"""ML Training Pipeline for SLR127 Wav2Vec2 CTC."""
from .manifest_builder import SLR127ManifestBuilder, ManifestEntry, build_slr127_manifest
from .tokenizer import TamilTokenizer
from .dataset import SLR127Dataset, AudioFeatures, create_data_loader, set_deterministic_seeds
from .trainer import (
    Wav2Vec2CTCTrainer,
    Wav2Vec2CTCModel,
    Wav2Vec2CTCProcessor,
    TrainingConfig,
    compute_ctc_loss,
    TrainingState,
    create_ctc_data_loader,
)
from .metrics import compute_cer, compute_wer

__all__ = [
    "SLR127ManifestBuilder",
    "ManifestEntry",
    "build_slr127_manifest",
    "TamilTokenizer",
    "SLR127Dataset",
    "AudioFeatures",
    "create_data_loader",
    "create_ctc_data_loader",
    "set_deterministic_seeds",
    "Wav2Vec2CTCTrainer",
    "Wav2Vec2CTCModel",
    "Wav2Vec2CTCProcessor",
    "TrainingConfig",
    "compute_ctc_loss",
    "TrainingState",
    "compute_cer",
    "compute_wer",
]