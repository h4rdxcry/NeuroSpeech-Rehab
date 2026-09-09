from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from uuid import UUID
from app.core.db import get_db
from app.core.dependencies import get_current_active_user, require_roles
from app.models import DatasetProvenance, Dataset, User
from app.schemas.dataset_provenance import DatasetProvenanceCreate, DatasetProvenanceUpdate, DatasetProvenanceResponse
from app.core.audit import AuditService

router = APIRouter()

@router.post("/datasets/{dataset_id}/provenance", response_model=DatasetProvenanceResponse, status_code=status.HTTP_201_CREATED)
async def create_provenance(dataset_id: str, provenance_in: DatasetProvenanceCreate, current_user=Depends(require_roles("RESEARCHER", "ADMIN")), db: AsyncSession = Depends(get_db)):
    dataset = await db.get(Dataset, UUID(dataset_id))
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    existing = await db.execute(select(DatasetProvenance).where(DatasetProvenance.dataset_id == UUID(dataset_id)))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Provenance already recorded for this dataset")
    payload = provenance_in.model_dump(exclude={"dataset_id"})
    provenance = DatasetProvenance(**payload, dataset_id=UUID(dataset_id))
    db.add(provenance)
    await db.flush()
    await db.refresh(provenance)
    audit = AuditService(db)
    await audit.log(action="create", resource_type="dataset_provenance", result="success", user=current_user, resource_id=str(provenance.id))
    await db.commit()
    return provenance

@router.get("/datasets/{dataset_id}/provenance", response_model=DatasetProvenanceResponse)
async def get_provenance(dataset_id: str, current_user=Depends(get_current_active_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(DatasetProvenance).where(DatasetProvenance.dataset_id == UUID(dataset_id)))
    provenance = result.scalar_one_or_none()
    if not provenance:
        raise HTTPException(status_code=404, detail="Provenance not found")
    return provenance

@router.patch("/datasets/{dataset_id}/provenance", response_model=DatasetProvenanceResponse)
async def update_provenance(dataset_id: str, provenance_update: DatasetProvenanceUpdate, current_user=Depends(require_roles("RESEARCHER", "ADMIN")), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(DatasetProvenance).where(DatasetProvenance.dataset_id == UUID(dataset_id)))
    provenance = result.scalar_one_or_none()
    if not provenance:
        raise HTTPException(status_code=404, detail="Provenance not found")
    for field, value in provenance_update.model_dump(exclude_unset=True).items():
        setattr(provenance, field, value)
    await db.flush()
    await db.refresh(provenance)
    audit = AuditService(db)
    await audit.log(action="update", resource_type="dataset_provenance", result="success", user=current_user, resource_id=str(provenance.id))
    await db.commit()
    return provenance
