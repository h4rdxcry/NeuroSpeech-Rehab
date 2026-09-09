from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from uuid import UUID
from app.core.db import get_db
from app.core.dependencies import get_current_active_user, require_roles
from app.models import DatasetSplit, Dataset
from app.schemas.dataset_split import DatasetSplitCreate, DatasetSplitUpdate, DatasetSplitResponse
from app.core.audit import AuditService

router = APIRouter()

@router.post("/datasets/{dataset_id}/splits", response_model=DatasetSplitResponse, status_code=status.HTTP_201_CREATED)
async def create_split(dataset_id: str, split_in: DatasetSplitCreate, current_user=Depends(require_roles("RESEARCHER", "ADMIN")), db: AsyncSession = Depends(get_db)):
    dataset = await db.get(Dataset, UUID(dataset_id))
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    payload = split_in.model_dump(exclude={"dataset_id"})
    split = DatasetSplit(**payload, dataset_id=UUID(dataset_id))
    db.add(split)
    await db.flush()
    await db.refresh(split)
    audit = AuditService(db)
    await audit.log(action="create", resource_type="dataset_split", result="success", user=current_user, resource_id=str(split.id))
    await db.commit()
    return split

@router.get("/datasets/{dataset_id}/splits", response_model=list[DatasetSplitResponse])
async def list_splits(dataset_id: str, current_user=Depends(get_current_active_user), db: AsyncSession = Depends(get_db), split_type: str = Query(None), skip: int = 0, limit: int = 1000):
    query = select(DatasetSplit).where(DatasetSplit.dataset_id == UUID(dataset_id))
    if split_type:
        query = query.where(DatasetSplit.split_type == split_type)
    result = await db.execute(query.offset(skip).limit(limit))
    return result.scalars().all()

@router.patch("/datasets/{dataset_id}/splits/{split_id}", response_model=DatasetSplitResponse)
async def update_split(dataset_id: str, split_id: str, split_update: DatasetSplitUpdate, current_user=Depends(require_roles("RESEARCHER", "ADMIN")), db: AsyncSession = Depends(get_db)):
    split = await db.get(DatasetSplit, UUID(split_id))
    if not split or split.dataset_id != UUID(dataset_id):
        raise HTTPException(status_code=404, detail="Split not found")
    if split.is_locked:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Split is locked and cannot be modified")
    for field, value in split_update.model_dump(exclude_unset=True).items():
        setattr(split, field, value)
    await db.flush()
    await db.refresh(split)
    audit = AuditService(db)
    await audit.log(action="update", resource_type="dataset_split", result="success", user=current_user, resource_id=str(split.id))
    await db.commit()
    return split

@router.post("/datasets/{dataset_id}/splits/lock", response_model=dict)
async def lock_splits(dataset_id: str, current_user=Depends(require_roles("RESEARCHER", "ADMIN")), db: AsyncSession = Depends(get_db)):
    dataset = await db.get(Dataset, UUID(dataset_id))
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    result = await db.execute(select(DatasetSplit).where(DatasetSplit.dataset_id == UUID(dataset_id)))
    splits = result.scalars().all()
    for split in splits:
        split.is_locked = True
    await db.flush()
    audit = AuditService(db)
    await audit.log(action="lock_splits", resource_type="dataset", result="success", user=current_user, resource_id=dataset_id)
    await db.commit()
    return {"locked": len(splits)}
