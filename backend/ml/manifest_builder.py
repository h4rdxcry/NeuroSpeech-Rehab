"""
Manifest builder for SLR127 dataset using research-safe splits.
Reads from PostgreSQL and creates deterministic train/validation/test manifests.
"""
import os
import hashlib
from typing import List, Dict, Tuple, Optional
from dataclasses import dataclass
from pathlib import Path

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy import select, func, and_
from sqlalchemy.orm import selectinload

from app.core.config import get_settings
from app.models import Dataset, Recording, Annotation, DatasetSplit, Session, ResearchParticipant


@dataclass
class ManifestEntry:
    """Single entry in the manifest."""
    recording_id: str
    participant_pseudonym: str
    audio_path: str  # Absolute path to WAV file
    transcript: str  # Ground truth transcript
    split: str       # train, validation, or test
    duration: float  # Duration in seconds


class SLR127ManifestBuilder:
    """Builds manifest for SLR127 dataset using research-safe splits."""
    
    def __init__(self, database_url: Optional[str] = None):
        self.settings = get_settings()
        self.database_url = database_url or self.settings.DATABASE_URL
        self.engine = create_async_engine(self.database_url, echo=False)
        
    async def __aenter__(self):
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.engine.dispose()
    
    async def get_slr127_dataset_id(self) -> str:
        """Get the SLR127 dataset ID by name."""
        async with AsyncSession(self.engine) as session:
            result = await session.execute(
                select(Dataset.id).where(
                    Dataset.name == "IISc-MILE Tamil ASR Corpus (OpenSLR 127)"
                )
            )
            dataset_id = result.scalar_one_or_none()
            if dataset_id is None:
                raise ValueError("SLR127 dataset not found in database")
            return str(dataset_id)
    
    async def get_research_safe_splits(self, dataset_id: str) -> Dict[str, List[str]]:
        """
        Get research-safe split assignments from DatasetSplit table.
        Returns dict: {split_type: [participant_pseudonym, ...]}
        """
        async with AsyncSession(self.engine) as session:
            # Join DatasetSplit -> ResearchParticipant to get pseudonyms
            result = await session.execute(
                select(
                    DatasetSplit.split_type,
                    ResearchParticipant.pseudonym_id
                )
                .join(
                    ResearchParticipant,
                    ResearchParticipant.pseudonym_id == DatasetSplit.participant_id
                )
                .where(DatasetSplit.dataset_id == dataset_id)
                .order_by(DatasetSplit.split_type, ResearchParticipant.pseudonym_id)
            )
            
            splits = {"train": [], "validation": [], "test": []}
            for split_type, pseudonym in result.fetchall():
                if split_type in splits:
                    splits[split_type].append(pseudonym)
                    
            return splits
    
    async def validate_no_participant_leakage(self, dataset_id: str) -> bool:
        """
        Verify no participant appears in more than one research-safe split.
        Returns True if no leakage, False otherwise.
        """
        async with AsyncSession(self.engine) as session:
            result = await session.execute(
                select(
                    DatasetSplit.participant_id,
                    func.count(func.distinct(DatasetSplit.split_type))
                )
                .where(DatasetSplit.dataset_id == dataset_id)
                .group_by(DatasetSplit.participant_id)
                .having(func.count(func.distinct(DatasetSplit.split_type)) > 1)
            )
            leakage = result.fetchall()
            return len(leakage) == 0
    
    async def build_manifest(self, dataset_id: Optional[str] = None) -> Dict[str, List[ManifestEntry]]:
        """
        Build manifest for all splits.
        
        Returns:
            Dict with keys 'train', 'validation', 'test' each containing List[ManifestEntry]
        """
        if dataset_id is None:
            dataset_id = await self.get_slr127_dataset_id()
            
        # Validate no participant leakage
        if not await self.validate_no_participant_leakage(dataset_id):
            raise ValueError("Participant leakage detected in research-safe splits")
        
        # Get research-safe split assignments
        splits = await self.get_research_safe_splits(dataset_id)
        
        # Get dataset bids_root for path resolution
        async with AsyncSession(self.engine) as session:
            result = await session.execute(
                select(Dataset.bids_root).where(Dataset.id == dataset_id)
            )
            bids_root = result.scalar_one_or_none()
            if bids_root is None:
                raise ValueError("Dataset bids_root not found")
        
        # Build manifest for each split
        manifest = {"train": [], "validation": [], "test": []}
        
        for split_type, participant_list in splits.items():
            if not participant_list:
                continue
                
            # Get recordings for these participants
            async with AsyncSession(self.engine) as session:
                result = await session.execute(
                    select(
                        Recording.id,
                        Recording.file_path,
                        Recording.duration_seconds,
                        ResearchParticipant.pseudonym_id,
                        Annotation.label
                    )
                    .join(Session, Session.id == Recording.session_id)
                    .join(ResearchParticipant, ResearchParticipant.id == Session.participant_id)
                    .join(Annotation, and_(
                        Annotation.recording_id == Recording.id,
                        Annotation.annotation_type == "TRANSCRIPT",
                        Annotation.is_ground_truth == True
                    ))
                    .where(Recording.source_dataset_id == dataset_id)
                    .where(ResearchParticipant.pseudonym_id.in_(participant_list))
                    .order_by(ResearchParticipant.pseudonym_id, Recording.id)
                )
                
                for rec_id, file_path, duration, pseudonym, transcript in result.fetchall():
                    # Resolve absolute path
                    if bids_root:
                        audio_path = str(Path(bids_root) / file_path)
                    else:
                        audio_path = str(file_path)
                    
                    # Validate file exists and is readable WAV
                    if not self._validate_wav_file(audio_path):
                        continue
                    
                    # Validate transcript
                    if not transcript or not transcript.strip():
                        continue
                    
                    # Create manifest entry
                    entry = ManifestEntry(
                        recording_id=str(rec_id),
                        participant_pseudonym=pseudonym,
                        audio_path=audio_path,
                        transcript=transcript.strip(),
                        split=split_type,
                        duration=float(duration) if duration else 0.0
                    )
                    
                    manifest[split_type].append(entry)
        
        # Sort manifests deterministically by participant then recording ID
        for split_type in manifest:
            manifest[split_type].sort(
                key=lambda x: (x.participant_pseudonym, x.recording_id)
            )
        
        return manifest
    
    def _validate_wav_file(self, file_path: str) -> bool:
        """Validate that WAV file exists and is readable."""
        try:
            if not os.path.exists(file_path):
                return False
            
            # Try to read WAV header
            import wave
            with wave.open(file_path, 'rb') as wav_file:
                # Check basic properties
                frames = wav_file.getnframes()
                rate = wav_file.getframerate()
                channels = wav_file.getnchannels()
                sample_width = wav_file.getsampwidth()
                
                # Must be 16 kHz, mono, 16-bit
                if rate != 16000 or channels != 1 or sample_width != 2:
                    return False
                
                # Must have at least some frames
                if frames <= 0:
                    return False
                    
                return True
                
        except Exception:
            return False
    
    def get_manifest_stats(self, manifest: Dict[str, List[ManifestEntry]]) -> Dict[str, Dict]:
        """Get statistics for the manifest."""
        stats = {}
        for split_type, entries in manifest.items():
            if not entries:
                stats[split_type] = {
                    "count": 0,
                    "participants": 0,
                    "total_duration": 0.0
                }
                continue
                
            participants = set(e.participant_pseudonym for e in entries)
            total_duration = sum(e.duration for e in entries)
            
            stats[split_type] = {
                "count": len(entries),
                "participants": len(participants),
                "total_duration": total_duration,
                "avg_duration": total_duration / len(entries) if entries else 0.0
            }
        
        return stats


def build_manifest_hash(manifest: Dict[str, List[ManifestEntry]]) -> str:
    """
    Build a deterministic hash of the manifest for reproducibility tracking.
    """
    hasher = hashlib.sha256()
    
    # Sort splits deterministically
    for split_type in sorted(manifest.keys()):
        entries = manifest[split_type]
        hasher.update(f"{split_type}:".encode('utf-8'))
        
        # Sort entries deterministically
        for entry in sorted(entries, key=lambda x: (x.participant_pseudonym, x.recording_id)):
            hasher.update(f"{entry.recording_id}:{entry.participant_pseudonym}:{entry.split}:{len(entry.transcript)}:".encode('utf-8'))
    
    return hasher.hexdigest()


# Convenience function for synchronous use
def build_slr127_manifest() -> Dict[str, List[ManifestEntry]]:
    """Synchronous convenience function to build SLR127 manifest."""
    import asyncio
    
    async def _build():
        async with SLR127ManifestBuilder() as builder:
            return await builder.build_manifest()
    
    return asyncio.run(_build())


if __name__ == "__main__":
    # Test the manifest builder
    import asyncio
    
    async def main():
        async with SLR127ManifestBuilder() as builder:
            manifest = await builder.build_manifest()
            stats = builder.get_manifest_stats(manifest)
            
            print("SLR127 Manifest Statistics:")
            for split_type, stat in stats.items():
                print(f"  {split_type}: {stat['count']} recordings, {stat['participants']} participants, {stat['total_duration']:.2f}s total")
            
            # Check for leaks
            leakage_free = await builder.validate_no_participant_leakage(
                await builder.get_slr127_dataset_id()
            )
            print(f"\nParticipant leakage check: {'PASS' if leakage_free else 'FAIL'}")
            
            # Show manifest hash
            manifest_hash = build_manifest_hash(manifest)
            print(f"Manifest hash: {manifest_hash}")
    
    asyncio.run(main())