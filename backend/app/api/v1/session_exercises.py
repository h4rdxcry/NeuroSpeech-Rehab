from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from uuid import UUID, uuid4
from app.core.db import get_db
from app.core.dependencies import get_current_active_user, require_roles
from app.models import User, SessionExercise, Session, Exercise, Patient
from app.schemas.session_detail import SessionExerciseCreate, SessionExerciseUpdate, SessionExerciseResponse
from app.core.audit import AuditService
from app.core.ownership import assert_session_access, assert_session_exercise_access, assert_patient_session_writable

router = APIRouter()


@router.post("/session-exercises", response_model=SessionExerciseResponse, status_code=status.HTTP_201_CREATED)
async def create_session_exercise(
    session_exercise_in: SessionExerciseCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    session = await db.get(Session, session_exercise_in.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    await assert_session_access(session, current_user, db)
    await assert_patient_session_writable(session, current_user, db)
    exercise = await db.get(Exercise, session_exercise_in.exercise_id)
    if not exercise:
        raise HTTPException(status_code=404, detail="Exercise not found")
    session_exercise = SessionExercise(**session_exercise_in.model_dump())
    db.add(session_exercise)
    await db.flush()
    await db.refresh(session_exercise)
    audit = AuditService(db)
    await audit.log(
        action="create",
        resource_type="session_exercise",
        result="success",
        user=current_user,
        resource_id=str(session_exercise.id),
    )
    await db.commit()
    return session_exercise


@router.get("/session-exercises", response_model=list[SessionExerciseResponse])
async def list_session_exercises(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    session_id: str = None,
    skip: int = 0,
    limit: int = 100,
):
    query = select(SessionExercise)
    if session_id:
        query = query.where(SessionExercise.session_id == session_id)
    if current_user.role.name == "PATIENT":
        # Filter through the owning patient's sessions without exposing any
        # other participant's exercise assignments.
        result = await db.execute(
            select(Session.id)
            .join(Patient, Session.patient_id == Patient.id)
            .where(Patient.user_id == current_user.id)
        )
        owned_session_ids = [row[0] for row in result.all()]
        if not owned_session_ids:
            return []
        query = query.where(SessionExercise.session_id.in_(owned_session_ids))
    result = await db.execute(query.offset(skip).limit(limit))
    return result.scalars().all()


@router.get("/session-exercises/{session_exercise_id}", response_model=SessionExerciseResponse)
async def get_session_exercise(
    session_exercise_id: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    session_exercise = await db.get(SessionExercise, UUID(session_exercise_id))
    if not session_exercise:
        raise HTTPException(status_code=404, detail="Session exercise not found")
    await assert_session_exercise_access(session_exercise, current_user, db)
    return session_exercise


@router.patch("/session-exercises/{session_exercise_id}", response_model=SessionExerciseResponse)
async def update_session_exercise(
    session_exercise_id: str,
    session_exercise_update: SessionExerciseUpdate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    session_exercise = await db.get(SessionExercise, UUID(session_exercise_id))
    if not session_exercise:
        raise HTTPException(status_code=404, detail="Session exercise not found")
    await assert_session_exercise_access(session_exercise, current_user, db)
    await assert_patient_session_writable(await db.get(Session, session_exercise.session_id), current_user, db)
    for field, value in session_exercise_update.model_dump(exclude_unset=True).items():
        setattr(session_exercise, field, value)
    await db.flush()
    await db.refresh(session_exercise)
    audit = AuditService(db)
    await audit.log(
        action="update",
        resource_type="session_exercise",
        result="success",
        user=current_user,
        resource_id=session_exercise_id,
    )
    await db.commit()
    return session_exercise


@router.delete("/session-exercises/{session_exercise_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_session_exercise(
    session_exercise_id: str,
    current_user: User = Depends(require_roles("ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    session_exercise = await db.get(SessionExercise, UUID(session_exercise_id))
    if not session_exercise:
        raise HTTPException(status_code=404, detail="Session exercise not found")
    await db.delete(session_exercise)
    audit = AuditService(db)
    await audit.log(
        action="delete",
        resource_type="session_exercise",
        result="success",
        user=current_user,
        resource_id=session_exercise_id,
    )
    await db.commit()
    return None
