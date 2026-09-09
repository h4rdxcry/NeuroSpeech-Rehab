from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.core.db import get_db
from app.core.dependencies import get_current_active_user, require_roles
from app.models import ModelVersion
from app.schemas.model_version import ModelVersionCreate, ModelVersionUpdate, ModelVersionResponse
from app.core.audit import AuditService

router = APIRouter()

@router.post("/model-versions", response_model=ModelVersionResponse, status_code=status.HTTP_201_CREATED)
async def create_model_version(model_in: ModelVersionCreate, current_user=Depends(require_roles("RESEARCHER", "ADMIN")), db: AsyncSession = Depends(get_db)):
    model = ModelVersion(**model_in.model_dump(), registered_by=current_user.id)
    db.add(model)
    await db.flush()
    await db.refresh(model)
    audit = AuditService(db)
    await audit.log(action="create", resource_type="model_version", result="success", user=current_user, resource_id=str(model.id))
    await db.commit()
    return model

@router.get("/model-versions", response_model=list[ModelVersionResponse])
async def list_model_versions(current_user=Depends(get_current_active_user), db: AsyncSession = Depends(get_db), skip: int = 0, limit: int = 100):
    result = await db.execute(select(ModelVersion).offset(skip).limit(limit))
    return result.scalars().all()

@router.get("/model-versions/{model_id}", response_model=ModelVersionResponse)
async def get_model_version(model_id: str, current_user=Depends(get_current_active_user), db: AsyncSession = Depends(get_db)):
    model = await db.get(ModelVersion, model_id)
    if not model:
        raise HTTPException(status_code=404, detail="Model version not found")
    return model

@router.patch("/model-versions/{model_id}", response_model=ModelVersionResponse)
async def update_model_version(model_id: str, model_update: ModelVersionUpdate, current_user=Depends(require_roles("RESEARCHER", "ADMIN")), db: AsyncSession = Depends(get_db)):
    model = await db.get(ModelVersion, model_id)
    if not model:
        raise HTTPException(status_code=404, detail="Model version not found")
    for field, value in model_update.model_dump(exclude_unset=True).items():
        setattr(model, field, value)
    await db.flush()
    await db.refresh(model)
    audit = AuditService(db)
    await audit.log(action="update", resource_type="model_version", result="success", user=current_user, resource_id=model_id)
    await db.commit()
    return model
