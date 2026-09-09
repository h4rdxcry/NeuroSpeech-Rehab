from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.core.db import get_db
from app.core.dependencies import get_current_active_user, require_roles
from app.models import EvaluationRun, ModelVersion
from app.schemas.evaluation_run import EvaluationRunCreate, EvaluationRunUpdate, EvaluationRunResponse
from app.core.audit import AuditService

router = APIRouter()

@router.post("/evaluation-runs", response_model=EvaluationRunResponse, status_code=status.HTTP_201_CREATED)
async def create_evaluation_run(run_in: EvaluationRunCreate, current_user=Depends(require_roles("RESEARCHER", "ADMIN")), db: AsyncSession = Depends(get_db)):
    model = await db.get(ModelVersion, run_in.model_version_id)
    if not model:
        raise HTTPException(status_code=404, detail="Model version not found")
    run = EvaluationRun(**run_in.model_dump())
    db.add(run)
    await db.flush()
    await db.refresh(run)
    audit = AuditService(db)
    await audit.log(action="create", resource_type="evaluation_run", result="success", user=current_user, resource_id=str(run.id))
    await db.commit()
    return run

@router.get("/evaluation-runs", response_model=list[EvaluationRunResponse])
async def list_evaluation_runs(current_user=Depends(get_current_active_user), db: AsyncSession = Depends(get_db), skip: int = 0, limit: int = 100):
    result = await db.execute(select(EvaluationRun).offset(skip).limit(limit))
    return result.scalars().all()

@router.get("/evaluation-runs/{run_id}", response_model=EvaluationRunResponse)
async def get_evaluation_run(run_id: UUID, current_user=Depends(get_current_active_user), db: AsyncSession = Depends(get_db)):
    run = await db.get(EvaluationRun, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Evaluation run not found")
    return run

@router.patch("/evaluation-runs/{run_id}", response_model=EvaluationRunResponse)
async def update_evaluation_run(run_id: UUID, run_update: EvaluationRunUpdate, current_user=Depends(require_roles("RESEARCHER", "ADMIN")), db: AsyncSession = Depends(get_db)):
    run = await db.get(EvaluationRun, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Evaluation run not found")
    for field, value in run_update.model_dump(exclude_unset=True).items():
        setattr(run, field, value)
    await db.flush()
    await db.refresh(run)
    audit = AuditService(db)
    await audit.log(action="update", resource_type="evaluation_run", result="success", user=current_user, resource_id=str(run_id))
    await db.commit()
    return run
