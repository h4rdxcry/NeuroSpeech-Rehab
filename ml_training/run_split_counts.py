import sys
from pathlib import Path

backend_path = Path(r"D:\NeuroSpeech-Rehab\backend")
ml_training_src = Path(r"D:\NeuroSpeech-Rehab\ml_training\src")
sys.path.insert(0, str(backend_path))
sys.path.insert(0, str(ml_training_src))

import asyncio
from ml_training.manifest_builder import SLR127ManifestBuilder


async def main():
    async with SLR127ManifestBuilder() as builder:
        dataset_id = await builder.get_slr127_dataset_id()
        splits = await builder.get_research_safe_splits(dataset_id)
        stats = {
            split_type: {
                "participants": len(pseudonyms),
            }
            for split_type, pseudonyms in splits.items()
        }
        print("Participant counts by split:")
        for split_type, stat in stats.items():
            print(f"  {split_type}: {stat['participants']} participants")
        print(f"\nTotal participants: {sum(len(v) for v in splits.values())}")


if __name__ == "__main__":
    asyncio.run(main())