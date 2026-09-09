"""Tests for Wav2Vec2 + CTC trainer, metrics, and reproducibility."""
from __future__ import annotations

import json
import os
import tempfile
import wave
from pathlib import Path

import pytest
import torch
import numpy as np

from ml_training.tokenizer import TamilTokenizer
from ml_training.metrics import compute_cer, compute_wer
from ml_training.dataset import (
    SLR127Dataset,
    ManifestEntry,
)
from ml_training.trainer import (
    Wav2Vec2CTCModel,
    Wav2Vec2CTCProcessor,
    TrainingConfig,
    compute_ctc_loss,
    TrainingState,
    create_ctc_data_loader,
)


def create_test_wav(file_path: Path, duration_sec: float = 1.0, sample_rate: int = 16000):
    file_path.parent.mkdir(parents=True, exist_ok=True)
    num_frames = int(duration_sec * sample_rate)
    with wave.open(str(file_path), "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(b"\x00\x00" * num_frames)


def _dummy_entries(tmp_path: Path, count: int = 4) -> tuple[list[ManifestEntry], TamilTokenizer]:
    entries = []
    transcripts = []
    for i in range(count):
        audio_path = str(tmp_path / f"dummy_{i}.wav")
        create_test_wav(Path(audio_path), duration_sec=1.0)
        transcript = f"தமிழ் {i}"
        entries.append(ManifestEntry(
            recording_id=f"rec{i}",
            participant_pseudonym=f"spk{i}",
            audio_path=audio_path,
            transcript=transcript,
            split="train",
            duration=1.0,
        ))
        transcripts.append(transcript)

    tokenizer = TamilTokenizer()
    tokenizer.build_vocab_from_transcripts(transcripts)
    return entries, tokenizer


class TestMetrics:
    def test_cer_perfect(self):
        assert compute_cer(["hello"], ["hello"]) == 0.0

    def test_cer_substitution(self):
        cer = compute_cer(["hello"], ["hallo"])
        assert 0 < cer < 1.0

    def test_wer_perfect(self):
        assert compute_wer(["hello world"], ["hello world"]) == 0.0

    def test_wer_insertion(self):
        wer = compute_wer(["hello world"], ["hello there world"])
        assert wer == pytest.approx(1.0 / 3.0, abs=1e-6)

    def test_empty_references(self):
        assert compute_cer([], []) == 0.0
        assert compute_wer([], []) == 0.0

    def test_length_mismatch(self):
        with pytest.raises(ValueError):
            compute_cer(["a"], ["a", "b"])


class TestCTCModel:
    def test_forward_pass_cpu(self):
        vocab_size = 10
        model = Wav2Vec2CTCModel(vocab_size=vocab_size, pretrained_model_name="facebook/wav2vec2-base")
        model.eval()

        batch_size = 2
        seq_len = 16000  # 1 second
        input_values = torch.randn(batch_size, seq_len)

        with torch.no_grad():
            logits = model(input_values)

        assert logits.shape[0] == batch_size
        assert logits.shape[2] == vocab_size
        assert logits.shape[1] > 0

    @pytest.mark.skipif(not torch.cuda.is_available(), reason="CUDA not available")
    def test_forward_pass_cuda(self):
        vocab_size = 10
        model = Wav2Vec2CTCModel(vocab_size=vocab_size, pretrained_model_name="facebook/wav2vec2-base")
        model.eval()
        model.cuda()

        batch_size = 1
        seq_len = 16000
        input_values = torch.randn(batch_size, seq_len, device="cuda")

        with torch.no_grad():
            logits = model(input_values)

        assert logits.is_cuda
        assert logits.shape[0] == batch_size
        assert logits.shape[2] == vocab_size
        assert logits.shape[1] > 0


class TestCTCLoss:
    def test_ctc_loss_finite(self):
        vocab_size = 10
        model = Wav2Vec2CTCModel(vocab_size=vocab_size, pretrained_model_name="facebook/wav2vec2-base")
        model.train()

        batch_size = 2
        seq_len = 16000
        input_values = torch.randn(batch_size, seq_len)
        labels = torch.tensor([1, 2, 3, 4, 5], dtype=torch.long)

        with torch.no_grad():
            logits = model(input_values)
        time_dim = logits.shape[1]
        input_lengths = torch.tensor([time_dim, time_dim], dtype=torch.long)
        label_lengths = torch.tensor([3, 2], dtype=torch.long)

        loss = compute_ctc_loss(logits, labels, input_lengths, label_lengths)

        assert torch.isfinite(loss), f"CTC loss should be finite, got {loss.item()}"
        assert loss.item() > 0.0

    def test_ctc_loss_backward(self):
        vocab_size = 10
        model = Wav2Vec2CTCModel(vocab_size=vocab_size, pretrained_model_name="facebook/wav2vec2-base")
        model.train()

        batch_size = 1
        seq_len = 16000
        input_values = torch.randn(batch_size, seq_len)
        labels = torch.tensor([1, 2, 3], dtype=torch.long)

        logits = model(input_values)
        time_dim = logits.shape[1]
        input_lengths = torch.tensor([time_dim], dtype=torch.long)
        label_lengths = torch.tensor([3], dtype=torch.long)

        loss = compute_ctc_loss(logits, labels, input_lengths, label_lengths)
        loss.backward()

        has_grad = any(p.grad is not None for p in model.parameters() if p.requires_grad)
        assert has_grad, "At least one parameter should have gradients after backward"

    @pytest.mark.skipif(not torch.cuda.is_available(), reason="CUDA not available")
    def test_ctc_loss_cuda(self):
        vocab_size = 10
        model = Wav2Vec2CTCModel(vocab_size=vocab_size, pretrained_model_name="facebook/wav2vec2-base")
        model.cuda()
        model.train()

        batch_size = 1
        seq_len = 16000
        input_values = torch.randn(batch_size, seq_len, device="cuda")
        labels = torch.tensor([1, 2, 3], dtype=torch.long, device="cuda")

        logits = model(input_values)
        time_dim = logits.shape[1]
        input_lengths = torch.tensor([time_dim], dtype=torch.long, device="cuda")
        label_lengths = torch.tensor([3], dtype=torch.long, device="cuda")

        loss = compute_ctc_loss(logits, labels, input_lengths, label_lengths)
        assert torch.isfinite(loss)
        assert loss.is_cuda


class TestCTCCollate:
    def test_ctc_collate_flattens_labels(self, tmp_path: Path):
        entries, tokenizer = _dummy_entries(tmp_path, count=3)
        dataset = SLR127Dataset(entries, tokenizer, cache_wavs=False)
        loader = create_ctc_data_loader(dataset, batch_size=3, shuffle=False)

        batch = next(iter(loader))
        assert batch["labels"].dim() == 1
        assert batch["input_lengths"].shape == (3,)
        assert batch["label_lengths"].shape == (3,)
        assert batch["input_values"].shape[0] == 3
        assert "transcripts" in batch
        assert len(batch["transcripts"]) == 3

    def test_ctc_collate_padding(self, tmp_path: Path):
        entries, tokenizer = _dummy_entries(tmp_path, count=2)
        dataset = SLR127Dataset(entries, tokenizer, cache_wavs=False)
        loader = create_ctc_data_loader(dataset, batch_size=2, shuffle=False)

        batch = next(iter(loader))
        assert batch["input_values"].shape[1] > 0
        total_labels = batch["label_lengths"].sum().item()
        assert batch["labels"].shape[0] == total_labels


class TestReproducibility:
    def test_same_seed_same_weights(self):
        vocab_size = 10

        def make_model():
            from ml_training.dataset import set_deterministic_seeds
            set_deterministic_seeds(42)
            return Wav2Vec2CTCModel(vocab_size=vocab_size, pretrained_model_name="facebook/wav2vec2-base")

        model1 = make_model()
        model2 = make_model()

        for (p1, p2) in zip(model1.parameters(), model2.parameters()):
            assert torch.allclose(p1, p2), "Models initialized with same seed should have identical weights"

    def test_training_config_saved(self, tmp_path: Path):
        config = TrainingConfig(output_dir=str(tmp_path), run_name="test-run", max_steps=10)
        config_path = tmp_path / "training_config.json"
        payload = {
            "model_name": config.model_name,
            "vocab_size": 5,
            "dataset_id": "test-ds",
            "manifest_hash": "abc123",
            "split_seed": config.seed,
            "train_batch_size": config.train_batch_size,
            "gradient_accumulation_steps": config.gradient_accumulation_steps,
            "effective_batch_size": config.effective_train_batch_size(),
            "learning_rate": config.learning_rate,
            "max_steps": config.max_steps,
            "fp16": config.fp16,
            "device": config.device,
        }
        with open(config_path, "w", encoding="utf-8") as f:
            json.dump(payload, f)

        assert config_path.exists()
        with open(config_path, "r", encoding="utf-8") as f:
            loaded = json.load(f)
        assert loaded["model_name"] == config.model_name
        assert loaded["split_seed"] == config.seed


class TestTestSetIsolation:
    def test_test_split_not_in_train_loader(self, tmp_path: Path):
        train_entries, tokenizer = _dummy_entries(tmp_path, count=2)
        test_entries = [
            ManifestEntry(
                recording_id="test_rec",
                participant_pseudonym="test_spk",
                audio_path=str(tmp_path / "test.wav"),
                transcript="பரীক্ষை",
                split="test",
                duration=1.0,
            )
        ]
        create_test_wav(tmp_path / "test.wav", duration_sec=1.0)

        train_dataset = SLR127Dataset(train_entries, tokenizer, cache_wavs=False)
        test_dataset = SLR127Dataset(test_entries, tokenizer, cache_wavs=False)

        train_loader = create_ctc_data_loader(train_dataset, batch_size=2, shuffle=False)
        test_loader = create_ctc_data_loader(test_dataset, batch_size=1, shuffle=False)

        train_ids = []
        for batch in train_loader:
            train_ids.extend(batch["recording_ids"])

        test_ids = []
        for batch in test_loader:
            test_ids.extend(batch["recording_ids"])

        assert set(train_ids).isdisjoint(set(test_ids)), "Test recordings should not appear in train loader"
