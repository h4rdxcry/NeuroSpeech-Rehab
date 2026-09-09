"""
Wav2Vec2 + CTC trainer for Tamil ASR baseline.
"""
from __future__ import annotations

import os
import json
import logging
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.cuda.amp import GradScaler, autocast
from torch.utils.data import DataLoader

from transformers import Wav2Vec2Model, Wav2Vec2FeatureExtractor

from .tokenizer import TamilTokenizer
from .dataset import SLR127Dataset
from .metrics import compute_cer, compute_wer

logger = logging.getLogger(__name__)


@dataclass
class TrainingConfig:
    """Training configuration for Wav2Vec2 CTC Tamil ASR."""
    model_name: str = "facebook/wav2vec2-base"
    output_dir: str = "D:/NeuroSpeech-Rehab/ml_training/outputs"
    run_name: str = "wav2vec2-ctc-tamil"

    train_batch_size: int = 2
    val_batch_size: int = 2
    gradient_accumulation_steps: int = 4
    max_audio_length_seconds: float = 12.0
    target_sample_rate: int = 16000

    learning_rate: float = 3e-5
    weight_decay: float = 0.01
    adam_beta1: float = 0.9
    adam_beta2: float = 0.98
    adam_epsilon: float = 1e-8
    warmup_steps: int = 500
    max_steps: int = 2000
    lr_scheduler_type: str = "linear"

    dropout: float = 0.1
    attention_dropout: float = 0.1
    hidden_dropout: float = 0.1

    save_steps: int = 500
    save_total_limit: int = 3

    fp16: bool = True

    seed: int = 42

    vocab_path: str = "D:/NeuroSpeech-Rehab/ml_training/tokenizer/vocab.json"

    logging_steps: int = 10
    eval_steps: int = 100

    device: str = "cuda" if torch.cuda.is_available() else "cpu"

    def effective_train_batch_size(self) -> int:
        return self.train_batch_size * self.gradient_accumulation_steps


class Wav2Vec2CTCProcessor:
    """Processor combining Wav2Vec2 feature extractor and Tamil tokenizer."""

    def __init__(
        self,
        tokenizer: TamilTokenizer,
        feature_extractor: Optional[Wav2Vec2FeatureExtractor] = None,
    ):
        self.tokenizer = tokenizer
        if feature_extractor is None:
            self.feature_extractor = Wav2Vec2FeatureExtractor(
                feature_size=1,
                sampling_rate=16000,
                padding_value=0.0,
                do_normalize=True,
                return_attention_mask=True,
            )
        else:
            self.feature_extractor = feature_extractor

    @classmethod
    def from_pretrained(
        cls,
        pretrained_model_name_or_path: str,
        tokenizer: TamilTokenizer,
    ) -> "Wav2Vec2CTCProcessor":
        feature_extractor = Wav2Vec2FeatureExtractor.from_pretrained(
            pretrained_model_name_or_path
        )
        return cls(tokenizer=tokenizer, feature_extractor=feature_extractor)

    def save_pretrained(self, save_dir: str) -> None:
        os.makedirs(save_dir, exist_ok=True)
        self.feature_extractor.save_pretrained(save_dir)
        self.tokenizer.save_vocab(os.path.join(save_dir, "vocab.json"))


class Wav2Vec2CTCModel(nn.Module):
    """Wav2Vec2 backbone with CTC head for Tamil ASR."""

    def __init__(
        self,
        vocab_size: int,
        pretrained_model_name: str = "facebook/wav2vec2-base",
        dropout: float = 0.1,
        attention_dropout: float = 0.1,
        hidden_dropout: float = 0.1,
    ):
        super().__init__()
        self.vocab_size = vocab_size
        self.pretrained_model_name = pretrained_model_name

        self.wav2vec2 = Wav2Vec2Model.from_pretrained(pretrained_model_name)
        self.wav2vec2.config.update(
            {
                "dropout": dropout,
                "attention_dropout": attention_dropout,
                "hidden_dropout": hidden_dropout,
            }
        )

        self.dropout = nn.Dropout(dropout)
        self.lm_head = nn.Linear(self.wav2vec2.config.hidden_size, vocab_size)

        nn.init.xavier_uniform_(self.lm_head.weight)
        nn.init.zeros_(self.lm_head.bias)

    def forward(
        self,
        input_values: torch.Tensor,
        attention_mask: Optional[torch.Tensor] = None,
    ) -> torch.Tensor:
        outputs = self.wav2vec2(input_values, attention_mask=attention_mask)
        hidden_states = outputs.last_hidden_state
        hidden_states = self.dropout(hidden_states)
        logits = self.lm_head(hidden_states)
        return logits


def compute_ctc_loss(
    logits: torch.Tensor,
    labels: torch.Tensor,
    input_lengths: torch.Tensor,
    label_lengths: torch.Tensor,
    blank_id: int = 0,
) -> torch.Tensor:
    """Compute CTC loss."""
    log_probs = F.log_softmax(logits, dim=-1).transpose(0, 1)
    loss = F.ctc_loss(
        log_probs,
        labels,
        input_lengths,
        label_lengths,
        blank=blank_id,
        reduction="mean",
        zero_infinity=True,
    )
    return loss


@dataclass
class TrainingState:
    """Holds training state for checkpointing."""
    global_step: int = 0
    epoch: int = 0
    best_cer: float = float("inf")
    best_wer: float = float("inf")
    best_checkpoint_path: Optional[str] = None


def create_ctc_data_loader(
    dataset: SLR127Dataset,
    batch_size: int = 2,
    shuffle: bool = True,
    num_workers: int = 0,
    pin_memory: bool = False,
    persistent_workers: bool = False,
) -> DataLoader:
    """Create DataLoader with CTC-friendly collate function."""

    def ctc_collate_fn(batch):
        input_values = [item["input_values"] for item in batch]
        labels = [item["labels"] for item in batch]
        input_lengths = [item["input_lengths"] for item in batch]
        label_lengths = [item["label_lengths"] for item in batch]
        transcripts = [item["transcript"] for item in batch]
        recording_ids = [item["recording_id"] for item in batch]
        participant_pseudonyms = [item["participant_pseudonym"] for item in batch]

        input_values_padded = torch.nn.utils.rnn.pad_sequence(
            input_values, batch_first=True, padding_value=0.0
        )

        flattened_labels = torch.cat(labels)
        input_lengths = torch.stack(input_lengths)
        label_lengths = torch.stack(label_lengths)

        return {
            "input_values": input_values_padded,
            "labels": flattened_labels,
            "input_lengths": input_lengths,
            "label_lengths": label_lengths,
            "transcripts": transcripts,
            "recording_ids": recording_ids,
            "participant_pseudonyms": participant_pseudonyms,
        }

    return DataLoader(
        dataset,
        batch_size=batch_size,
        shuffle=shuffle,
        num_workers=num_workers,
        pin_memory=pin_memory,
        persistent_workers=persistent_workers and num_workers > 0,
        collate_fn=ctc_collate_fn,
    )


class Wav2Vec2CTCTrainer:
    """Trainer for Wav2Vec2 + CTC Tamil ASR."""

    def __init__(
        self,
        config: TrainingConfig,
        model: Wav2Vec2CTCModel,
        train_loader: DataLoader,
        val_loader: DataLoader,
        tokenizer: TamilTokenizer,
        processor: Optional[Wav2Vec2CTCProcessor] = None,
    ):
        self.config = config
        self.model = model.to(config.device)
        self.train_loader = train_loader
        self.val_loader = val_loader
        self.tokenizer = tokenizer
        self.processor = processor

        self.optimizer = torch.optim.AdamW(
            self.model.parameters(),
            lr=config.learning_rate,
            weight_decay=config.weight_decay,
            betas=(config.adam_beta1, config.adam_beta2),
            eps=config.adam_epsilon,
        )

        num_training_steps = config.max_steps
        num_warmup = config.warmup_steps

        def lr_lambda(current_step: int) -> float:
            if current_step < num_warmup:
                return float(current_step) / float(max(1, num_warmup))
            return max(
                0.0,
                float(num_training_steps - current_step)
                / float(max(1, num_training_steps - num_warmup)),
            )

        self.lr_scheduler = torch.optim.lr_scheduler.LambdaLR(
            self.optimizer, lr_lambda
        )

        self.scaler = GradScaler() if config.fp16 and config.device == "cuda" else None
        self.state = TrainingState()
        self.mlflow_run = None

        os.makedirs(config.output_dir, exist_ok=True)

        if config.device == "cuda":
            self.model.wav2vec2.gradient_checkpointing_enable()

    def _log_gpu_memory(self) -> Dict[str, float]:
        if torch.cuda.is_available():
            return {
                "gpu_memory_allocated_mb": torch.cuda.memory_allocated() / 1024**2,
                "gpu_memory_reserved_mb": torch.cuda.memory_reserved() / 1024**2,
                "gpu_memory_max_allocated_mb": torch.cuda.max_memory_allocated() / 1024**2,
            }
        return {}

    def _build_attention_mask(self, input_values: torch.Tensor, input_lengths: Optional[torch.Tensor] = None) -> torch.Tensor:
        batch_size, max_length = input_values.shape[:2]
        lengths = (input_lengths.to(input_values.device).clamp(max=max_length) if input_lengths is not None
                   else torch.full((batch_size,), max_length, device=input_values.device))
        return (torch.arange(max_length, device=input_values.device)[None, :] < lengths[:, None]).long()

    def _output_lengths(self, attention_mask: torch.Tensor, logits: torch.Tensor) -> torch.Tensor:
        return self.model.wav2vec2._get_feat_extract_output_lengths(attention_mask.sum(-1)).clamp(max=logits.shape[1]).long()

    def train_step(self, batch: Dict[str, Any]) -> Tuple[torch.Tensor, Dict[str, float]]:
        self.model.train()

        input_values = batch["input_values"].to(self.config.device)
        labels = batch["labels"].to(self.config.device)
        label_lengths = batch["label_lengths"].to(self.config.device)

        max_samples = int(self.config.max_audio_length_seconds * self.config.target_sample_rate)
        if input_values.shape[1] > max_samples:
            raise ValueError("Audio exceeds the configured model duration; filter or align segments before training/evaluation")

        attention_mask = self._build_attention_mask(input_values, batch.get("input_lengths"))

        if self.scaler is not None:
            with autocast():
                logits = self.model(input_values, attention_mask=attention_mask)
                input_lengths = self._output_lengths(attention_mask, logits)
                loss = compute_ctc_loss(
                    logits, labels, input_lengths, label_lengths
                )
                loss = loss / self.config.gradient_accumulation_steps
        else:
            logits = self.model(input_values, attention_mask=attention_mask)
            input_lengths = self._output_lengths(attention_mask, logits)
            loss = compute_ctc_loss(
                logits, labels, input_lengths, label_lengths
            )
            loss = loss / self.config.gradient_accumulation_steps

        if self.scaler is not None:
            self.scaler.scale(loss).backward()
        else:
            loss.backward()

        return loss, {}

    def train_epoch(self) -> Dict[str, float]:
        self.model.train()
        total_loss = 0.0
        num_batches = 0

        for batch_idx, batch in enumerate(self.train_loader):
            loss, _ = self.train_step(batch)
            total_loss += loss.item() * self.config.gradient_accumulation_steps
            num_batches += 1

            if (batch_idx + 1) % self.config.gradient_accumulation_steps == 0:
                if self.scaler is not None:
                    self.scaler.unscale_(self.optimizer)
                    torch.nn.utils.clip_grad_norm_(self.model.parameters(), 1.0)
                    self.scaler.step(self.optimizer)
                    self.scaler.update()
                else:
                    torch.nn.utils.clip_grad_norm_(self.model.parameters(), 1.0)
                    self.optimizer.step()

                self.lr_scheduler.step()
                self.optimizer.zero_grad()
                self.state.global_step += 1

                if self.state.global_step % self.config.logging_steps == 0:
                    lr = self.lr_scheduler.get_last_lr()[0]
                    gpu_mem = self._log_gpu_memory()
                    mem_str = ", ".join(
                        f"{k}={v:.1f}" for k, v in gpu_mem.items()
                    )
                    logger.info(
                        f"Step {self.state.global_step}: loss={loss.item() * self.config.gradient_accumulation_steps:.4f}, lr={lr:.2e}, {mem_str}"
                    )

                if self.state.global_step >= self.config.max_steps:
                    break

        return {"train_loss": total_loss / max(1, num_batches)}

    @torch.no_grad()
    def evaluate(self, dataloader: DataLoader) -> Dict[str, float]:
        self.model.eval()
        total_loss = 0.0
        all_predictions: List[str] = []
        all_references: List[str] = []
        num_batches = 0

        for batch in dataloader:
            input_values = batch["input_values"].to(self.config.device)
            labels = batch["labels"].to(self.config.device)
            label_lengths = batch["label_lengths"].to(self.config.device)
            transcripts = batch.get("transcripts")
            if transcripts is None or len(transcripts) != input_values.shape[0] or any(not isinstance(t, str) or not t.strip() for t in transcripts):
                raise ValueError("Evaluation requires original nonempty reference transcripts")

            max_samples = int(self.config.max_audio_length_seconds * self.config.target_sample_rate)
            if input_values.shape[1] > max_samples:
                raise ValueError("Audio exceeds the configured model duration; filter or align segments before training/evaluation")

            attention_mask = self._build_attention_mask(input_values, batch.get("input_lengths"))
            logits = self.model(input_values, attention_mask=attention_mask)
            input_lengths = self._output_lengths(attention_mask, logits)
            loss = compute_ctc_loss(logits, labels, input_lengths, label_lengths)
            total_loss += loss.item()
            num_batches += 1

            predicted_ids = logits.argmax(dim=-1).cpu().numpy()
            for i in range(predicted_ids.shape[0]):
                pred_text = self.tokenizer.decode(predicted_ids[i, :input_lengths[i].item()].tolist())
                all_predictions.append(pred_text)

            # References are original text, never CTC-collapsed model targets.
            all_references.extend(transcripts)

        if not all_references:
            raise ValueError("Evaluation requires at least one labeled utterance")

        cer = compute_cer(all_predictions, all_references)
        wer = compute_wer(all_predictions, all_references)

        return {
            "eval_loss": total_loss / max(1, num_batches),
            "cer": cer,
            "wer": wer,
        }

    def save_checkpoint(self, is_best: bool = False) -> None:
        checkpoint: Dict[str, Any] = {
            "model_state_dict": self.model.state_dict(),
            "optimizer_state_dict": self.optimizer.state_dict(),
            "lr_scheduler_state_dict": self.lr_scheduler.state_dict(),
            "state": self.state.__dict__,
            "config": self.config.__dict__,
            "tokenizer_vocab": self.tokenizer.get_vocab(),
            "tokenizer_vocab_size": self.tokenizer.get_vocab_size(),
        }

        if self.scaler is not None:
            checkpoint["scaler_state_dict"] = self.scaler.state_dict()

        checkpoint_path = os.path.join(
            self.config.output_dir, f"checkpoint-{self.state.global_step}.pt"
        )
        torch.save(checkpoint, checkpoint_path)

        if is_best:
            best_path = os.path.join(self.config.output_dir, "best-checkpoint.pt")
            torch.save(checkpoint, best_path)
            self.state.best_checkpoint_path = best_path

        self._cleanup_checkpoints()

    def load_checkpoint(self, checkpoint_path: str) -> None:
        checkpoint = torch.load(checkpoint_path, map_location=self.config.device)
        self.model.load_state_dict(checkpoint["model_state_dict"])
        self.optimizer.load_state_dict(checkpoint["optimizer_state_dict"])
        self.lr_scheduler.load_state_dict(checkpoint["lr_scheduler_state_dict"])
        self.state = TrainingState(**checkpoint["state"])
        if self.scaler is not None and "scaler_state_dict" in checkpoint:
            self.scaler.load_state_dict(checkpoint["scaler_state_dict"])

    def _cleanup_checkpoints(self) -> None:
        import glob

        checkpoints = sorted(
            glob.glob(os.path.join(self.config.output_dir, "checkpoint-*.pt"))
        )
        while len(checkpoints) > self.config.save_total_limit:
            os.remove(checkpoints.pop(0))

    def _save_run_config(self, dataset_id: str, manifest_hash: str) -> None:
        run_config = {
            "model_name": self.config.model_name,
            "vocab_size": self.tokenizer.get_vocab_size(),
            "dataset_id": dataset_id,
            "manifest_hash": manifest_hash,
            "split_seed": self.config.seed,
            "train_batch_size": self.config.train_batch_size,
            "gradient_accumulation_steps": self.config.gradient_accumulation_steps,
            "effective_batch_size": self.config.effective_train_batch_size(),
            "learning_rate": self.config.learning_rate,
            "max_steps": self.config.max_steps,
            "fp16": self.config.fp16,
            "device": self.config.device,
            "software": {
                "python": torch.__version__,  # actually torch version, not python
                "torch": self._get_torch_version(),
                "transformers": self._get_transformers_version(),
                "librosa": self._get_librosa_version(),
                "mlflow": self._get_mlflow_version(),
            },
            "hardware": {
                "device": self.config.device,
                "gpu_name": torch.cuda.get_device_name(0) if torch.cuda.is_available() else "N/A",
            },
        }
        config_path = os.path.join(self.config.output_dir, "training_config.json")
        with open(config_path, "w", encoding="utf-8") as f:
            json.dump(run_config, f, indent=2, ensure_ascii=False)

    @staticmethod
    def _get_torch_version() -> str:
        import torch

        return torch.__version__

    @staticmethod
    def _get_transformers_version() -> str:
        import transformers

        return transformers.__version__

    @staticmethod
    def _get_librosa_version() -> str:
        import librosa

        return librosa.__version__

    @staticmethod
    def _get_mlflow_version() -> str:
        try:
            import mlflow

            return mlflow.__version__
        except Exception:
            return "not_installed"

    def train(
        self,
        train_loader: DataLoader,
        val_loader: DataLoader,
        dataset_id: str,
        manifest_hash: str,
        val_eval_loader: Optional[DataLoader] = None,
    ) -> None:
        try:
            import mlflow

            mlflow.set_experiment(self.config.run_name)
            self.mlflow_run = mlflow.start_run()
            mlflow.log_params(
                {
                    "model_name": self.config.model_name,
                    "vocab_size": self.tokenizer.get_vocab_size(),
                    "dataset_id": dataset_id,
                    "manifest_hash": manifest_hash,
                    "split_seed": self.config.seed,
                    "train_batch_size": self.config.train_batch_size,
                    "gradient_accumulation_steps": self.config.gradient_accumulation_steps,
                    "effective_batch_size": self.config.effective_train_batch_size(),
                    "learning_rate": self.config.learning_rate,
                    "max_steps": self.config.max_steps,
                    "fp16": self.config.fp16,
                    "device": self.config.device,
                }
            )
        except Exception as exc:  # pragma: no cover - MLflow optional
            logger.warning("MLflow logging disabled: %s", exc)

        try:
            self._save_run_config(dataset_id, manifest_hash)

            while True:
                self.state.epoch += 1
                train_metrics = self.train_epoch()
                logger.info("Epoch %d: %s", self.state.epoch, train_metrics)

                if self.mlflow_run is not None:
                    try:
                        import mlflow

                        mlflow.log_metrics(
                            {f"train_{k}": v for k, v in train_metrics.items()},
                            step=self.state.global_step,
                        )
                    except Exception:
                        pass

                if val_loader is not None and self.state.global_step % self.config.eval_steps == 0:
                    eval_loader = val_eval_loader if val_eval_loader is not None else val_loader
                    val_metrics = self.evaluate(eval_loader)
                    logger.info("Validation: %s", val_metrics)

                    if self.mlflow_run is not None:
                        try:
                            import mlflow

                            mlflow.log_metrics(
                                {f"eval_{k}": v for k, v in val_metrics.items()},
                                step=self.state.global_step,
                            )
                        except Exception:
                            pass

                    if val_metrics["cer"] < self.state.best_cer:
                        self.state.best_cer = val_metrics["cer"]
                        self.state.best_wer = val_metrics["wer"]
                        self.save_checkpoint(is_best=True)

                if self.state.global_step % self.config.save_steps == 0:
                    self.save_checkpoint()

                if self.state.global_step >= self.config.max_steps:
                    break
        finally:
            if self.mlflow_run is not None:
                try:
                    import mlflow

                    mlflow.end_run()
                except Exception:
                    pass
