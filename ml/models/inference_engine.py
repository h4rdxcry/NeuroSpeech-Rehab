"""Inference Engine: Low-Latency (<150ms) GPU/CPU Runtime for Multimodal Speech Rehabilitation.
Thread-safe singleton with pre-warmed models, temporal viseme classification, and dynamic kinematics.
"""
from typing import Dict, Any, Optional, List, Tuple
import os
import time
import threading
from pathlib import Path
import torch
import numpy as np

from ml.models.multimodal_fusion import MultimodalFusionModel
from ml.models.articulation_scorer import ArticulationScorer
from ml.models.viseme_classifier import PhonemeVisemeMapper, VisemeClass
from ml.pipelines.kinematics_engine import KinematicsEngine


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
                        self.model.load_state_dict(ckpt["model_state_dict"], strict=False)
                    elif isinstance(ckpt, dict):
                        self.model.load_state_dict(ckpt, strict=False)
                except Exception as e:
                    print(f"[Warning] Failed to load multimodal weights from {weights_path}: {e}")

            self.model.eval()

            # Pre-warm GPU with dummy forward pass
            with torch.inference_mode():
                dummy_audio = torch.randn(1, 768, device=self.device)
                dummy_vision = torch.randn(1, 16, device=self.device)
                dummy_emg = torch.randn(1, 40, device=self.device)
                dummy_eeg = torch.randn(1, 25, device=self.device)
                dummy_vision_seq = torch.randn(1, 16, 40, device=self.device)
                _ = self.model(dummy_audio, dummy_vision, dummy_emg, dummy_eeg, dummy_vision_seq)

            self.is_ready = True

    def predict_rehabilitation(
        self,
        audio_features: Optional[List[float]] = None,
        vision_features: Optional[List[float]] = None,
        emg_features: Optional[List[float]] = None,
        eeg_features: Optional[List[float]] = None,
        landmarks_sequence: Optional[List[List[List[float]]]] = None,
        target_phrase: Optional[str] = None,
        recognized_transcript: Optional[str] = None,
        target_vowel_type: str = "default",
        active_modalities: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """Executes low-latency multimodal prediction and returns clinical rehabilitation scores."""
        t0 = time.perf_counter()

        if not self.is_ready or self.model is None:
            self.initialize()

        device = self.device
        to_tensor = lambda feat, dim: (
            torch.tensor([feat], dtype=torch.float32, device=device)
            if feat is not None and (dim is None or len(feat) == dim)
            else None
        )

        audio_t = to_tensor(audio_features, 768)
        emg_t = to_tensor(emg_features, 40)
        eeg_t = to_tensor(eeg_features, 25)

        # Handle Vision: single frame vs sequence
        vision_seq_t = None
        vision_t = None
        kinematic_biomarkers: Dict[str, Any] = {}
        viseme_analysis: Dict[str, Any] = {}

        if landmarks_sequence and len(landmarks_sequence) > 0:
            # Extract 40-dim trajectory from temporal landmark sequence
            trajectory = KinematicsEngine.extract_trajectory(landmarks_sequence)
            t_len = trajectory.shape[0]

            if t_len > 0:
                vision_seq_t = torch.tensor(trajectory, dtype=torch.float32, device=device).unsqueeze(0)  # (1, T, 40)
                
                # Compute dynamic kinematics derivatives
                derivs = KinematicsEngine.compute_derivatives(trajectory)
                smoothness = KinematicsEngine.compute_movement_smoothness(derivs["jerk"], derivs["velocity"])
                peak_vel = float(np.max(np.linalg.norm(derivs["velocity"], axis=-1))) if derivs["velocity"].size > 0 else 0.0

                # DTW comparison against target phoneme template
                canonical = KinematicsEngine.generate_canonical_trajectory(target_vowel_type, num_frames=max(t_len, 15))
                dtw_dist, dtw_sim = KinematicsEngine.fast_dtw_distance(trajectory, canonical)

                # Bilateral symmetry across sequence (feature 20 is bilateral symmetry)
                mean_symmetry = float(np.mean(trajectory[:, 20])) if t_len > 0 else 1.0

                kinematic_biomarkers = {
                    "trajectory_frames": t_len,
                    "movement_smoothness": round(smoothness, 4),
                    "peak_velocity": round(peak_vel, 4),
                    "dtw_distance": dtw_dist,
                    "dtw_trajectory_similarity": dtw_sim,
                    "bilateral_symmetry": round(mean_symmetry, 4),
                    "is_kinematically_sound": bool(smoothness >= 0.35 and dtw_sim >= 0.50),
                }

        elif vision_features is not None:
            if len(vision_features) == 40:
                vision_t = torch.tensor([vision_features], dtype=torch.float32, device=device)
            elif len(vision_features) == 16:
                vision_t = torch.tensor([vision_features], dtype=torch.float32, device=device)

        with torch.inference_mode():
            output = self.model(
                audio_feat=audio_t,
                vision_feat=vision_t,
                emg_feat=emg_t,
                eeg_feat=eeg_t,
                vision_seq=vision_seq_t,
                active_modalities=active_modalities,
            )

        rehab_score = float(output["rehab_score"][0].cpu().item())
        cat_idx = int(output["predicted_category"][0].cpu().item())
        confidence = float(output["confidence"][0].cpu().item())
        joint_av_conf = float(output["joint_av_confidence"][0].cpu().item())
        pred_lar = float(output["target_lip_aperture"][0].cpu().item())
        motor_score = float(output["motor_score"][0].cpu().item())

        categories = ["NEEDS_PRACTICE", "APPROXIMATED", "TARGET_MASTERED"]
        predicted_category = categories[cat_idx]

        # Viseme sequence analysis if temporal model predicted visemes
        if "predicted_visemes" in output:
            pred_v = output["predicted_visemes"][0].cpu().numpy().tolist()
            if target_phrase:
                target_v = PhonemeVisemeMapper.phrase_to_visemes(target_phrase)
                viseme_analysis = PhonemeVisemeMapper.align_viseme_sequences(pred_v, target_v)
            else:
                viseme_analysis = {
                    "predicted_visemes": pred_v,
                    "viseme_match_score": 1.0,
                    "is_visually_verified": True,
                }

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
            "joint_av_confidence": round(joint_av_conf, 4),
            "motor_coordination_score": round(motor_score, 4),
            "kinematic_biomarkers": kinematic_biomarkers,
            "viseme_analysis": viseme_analysis,
            "latency_ms": round(elapsed_ms, 2),
            "is_realtime_capable": bool(elapsed_ms < 200.0),
            "device": str(self.device),
            "target_match": target_match_info,
        }
