"""Bounded, authenticated ingestion of real research sensor samples."""
import asyncio
import hashlib
import json
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, ConfigDict
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.db import get_db
from app.core.dependencies import require_roles, get_current_active_user
from app.core.audit import AuditService
from app.models import Recording, SignalQuality, Attempt, SessionExercise, Session
from app.models.feature import FeatureRecord
from app.services.signal_processing import process_biosignal, facial_features, synchronize, prepare_fusion
from app.services.test_isolation import is_final_test_session

router = APIRouter()
staff = require_roles("RESEARCHER", "CLINICIAN", "ADMIN")
STORAGE_ROOT = Path(os.environ.get("NEUROSPEECH_RECORDING_ROOT", str(Path(__file__).resolve().parents[4] / "recordings")))


class CameraFrame(BaseModel):
    image_base64: str = Field(min_length=1, max_length=6_000_000)


@router.post("/camera/track-frame")
async def camera_frame(payload: CameraFrame, user=Depends(get_current_active_user)):
    from app.services.camera import track_frame, TrackerUnavailable
    try:
        return await asyncio.to_thread(track_frame, payload.image_base64)
    except TrackerUnavailable as exc:
        raise HTTPException(503, str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc


class SignalInput(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)
    session_id: uuid.UUID
    attempt_id: uuid.UUID
    modality: Literal["EEG", "EMG"]
    device_id: str = Field(min_length=1, max_length=255)
    sample_rate: float = Field(gt=0, le=10000)
    units: Literal["V", "mV", "uV"]
    channel_names: list[str] = Field(min_length=1, max_length=64)
    samples: list[list[float]] = Field(min_length=2, max_length=120000)
    started_at: datetime
    clock_id: str = Field(min_length=1, max_length=255)
    is_synthetic: bool = False


class FaceInput(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)
    session_id: uuid.UUID
    attempt_id: uuid.UUID
    device_id: str = Field(min_length=1, max_length=255)
    landmarks: list[list[float]] = Field(min_length=468, max_length=478)
    captured_at: datetime
    clock_id: str = Field(min_length=1, max_length=255)
    tracker_version: str = Field(min_length=1, max_length=255)
    is_synthetic: bool = False


async def validate_chain(db, session_id, attempt_id):
    session = await db.get(Session, session_id)
    attempt = await db.get(Attempt, attempt_id)
    se = await db.get(SessionExercise, attempt.session_exercise_id) if attempt else None
    if not session or not se or se.session_id != session_id:
        raise HTTPException(404, "Session/attempt chain not found")
    if await is_final_test_session(db, session):
        raise HTTPException(409, "Locked final test sessions cannot be processed through this API")
    return se


def store_source(recording_id, payload):
    data = json.dumps(payload, allow_nan=False, sort_keys=True, separators=(",", ":")).encode()
    STORAGE_ROOT.mkdir(parents=True, exist_ok=True)
    path = STORAGE_ROOT / (str(recording_id) + ".json")
    with path.open("xb") as f:
        f.write(data)
    return str(path), hashlib.sha256(data).hexdigest()


async def persist(db, user, payload, result, modality, timestamp, se):
    from app.core.config import get_settings
    if payload.is_synthetic and get_settings().ENVIRONMENT != "test":
        raise HTTPException(422, "Synthetic sensor input is permitted only in automated tests")
    if timestamp.tzinfo is None or timestamp.utcoffset() is None:
        raise HTTPException(422, "Capture timestamp must include timezone")
    recording_id = uuid.uuid4()
    path, digest = await asyncio.to_thread(store_source, recording_id, payload.model_dump(mode="json"))
    recording = Recording(id=recording_id, session_id=payload.session_id, attempt_id=payload.attempt_id,
                          session_exercise_id=se.id, modality=modality, device_id=payload.device_id,
                          file_path=path, file_format="json", start_timestamp=timestamp,
                          sampling_rate_hz=getattr(payload, "sample_rate", None),
                          channel_count=len(getattr(payload, "channel_names", [])) or None,
                          channel_names=getattr(payload, "channel_names", None),
                          units=getattr(payload, "units", "normalized_landmarks"),
                          duration_seconds=result.get("duration_seconds"),
                          synchronization_info={"clock_id": payload.clock_id},
                          is_synthetic=payload.is_synthetic, data_classification="SYNTHETIC" if payload.is_synthetic else "REAL", processing_status="completed")
    feature = FeatureRecord(recording_id=recording_id, pipeline_version=result["pipeline_version"], source_sha256=digest, result=result)
    try:
        db.add(recording)
        await db.flush()
        db.add(SignalQuality(recording_id=recording_id, quality_state=result["quality"]["state"],
                             artifact_indicators=result["quality"], qc_timestamp=datetime.now(timezone.utc)))
        db.add(feature)
        await db.flush()
        await AuditService(db).log("process_signal", "recording", "success", user, str(recording_id), metadata={"pipeline_version": result["pipeline_version"], "source_sha256": digest})
        await db.commit()
    except BaseException:
        await db.rollback()
        await asyncio.to_thread(Path(path).unlink, missing_ok=True)
        raise
    return {"recording_id": str(recording_id), "feature_id": str(feature.id), "source_sha256": digest, **result}


@router.post("/biosignals", status_code=201)
async def ingest_biosignal(payload: SignalInput, user=Depends(staff), db: AsyncSession = Depends(get_db)):
    se = await validate_chain(db, payload.session_id, payload.attempt_id)
    try:
        result = await asyncio.to_thread(process_biosignal, payload.samples, payload.sample_rate, payload.modality, payload.units, payload.channel_names)
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    return await persist(db, user, payload, result, payload.modality, payload.started_at, se)


@router.post("/facial-landmarks", status_code=201)
async def ingest_face(payload: FaceInput, user=Depends(staff), db: AsyncSession = Depends(get_db)):
    se = await validate_chain(db, payload.session_id, payload.attempt_id)
    try:
        result = await asyncio.to_thread(facial_features, payload.landmarks)
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    result["tracker_version"] = payload.tracker_version
    return await persist(db, user, payload, result, "VIDEO", payload.captured_at, se)


@router.get("/recordings/{recording_id}/features")
async def get_features(recording_id: uuid.UUID, user=Depends(staff), db: AsyncSession = Depends(get_db)):
    result = (await db.execute(select(FeatureRecord).where(FeatureRecord.recording_id == recording_id))).scalars().all()
    return [{"id": str(r.id), "source_sha256": r.source_sha256, "result": r.result} for r in result]


class FusionInput(BaseModel):
    feature_ids: list[uuid.UUID] = Field(min_length=1, max_length=4)


@router.post("/fusion/prepare")
async def fusion(payload: FusionInput, user=Depends(staff), db: AsyncSession = Depends(get_db)):
    processed, attempts = {}, set()
    for fid in payload.feature_ids:
        feature = await db.get(FeatureRecord, fid)
        recording = await db.get(Recording, feature.recording_id) if feature else None
        if not recording:
            raise HTTPException(404, "Feature not found")
        if recording.modality in processed:
            raise HTTPException(422, "Duplicate modality")
        attempts.add(recording.attempt_id)
        processed[recording.modality] = feature.result
    if len(attempts) != 1 or None in attempts:
        raise HTTPException(422, "Features must belong to the same attempt")
    try:
        result = await asyncio.to_thread(prepare_fusion, processed)
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    await AuditService(db).log("prepare_fusion", "features", "success", user, metadata={"feature_ids": [str(x) for x in payload.feature_ids], "status": result["status"]})
    await db.commit()
    return result


class SyncStream(BaseModel):
    modality: Literal["EEG", "EMG", "AUDIO", "VIDEO"]
    clock_id: str = Field(min_length=1)
    timestamps_seconds: list[float] = Field(min_length=2, max_length=120000)


class SyncInput(BaseModel):
    streams: list[SyncStream] = Field(min_length=2, max_length=4)
    tolerance_ms: float = Field(default=20, gt=0, le=1000)


@router.post("/synchronization/check")
async def check_sync(payload: SyncInput, user=Depends(staff)):
    try:
        return await asyncio.to_thread(synchronize, [s.model_dump() for s in payload.streams], payload.tolerance_ms)
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
