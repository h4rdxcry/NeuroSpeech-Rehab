"""GPU smoke/overfit test for Wav2Vec2 + CTC Tamil ASR baseline."""
import sys
from pathlib import Path

backend_path = Path(r"D:\NeuroSpeech-Rehab\backend")
ml_training_src = Path(r"D:\NeuroSpeech-Rehab\ml_training\src")
sys.path.insert(0, str(backend_path))
sys.path.insert(0, str(ml_training_src))

import asyncio
import json
import time
import torch
from ml_training.manifest_builder import SLR127ManifestBuilder, ManifestEntry, build_manifest_hash
from ml_training.tokenizer import TamilTokenizer
from ml_training.dataset import SLR127Dataset
from ml_training.trainer import (
    Wav2Vec2CTCTrainer,
    Wav2Vec2CTCModel,
    Wav2Vec2CTCProcessor,
    TrainingConfig,
    TrainingState,
    create_ctc_data_loader,
)

TRAIN_COUNT = 4
VAL_COUNT = 2
TRAIN_STEPS = 5


def build_local_manifest() -> tuple[list[ManifestEntry], list[ManifestEntry], str, str]:
    base = Path(r"D:\NeuroSpeech-Rehab\ml_training\mile_tamil_asr_corpus")
    train_files = sorted((base / "train" / "audio_files").glob("*.wav"))[:TRAIN_COUNT]
    val_files = sorted((base / "validation" / "audio_files").glob("*.wav"))[:VAL_COUNT]

    if len(train_files) < TRAIN_COUNT or len(val_files) < VAL_COUNT:
        raise RuntimeError(
            f"Insufficient local WAVs: train={len(train_files)}, val={len(val_files)}"
        )

    def make_entries(files, split):
        entries = []
        for p in files:
            name = p.stem
            parts = name.split("_")
            pseudonym = "_".join(parts[:2]) if len(parts) >= 2 else name
            entries.append(ManifestEntry(
                recording_id=name,
                participant_pseudonym=pseudonym,
                audio_path=str(p),
                transcript="",
                split=split,
                duration=1.0,
            ))
        return entries

    train_entries = make_entries(train_files, "train")
    val_entries = make_entries(val_files, "validation")

    # Fill transcripts deterministically for overfitting
    for i, entry in enumerate(train_entries):
        entry.transcript = f"வணக்கம் {i}"
    for i, entry in enumerate(val_entries):
        entry.transcript = f"வணக்கம் {i}"

    manifest = {"train": train_entries, "validation": val_entries, "test": []}
    manifest_hash = build_manifest_hash(manifest)
    dataset_id = "local-smoke-test"
    return train_entries, val_entries, dataset_id, manifest_hash


async def build_small_manifest() -> tuple[list[ManifestEntry], list[ManifestEntry], str, str]:
    async with SLR127ManifestBuilder() as builder:
        dataset_id = await builder.get_slr127_dataset_id()
        manifest = await builder.build_manifest(dataset_id)
        manifest_hash = builder.build_manifest_hash(manifest)

    train_entries = manifest.get("train", [])[:TRAIN_COUNT]
    val_entries = manifest.get("validation", [])[:VAL_COUNT]

    if len(train_entries) < TRAIN_COUNT or len(val_entries) < VAL_COUNT:
        raise RuntimeError(
            f"Insufficient manifest data: train={len(train_entries)}, val={len(val_entries)}"
        )

    return train_entries, val_entries, dataset_id, manifest_hash


def build_tokenizer(train_entries: list[ManifestEntry]) -> TamilTokenizer:
    tokenizer = TamilTokenizer()
    tokenizer.build_vocab_from_transcripts([e.transcript for e in train_entries])
    return tokenizer


def build_model(vocab_size: int, device: str) -> Wav2Vec2CTCModel:
    from ml_training.dataset import set_deterministic_seeds
    set_deterministic_seeds(42)
    model = Wav2Vec2CTCModel(
        vocab_size=vocab_size,
        pretrained_model_name="facebook/wav2vec2-base",
        dropout=0.1,
        attention_dropout=0.1,
        hidden_dropout=0.1,
    )
    return model.to(device)


def run_smoke_test() -> dict:
    result = {
        "train_entries": 0,
        "val_entries": 0,
        "dataset_id": "",
        "manifest_hash": "",
        "vocab_size": 0,
        "steps_completed": 0,
        "final_train_loss": None,
        "final_eval_loss": None,
        "cer": None,
        "wer": None,
        "decoded_sample": "",
        "peak_gpu_memory_mb": None,
        "checkpoint_saved": False,
        "checkpoint_reloaded": False,
        "issues": [],
    }

    device = "cuda" if torch.cuda.is_available() else "cpu"
    if device != "cuda":
        result["issues"].append("CUDA not available; smoke test skipped")
        return result

    try:
        train_entries, val_entries, dataset_id, manifest_hash = asyncio.run(build_small_manifest())
        result["dataset_id"] = dataset_id
        result["manifest_hash"] = manifest_hash
    except Exception as exc:
        result["issues"].append(f"PostgreSQL manifest unavailable ({exc}); using local WAV fallback")
        try:
            train_entries, val_entries, dataset_id, manifest_hash = build_local_manifest()
            result["dataset_id"] = dataset_id
            result["manifest_hash"] = manifest_hash
        except Exception as local_exc:
            result["issues"].append(f"Local fallback also failed: {local_exc}")
            return result

    result["train_entries"] = len(train_entries)
    result["val_entries"] = len(val_entries)

    tokenizer = build_tokenizer(train_entries)
    result["vocab_size"] = tokenizer.get_vocab_size()

    train_dataset = SLR127Dataset(
        train_entries, tokenizer, cache_wavs=False, augment=False, seed=42
    )
    val_dataset = SLR127Dataset(
        val_entries, tokenizer, cache_wavs=False, augment=False, seed=42
    )

    train_loader = create_ctc_data_loader(
        train_dataset, batch_size=2, shuffle=True, pin_memory=True
    )
    val_loader = create_ctc_data_loader(
        val_dataset, batch_size=2, shuffle=False, pin_memory=True
    )

    model = build_model(tokenizer.get_vocab_size(), device)
    processor = Wav2Vec2CTCProcessor(tokenizer=tokenizer)

    output_dir = Path(r"D:\NeuroSpeech-Rehab\ml_training\outputs\smoke_test")
    config = TrainingConfig(
        output_dir=str(output_dir),
        run_name="smoke-test",
        train_batch_size=2,
        val_batch_size=2,
        gradient_accumulation_steps=1,
        max_audio_length_seconds=12.0,
        learning_rate=3e-5,
        max_steps=TRAIN_STEPS,
        save_steps=TRAIN_STEPS,
        fp16=True,
        seed=42,
        device=device,
    )

    trainer = Wav2Vec2CTCTrainer(
        config=config, model=model, train_loader=train_loader, val_loader=val_loader,
        tokenizer=tokenizer, processor=processor,
    )

    torch.cuda.reset_peak_memory_stats(device)
    start = time.perf_counter()

    try:
        trainer.train(train_loader, val_loader, dataset_id, manifest_hash)
        result["steps_completed"] = trainer.state.global_step
    except Exception as exc:
        result["issues"].append(f"Training failed: {exc}")
        return result

    elapsed = time.perf_counter() - start
    result["peak_gpu_memory_mb"] = torch.cuda.max_memory_allocated(device) / 1024**2

    val_metrics = trainer.evaluate(val_loader)
    result["final_eval_loss"] = val_metrics.get("eval_loss")
    result["cer"] = val_metrics.get("cer")
    result["wer"] = val_metrics.get("wer")

    sample_batch = next(iter(val_loader))
    with torch.no_grad():
        input_values = sample_batch["input_values"].to(device)
        attention_mask = torch.ones(input_values.shape, dtype=torch.long, device=device)
        logits = trainer.model(input_values, attention_mask=attention_mask)
        pred_ids = logits.argmax(dim=-1)[0].cpu().numpy().tolist()
        result["decoded_sample"] = tokenizer.decode(pred_ids)

    checkpoint_path = output_dir / "best-checkpoint.pt"
    any_checkpoint = list(output_dir.glob("checkpoint-*.pt"))
    result["checkpoint_saved"] = checkpoint_path.exists() or bool(any_checkpoint)
    result["checkpoint_saved_path"] = str(checkpoint_path) if checkpoint_path.exists() else (str(any_checkpoint[0]) if any_checkpoint else "")
    if result["checkpoint_saved"]:
        reload_path = result.get("checkpoint_saved_path") or str(checkpoint_path)
        new_model = build_model(tokenizer.get_vocab_size(), device)
        new_trainer = Wav2Vec2CTCTrainer(
            config=config, model=new_model, train_loader=train_loader, val_loader=val_loader,
            tokenizer=tokenizer, processor=processor,
        )
        try:
            new_trainer.load_checkpoint(reload_path)
            result["checkpoint_reloaded"] = True
        except Exception as exc:
            result["issues"].append(f"Checkpoint reload failed: {exc}")

    print("\n=== SMOKE TEST RESULT ===")
    print(f"Train entries: {result['train_entries']}")
    print(f"Val entries: {result['val_entries']}")
    print(f"Dataset ID: {result['dataset_id']}")
    print(f"Manifest hash: {result['manifest_hash']}")
    print(f"Vocab size: {result['vocab_size']}")
    print(f"Steps completed: {result['steps_completed']}")
    print(f"Elapsed: {elapsed:.1f}s")
    print(f"Peak GPU memory: {result['peak_gpu_memory_mb']:.1f} MB")
    print(f"Final eval loss: {result['final_eval_loss']}")
    print(f"CER: {result['cer']}")
    print(f"WER: {result['wer']}")
    print(f"Decoded sample: {result['decoded_sample']}")
    print(f"Checkpoint saved: {result['checkpoint_saved']}")
    print(f"Checkpoint reloaded: {result['checkpoint_reloaded']}")
    if result["issues"]:
        print(f"Issues: {result['issues']}")
    print("=== END SMOKE TEST ===\n")

    return result


if __name__ == "__main__":
    run_smoke_test()
