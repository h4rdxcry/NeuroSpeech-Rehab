"""Inference Engine: Low-Latency (<150ms) GPU/CPU Runtime for Multimodal Speech Rehabilitation.
Thread-safe singleton with pre-warmed models, dual-stream visual speech fusion, and CTC beam search.
"""
from typing import Dict, Any, Optional, List, Tuple, Union
import os
import time
import threading
from pathlib import Path
import torch
import numpy as np

from ml.models.multimodal_fusion import MultimodalFusionModel
from ml.models.articulation_scorer import ArticulationScorer
from ml.models.viseme_classifier import PhonemeVisemeMapper, VisemeClass
from ml.models.dual_stream_visual_encoder import DualStreamVisualSpeechEncoder
from ml.models.viseme_beam_search import VisemeBeamSearchDecoder
from ml.pipelines.kinematics_engine import KinematicsEngine
from ml.pipelines.mouth_roi_extractor import MouthROIExtractor
from ml.pipelines.landmark_filter import OneEuroFilter, PatientBaselineCalibrator
from ml.pipelines.action_unit_extractor import ActionUnitExtractor


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
        self.dual_stream_encoder: Optional[DualStreamVisualSpeechEncoder] = None
        self.beam_decoder: Optional[VisemeBeamSearchDecoder] = None
        self.landmark_filter = OneEuroFilter(min_cutoff=1.0, beta=0.007)
        self.baseline_calibrator = PatientBaselineCalibrator()
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
        """Initializes and pre-warms the multimodal model and dual-stream visual speech networks."""
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

            self.dual_stream_encoder = DualStreamVisualSpeechEncoder(
                kinematics_dim=40,
                pixel_channels=1,
                hidden_dim=64,
                d_model=128,
                num_viseme_classes=8,
            ).to(self.device)

            self.beam_decoder = VisemeBeamSearchDecoder(beam_width=8)

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
            self.dual_stream_encoder.eval()

            # Pre-warm GPU with dummy forward pass
            with torch.inference_mode():
                dummy_audio = torch.randn(1, 768, device=self.device)
                dummy_vision = torch.randn(1, 16, device=self.device)
                dummy_emg = torch.randn(1, 40, device=self.device)
                dummy_eeg = torch.randn(1, 25, device=self.device)
                dummy_vision_seq = torch.randn(1, 16, 40, device=self.device)
                dummy_pixels = torch.randn(1, 1, 16, 48, 48, device=self.device)
                _ = self.model(dummy_audio, dummy_vision, dummy_emg, dummy_eeg, dummy_vision_seq)
                _ = self.dual_stream_encoder(dummy_vision_seq, dummy_pixels)

            self.is_ready = True

    def predict_rehabilitation(
        self,
        audio_features: Optional[List[float]] = None,
        vision_features: Optional[List[float]] = None,
        emg_features: Optional[List[float]] = None,
        eeg_features: Optional[List[float]] = None,
        landmarks_sequence: Optional[List[List[List[float]]]] = None,
        mouth_frames_sequence: Optional[List[Any]] = None,
        patient_baseline: Optional[Dict[str, Any]] = None,
        target_phrase: Optional[str] = None,
        recognized_transcript: Optional[str] = None,
        target_vowel_type: str = "default",
        active_modalities: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """Executes low-latency multimodal prediction with 1€ filter, FACS Action Units, and beam search."""
        t0 = time.perf_counter()

        if not self.is_ready or self.model is None or self.dual_stream_encoder is None or self.beam_decoder is None:
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

        vision_seq_t = None
        vision_t = None
        kinematic_biomarkers: Dict[str, Any] = {}
        viseme_analysis: Dict[str, Any] = {}
        visual_word_decoding: Dict[str, Any] = {}
        dual_stream_info: Dict[str, Any] = {}

        # 1. Kinematics & FACS processing if landmarks sequence provided
        filtered_landmarks = None
        if landmarks_sequence and len(landmarks_sequence) > 0:
            # Apply adaptive 1€ filter to eliminate high-frequency webcam jitter
            filtered_landmarks = self.landmark_filter.filter_sequence(landmarks_sequence)
            trajectory = KinematicsEngine.extract_trajectory(filtered_landmarks)
            t_len = trajectory.shape[0]

            if t_len > 0:
                vision_seq_t = torch.tensor(trajectory, dtype=torch.float32, device=device).unsqueeze(0)  # (1, T, 40)
                
                derivs = KinematicsEngine.compute_derivatives(trajectory)
                smoothness = KinematicsEngine.compute_movement_smoothness(derivs["jerk"], derivs["velocity"])
                peak_vel = float(np.max(np.linalg.norm(derivs["velocity"], axis=-1))) if derivs["velocity"].size > 0 else 0.0

                canonical = KinematicsEngine.generate_canonical_trajectory(target_vowel_type, num_frames=max(t_len, 15))
                dtw_dist, dtw_sim = KinematicsEngine.fast_dtw_distance(trajectory, canonical)
                mean_symmetry = float(np.mean(trajectory[:, 20])) if t_len > 0 else 1.0

                # Extract continuous FACS Action Units (AU10, AU12, AU14, AU15, AU17, AU18, AU20, AU25, AU26)
                action_units_data = ActionUnitExtractor.extract_sequence(
                    filtered_landmarks,
                    baseline_profile=patient_baseline,
                )

                kinematic_biomarkers = {
                    "trajectory_frames": t_len,
                    "movement_smoothness": round(smoothness, 4),
                    "peak_velocity": round(peak_vel, 4),
                    "dtw_distance": dtw_dist,
                    "dtw_trajectory_similarity": dtw_sim,
                    "bilateral_symmetry": round(mean_symmetry, 4),
                    "is_kinematically_sound": bool(smoothness >= 0.35 and dtw_sim >= 0.50),
                    "action_units": action_units_data,
                }

                # Compute patient baseline-calibrated excursion if baseline profile provided
                if patient_baseline:
                    raw_dims = {
                        "lip_aperture": float(np.mean(trajectory[:, 0])),
                        "mouth_width": float(np.mean(trajectory[:, 1])),
                        "bilateral_symmetry": mean_symmetry,
                    }
                    calibrated = self.baseline_calibrator.compute_calibrated_excursion(
                        raw_dims, profile=patient_baseline
                    )
                    kinematic_biomarkers["calibrated_excursion"] = calibrated

        elif vision_features is not None:
            if len(vision_features) in (16, 40):
                vision_t = torch.tensor([vision_features], dtype=torch.float32, device=device)

        # 2. Dual-Stream Pixel Appearance Processing if mouth frames provided
        pixel_seq_t = None
        if mouth_frames_sequence and landmarks_sequence and len(mouth_frames_sequence) > 0:
            target_lm = filtered_landmarks if filtered_landmarks is not None else landmarks_sequence
            pixel_rois = MouthROIExtractor.extract_sequence(mouth_frames_sequence, target_lm)
            if pixel_rois.shape[0] > 0:
                # (T, 1, H, W) -> (1, 1, T, H, W)
                pixel_seq_t = torch.tensor(pixel_rois, dtype=torch.float32, device=device).permute(1, 0, 2, 3).unsqueeze(0)

        # 3. Forward Pass: Dual-Stream Network
        dual_viseme_logits = None
        if vision_seq_t is not None or pixel_seq_t is not None:
            with torch.inference_mode():
                dual_out = self.dual_stream_encoder(kinematics_seq=vision_seq_t, pixel_seq=pixel_seq_t)
                dual_viseme_logits = dual_out["viseme_logits"]

                if dual_out["gating_weights"] is not None:
                    mean_gate = float(torch.mean(dual_out["gating_weights"]).cpu().item())
                    dual_stream_info = {
                        "fusion_mode": "DUAL_STREAM (Kinematics + 3D-CNN Pixels)",
                        "kinematic_weight": round(mean_gate, 3),
                        "appearance_weight": round(1.0 - mean_gate, 3),
                    }
                else:
                    dual_stream_info = {
                        "fusion_mode": "KINEMATICS_ONLY" if vision_seq_t is not None else "PIXELS_ONLY"
                    }

        # 4. Multimodal Fusion Forward Pass
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

        # 5. CTC Beam Search Decoding & Homophene Disambiguation
        target_viseme_logits = dual_viseme_logits if dual_viseme_logits is not None else output.get("viseme_frame_logits")
        if target_viseme_logits is not None:
            visual_word_decoding = self.beam_decoder.decode_beam(
                target_viseme_logits,
                target_word=target_phrase,
            )

            pred_v = visual_word_decoding["greedy_viseme_sequence"]
            if target_phrase:
                target_v = PhonemeVisemeMapper.phrase_to_visemes(target_phrase)
                viseme_analysis = PhonemeVisemeMapper.align_viseme_sequences(pred_v, target_v)
            else:
                viseme_analysis = {
                    "predicted_visemes": pred_v,
                    "viseme_match_score": 1.0,
                    "is_visually_verified": True,
                }

        # 6. Target match if recognized transcript provided
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
            "visual_word_decoding": visual_word_decoding,
            "dual_stream_info": dual_stream_info,
            "latency_ms": round(elapsed_ms, 2),
            "is_realtime_capable": bool(elapsed_ms < 200.0),
            "device": str(self.device),
            "target_match": target_match_info,
        }
