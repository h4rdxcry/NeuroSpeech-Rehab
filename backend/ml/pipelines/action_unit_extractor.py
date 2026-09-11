"""Facial Action Coding System (FACS) Articulatory Action Unit (AU) Extractor.
Extracts continuous activations [0.0, 1.0] for clinical speech articulation assessment
and neuromuscular motor coordination analysis.
"""
from typing import Dict, List, Tuple, Optional, Any, Union
import numpy as np

from ml.pipelines.kinematics_engine import KinematicsEngine


class ActionUnitExtractor:
    """Computes continuous articulatory Action Unit activations from 3D FaceMesh landmarks."""

    # Key landmark indices (MediaPipe FaceMesh)
    NOSE_BRIDGE = 168
    NOSE_BASE = 2
    CHIN = 152
    UPPER_LIP_CENTER = 13
    LOWER_LIP_CENTER = 14
    UPPER_LIP_TOP = 0
    LOWER_LIP_BOTTOM = 17
    MOUTH_LEFT_CORNER = 61
    MOUTH_RIGHT_CORNER = 291
    LEFT_EYE_OUTER = 33
    RIGHT_EYE_OUTER = 263

    @classmethod
    def extract_action_units(
        cls,
        landmarks: Union[List, np.ndarray],
        baseline_profile: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, float]:
        """Calculates normalized continuous intensity activations [0.0, 1.0] for 9 articulatory AUs.
        
        Args:
            landmarks: (N, 3) 3D coordinates.
            baseline_profile: Optional resting face profile for patient-specific calibration.
        Returns:
            Dict mapping AU names (AU10, AU12, AU14, AU15, AU17, AU18, AU20, AU25, AU26) to [0.0, 1.0].
        """
        # Normalize head pose 3D first for rotation & scale invariance
        norm_lm = KinematicsEngine.normalize_head_pose_3d(np.asarray(landmarks, dtype=np.float64))
        if norm_lm.ndim != 2 or norm_lm.shape[0] < 468:
            return {
                "AU10_upper_lip_raiser": 0.0,
                "AU12_lip_corner_puller": 0.0,
                "AU14_dimpler": 0.0,
                "AU15_lip_corner_depressor": 0.0,
                "AU17_chin_raiser": 0.0,
                "AU18_lip_pucker": 0.0,
                "AU20_lip_stretcher": 0.0,
                "AU25_lips_part": 0.0,
                "AU26_jaw_drop": 0.0,
            }

        prof = baseline_profile or {}
        base_width = prof.get("resting_width_mean", 0.50)
        base_aperture = prof.get("resting_aperture_mean", 0.05)

        # 1. AU25: Lips Part (vertical separation of vermilion borders)
        lip_aperture = float(np.linalg.norm(norm_lm[cls.UPPER_LIP_CENTER, :2] - norm_lm[cls.LOWER_LIP_CENTER, :2]))
        au25 = float(np.clip((lip_aperture - base_aperture) / 0.30, 0.0, 1.0))

        # 2. AU26: Jaw Drop (mandibular vertical displacement)
        # Distance from nose bridge (168) to chin (152)
        jaw_length = float(np.linalg.norm(norm_lm[cls.NOSE_BRIDGE, :2] - norm_lm[cls.CHIN, :2]))
        # In normalized coords (eye dist = 1.0), typical resting jaw_length is ~0.65 - 0.75
        au26 = float(np.clip((jaw_length - 0.65) / 0.35, 0.0, 1.0))

        # 3. AU12: Lip Corner Puller (Zygomaticus Major - smile / spread vowel)
        mouth_width = float(np.linalg.norm(norm_lm[cls.MOUTH_LEFT_CORNER, :2] - norm_lm[cls.MOUTH_RIGHT_CORNER, :2]))
        # Corner elevation relative to mouth center Y
        mouth_center_y = (norm_lm[cls.UPPER_LIP_CENTER, 1] + norm_lm[cls.LOWER_LIP_CENTER, 1]) / 2.0
        left_elev = norm_lm[cls.MOUTH_LEFT_CORNER, 1] - mouth_center_y
        right_elev = norm_lm[cls.MOUTH_RIGHT_CORNER, 1] - mouth_center_y
        corner_elevation = float((left_elev + right_elev) / 2.0)
        au12 = float(np.clip(((mouth_width - base_width) * 1.5) + (corner_elevation * 3.0), 0.0, 1.0))

        # 4. AU18: Lip Pucker (Incisivus labii - rounded vowel / protrusion)
        # Narrow width + lip depth protrusion relative to mouth corners
        corner_z = (norm_lm[cls.MOUTH_LEFT_CORNER, 2] + norm_lm[cls.MOUTH_RIGHT_CORNER, 2]) / 2.0
        lip_z = (norm_lm[cls.UPPER_LIP_CENTER, 2] + norm_lm[cls.LOWER_LIP_CENTER, 2]) / 2.0
        z_protrusion = float(abs(lip_z - corner_z))
        width_reduction = max(0.0, base_width - mouth_width)
        au18 = float(np.clip((width_reduction * 2.5) + (z_protrusion * 3.5), 0.0, 1.0))

        # 5. AU10: Upper Lip Raiser (Levator labii superioris)
        # Distance from nose base (2) to upper lip top (0) decreases as lip is raised
        nose_to_lip = float(np.linalg.norm(norm_lm[cls.NOSE_BASE, :2] - norm_lm[cls.UPPER_LIP_TOP, :2]))
        au10 = float(np.clip((0.14 - nose_to_lip) / 0.08, 0.0, 1.0))

        # 6. AU15: Lip Corner Depressor (Depressor anguli oris)
        corner_depression = float(-corner_elevation)
        au15 = float(np.clip(corner_depression * 4.0, 0.0, 1.0))

        # 7. AU17: Chin Raiser (Mentalis strain)
        # Chin landmark 152 moves upward toward lower lip bottom (17)
        chin_to_lower_lip = float(np.linalg.norm(norm_lm[cls.CHIN, :2] - norm_lm[cls.LOWER_LIP_BOTTOM, :2]))
        au17 = float(np.clip((0.22 - chin_to_lower_lip) / 0.10, 0.0, 1.0))

        # 8. AU20: Lip Stretcher (Risorius - lateral stretch without elevation)
        lateral_stretch = max(0.0, mouth_width - base_width)
        au20 = float(np.clip((lateral_stretch * 2.0) - max(0.0, corner_elevation * 2.0), 0.0, 1.0))

        # 9. AU14: Dimpler (Buccinator tension / tightening)
        # Narrow mouth corners pulled inward and tight
        dimpler_metric = max(0.0, (base_width - mouth_width) * 1.5)
        au14 = float(np.clip(dimpler_metric, 0.0, 1.0))

        return {
            "AU10_upper_lip_raiser": round(au10, 3),
            "AU12_lip_corner_puller": round(au12, 3),
            "AU14_dimpler": round(au14, 3),
            "AU15_lip_corner_depressor": round(au15, 3),
            "AU17_chin_raiser": round(au17, 3),
            "AU18_lip_pucker": round(au18, 3),
            "AU20_lip_stretcher": round(au20, 3),
            "AU25_lips_part": round(au25, 3),
            "AU26_jaw_drop": round(au26, 3),
        }

    @classmethod
    def extract_sequence(
        cls,
        landmarks_sequence: Union[List, np.ndarray],
        baseline_profile: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Extracts temporal Action Unit trajectories, peak intensities, and kinematic onset rates.
        
        Args:
            landmarks_sequence: (T, 468, 3) sequence of 3D landmarks.
            baseline_profile: Optional resting baseline profile.
        Returns:
            Dict containing per-frame trajectories, peak activations, and clinical motor summary.
        """
        seq = np.asarray(landmarks_sequence, dtype=np.float64)
        t_len = seq.shape[0] if seq.ndim == 3 else 0
        if t_len == 0:
            return {
                "trajectories": {},
                "peak_intensities": {},
                "dominant_actions": [],
                "clinical_cues": [],
            }

        au_keys = [
            "AU10_upper_lip_raiser",
            "AU12_lip_corner_puller",
            "AU14_dimpler",
            "AU15_lip_corner_depressor",
            "AU17_chin_raiser",
            "AU18_lip_pucker",
            "AU20_lip_stretcher",
            "AU25_lips_part",
            "AU26_jaw_drop",
        ]

        trajectories: Dict[str, List[float]] = {k: [] for k in au_keys}

        for frame in seq:
            frame_aus = cls.extract_action_units(frame, baseline_profile=baseline_profile)
            for k in au_keys:
                trajectories[k].append(frame_aus[k])

        # Compute peak intensity and mean for each AU
        peaks = {k: round(float(np.max(trajectories[k])), 3) for k in au_keys}
        means = {k: round(float(np.mean(trajectories[k])), 3) for k in au_keys}

        # Identify dominant actions (> 0.25 activation)
        dominant_actions = [k for k, v in peaks.items() if v >= 0.25]

        # Clinical cues based on Action Unit thresholds
        clinical_cues = []
        if peaks["AU26_jaw_drop"] < 0.20 and peaks["AU25_lips_part"] > 0.40:
            clinical_cues.append("Restricted mandibular excursion (Jaw Drop AU26 low)—practice dropping the jaw wider.")
        if peaks["AU17_chin_raiser"] >= 0.50:
            clinical_cues.append("Elevated mentalis strain (Chin Raiser AU17 high)—encourage lower lip relaxation.")
        if peaks["AU15_lip_corner_depressor"] >= 0.40:
            clinical_cues.append("Prominent corner depression (AU15 high)—evaluate for unilateral hemiparetic lag.")
        if peaks["AU18_lip_pucker"] >= 0.45:
            clinical_cues.append("Strong lip protrusion/funneling (AU18 active)—beneficial for rounded vowel targets.")

        return {
            "trajectories": trajectories,
            "peak_intensities": peaks,
            "mean_intensities": means,
            "dominant_actions": dominant_actions,
            "clinical_cues": clinical_cues,
        }
