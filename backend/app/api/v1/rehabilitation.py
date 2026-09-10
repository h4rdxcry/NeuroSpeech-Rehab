"""Rehabilitation API: Authoritative 100-Level Patient Journey & Speech Attempt Evaluation."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from datetime import date, datetime
from uuid import UUID
from typing import List, Optional

from app.core.db import get_db
from app.core.dependencies import get_current_active_user, require_roles
from app.models import User, Patient, Session
from app.models.rehabilitation import PatientRehabProgress, PatientLevelAttempt
from app.schemas.rehabilitation import (
    PatientRehabProgressResponse,
    AttemptSubmissionRequest,
    AttemptEvaluationResponse,
    RehabLevelSchema,
)
from app.services.clinical_rehab_service import ClinicalRehabService

router = APIRouter()
_rehab_service = ClinicalRehabService()


async def _get_or_create_patient_progress(
    user: User,
    db: AsyncSession,
    patient_id: Optional[UUID] = None,
) -> tuple[Patient, PatientRehabProgress]:
    """Retrieves or initializes the authoritative PatientRehabProgress record."""
    if user.role.name == "PATIENT":
        result = await db.execute(select(Patient).where(Patient.user_id == user.id))
        patient = result.scalar_one_or_none()
        if not patient:
            # Auto-create patient profile if missing for registered patient user
            patient = Patient(user_id=user.id)
            db.add(patient)
            await db.flush()
            await db.refresh(patient)
    elif patient_id:
        patient = await db.get(Patient, patient_id)
        if not patient:
            raise HTTPException(status_code=404, detail="Patient not found")
    else:
        # For clinician/researcher without specific patient, pick first active patient or create demo
        result = await db.execute(select(Patient))
        patient = result.scalars().first()
        if not patient:
            patient = Patient(user_id=user.id)
            db.add(patient)
            await db.flush()
            await db.refresh(patient)

    # Fetch progress
    result = await db.execute(
        select(PatientRehabProgress).where(PatientRehabProgress.patient_id == patient.id)
    )
    progress = result.scalar_one_or_none()
    if not progress:
        progress = PatientRehabProgress(
            patient_id=patient.id,
            current_level=1,
            highest_unlocked_level=1,
            completed_levels=[],
            streak_count=0,
            longest_streak=0,
            last_practice_date=None,
        )
        db.add(progress)
        await db.flush()
        await db.refresh(progress)

    return patient, progress


@router.get("/progress", response_model=PatientRehabProgressResponse)
async def get_progress(
    patient_id: Optional[UUID] = None,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Fetches the authoritative persistent rehabilitation progress for the patient."""
    _, progress = await _get_or_create_patient_progress(current_user, db, patient_id)
    await db.commit()
    return progress


@router.post("/attempt", response_model=AttemptEvaluationResponse)
async def submit_attempt(
    payload: AttemptSubmissionRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Evaluates a pronunciation attempt against clinical targets and updates persistent level progress.

    ZERO FAKE FUNCTIONALITY: Requires legitimate transcript match or acoustic evaluation.
    Volume alone or duration without target match will NEVER pass the exercise.
    """
    patient, progress = await _get_or_create_patient_progress(current_user, db)

    # Validate transcript
    raw_transcript = (payload.recognized_transcript or "").strip()
    speech_detected = len(raw_transcript) > 0

    # Evaluate attempt through ClinicalRehabService
    eval_result = _rehab_service.evaluate_attempt(
        target_phrase=payload.target_text,
        recognized_transcript=raw_transcript,
        lip_aperture_ratio=payload.lip_aperture_ratio,
        mouth_width_ratio=payload.mouth_width_ratio,
        target_vowel_type=payload.target_vowel_type,
        landmarks_sequence=payload.landmarks_sequence,
        mouth_frames_sequence=payload.mouth_frames_sequence,
    )

    rehab_summary = eval_result.get("rehab_summary", {})
    acoustic_eval = eval_result.get("acoustic_eval", {})
    match_score = float(acoustic_eval.get("target_match_ratio", 0.0))

    # Success criteria: Valid transcript with target match ratio >= 0.45
    # Audio energy without transcript cannot pass!
    is_success = bool(speech_detected and match_score >= 0.45)

    feedback_message = (
        "Speech detected clearly and exercise completed!"
        if is_success
        else (
            "We detected your voice, but the pronunciation differed from the target. Please try again."
            if speech_detected
            else "No clear speech detected. Please speak into the microphone and pronounce the target."
        )
    )

    actionable_tip = None
    if not is_success:
        actionable_tip = (
            "Listen to the target audio and repeat slowly, focusing on mouth shaping."
            if payload.language == "ta-IN"
            else "Pronounce each syllable distinctly at a comfortable pace."
        )

    # Update persistent level progress upon verified success
    today = date.today()
    completed_list = list(progress.completed_levels or [])

    if is_success:
        if payload.level_number not in completed_list:
            completed_list.append(payload.level_number)
            progress.completed_levels = sorted(completed_list)
            progress.highest_unlocked_level = max(
                progress.highest_unlocked_level,
                min(100, payload.level_number + 1),
            )
            if progress.current_level == payload.level_number:
                progress.current_level = min(100, payload.level_number + 1)

        # Update practice streak
        if progress.last_practice_date != today:
            if progress.last_practice_date is not None:
                days_diff = (today - progress.last_practice_date).days
                if days_diff == 1:
                    progress.streak_count += 1
                elif days_diff > 1:
                    progress.streak_count = 1
            else:
                progress.streak_count = 1
            progress.last_practice_date = today
            progress.longest_streak = max(progress.longest_streak, progress.streak_count)

    # Persist attempt record
    attempt_record = PatientLevelAttempt(
        patient_id=patient.id,
        session_id=payload.session_id,
        level_number=payload.level_number,
        target_text=payload.target_text,
        language=payload.language,
        transcript=raw_transcript if speech_detected else None,
        speech_detected=speech_detected,
        match_score=round(match_score, 4),
        is_success=is_success,
        metrics=eval_result,
    )
    db.add(attempt_record)
    await db.flush()
    await db.refresh(attempt_record)
    await db.commit()

    return AttemptEvaluationResponse(
        attempt_id=attempt_record.id,
        level_number=payload.level_number,
        target_text=payload.target_text,
        language=payload.language,
        transcript=raw_transcript if speech_detected else None,
        speech_detected=speech_detected,
        match_score=round(match_score, 4),
        is_success=is_success,
        feedback_message=feedback_message,
        actionable_tip=actionable_tip,
        current_level=progress.current_level,
        highest_unlocked_level=progress.highest_unlocked_level,
        completed_levels=progress.completed_levels,
        streak_count=progress.streak_count,
        rehab_summary=rehab_summary,
    )


@router.post("/reset-progress", response_model=PatientRehabProgressResponse)
async def reset_progress(
    patient_id: Optional[UUID] = None,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Resets patient progress back to Level 1 (for re-training or testing)."""
    _, progress = await _get_or_create_patient_progress(current_user, db, patient_id)
    progress.current_level = 1
    progress.highest_unlocked_level = 1
    progress.completed_levels = []
    await db.commit()
    await db.refresh(progress)
    return progress
