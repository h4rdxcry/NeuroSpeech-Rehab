"""Full baseline training script for SLR127 Tamil ASR."""
import sys
import os
import json
import time
import hashlib
from pathlib import Path
from datetime import datetime

backend_path = Path(r"D:\NeuroSpeech-Rehab\backend")
ml_training_src = Path(r"D:\NeuroSpeech-Rehab\ml_training\src")
sys.path.insert(0, str(backend_path))
sys.path.insert(0, str(ml_training_src))

import asyncio
import torch
import torch.nn.functional as F
from torch.cuda.amp import GradScaler, autocast
from torch.utils.data import DataLoader

from ml_training.manifest_builder import SLR127ManifestBuilder, ManifestEntry, build_manifest_hash
from ml_training.tokenizer import TamilTokenizer
from ml_training.dataset import SLR127Dataset, set_deterministic_seeds
from ml_training.trainer import (
    Wav2Vec2CTCModel,
    Wav2Vec2CTCProcessor,
    TrainingConfig,
    compute_ctc_loss,
    create_ctc_data_loader,
    Wav2Vec2CTCTrainer,
)
from ml_training.metrics import compute_cer, compute_wer


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()


def get_project_revision() -> str:
    try:
        import subprocess

        result = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            cwd=r"D:\NeuroSpeech-Rehab",
            capture_output=True,
            text=True,
            check=True,
        )
        return result.stdout.strip()
    except Exception:
        return "unavailable"


def log_manifest_stats(manifest, split_name: str) -> None:
    entries = manifest.get(split_name, [])
    if not entries:
        print(f"{split_name}: 0 recordings")
        return

    durations = [e.duration for e in entries]
    transcripts = [e.transcript for e in entries]
    participants = sorted({e.participant_pseudonym for e in entries})

    print(f"{split_name}: {len(entries)} recordings / {len(participants)} participants")
    print(
        f"  duration min={min(durations):.2f}s, max={max(durations):.2f}s, "
        f"mean={sum(durations)/len(durations):.2f}s, median={sorted(durations)[len(durations)//2]:.2f}s"
    )
    print(
        f"  transcript chars min={min(len(t) for t in transcripts)}, "
        f"max={max(len(t) for t in transcripts)}, "
        f"mean={sum(len(t) for t in transcripts)/len(transcripts):.1f}"
    )


async def build_real_manifest() -> tuple[list[ManifestEntry], list[ManifestEntry], str, str]:
    try:
        import docker
        client = docker.from_env()
        client.ping()
    except Exception as exc:
        raise RuntimeError(
            "Docker is unavailable or not running. "
            "Start Docker Desktop and rerun. "
            f"Details: {exc}"
        )

    async with SLR127ManifestBuilder() as builder:
        dataset_id = await builder.get_slr127_dataset_id()
        manifest = await builder.build_manifest(dataset_id)
        manifest_hash = build_manifest_hash(manifest)

    train_entries = manifest.get("train", [])
    val_entries = manifest.get("validation", [])

    if not train_entries:
        raise RuntimeError("Train manifest is empty")
    if not val_entries:
        raise RuntimeError("Validation manifest is empty")

    print("Loaded real PostgreSQL-backed manifest:")
    log_manifest_stats(manifest, "train")
    log_manifest_stats(manifest, "validation")
    log_manifest_stats(manifest, "test")

    return train_entries, val_entries, dataset_id, manifest_hash


def build_tokenizer(train_entries: list[ManifestEntry]) -> TamilTokenizer:
    tokenizer = TamilTokenizer()
    tokenizer.build_vocab_from_transcripts([e.transcript for e in train_entries])
    return tokenizer


def create_dataloaders(
    train_entries: list[ManifestEntry],
    val_entries: list[ManifestEntry],
    tokenizer: TamilTokenizer,
    train_batch_size: int = 2,
    val_batch_size: int = 2,
    max_audio_length_seconds: float = 12.0,
):
    train_dataset = SLR127Dataset(
        train_entries,
        tokenizer,
        max_duration=max_audio_length_seconds,
        cache_wavs=False,
        augment=False,
        seed=42,
    )
    val_dataset = SLR127Dataset(
        val_entries,
        tokenizer,
        max_duration=max_audio_length_seconds,
        cache_wavs=False,
        augment=False,
        seed=42,
    )

    train_loader = create_ctc_data_loader(
        train_dataset,
        batch_size=train_batch_size,
        shuffle=True,
        pin_memory=True,
        num_workers=0,
    )
    val_loader = create_ctc_data_loader(
        val_dataset,
        batch_size=val_batch_size,
        shuffle=False,
        pin_memory=True,
        num_workers=0,
    )

    return train_loader, val_loader


def run_training(
    config: TrainingConfig,
    train_loader: DataLoader,
    val_loader: DataLoader,
    tokenizer: TamilTokenizer,
    dataset_id: str,
    manifest_hash: str,
    vocab_path: Path,
    max_steps: int,
):
    device = config.device
    model = Wav2Vec2CTCModel(
        vocab_size=tokenizer.get_vocab_size(),
        pretrained_model_name=config.model_name,
        dropout=config.dropout,
        attention_dropout=config.attention_dropout,
        hidden_dropout=config.hidden_dropout,
    ).to(device)

    if device == "cuda":
        model.wav2vec2.gradient_checkpointing_enable()

    processor = Wav2Vec2CTCProcessor(tokenizer=tokenizer)

    trainer = Wav2Vec2CTCTrainer(
        config=config,
        model=model,
        train_loader=train_loader,
        val_loader=val_loader,
        tokenizer=tokenizer,
        processor=processor,
    )

    start_time = time.perf_counter()
    torch.cuda.reset_peak_memory_stats(device)
    torch.cuda.empty_cache()

    mlflow_run = None
    run_id = None
    try:
        import mlflow

        mlflow.set_experiment("SLR127 Tamil ASR Baseline")
        mlflow_run = mlflow.start_run()
        run_id = mlflow_run.info.run_id
    except Exception as exc:
        print(f"MLflow unavailable: {exc}")

    vocab_version = sha256_file(vocab_path) if vocab_path.exists() else "unknown"

    metadata = {
        "dataset_id": dataset_id,
        "manifest_hash": manifest_hash,
        "split_seed": config.seed,
        "model_name": config.model_name,
        "vocab_size": tokenizer.get_vocab_size(),
        "vocab_version": vocab_version,
        "train_recordings": len(train_loader.dataset),
        "val_recordings": len(val_loader.dataset),
        "train_batch_size": config.train_batch_size,
        "val_batch_size": config.val_batch_size,
        "gradient_accumulation_steps": config.gradient_accumulation_steps,
        "effective_batch_size": config.effective_train_batch_size(),
        "learning_rate": config.learning_rate,
        "max_steps": max_steps,
        "max_audio_length_seconds": config.max_audio_length_seconds,
        "fp16": config.fp16,
        "seed": config.seed,
        "python_version": sys.version.split()[0],
        "torch_version": torch.__version__,
        "transformers_version": __import__("transformers").__version__,
        "librosa_version": __import__("librosa").__version__,
        "device": device,
        "gpu_name": torch.cuda.get_device_name(0) if device == "cuda" else "N/A",
        "started_at": datetime.utcnow().isoformat() + "Z",
        "git_revision": get_project_revision(),
    }

    config_path = Path(config.output_dir) / "training_config.json"
    config_path.parent.mkdir(parents=True, exist_ok=True)
    with open(config_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2, ensure_ascii=False)

    if run_id is not None:
        try:
            import mlflow

            mlflow.log_params(
                {
                    "dataset_id": dataset_id,
                    "manifest_hash": manifest_hash,
                    "split_seed": config.seed,
                    "model_name": config.model_name,
                    "vocab_size": tokenizer.get_vocab_size(),
                    "vocab_version": vocab_version,
                    "train_batch_size": config.train_batch_size,
                    "val_batch_size": config.val_batch_size,
                    "gradient_accumulation_steps": config.gradient_accumulation_steps,
                    "effective_batch_size": config.effective_train_batch_size(),
                    "learning_rate": config.learning_rate,
                    "max_steps": max_steps,
                    "max_audio_length_seconds": config.max_audio_length_seconds,
                    "fp16": config.fp16,
                    "seed": config.seed,
                    "device": device,
                    "gpu_name": metadata["gpu_name"],
                    "train_recordings": metadata["train_recordings"],
                    "val_recordings": metadata["val_recordings"],
                }
            )
        except Exception:
            pass

    try:
        trainer.train(train_loader, val_loader, dataset_id, manifest_hash)
    except Exception as exc:
        print(f"Training failed: {exc}")
        raise
    finally:
        elapsed = time.perf_counter() - start_time
        peak_vram = torch.cuda.max_memory_allocated(device) / 1024**2 if device == "cuda" else 0.0

        metadata["completed_at"] = datetime.utcnow().isoformat() + "Z"
        metadata["elapsed_seconds"] = elapsed
        metadata["peak_gpu_memory_mb"] = peak_vram
        metadata["final_global_step"] = trainer.state.global_step
        metadata["best_cer"] = trainer.state.best_cer
        metadata["best_wer"] = trainer.state.best_wer
        metadata["best_checkpoint_path"] = trainer.state.best_checkpoint_path

        with open(config_path, "w", encoding="utf-8") as f:
            json.dump(metadata, f, indent=2, ensure_ascii=False)

        if run_id is not None:
            try:
                import mlflow

                mlflow.log_artifact(str(config_path))
                mlflow.log_params(
                    {
                        "best_cer": trainer.state.best_cer,
                        "best_wer": trainer.state.best_wer,
                        "peak_gpu_memory_mb": peak_vram,
                        "elapsed_seconds": elapsed,
                    }
                )
            except Exception:
                pass
            finally:
                try:
                    import mlflow

                    mlflow.end_run()
                except Exception:
                    pass

    return metadata, trainer


def main():
    print("=" * 60)
    print("SLR127 Tamil ASR Baseline Training")
    print("=" * 60)

    set_deterministic_seeds(42)

    max_steps = 2000
    warmup_steps = 20

    config = TrainingConfig(
        model_name="facebook/wav2vec2-base",
        output_dir=r"D:\NeuroSpeech-Rehab\ml_training\outputs\baseline",
        run_name="slr127-tamil-baseline",
        train_batch_size=2,
        val_batch_size=2,
        gradient_accumulation_steps=4,
        max_audio_length_seconds=12.0,
        target_sample_rate=16000,
        learning_rate=3e-5,
        weight_decay=0.01,
        adam_beta1=0.9,
        adam_beta2=0.98,
        adam_epsilon=1e-8,
        warmup_steps=500,
        max_steps=max_steps,
        lr_scheduler_type="linear",
        dropout=0.1,
        attention_dropout=0.1,
        hidden_dropout=0.1,
        save_steps=500,
        save_total_limit=3,
        fp16=True,
        seed=42,
        vocab_path=r"D:\NeuroSpeech-Rehab\ml_training\tokenizer\vocab.json",
        logging_steps=10,
        eval_steps=100,
        device="cuda" if torch.cuda.is_available() else "cpu",
    )

    print("Building real PostgreSQL-backed manifest...")
    train_entries, val_entries, dataset_id, manifest_hash = asyncio.run(build_real_manifest())

    if not train_entries:
        raise RuntimeError("Train manifest is empty")
    if not val_entries:
        raise RuntimeError("Validation manifest is empty")

    print(f"Train entries: {len(train_entries)}")
    print(f"Validation entries: {len(val_entries)}")

    # Verify test split is not loaded
    test_path = Path(r"D:\NeuroSpeech-Rehab\ml_training\mile_tamil_asr_corpus\test")
    if test_path.exists():
        print(f"WARNING: test split directory exists at {test_path} but will NOT be loaded.")

    print("Building tokenizer...")
    tokenizer = build_tokenizer(train_entries)
    print(f"Vocab size: {tokenizer.get_vocab_size()}")

    print("Creating dataloaders...")
    train_loader, val_loader = create_dataloaders(
        train_entries,
        val_entries,
        tokenizer,
        max_duration=max_audio_length_seconds,
        train_batch_size=config.train_batch_size,
        val_batch_size=config.val_batch_size,
        max_audio_length_seconds=config.max_audio_length_seconds,
    )

    # Use a small fixed validation subset for fast periodic evaluation.
    # The full validation set is reserved for the final evaluation.
    val_eval_entries = val_entries[:500]
    val_eval_loader = create_ctc_data_loader(
        SLR127Dataset(
            val_eval_entries,
            tokenizer,
            cache_wavs=False,
            augment=False,
            seed=42,
        ),
        batch_size=config.val_batch_size,
        shuffle=False,
        pin_memory=True,
        num_workers=0,
    )

    vocab_path = Path(config.vocab_path)

    print(f"\nRunning {warmup_steps}-step warm-up...")
    warmup_config = TrainingConfig(
        **{
            **config.__dict__,
            "max_steps": warmup_steps,
            "eval_steps": max(1, warmup_steps // 4),
            "save_steps": max(1, warmup_steps // 2),
        }
    )
    warmup_metadata, warmup_trainer = run_training(
        config=warmup_config,
        train_loader=train_loader,
        val_loader=val_loader,
        tokenizer=tokenizer,
        dataset_id=dataset_id,
        manifest_hash=manifest_hash,
        vocab_path=vocab_path,
        max_steps=warmup_steps,
    )

    print(f"\nWarm-up completed in {warmup_metadata['elapsed_seconds']:.1f}s")
    print(f"Peak VRAM: {warmup_metadata['peak_gpu_memory_mb']:.1f} MB")
    print(f"Best CER: {warmup_metadata['best_cer']:.4f}")
    print(f"Best WER: {warmup_metadata['best_wer']:.4f}")
    print(f"Best checkpoint: {warmup_metadata.get('best_checkpoint_path', 'N/A')}")

    if warmup_trainer.state.global_step != warmup_steps:
        raise RuntimeError(
            f"Warm-up did not complete expected steps: {warmup_trainer.state.global_step} != {warmup_steps}"
        )

    print(f"\nStarting full {max_steps}-step baseline training...")
    full_metadata, full_trainer = run_training(
        config=config,
        train_loader=train_loader,
        val_loader=val_loader,
        tokenizer=tokenizer,
        dataset_id=dataset_id,
        manifest_hash=manifest_hash,
        vocab_path=vocab_path,
        max_steps=max_steps,
    )

    print("\n" + "=" * 60)
    print("TRAINING COMPLETE")
    print("=" * 60)
    print(f"Total steps: {full_metadata['final_global_step']}")
    print(f"Training time: {full_metadata['elapsed_seconds']:.1f}s")
    print(f"Best validation loss: N/A (CER-based checkpointing)")
    print(f"Best validation CER: {full_metadata['best_cer']:.4f}")
    print(f"Best validation WER: {full_metadata['best_wer']:.4f}")
    print(f"Best checkpoint: {full_metadata.get('best_checkpoint_path', 'N/A')}")
    print(f"Peak GPU VRAM: {full_metadata['peak_gpu_memory_mb']:.1f} MB")
    print(f"Dataset ID: {full_metadata['dataset_id']}")
    print(f"Manifest hash: {full_metadata['manifest_hash']}")
    print(f"Split seed: {full_metadata['split_seed']}")
    print(f"Model: {full_metadata['model_name']}")
    print(f"Vocab size: {full_metadata['vocab_size']}")
    print(f"Vocab version: {full_metadata['vocab_version']}")
    print(f"Train recordings: {full_metadata['train_recordings']}")
    print(f"Validation recordings: {full_metadata['val_recordings']}")
    print(f"GPU: {full_metadata['gpu_name']}")
    print(f"Started: {full_metadata['started_at']}")
    print(f"Completed: {full_metadata['completed_at']}")
    print(f"Git revision: {full_metadata['git_revision']}")


if __name__ == "__main__":
    main()
