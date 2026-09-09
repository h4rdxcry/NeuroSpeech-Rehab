from typing import Dict, Any, Optional
import asyncio
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from uuid import UUID
from datetime import datetime
import os
import wave

from app.core.db import get_db
from app.core.dependencies import get_current_active_user, require_roles
from app.models import User, Prediction, Attempt, Recording, SignalQuality, ModelVersion, Session, SessionExercise, Patient
from app.schemas.prediction import PredictionCreate, PredictionUpdate, PredictionResponse
from app.core.audit import AuditService
from app.services.asr import TamilASRInference, ASRInferenceError
from app.services.test_isolation import is_final_test_session
from app.core.ownership import assert_prediction_access

router = APIRouter()


def _validate_wav_metadata(file_path: str) -> Dict[str, Any]:
    if not file_path or not isinstance(file_path, str):
        raise HTTPException(status_code=400, detail="Recording file_path is required")
    if not os.path.exists(file_path):
        raise HTTPException(status_code=400, detail=f"Recording file not found: {file_path}")
    if not os.path.isfile(file_path):
        raise HTTPException(status_code=400, detail=f"Recording path is not a file: {file_path}")
    try:
        with wave.open(file_path, "rb") as wav_file:
            frames = wav_file.getnframes()
            rate = wav_file.getframerate()
            channels = wav_file.getnchannels()
            sample_width = wav_file.getsampwidth()
            if rate != 16000 or channels != 1 or sample_width != 2:
                raise HTTPException(
                    status_code=400,
                    detail=f"WAV must be 16 kHz mono 16-bit; got {rate} Hz / {channels} ch / {sample_width*8}-bit",
                )
            if frames <= 0:
                raise HTTPException(status_code=400, detail="WAV file contains no audio frames")
            duration = frames / float(rate)
            return {
                "sample_rate": rate,
                "channels": channels,
                "sample_width_bytes": sample_width,
                "frames": frames,
                "duration_seconds": round(duration, 3),
            }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid WAV file: {exc}") from exc


async def _validate_recording_ownership(recording_id: UUID, attempt_id: UUID, db: AsyncSession) -> Recording:
    recording = await db.get(Recording, recording_id)
    if not recording:
        raise HTTPException(status_code=404, detail="Recording not found")
    if recording.attempt_id is not None and recording.attempt_id != attempt_id:
        raise HTTPException(400, "Recording belongs to a different attempt")
    session = await db.get(Session, recording.session_id)
    if not session:
        raise HTTPException(status_code=400, detail="Recording session not found")
    if await is_final_test_session(db, session):
        raise HTTPException(409, "Locked final test data requires the explicit final-test command")
    attempt = await db.get(Attempt, attempt_id)
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")
    session_exercise = await db.get(SessionExercise, attempt.session_exercise_id)
    if not session_exercise or session_exercise.session_id != session.id:
        raise HTTPException(
            status_code=400,
            detail="Recording does not belong to the requested attempt/session chain",
        )
    return recording


async def _get_signal_quality(recording_id: UUID, db: AsyncSession) -> SignalQuality:
    result = await db.execute(
        select(SignalQuality).where(SignalQuality.recording_id == recording_id)
    )
    sq = result.scalar_one_or_none()
    if not sq:
        raise HTTPException(
            status_code=400,
            detail="ASR inference requires SignalQuality record; none found for recording",
        )
    if sq.quality_state not in ("GOOD", "ACCEPTABLE"):
        raise HTTPException(
            status_code=400,
            detail=f"ASR inference requires signal quality GOOD or ACCEPTABLE; got {sq.quality_state}",
        )
    return sq


async def _check_idempotent_prediction(attempt_id: UUID, recording_id: UUID, model_id: UUID, prediction_type: str, db: AsyncSession) -> Optional[Prediction]:
    result = await db.execute(
        select(Prediction).where(
            Prediction.attempt_id == attempt_id,
            Prediction.recording_id == recording_id,
            Prediction.model_id == model_id,
            Prediction.prediction_type == prediction_type,
        )
    )
    return result.scalar_one_or_none()


@router.post("/predictions", response_model=PredictionResponse, status_code=status.HTTP_201_CREATED)
async def create_prediction(
    prediction_in: PredictionCreate,
    current_user: User = Depends(require_roles("RESEARCHER", "CLINICIAN", "ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    attempt = await db.get(Attempt, prediction_in.attempt_id)
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")
    if prediction_in.recording_id:
        recording = await db.get(Recording, prediction_in.recording_id)
        if not recording:
            raise HTTPException(status_code=404, detail="Recording not found")
    model = await db.get(ModelVersion, prediction_in.model_id)
    if not model:
        raise HTTPException(status_code=404, detail="Model version not found")
    prediction = Prediction(**prediction_in.model_dump())
    db.add(prediction)
    await db.flush()
    await db.refresh(prediction)
    audit = AuditService(db)
    await audit.log(
        action="create",
        resource_type="prediction",
        result="success",
        user=current_user,
        resource_id=str(prediction.id),
    )
    await db.commit()
    return prediction


@router.get("/predictions", response_model=list[PredictionResponse])
async def list_predictions(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    attempt_id: str = None,
    model_id: str = None,
    skip: int = 0,
    limit: int = 100,
):
    query = select(Prediction)
    if attempt_id:
        query = query.where(Prediction.attempt_id == UUID(attempt_id))
    if model_id:
        query = query.where(Prediction.model_id == UUID(model_id))
    if current_user.role.name == "PATIENT":
        query = (
            query.join(Attempt, Prediction.attempt_id == Attempt.id)
            .join(SessionExercise, Attempt.session_exercise_id == SessionExercise.id)
            .join(Session, Session.id == SessionExercise.session_id)
            .join(Patient, Session.patient_id == Patient.id)
            .where(Patient.user_id == current_user.id)
        )
    result = await db.execute(query.offset(skip).limit(limit))
    return result.scalars().all()


@router.get("/predictions/{prediction_id}", response_model=PredictionResponse)
async def get_prediction(
    prediction_id: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    prediction = await db.get(Prediction, UUID(prediction_id))
    if not prediction:
        raise HTTPException(status_code=404, detail="Prediction not found")
    await assert_prediction_access(prediction, current_user, db)
    return prediction


@router.patch("/predictions/{prediction_id}", response_model=PredictionResponse)
async def update_prediction(
    prediction_id: str,
    prediction_update: PredictionUpdate,
    current_user: User = Depends(require_roles("RESEARCHER", "CLINICIAN", "ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    prediction = await db.get(Prediction, UUID(prediction_id))
    if not prediction:
        raise HTTPException(status_code=404, detail="Prediction not found")
    for field, value in prediction_update.model_dump(exclude_unset=True).items():
        setattr(prediction, field, value)
    await db.flush()
    await db.refresh(prediction)
    audit = AuditService(db)
    await audit.log(
        action="update",
        resource_type="prediction",
        result="success",
        user=current_user,
        resource_id=prediction_id,
    )
    await db.commit()
    return prediction


@router.post("/predictions/run-asr", response_model=PredictionResponse, status_code=status.HTTP_201_CREATED)
async def run_asr_inference(
    attempt_id: UUID,
    recording_id: UUID,
    current_user: User = Depends(require_roles("RESEARCHER", "ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    attempt = await db.get(Attempt, attempt_id)
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")

    await _validate_recording_ownership(recording_id, attempt_id, db)
    recording = await db.get(Recording, recording_id)
    if recording.modality != "AUDIO":
        raise HTTPException(status_code=400, detail="ASR inference requires AUDIO modality recording")

    _validate_wav_metadata(recording.file_path)
    sq = await _get_signal_quality(recording_id, db)

    production_model = await db.execute(
        select(ModelVersion).where(ModelVersion.is_production.is_(True), ModelVersion.model_type == "asr").limit(1)
    )
    production_model = production_model.scalar_one_or_none()
    if not production_model:
        raise HTTPException(status_code=404, detail="No production ASR model registered")

    existing = await _check_idempotent_prediction(attempt_id, recording_id, production_model.id, "asr_transcript", db)
    if existing:
        return existing

    prediction = Prediction(
        attempt_id=attempt_id,
        recording_id=recording_id,
        model_id=production_model.id,
        model_version=production_model.version,
        feature_pipeline_version=production_model.feature_pipeline_version,
        training_dataset_version=production_model.training_dataset_version,
        prediction_type="asr_transcript",
        predicted_label="",
        signal_quality_state=sq.quality_state,
        signal_quality_details=sq.artifact_indicators,
        timestamp=datetime.utcnow(),
    )
    db.add(prediction)
    await db.flush()
    await db.refresh(prediction)

    try:
        asr = TamilASRInference.get_instance()
        await asr.load()
        result = await asyncio.to_thread(asr.run_inference, recording.file_path)
        prediction.predicted_label = result.transcript
        prediction.confidence = result.confidence
        prediction.prediction_json = {
            "transcript": result.transcript,
            "model_name": result.model_name,
            "model_version": result.model_version,
            "model_scope": result.model_scope,
            "notes": result.notes,
            "feature_pipeline_version": result.feature_pipeline_version,
            "training_dataset_version": result.training_dataset_version,
            "prediction_type": result.prediction_type,
            "sample_rate": result.prediction_json.get("sample_rate"),
            "audio_duration_seconds": result.prediction_json.get("audio_duration_seconds"),
        }
    except ASRInferenceError as exc:
        await db.rollback()
        raise HTTPException(503, "ASR inference unavailable") from exc
    except Exception as exc:
        await db.rollback()
        raise HTTPException(503, "ASR inference failed") from exc

    await db.flush()
    await db.refresh(prediction)

    audit = AuditService(db)
    await audit.log(
        action="run_asr_inference",
        resource_type="prediction",
        result="success",
        user=current_user,
        resource_id=str(prediction.id),
    )
    await db.commit()
    return prediction

