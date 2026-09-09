import os
from pathlib import Path
from typing import Optional, Dict, Any
import asyncio
import threading
from dataclasses import dataclass

import torch
import numpy as np

from app.core.config import get_settings


@dataclass
class ASRResult:
    transcript: str
    model_name: str
    model_version: str
    feature_pipeline_version: str
    training_dataset_version: str
    prediction_type: str
    model_scope: str
    notes: str
    confidence: Optional[float] = None
    prediction_json: Optional[Dict[str, Any]] = None


class ASRInferenceError(Exception):
    pass


class TamilASRInference:
    """Real Wav2Vec2 ASR inference for the SLR127 Tamil baseline."""

    _instance: Optional["TamilASRInference"] = None

    def __init__(self, checkpoint_path: Optional[str] = None):
        self.settings = get_settings()
        self.checkpoint_path = checkpoint_path or os.environ.get(
            "NEUROSPEECH_ASR_CHECKPOINT",
            str(Path(__file__).resolve().parents[3] / "ml_training" / "outputs" / "baseline" / "best-checkpoint.pt"),
        )
        self._model = None
        self._processor = None
        self._vocab = None
        self._config = None
        self._load_lock = asyncio.Lock()
        self._thread_load_lock = threading.RLock()

    @classmethod
    def get_instance(cls) -> "TamilASRInference":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def _ensure_loaded(self) -> None:
        with self._thread_load_lock:
            self._load_model()

    def _load_model(self) -> None:
        if self._model is not None:
            return
        if not os.path.exists(self.checkpoint_path):
            raise ASRInferenceError(f"ASR checkpoint not found: {self.checkpoint_path}")

        try:
            from transformers import Wav2Vec2ForCTC, Wav2Vec2Processor
        except ImportError as exc:
            raise ASRInferenceError("transformers is required for ASR inference") from exc

        self._device = "cuda" if torch.cuda.is_available() else "cpu"
        state = torch.load(self.checkpoint_path, map_location=self._device)
        self._config = state.get("config", {})
        self._vocab = state.get("tokenizer_vocab", {})

        base_model_name = self._config.get("model_name", "facebook/wav2vec2-base")
        self._processor = Wav2Vec2Processor.from_pretrained(base_model_name)
        self._model = Wav2Vec2ForCTC.from_pretrained(
            base_model_name,
            vocab_size=state.get("tokenizer_vocab_size", len(self._vocab)),
        ).to(self._device)
        self._model.load_state_dict(state["model_state_dict"])
        self._model.eval()

    async def load(self) -> None:
        async with self._load_lock:
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(None, self._ensure_loaded)

    def _decode_vocab(self, pred_ids: list[int]) -> str:
        if not self._vocab:
            return ""
        idx_to_char = {v: k for k, v in self._vocab.items()}
        collapsed = []
        prev = None
        for idx in pred_ids:
            if idx != 0 and idx != prev:
                collapsed.append(idx)
                prev = idx
            elif idx == 0:
                prev = None
        return "".join(idx_to_char.get(idx, "") for idx in collapsed)

    def run_inference(self, audio_path: str, target_phrase: Optional[str] = None) -> ASRResult:
        self._ensure_loaded()

        try:
            import soundfile as sf
        except ImportError as exc:
            raise ASRInferenceError("soundfile is required for ASR inference") from exc

        if not os.path.exists(audio_path):
            raise ASRInferenceError(f"Audio file not found: {audio_path}")
        if not os.path.isfile(audio_path):
            raise ASRInferenceError(f"Audio path is not a file: {audio_path}")

        try:
            with sf.SoundFile(audio_path) as f:
                if f.samplerate != 16000 or f.channels != 1:
                    raise ASRInferenceError(
                        f"Audio must be 16 kHz mono; got {f.samplerate} Hz / {f.channels} ch"
                    )
                audio = f.read(dtype="float32")
        except ASRInferenceError:
            raise
        except Exception as exc:
            raise ASRInferenceError(f"Failed to read audio file: {exc}") from exc

        target_sr = self._config.get("target_sample_rate", 16000)
        max_len_sec = self._config.get("max_audio_length_seconds", 12.0)
        max_samples = int(target_sr * max_len_sec)
        if audio.shape[0] > max_samples:
            raise ASRInferenceError(f"Audio exceeds model limit of {max_len_sec} seconds; segment it first")

        inputs = self._processor(audio, sampling_rate=target_sr, return_tensors="pt")
        input_values = inputs.input_values.to(self._device)
        with torch.inference_mode():
            logits = self._model(input_values).logits
        pred_ids = torch.argmax(logits, dim=-1)[0].tolist()
        transcript = self._decode_vocab(pred_ids)

        model_name = self._config.get("model_name", "wav2vec2-tamil-baseline")
        model_version = os.path.basename(self.checkpoint_path)
        feature_pipeline_version = "wav2vec2-feat-v1"
        training_dataset_version = "IISc-MILE Tamil ASR Corpus (OpenSLR 127)"

        rehab_target_info = None
        if target_phrase:
            from ml.models.articulation_scorer import ArticulationScorer
            rehab_target_info = ArticulationScorer.compute_target_match(target_phrase, transcript)

        prediction_json = {
            "transcript": transcript,
            "model_name": model_name,
            "model_scope": "IISc-MILE Tamil ASR Corpus (OpenSLR 127) general speech baseline",
            "notes": "This model is a general Tamil speech baseline, not a dysarthria-specific model.",
            "sample_rate": target_sr,
            "audio_duration_seconds": round(float(audio.shape[0]) / float(target_sr), 3),
            "device": str(self._device),
        }
        if rehab_target_info:
            prediction_json["rehab_target_verification"] = rehab_target_info

        return ASRResult(
            transcript=transcript,
            model_name=model_name,
            model_version=model_version,
            feature_pipeline_version=feature_pipeline_version,
            training_dataset_version=training_dataset_version,
            prediction_type="asr_transcript",
            model_scope="IISc-MILE Tamil ASR Corpus (OpenSLR 127) general speech baseline",
            notes="This model is a general Tamil speech baseline, not a dysarthria-specific model.",
            prediction_json=prediction_json,
        )
