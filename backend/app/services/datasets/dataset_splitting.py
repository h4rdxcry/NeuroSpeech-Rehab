import hashlib
import json
import random
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, List, Optional, Set
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Dataset, DatasetProvenance, DatasetSplit, Recording, ResearchParticipant, Session


@dataclass
class SplitAssignment:
    participant_id: str
    split_type: str  # "train", "validation", "test"
    source_split: Optional[str] = None  # Original OpenSLR split: "train" or "test"


@dataclass
class SplitResult:
    train_participants: List[str]
    validation_participants: List[str]
    test_participants: List[str]
    assignments: List[SplitAssignment]
    seed: int
    split_version: str


def _hash_for_split(participant_id: str, seed: int) -> int:
    """Generate a deterministic hash for participant split assignment."""
    h = hashlib.sha256(f"{participant_id}:{seed}".encode()).hexdigest()
    return int(h[:8], 16)


def _deterministic_split(
    participants: List[str],
    train_ratio: float,
    validation_ratio: float,
    test_ratio: float,
    seed: int,
) -> Dict[str, str]:
    """Deterministically assign participants to splits based on hash."""
    assert abs(train_ratio + validation_ratio + test_ratio - 1.0) < 1e-9
    
    assignments = {}
    for pid in participants:
        h = _hash_for_split(pid, seed)
        # Use hash as fraction in [0, 1)
        fraction = h / 0xFFFFFFFF
        if fraction < train_ratio:
            assignments[pid] = "train"
        elif fraction < train_ratio + validation_ratio:
            assignments[pid] = "validation"
        else:
            assignments[pid] = "test"
    return assignments


async def create_research_safe_splits(
    db: AsyncSession,
    dataset_id: UUID,
    train_ratio: float = 0.7,
    validation_ratio: float = 0.15,
    test_ratio: float = 0.15,
    seed: int = 42,
    split_version: str = "v1",
    current_user_id: Optional[UUID] = None,
) -> SplitResult:
    """
    Create research-safe participant-level splits for a dataset.
    
    This ensures:
    - No participant appears in more than one split (no leakage)
    - Deterministic assignment via hash-based deterministic shuffle
    - Original OpenSLR train/test membership preserved as source metadata
    - Final test set is locked and flagged
    - Split assignments stored in DatasetSplit table
    """
    dataset = await db.get(Dataset, dataset_id)
    if not dataset:
        raise ValueError(f"Dataset {dataset_id} not found")
    
    # Get all participants for this dataset
    result = await db.execute(
        select(ResearchParticipant)
        .join(Session, Session.participant_id == ResearchParticipant.id)
        .join(Recording, Recording.session_id == Session.id)
        .where(Recording.source_dataset_id == dataset_id)
        .distinct()
    )
    participants = result.scalars().all()
    
    if not participants:
        raise ValueError("No participants found for this dataset")
    
    participant_ids = [p.pseudonym_id for p in participants]
    
    # Get original OpenSLR split membership from session metadata
    original_splits = {}
    for p in participants:
        result = await db.execute(
            select(Session.dataset_split)
            .join(Recording, Recording.session_id == Session.id)
            .where(Session.participant_id == p.id)
            .where(Recording.source_dataset_id == dataset_id)
            .distinct()
        )
        splits = [row[0] for row in result.fetchall() if row[0] is not None]
        original_splits[p.pseudonym_id] = splits
    
    # Deterministic split assignment
    assignments_map = _deterministic_split(
        participant_ids, train_ratio, validation_ratio, test_ratio, seed
    )
    
    # Build assignments with source metadata
    assignments = []
    train_participants = []
    validation_participants = []
    test_participants = []
    
    for pid, split_type in assignments_map.items():
        source_split = original_splits.get(pid, [])
        assignments.append(SplitAssignment(
            participant_id=pid,
            split_type=split_type,
            source_split=source_split[0] if len(source_split) == 1 else ";".join(source_split) if source_split else None
        ))
        if split_type == "train":
            train_participants.append(pid)
        elif split_type == "validation":
            validation_participants.append(pid)
        else:
            test_participants.append(pid)
    
    # Store in DatasetSplit table
    for assignment in assignments:
        split_record = DatasetSplit(
            dataset_id=dataset_id,
            participant_id=assignment.participant_id,
            split_type=assignment.split_type,
            split_version=split_version,
            is_locked=(assignment.split_type == "test"),  # Lock final test set
            final_test_flag=(assignment.split_type == "test"),
        )
        db.add(split_record)
    
    # Update dataset split_definition with research-safe splits
    dataset.split_definition = {
        "train": train_participants,
        "validation": validation_participants,
        "test": test_participants,
        "original_openslr_train": [a.participant_id for a in assignments if a.source_split == "train"],
        "original_openslr_test": [a.participant_id for a in assignments if a.source_split == "test"],
        "split_version": split_version,
        "seed": seed,
        "ratios": {
            "train": train_ratio,
            "validation": validation_ratio,
            "test": test_ratio,
        },
    }
    
    # Update provenance with split metadata
    result = await db.execute(select(DatasetProvenance).where(DatasetProvenance.dataset_id == dataset_id))
    provenance = result.scalar_one_or_none()
    if provenance:
        transformations = json.loads(provenance.transformations_performed) if provenance.transformations_performed else []
        transformations.append({
            "type": "participant_level_split",
            "version": split_version,
            "seed": seed,
            "ratios": {"train": train_ratio, "validation": validation_ratio, "test": test_ratio},
            "timestamp": datetime.utcnow().isoformat(),
        })
        provenance.transformations_performed = json.dumps(transformations)
    
    await db.flush()
    await db.commit()
    
    return SplitResult(
        train_participants=train_participants,
        validation_participants=validation_participants,
        test_participants=test_participants,
        assignments=assignments,
        seed=seed,
        split_version=split_version,
    )


async def get_split_statistics(db: AsyncSession, dataset_id: UUID) -> Dict[str, Any]:
    """Get detailed statistics for dataset splits."""
    # Get split assignments
    result = await db.execute(
        select(DatasetSplit)
        .where(DatasetSplit.dataset_id == dataset_id)
    )
    splits = result.scalars().all()
    
    # Count participants per split
    split_counts = {"train": 0, "validation": 0, "test": 0}
    for s in splits:
        if s.split_type in split_counts:
            split_counts[s.split_type] += 1
    
    # Get recording counts per split via session/participant
    result = await db.execute(
        select(DatasetSplit.split_type, Recording.id)
        .join(ResearchParticipant, ResearchParticipant.pseudonym_id == DatasetSplit.participant_id)
        .join(Session, Session.participant_id == ResearchParticipant.id)
        .join(Recording, Recording.session_id == Session.id)
        .where(DatasetSplit.dataset_id == dataset_id)
    )
    recording_splits = {}
    for row in result.fetchall():
        split_type = row[0]
        if split_type not in recording_splits:
            recording_splits[split_type] = 0
        recording_splits[split_type] += 1
    
    # Verify no participant leakage
    participant_splits = {}
    for s in splits:
        if s.participant_id in participant_splits:
            participant_splits[s.participant_id].append(s.split_type)
        else:
            participant_splits[s.participant_id] = [s.split_type]
    
    leakage = {pid: types for pid, types in participant_splits.items() if len(set(types)) > 1}
    
    return {
        "participant_counts": split_counts,
        "recording_counts": recording_splits,
        "total_participants": sum(split_counts.values()),
        "total_recordings": sum(recording_splits.values()),
        "leakage_detected": len(leakage) > 0,
        "leakage_details": leakage,
        "test_locked": all(s.is_locked for s in splits if s.split_type == "test"),
        "final_test_flagged": all(s.final_test_flag for s in splits if s.split_type == "test"),
    }


async def verify_no_leakage(db: AsyncSession, dataset_id: UUID) -> bool:
    """Verify no participant appears in more than one split."""
    result = await db.execute(
        select(DatasetSplit)
        .where(DatasetSplit.dataset_id == dataset_id)
    )
    splits = result.scalars().all()
    
    participant_splits = {}
    for s in splits:
        if s.participant_id in participant_splits:
            participant_splits[s.participant_id].append(s.split_type)
        else:
            participant_splits[s.participant_id] = [s.split_type]
    
    for pid, types in participant_splits.items():
        if len(set(types)) > 1:
            return False
    return True