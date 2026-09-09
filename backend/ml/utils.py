"""
Utilities for the ML pipeline: database connection, random seeds, leakage check.
"""
import os
import random
import numpy as np
import torch
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.core.config import get_settings
from app.models import Dataset, Recording, Annotation, DatasetSplit, ResearchParticipant, Session

settings = get_settings()
engine = create_async_engine(settings.DATABASE_URL, echo=False)


async def get_dataset_by_name(name: str) -> Dataset:
    """Fetch dataset by name."""
    async with AsyncSession(engine) as session:
        result = await session.execute(
            select(Dataset).where(Dataset.name == name)
        )
        dataset = result.scalar_one_or_none()
        if dataset is None:
            raise ValueError(f"Dataset '{name}' not found")
        return dataset


def set_random_seeds(seed: int = 42) -> None:
    """Set random seeds for reproducibility."""
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)


async def check_partition_leakage_async(dataset_id: str) -> bool:
    """Async version of leakage check."""
    async with AsyncSession(engine) as session:
        result = await session.execute(
            select(DatasetSplit.participant_id, DatasetSplit.split_type)
            .where(DatasetSplit.dataset_id == dataset_id)
        )
        rows = result.fetchall()
        participant_to_splits = {}
        for participant_id, split_type in rows:
            if participant_id not in participant_to_splits:
                participant_to_splits[participant_id] = set()
            participant_to_splits[participant_id].add(split_type)
        for participant_id, splits in participant_to_splits.items():
            if len(splits) > 1:
                return False
        return True