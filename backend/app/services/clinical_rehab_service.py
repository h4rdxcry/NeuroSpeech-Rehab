"""Clinical Rehabilitation Service: High-Accuracy Target Verification & Gamified Biofeedback.
Combines acoustic speech, facial tracking kinematics, and biosignal metrics.
"""
from typing import Dict, Any, Optional, List
import os
import time
from pathlib import Path

from ml.models.articulation_scorer import ArticulationScorer
from ml.models.inference_engine import MultimodalInferenceEngine


class ClinicalRehabService:
    """Provides clinical-grade speech rehabilitation scoring and gamified session metrics."""

    def __init__(self):
        self.engine = MultimodalInferenceEngine.get_instance()
        ckpt_path = str(Path(__file__).resolve().parents[3] / "ml_training" / "outputs" / "multimodal" / "multimodal_best.pt")
        if os.path.exists(ckpt_path):
            self.engine.initialize(ckpt_path)

    def evaluate_attempt(
        self,
        target_phrase: str,
        recognized_transcript: str,
        lip_aperture_ratio: Optional[float] = None,
        mouth_width_ratio: Optional[float] = None,
        target_vowel_type: str = "default",
        emg_features: Optional[List[float]] = None,
        eeg_features: Optional[List[float]] = None,
        audio_features: Optional[List[float]] = None,
        difficulty_level: str = "standard",  # "novice", "standard", "clinical_mastery"
    ) -> Dict[str, Any]:
        """Evaluates a single patient practice attempt against clinical rehabilitation targets."""
        t0 = time.perf_counter()

        # 1. Acoustic Target Match (RTV)
        acoustic_eval = ArticulationScorer.compute_target_match(
            target_phrase=target_phrase,
            recognized_transcript=recognized_transcript,
        )
        acoustic_match = acoustic_eval["target_match_ratio"]

        # 2. Kinematic Articulatory Assessment (if FaceMesh data provided)
        kinematic_eval = None
        kinematic_score = None
        if lip_aperture_ratio is not None and mouth_width_ratio is not None:
            kinematic_eval = ArticulationScorer.evaluate_lip_kinematics(
                lip_aperture_ratio=lip_aperture_ratio,
                mouth_width_ratio=mouth_width_ratio,
                target_vowel_type=target_vowel_type,
            )
            kinematic_score = kinematic_eval["kinematic_score"]

        # 3. Biosignal Coordination
        emg_symmetry = None
        if emg_features and len(emg_features) >= 10:
            # Estimate bilateral symmetry from left and right channels
            left_pwr = sum(emg_features[0:5])
            right_pwr = sum(emg_features[5:10])
            total_pwr = left_pwr + right_pwr
            if total_pwr > 1e-6:
                diff = abs(left_pwr - right_pwr) / total_pwr
                emg_symmetry = max(0.0, 1.0 - diff)

        eeg_engagement = None
        if eeg_features and len(eeg_features) >= 5:
            # Estimate motor readiness from beta band power (index 3) vs alpha (index 2)
            alpha_pwr = max(eeg_features[2], 1e-6)
            beta_pwr = max(eeg_features[3], 1e-6)
            eeg_engagement = min(1.0, beta_pwr / (alpha_pwr + beta_pwr))

        # 4. Multimodal Fusion AI Prediction
        vision_feat_vec = None
        if lip_aperture_ratio is not None and mouth_width_ratio is not None:
            vision_feat_vec = [
                lip_aperture_ratio,
                mouth_width_ratio,
                lip_aperture_ratio / max(mouth_width_ratio, 1e-4),
                0.60, 0.22, 0.15, 0.18, 0.01, 0.02, 0.01,
                0.40, 0.30, 0.75, 1.5, 0.20, 0.0
            ]

        ai_pred = self.engine.predict_rehabilitation(
            audio_features=audio_features,
            vision_features=vision_feat_vec,
            emg_features=emg_features,
            eeg_features=eeg_features,
            target_phrase=target_phrase,
            recognized_transcript=recognized_transcript,
        )

        # 5. Composite Rehabilitation Score
        composite_summary = ArticulationScorer.compute_composite_rehab_score(
            acoustic_match=acoustic_match,
            kinematic_score=kinematic_score,
            emg_symmetry=emg_symmetry,
            eeg_engagement=eeg_engagement,
        )

        # Adjust game stars / thresholds based on difficulty setting
        thresholds = {
            "novice": {"mastered": 85.0, "strong": 75.0, "star1": 60.0},
            "standard": {"mastered": 92.0, "strong": 82.0, "star1": 70.0},
            "clinical_mastery": {"mastered": 95.0, "strong": 90.0, "star1": 80.0},
        }.get(difficulty_level, {"mastered": 95.0, "strong": 85.0, "star1": 70.0})

        pct = composite_summary["mastery_percentage"]
        if pct >= thresholds["mastered"]:
            game_stars = 3
        elif pct >= thresholds["strong"]:
            game_stars = 2
        elif pct >= thresholds["star1"]:
            game_stars = 1
        else:
            game_stars = 0

        composite_summary["game_stars"] = game_stars
        composite_summary["difficulty_level"] = difficulty_level

        latency_ms = (time.perf_counter() - t0) * 1000.0

        return {
            "target_phrase": target_phrase,
            "recognized_transcript": recognized_transcript,
            "acoustic_eval": acoustic_eval,
            "kinematic_eval": kinematic_eval,
            "rehab_summary": composite_summary,
            "neural_prediction": ai_pred,
            "latency_ms": round(latency_ms, 2),
            "is_realtime": bool(latency_ms < 200.0),
        }
