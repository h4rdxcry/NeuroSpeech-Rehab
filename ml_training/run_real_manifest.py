import sys
from pathlib import Path

backend_path = Path(r"D:\NeuroSpeech-Rehab\backend")
ml_training_src = Path(r"D:\NeuroSpeech-Rehab\ml_training\src")
sys.path.insert(0, str(backend_path))
sys.path.insert(0, str(ml_training_src))

import asyncio
from ml_training.manifest_builder import SLR127ManifestBuilder, build_manifest_hash
from ml_training.tokenizer import TamilTokenizer


async def main():
    async with SLR127ManifestBuilder() as builder:
        dataset_id = await builder.get_slr127_dataset_id()
        print(f"SLR127 dataset_id={dataset_id}")
        manifest = await builder.build_manifest(dataset_id)
        stats = builder.get_manifest_stats(manifest)
        print("Manifest counts:")
        for split_type, stat in stats.items():
            print(f"  {split_type}: {stat['count']} recordings, {stat['participants']} participants, {stat['total_duration']:.2f}s total")
        print(f"Manifest hash: {build_manifest_hash(manifest)}")
        return manifest


if __name__ == "__main__":
    manifest = asyncio.run(main())