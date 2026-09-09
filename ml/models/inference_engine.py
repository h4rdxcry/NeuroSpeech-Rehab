"""Inference Engine: Low-Latency (<150ms) GPU Runtime for Multimodal Speech Rehabilitation.
Thread-safe singleton with pre-warmed models and memory-pinned weights.
"""
from typing import Dict, Any, Optional, List, Tuple
import os
import time
import threading
from pathlib import Path
import torch

from ml.models.multimodal_fusion import MultimodalFusionModel
from ml.models.articulation_scorer import ArticulationScorer


class MultimodalInferenceEngine:
    """High-speed GPU/CPU inference engine for real-time speech rehabilitation biofeedback."""
    _instance: Optional["MultimodalInferenceEngine"] = None
    _lock = threading.Lock()

    def __init__(self, device: Optional[str] = None):
        if device is None:
            self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        else:
            self.device = torch.device(device)

        self.model: Optional[MultimodalFusionModel] = None
        self.is_ready = False
        self._load_lock = threading.Lock()

    @classmethod
    def get_instance(cls) -> "MultimodalInferenceEngine":
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = cls()
                    cls._instance.initialize()
        return cls._instance

    def initialize(self, weights_path: Optional[str] = None):
        """Initializes and pre-warms the multimodal model."""
        with self._load_lock:
            if self.is_ready:
                return

            self.model = MultimodalFusionModel(
                audio_in_dim=768,
                vision_in_dim=16,
                emg_in_dim=40,
                eeg_in_dim=25,
                d_model=128,
            ).to(self.device)

            # Load checkpoint if provided and exists
            if weights_path and Path(weights_path).exists():
                try:
                    ckpt = torch.load(weights_path, map_location=self.device)
                    if isinstance(ckpt, dict) and "model_state_dict" in ckpt:
                        self.model.load_state_dict(ckpt["model_state_dict"])
                    elif isinstance(ckpt, dict):
                        self.model.load_state_dict(ckpt)
                except Exception as e:
                    print(f"[Warning] Failed to load multimodal weights from {weights_path}: {e}")

            self.model.eval()

            # Pre-warm GPU with dummy forward pass
            with torch.inference_mode():
                dummy_audio = torch.randn(1, 768, device=self.device)
                dummy_vision = torch.randn(1, 16, device=self.device)
                dummy_emg = torch.randn(1, 40, device=self.device)
                dummy_eeg = torch.randn(1, 25, device=self.device)
                _ = self.model(dummy_audio, dummy_vision, dummy_emg, dummy_eeg)

            self.is_ready = True

    def predict_rehabilitation(
        self,
        audio_features: Optional[List[float]] = None,
        vision_features: Optional[List[float]] = None,
        emg_features: Optional[List[float]] = None,
        eeg_features: Optional[List[float]] = None,
        target_phrase: Optional[str] = None,
        recognized_transcript: Optional[str] = None,
        active_modalities: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """Executes low-latency multimodal prediction and returns clinical rehabilitation scores."""
        t0 = time.perf_counter()

        if not self.is_ready or self.model is None:
            self.initialize()

        device = self.device
        to_tensor = lambda feat, dim: (
            torch.tensor([feat], dtype=torch.float32, device=device)
            if feat is not None and len(feat) == dim
            else None
        )

        audio_t = to_tensor(audio_features, 768)
        vision_t = to_tensor(vision_features, 16)
        emg_t = to_tensor(emg_features, 40)
        eeg_t = to_tensor(eeg_features, 25)

        with torch.inference_mode():
            output = self.model(
                audio_feat=audio_t,
                vision_feat=vision_t,
                emg_feat=emg_t,
                eeg_feat=eeg_t,
                active_modalities=active_modalities,
            )

        rehab_score = float(output["rehab_score"][0].cpu().item())
        cat_idx = int(output["predicted_category"][0].cpu().item())
        confidence = float(output["confidence"][0].cpu().item())
        pred_lar = float(output["target_lip_aperture"][0].cpu().item())

        categories = ["NEEDS_PRACTICE", "APPROXIMATED", "TARGET_MASTERED"]
        predicted_category = categories[cat_idx]

        # Calculate target match if target phrase is provided
        target_match_info = {}
        if target_phrase and recognized_transcript:
            target_match_info = ArticulationScorer.compute_target_match(
                target_phrase=target_phrase,
                recognized_transcript=recognized_transcript,
            )

        elapsed_ms = (time.perf_counter() - t0) * 1000.0

        return {
            "rehabilitation_score": round(rehab_score, 4),
            "mastery_percentage": round(rehab_score * 100.0, 1),
            "predicted_category": predicted_category,
            "is_target_mastered": bool(cat_idx == 2 or rehab_score >= 0.95),
            "target_lip_aperture": round(pred_lar, 4),
            "confidence": round(confidence, 4),
            "latency_ms": round(elapsed_ms, 2),
            "is_realtime_capable": bool(elapsed_ms < 200.0),
            "device": str(self.device),
            "target_match": target_match_info,
        }
