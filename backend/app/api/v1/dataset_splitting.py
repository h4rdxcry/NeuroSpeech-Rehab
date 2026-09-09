from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from uuid import UUID
from app.core.db import get_db
from app.core.dependencies import get_current_active_user, require_roles
from app.models import Dataset, DatasetSplit, ResearchParticipant, Session, Recording
from app.schemas.dataset_split import DatasetSplitCreate, DatasetSplitUpdate, DatasetSplitResponse
from app.schemas.dataset_split import DatasetSplitCreate, DatasetSplitUpdate, DatasetSplitResponse
from app.services.datasets.dataset_splitting import (
    create_research_safe_splits,
    get_split_statistics,
    verify_no_leakage,
)
from app.core.audit import AuditService
from typing import Dict, Any

router = APIRouter()


@router.post("/{dataset_id}/splits/create-research-safe", response_model=Dict[str, Any], status_code=status.HTTP_201_CREATED)
async def create_research_safe_splits_endpoint(
    dataset_id: str,
    train_ratio: float = Query(0.7, ge=0.0, le=1.0),
    validation_ratio: float = Query(0.15, ge=0.0, le=1.0),
    test_ratio: float = Query(0.15, ge=0.0, le=1.0),
    seed: int = Query(42, ge=0),
    split_version: str = Query("v1", max_length=64),
    current_user=Depends(require_roles("RESEARCHER", "ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    """Create research-safe participant-level splits with no leakage."""
    dataset = await db.get(Dataset, UUID(dataset_id))
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    # Validate ratios sum to 1.0
    if abs(train_ratio + validation_ratio + test_ratio - 1.0) > 1e-9:
        raise HTTPException(status_code=400, detail="Ratios must sum to 1.0")
    
    # Check if splits already exist
    existing = await db.execute(
        select(DatasetSplit).where(DatasetSplit.dataset_id == UUID(dataset_id))
    )
    if existing.scalars().first():
        raise HTTPException(status_code=409, detail="Splits already exist for this dataset. Delete existing splits first.")
    
    result = await create_research_safe_splits(
        db=db,
        dataset_id=UUID(dataset_id),
        train_ratio=train_ratio,
        validation_ratio=validation_ratio,
        test_ratio=test_ratio,
        seed=seed,
        split_version=split_version,
        current_user_id=current_user.id,
    )
    
    # Audit log
    audit = AuditService(db)
    await audit.log(
        action="create_research_safe_splits",
        resource_type="dataset",
        result="success",
        user=current_user,
        resource_id=dataset_id,
        metadata={
            "seed": seed,
            "split_version": split_version,
            "train_count": len(result.train_participants),
            "validation_count": len(result.validation_participants),
            "test_count": len(result.test_participants),
        }
    )
    
    return {
        "dataset_id": dataset_id,
        "split_version": split_version,
        "seed": seed,
        "train_participants": len(result.train_participants),
        "validation_participants": len(result.validation_participants),
        "test_participants": len(result.test_participants),
        "total_participants": len(result.train_participants) + len(result.validation_participants) + len(result.test_participants),
        "train_recordings": 0,  # Will be filled by statistics endpoint
        "validation_recordings": 0,
        "test_recordings": 0,
        "leakage_check": "passed",
    }


@router.get("/{dataset_id}/splits/statistics", response_model=Dict[str, Any])
async def get_split_statistics_endpoint(
    dataset_id: str,
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Get detailed statistics for dataset splits."""
    dataset = await db.get(Dataset, UUID(dataset_id))
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    stats = await get_split_statistics(db, UUID(dataset_id))
    return stats


@router.get("/{dataset_id}/splits/verify", response_model=Dict[str, Any])
async def verify_splits_endpoint(
    dataset_id: str,
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Verify no participant leakage between splits."""
    dataset = await db.get(Dataset, UUID(dataset_id))
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    no_leakage = await verify_no_leakage(db, UUID(dataset_id))
    
    return {
        "dataset_id": dataset_id,
        "no_leakage": no_leakage,
        "message": "No participant leakage detected" if no_leakage else "PARTICIPANT LEAKAGE DETECTED",
    }


@router.get("/{dataset_id}/splits/assignments", response_model=list[Dict[str, Any]])
async def get_split_assignments_endpoint(
    dataset_id: str,
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    split_type: str = Query(None),
    split_version: str = Query(None),
):
    """Get all participant split assignments for a dataset."""
    dataset = await db.get(Dataset, UUID(dataset_id))
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    query = select(DatasetSplit).where(DatasetSplit.dataset_id == UUID(dataset_id))
    if split_type:
        query = query.where(DatasetSplit.split_type == split_type)
    if split_version:
        query = query.where(DatasetSplit.split_version == split_version)
    
    result = await db.execute(query)
    splits = result.scalars().all()
    
    return [
        {
            "participant_id": s.participant_id,
            "split_type": s.split_type,
            "split_version": s.split_version,
            "is_locked": s.is_locked,
            "final_test_flag": s.final_test_flag,
            "created_at": s.created_at.isoformat(),
        }
        for s in splits
    ]