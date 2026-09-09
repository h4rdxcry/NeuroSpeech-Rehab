"""Ownership checks for patient-facing research resources.

Staff roles keep the existing research access rules. Patients are limited to
the session chain belonging to the Patient row linked to their authenticated
user; callers must use these checks before returning or mutating a resource.
"""
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import User, Patient, Session, SessionExercise, Attempt, Recording, Prediction
from app.services.test_isolation import is_final_test_session


async def assert_session_access(session: Session, current_user: User, db: AsyncSession) -> None:
    if current_user.role.name != "PATIENT":
        return
    patient = await db.get(Patient, session.patient_id) if session.patient_id else None
    if not patient or not patient.is_active or patient.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Session access denied")


async def assert_patient_session_writable(session: Session, current_user: User, db: AsyncSession) -> None:
    """Keep ordinary patient activity out of the locked final-test cohort."""
    if current_user.role.name == "PATIENT" and await is_final_test_session(db, session):
        raise HTTPException(status_code=403, detail="Locked final-test sessions cannot be changed by patient activity")


async def assert_session_exercise_access(item: SessionExercise, current_user: User, db: AsyncSession) -> None:
    session = await db.get(Session, item.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    await assert_session_access(session, current_user, db)


async def assert_attempt_access(attempt: Attempt, current_user: User, db: AsyncSession) -> None:
    session_exercise = await db.get(SessionExercise, attempt.session_exercise_id)
    if not session_exercise:
        raise HTTPException(status_code=404, detail="Session exercise not found")
    await assert_session_exercise_access(session_exercise, current_user, db)


async def assert_recording_access(recording: Recording, current_user: User, db: AsyncSession) -> None:
    session = await db.get(Session, recording.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    await assert_session_access(session, current_user, db)


async def assert_prediction_access(prediction: Prediction, current_user: User, db: AsyncSession) -> None:
    attempt = await db.get(Attempt, prediction.attempt_id)
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")
    await assert_attempt_access(attempt, current_user, db)
