from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
from app.core.db import get_db
from app.core.dependencies import get_current_active_user, require_roles
from app.models import Dataset
from app.schemas.dataset import DatasetResponse
from app.schemas.dataset_import import DatasetImportRequest, DatasetImportResponse, DatasetManifest
from app.services.datasets.importer import DatasetImporter

router = APIRouter()


@router.post("/{dataset_id}/import", response_model=DatasetImportResponse, status_code=status.HTTP_200_OK)
async def import_dataset(dataset_id: str, payload: DatasetImportRequest, current_user=Depends(require_roles("RESEARCHER", "ADMIN")), db: AsyncSession = Depends(get_db)):
    dataset = await db.get(Dataset, UUID(dataset_id))
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    if dataset.data_classification != "REAL":
        raise HTTPException(status_code=400, detail="Only REAL datasets may be imported through this endpoint")
    importer = DatasetImporter(db, current_user)
    return await importer.import_dataset(dataset.id, payload)


@router.get("/{dataset_id}/manifest", response_model=DatasetManifest)
async def get_manifest(dataset_id: str, current_user=Depends(get_current_active_user), db: AsyncSession = Depends(get_db)):
    dataset = await db.get(Dataset, UUID(dataset_id))
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    if not dataset.manifest:
        raise HTTPException(status_code=404, detail="Manifest not generated")
    return DatasetManifest.model_validate(dataset.manifest)


@router.post("/register-real", response_model=DatasetResponse, status_code=status.HTTP_201_CREATED)
async def register_real_dataset(dataset_in: DatasetImportRequest, current_user=Depends(require_roles("RESEARCHER", "ADMIN")), db: AsyncSession = Depends(get_db)):
    source_metadata: dict = dataset_in.metadata_override or {}
    source_metadata.setdefault("data_classification", "REAL")
    if dataset_in.is_restricted:
        source_metadata["is_restricted"] = True
    if dataset_in.is_credentialed:
        source_metadata["is_credentialed"] = True
    if dataset_in.access_type:
        source_metadata["access_type"] = dataset_in.access_type
    if dataset_in.access_requirements:
        source_metadata["access_requirements"] = dataset_in.access_requirements
    if dataset_in.source_url:
        source_metadata["source_url"] = dataset_in.source_url
    if dataset_in.local_path:
        source_metadata["bids_root"] = dataset_in.local_path
    importer = DatasetImporter(db, current_user)
    return await importer.register_real_dataset(dataset_in, source_metadata)
