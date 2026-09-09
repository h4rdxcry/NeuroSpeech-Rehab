from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from uuid import UUID
from app.core.db import get_db
from app.core.dependencies import get_current_active_user, require_roles
from app.models import DatasetCatalog, Dataset
from app.schemas.dataset_catalog import DatasetCatalogCreate, DatasetCatalogUpdate, DatasetCatalogResponse
from app.core.audit import AuditService

router = APIRouter()

@router.post("/datasets/{dataset_id}/catalog", response_model=DatasetCatalogResponse, status_code=status.HTTP_201_CREATED)
async def create_catalog(dataset_id: str, catalog_in: DatasetCatalogCreate, current_user=Depends(require_roles("RESEARCHER", "ADMIN")), db: AsyncSession = Depends(get_db)):
    dataset = await db.get(Dataset, UUID(dataset_id))
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    existing = await db.execute(select(DatasetCatalog).where(DatasetCatalog.dataset_id == UUID(dataset_id)))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Catalog entry already exists for this dataset")
    payload = catalog_in.model_dump(exclude={"dataset_id"})
    catalog = DatasetCatalog(**payload, dataset_id=UUID(dataset_id))
    db.add(catalog)
    await db.flush()
    await db.refresh(catalog)
    audit = AuditService(db)
    await audit.log(action="create", resource_type="dataset_catalog", result="success", user=current_user, resource_id=str(catalog.id))
    await db.commit()
    return catalog

@router.get("/datasets/{dataset_id}/catalog", response_model=DatasetCatalogResponse)
async def get_catalog(dataset_id: str, current_user=Depends(get_current_active_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(DatasetCatalog).where(DatasetCatalog.dataset_id == UUID(dataset_id)))
    catalog = result.scalar_one_or_none()
    if not catalog:
        raise HTTPException(status_code=404, detail="Catalog entry not found")
    return catalog

@router.patch("/datasets/{dataset_id}/catalog", response_model=DatasetCatalogResponse)
async def update_catalog(dataset_id: str, catalog_update: DatasetCatalogUpdate, current_user=Depends(require_roles("RESEARCHER", "ADMIN")), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(DatasetCatalog).where(DatasetCatalog.dataset_id == UUID(dataset_id)))
    catalog = result.scalar_one_or_none()
    if not catalog:
        raise HTTPException(status_code=404, detail="Catalog entry not found")
    for field, value in catalog_update.model_dump(exclude_unset=True).items():
        setattr(catalog, field, value)
    await db.flush()
    await db.refresh(catalog)
    audit = AuditService(db)
    await audit.log(action="update", resource_type="dataset_catalog", result="success", user=current_user, resource_id=str(catalog.id))
    await db.commit()
    return catalog

@router.get("/catalog", response_model=list[DatasetCatalogResponse])
async def list_catalog(current_user=Depends(get_current_active_user), db: AsyncSession = Depends(get_db), modality: str = Query(None), project_usage: str = Query(None), skip: int = 0, limit: int = 100):
    query = select(DatasetCatalog)
    if modality:
        query = query.where(DatasetCatalog.modality == modality)
    if project_usage:
        query = query.where(DatasetCatalog.project_usage == project_usage)
    result = await db.execute(query.offset(skip).limit(limit))
    return result.scalars().all()
