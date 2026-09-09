import sys
from pathlib import Path

backend_path = Path(r"D:\NeuroSpeech-Rehab\backend")
ml_training_src = Path(r"D:\NeuroSpeech-Rehab\ml_training\src")
sys.path.insert(0, str(backend_path))
sys.path.insert(0, str(ml_training_src))

import asyncio
from uuid import UUID
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy import select, and_, distinct
from ml_training.manifest_builder import SLR127ManifestBuilder, ManifestEntry
from ml_training.tokenizer import TamilTokenizer
from ml_training.dataset import SLR127Dataset, create_data_loader, set_deterministic_seeds
from app.models import Dataset, DatasetSplit, Recording, Annotation, ResearchParticipant, Session

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

DATASET_NAME = "IISc-MILE Tamil ASR Corpus (OpenSLR 127)"


async def main():
    set_deterministic_seeds(42)
    engine = create_async_engine("postgresql+asyncpg://neurospeech:neurospeech_dev@localhost:5432/neurospeech", echo=False)
    async with AsyncSession(engine) as session:
        dataset_id = str((await session.execute(select(Dataset.id).where(Dataset.name == DATASET_NAME))).scalar_one())

        result = await session.execute(
            select(
                DatasetSplit.split_type,
                Recording.id,
                Recording.file_path,
                Recording.participant_pseudonym,
                Annotation.label,
            )
            .join(Recording, Recording.source_dataset_id == DatasetSplit.dataset_id)
            .join(Session, Session.id == Recording.session_id)
            .join(ResearchParticipant, ResearchParticipant.id == Session.participant_id)
            .join(Annotation, and_(
                Annotation.recording_id == Recording.id,
                Annotation.annotation_type == "TRANSCRIPT",
                Annotation.is_ground_truth == True,
            ))
            .where(DatasetSplit.dataset_id == dataset_id)
            .where(DatasetSplit.split_type.in_(["train", "validation", "test"]))
            .where(ResearchParticipant.pseudonym_id == DatasetSplit.participant_id)
            .order_by(DatasetSplit.split_type, Recording.id)
            .limit(9)
        )
        rows = result.fetchall()

    print("Sampled rows:")
    counts = {}
    seen = set()
    unique_rows = []
    for split_type, rec_id, file_path, pseudonym, transcript in rows:
        key = (str(rec_id), split_type)
        if key in seen:
            continue
        seen.add(key)
        counts[split_type] = counts.get(split_type, 0) + 1
        unique_rows.append((split_type, rec_id, file_path, pseudonym, transcript))
        print(f"  {split_type} | {pseudonym} | id={rec_id}")

    print("Split sample counts:", counts)

    entries = []
    for split_type, rec_id, file_path, pseudonym, transcript in unique_rows:
        entries.append(ManifestEntry(
            recording_id=str(rec_id),
            participant_pseudonym=pseudonym,
            audio_path=str(Path(r"D:\NeuroSpeech-Rehab\data\raw\openslr127_tamil") / file_path),
            transcript=transcript or "",
            split=split_type,
            duration=1.0,
        ))

    tokenizer = TamilTokenizer()
    tokenizer.build_vocab_from_transcripts([e.transcript for e in entries if e.transcript])

    dataset = SLR127Dataset(entries, tokenizer, cache_wavs=False, augment=False)
    loader = create_data_loader(dataset, batch_size=4, shuffle=False)

    batch = next(iter(loader))
    print(f"Batch input_values shape: {batch['input_values'].shape}")
    print(f"Batch labels shape: {batch['labels'].shape}")
    print(f"Batch input_lengths: {batch['input_lengths'].tolist()}")
    print(f"Batch label_lengths: {batch['label_lengths'].tolist()}")
    print("Real-data smoke test PASSED")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())