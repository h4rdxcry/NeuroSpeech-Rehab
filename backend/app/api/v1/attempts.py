from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from uuid import UUID
from app.core.db import get_db
from app.core.dependencies import get_current_active_user, require_roles
from app.models import User, Attempt, SessionExercise, Session, Patient
from app.schemas.session_detail import AttemptCreate, AttemptUpdate, AttemptResponse
from app.core.audit import AuditService
from app.core.ownership import assert_session_exercise_access, assert_attempt_access, assert_patient_session_writable

router = APIRouter()


@router.post("/attempts", response_model=AttemptResponse, status_code=status.HTTP_201_CREATED)
async def create_attempt(
    attempt_in: AttemptCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    session_exercise = await db.get(SessionExercise, attempt_in.session_exercise_id)
    if not session_exercise:
        raise HTTPException(status_code=404, detail="Session exercise not found")
    await assert_session_exercise_access(session_exercise, current_user, db)
    await assert_patient_session_writable(await db.get(Session, session_exercise.session_id), current_user, db)
    if current_user.role.name == "PATIENT" and {"outcome", "clinician_rating"} & attempt_in.model_fields_set:
        raise HTTPException(status_code=403, detail="Patients cannot supply clinical outcomes or clinician ratings")
    attempt = Attempt(**attempt_in.model_dump())
    db.add(attempt)
    await db.flush()
    await db.refresh(attempt)
    audit = AuditService(db)
    await audit.log(
        action="create",
        resource_type="attempt",
        result="success",
        user=current_user,
        resource_id=str(attempt.id),
    )
    await db.commit()
    return attempt


@router.get("/attempts", response_model=list[AttemptResponse])
async def list_attempts(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    session_exercise_id: str = None,
    skip: int = 0,
    limit: int = 100,
):
    query = select(Attempt)
    if session_exercise_id:
        query = query.where(Attempt.session_exercise_id == UUID(session_exercise_id))
    if current_user.role.name == "PATIENT":
        query = (query
            .join(SessionExercise, Attempt.session_exercise_id == SessionExercise.id)
            .join(Session, Session.id == SessionExercise.session_id)
            .join(Patient, Session.patient_id == Patient.id)
            .where(Patient.user_id == current_user.id)
        )
    result = await db.execute(query.offset(skip).limit(limit))
    return result.scalars().all()


@router.get("/attempts/{attempt_id}", response_model=AttemptResponse)
async def get_attempt(
    attempt_id: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    attempt = await db.get(Attempt, UUID(attempt_id))
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")
    await assert_attempt_access(attempt, current_user, db)
    return attempt


@router.patch("/attempts/{attempt_id}", response_model=AttemptResponse)
async def update_attempt(
    attempt_id: str,
    attempt_update: AttemptUpdate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    attempt = await db.get(Attempt, UUID(attempt_id))
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")
    await assert_attempt_access(attempt, current_user, db)
    if current_user.role.name == "PATIENT":
        session_exercise = await db.get(SessionExercise, attempt.session_exercise_id)
        await assert_patient_session_writable(await db.get(Session, session_exercise.session_id), current_user, db)
        disallowed = set(attempt_update.model_dump(exclude_unset=True)) - {"ended_at", "notes"}
        if disallowed:
            raise HTTPException(status_code=403, detail="Patients may only update attempt timing and notes")
    for field, value in attempt_update.model_dump(exclude_unset=True).items():
        setattr(attempt, field, value)
    await db.flush()
    await db.refresh(attempt)
    audit = AuditService(db)
    await audit.log(
        action="update",
        resource_type="attempt",
        result="success",
        user=current_user,
        resource_id=attempt_id,
    )
    await db.commit()
    return attempt


@router.delete("/attempts/{attempt_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_attempt(
    attempt_id: str,
    current_user: User = Depends(require_roles("ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    attempt = await db.get(Attempt, UUID(attempt_id))
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")
    await db.delete(attempt)
    audit = AuditService(db)
    await audit.log(
        action="delete",
        resource_type="attempt",
        result="success",
        user=current_user,
        resource_id=attempt_id,
    )
    await db.commit()
    return None
