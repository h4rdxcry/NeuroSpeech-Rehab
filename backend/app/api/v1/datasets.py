from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from uuid import UUID
from app.core.db import get_db
from app.core.dependencies import get_current_active_user, require_roles
from app.models import Dataset, User
from app.schemas.dataset import DatasetCreate, DatasetUpdate, DatasetResponse
from app.core.audit import AuditService

router = APIRouter()

def _check_locked(dataset: Dataset):
    if dataset.is_locked:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Dataset is locked and cannot be modified")

@router.post("/datasets", response_model=DatasetResponse, status_code=status.HTTP_201_CREATED)
async def create_dataset(dataset_in: DatasetCreate, current_user=Depends(require_roles("RESEARCHER", "ADMIN")), db: AsyncSession = Depends(get_db)):
    dataset = Dataset(**dataset_in.model_dump(), created_by=current_user.id)
    db.add(dataset)
    await db.flush()
    await db.refresh(dataset)
    audit = AuditService(db)
    await audit.log(action="create", resource_type="dataset", result="success", user=current_user, resource_id=str(dataset.id))
    await db.commit()
    return dataset

@router.get("/datasets", response_model=list[DatasetResponse])
async def list_datasets(current_user=Depends(get_current_active_user), db: AsyncSession = Depends(get_db), skip: int = 0, limit: int = 100):
    result = await db.execute(select(Dataset).offset(skip).limit(limit))
    return result.scalars().all()

@router.get("/datasets/{dataset_id}", response_model=DatasetResponse)
async def get_dataset(dataset_id: str, current_user=Depends(get_current_active_user), db: AsyncSession = Depends(get_db)):
    dataset = await db.get(Dataset, UUID(dataset_id))
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    return dataset

@router.patch("/datasets/{dataset_id}", response_model=DatasetResponse)
async def update_dataset(dataset_id: str, dataset_update: DatasetUpdate, current_user=Depends(require_roles("RESEARCHER", "ADMIN")), db: AsyncSession = Depends(get_db)):
    dataset = await db.get(Dataset, UUID(dataset_id))
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    _check_locked(dataset)
    if dataset.data_classification == "REAL" and dataset_update.data_classification and dataset_update.data_classification != "REAL":
        raise HTTPException(status_code=400, detail="REAL datasets cannot be reclassified as SYNTHETIC or DEMO")
    for field, value in dataset_update.model_dump(exclude_unset=True).items():
        setattr(dataset, field, value)
    await db.flush()
    await db.refresh(dataset)
    audit = AuditService(db)
    await audit.log(action="update", resource_type="dataset", result="success", user=current_user, resource_id=dataset_id)
    await db.commit()
    return dataset

@router.post("/datasets/{dataset_id}/lock", response_model=DatasetResponse)
async def lock_dataset(dataset_id: str, current_user=Depends(require_roles("RESEARCHER", "ADMIN")), db: AsyncSession = Depends(get_db)):
    dataset = await db.get(Dataset, UUID(dataset_id))
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    dataset.is_locked = True
    await db.flush()
    await db.refresh(dataset)
    audit = AuditService(db)
    await audit.log(action="lock", resource_type="dataset", result="success", user=current_user, resource_id=dataset_id)
    await db.commit()
    return dataset
