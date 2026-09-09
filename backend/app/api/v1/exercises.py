from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.core.db import get_db
from app.core.dependencies import get_current_active_user, require_roles
from app.models import Exercise
from app.schemas.exercise import ExerciseCreate, ExerciseUpdate, ExerciseResponse
from app.core.audit import AuditService

router = APIRouter()

@router.post("/exercises", response_model=ExerciseResponse, status_code=status.HTTP_201_CREATED)
async def create_exercise(exercise_in: ExerciseCreate, current_user=Depends(require_roles("CLINICIAN", "ADMIN")), db: AsyncSession = Depends(get_db)):
    exercise = Exercise(**exercise_in.model_dump())
    db.add(exercise)
    await db.flush()
    await db.refresh(exercise)
    audit = AuditService(db)
    await audit.log(action="create", resource_type="exercise", result="success", user=current_user, resource_id=str(exercise.id))
    await db.commit()
    return exercise

@router.get("/exercises", response_model=list[ExerciseResponse])
async def list_exercises(current_user=Depends(get_current_active_user), db: AsyncSession = Depends(get_db), skip: int = 0, limit: int = 100):
    result = await db.execute(select(Exercise).offset(skip).limit(limit))
    return result.scalars().all()

@router.get("/exercises/{exercise_id}", response_model=ExerciseResponse)
async def get_exercise(exercise_id: str, current_user=Depends(get_current_active_user), db: AsyncSession = Depends(get_db)):
    exercise = await db.get(Exercise, exercise_id)
    if not exercise:
        raise HTTPException(status_code=404, detail="Exercise not found")
    return exercise

@router.patch("/exercises/{exercise_id}", response_model=ExerciseResponse)
async def update_exercise(exercise_id: str, exercise_update: ExerciseUpdate, current_user=Depends(require_roles("CLINICIAN", "ADMIN")), db: AsyncSession = Depends(get_db)):
    exercise = await db.get(Exercise, exercise_id)
    if not exercise:
        raise HTTPException(status_code=404, detail="Exercise not found")
    for field, value in exercise_update.model_dump(exclude_unset=True).items():
        setattr(exercise, field, value)
    await db.flush()
    await db.refresh(exercise)
    audit = AuditService(db)
    await audit.log(action="update", resource_type="exercise", result="success", user=current_user, resource_id=exercise_id)
    await db.commit()
    return exercise
