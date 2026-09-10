"""Dynamic Articulatory Kinematics & 3D Head-Pose Invariance Engine.
Provides research-grade 3D normalization, temporal derivative tracking (velocity, acceleration, jerk),
and Dynamic Time Warping (DTW) trajectory comparison for clinical neuro-rehabilitation.
"""
from typing import Dict, List, Tuple, Optional, Any
import numpy as np


class KinematicsEngine:
    """Computes pose-invariant 3D articulatory kinematics and dynamic motion biomarkers."""

    # Key MediaPipe FaceMesh Landmark Indices
    LEFT_EYE_OUTER = 33
    RIGHT_EYE_OUTER = 263
    NOSE_TIP = 1
    NOSE_BASE = 2
    NOSE_BRIDGE = 168
    CHIN = 152
    UPPER_LIP_CENTER = 13
    LOWER_LIP_CENTER = 14
    UPPER_LIP_TOP = 0
    LOWER_LIP_BOTTOM = 17
    MOUTH_LEFT_CORNER = 61
    MOUTH_RIGHT_CORNER = 291
    INNER_MOUTH_LEFT = 78
    INNER_MOUTH_RIGHT = 308
    INNER_UPPER_LIP = 82
    INNER_LOWER_LIP = 87

    @classmethod
    def normalize_head_pose_3d(cls, landmarks: np.ndarray) -> np.ndarray:
        """Applies 3D rigid Procrustes alignment to remove head pitch, yaw, roll, and camera distance.
        
        Args:
            landmarks: (N, 3) array of 3D coordinates.
        Returns:
            (N, 3) normalized coordinates centered at mid-eye with unit eye-distance scale
            and rotated such that eye axis is horizontal (X) and nose-chin axis is vertical (Y).
        """
        p = np.asarray(landmarks, dtype=np.float64).copy()
        if p.ndim != 2 or p.shape[0] < 468 or p.shape[1] < 3:
            return p

        # 1. Translation: center at midpoint between outer eye corners
        left_eye = p[cls.LEFT_EYE_OUTER]
        right_eye = p[cls.RIGHT_EYE_OUTER]
        eye_center = (left_eye + right_eye) / 2.0
        p -= eye_center

        # 2. Scale: normalize by inter-ocular distance
        eye_dist = np.linalg.norm(right_eye - left_eye)
        scale = max(eye_dist, 1e-6)
        p /= scale

        # 3. Rotation: In-plane Roll correction (align eye vector with X axis)
        eye_vec = p[cls.RIGHT_EYE_OUTER] - p[cls.LEFT_EYE_OUTER]
        roll_angle = np.arctan2(eye_vec[1], eye_vec[0])
        cos_r, sin_r = np.cos(-roll_angle), np.sin(-roll_angle)
        r_roll = np.array([
            [cos_r, -sin_r, 0.0],
            [sin_r,  cos_r, 0.0],
            [0.0,    0.0,   1.0],
        ])
        p = np.dot(p, r_roll.T)

        # 4. Out-of-plane Pitch & Yaw correction using facial normal
        # Vector 1: Eye axis (now along X)
        v_x = p[cls.RIGHT_EYE_OUTER] - p[cls.LEFT_EYE_OUTER]
        v_x /= max(np.linalg.norm(v_x), 1e-6)

        # Vector 2: Vertical axis from eye center to chin
        v_y = p[cls.CHIN] - (p[cls.LEFT_EYE_OUTER] + p[cls.RIGHT_EYE_OUTER]) / 2.0
        # Project out any X component to ensure orthogonality
        v_y = v_y - np.dot(v_y, v_x) * v_x
        v_y /= max(np.linalg.norm(v_y), 1e-6)

        # Vector 3: Normal axis (Z) via cross product
        v_z = np.cross(v_x, v_y)
        v_z /= max(np.linalg.norm(v_z), 1e-6)

        # Rotation matrix to align [v_x, v_y, v_z] with canonical [ [1,0,0], [0,1,0], [0,0,1] ]
        rot_matrix = np.vstack([v_x, v_y, v_z])
        p = np.dot(p, rot_matrix.T)

        return p

    @classmethod
    def extract_kinematic_frame(cls, landmarks: List[List[float]]) -> List[float]:
        """Extracts 40-dimensional articulatory kinematic vector from normalized 3D landmarks."""
        p_raw = np.asarray(landmarks, dtype=np.float64)
        if p_raw.ndim != 2 or p_raw.shape[0] < 468 or p_raw.shape[1] < 3:
            return [0.0] * 40

        p = cls.normalize_head_pose_3d(p_raw)

        # Core Geometric Distances
        mouth_center = (p[cls.MOUTH_LEFT_CORNER] + p[cls.MOUTH_RIGHT_CORNER]) / 2.0
        face_midline_x = p[cls.NOSE_TIP, 0]

        # 1. Lip Aperture (Upper inner 13 to Lower inner 14)
        lip_aperture = float(np.linalg.norm(p[cls.UPPER_LIP_CENTER, :2] - p[cls.LOWER_LIP_CENTER, :2]))
        # 2. Mouth Width (Left 61 to Right 291)
        mouth_width = float(np.linalg.norm(p[cls.MOUTH_LEFT_CORNER, :2] - p[cls.MOUTH_RIGHT_CORNER, :2]))
        # 3. Lip Aspect Ratio
        lip_aspect_ratio = float(lip_aperture / max(mouth_width, 1e-4))
        # 4. Philtrum Length (Nose base 2 to Upper lip 0)
        philtrum_len = float(np.linalg.norm(p[cls.NOSE_BASE, :2] - p[cls.UPPER_LIP_TOP, :2]))
        # 5. Upper lip elevation
        upper_elevation = float(p[cls.NOSE_BASE, 1] - p[cls.UPPER_LIP_CENTER, 1])
        # 6. Lower lip depression
        lower_depression = float(p[cls.CHIN, 1] - p[cls.LOWER_LIP_CENTER, 1])
        # 7. Mouth asymmetry (deviation of mouth center from facial midline)
        asymmetry = float(abs(mouth_center[0] - face_midline_x))
        # 8. 3D Lip depth (z distance)
        lip_depth = float(abs(p[cls.UPPER_LIP_CENTER, 2] - p[cls.LOWER_LIP_CENTER, 2]))
        # 9. Corner height difference (lip tilt)
        lip_tilt = float(abs(p[cls.MOUTH_LEFT_CORNER, 1] - p[cls.MOUTH_RIGHT_CORNER, 1]))
        # 10. Inner Lip Width
        inner_width = float(np.linalg.norm(p[cls.INNER_MOUTH_LEFT, :2] - p[cls.INNER_MOUTH_RIGHT, :2]))
        # 11. Inner Lip Height
        inner_height = float(np.linalg.norm(p[cls.INNER_UPPER_LIP, :2] - p[cls.INNER_LOWER_LIP, :2]))
        # 12. Inner Aspect Ratio
        inner_aspect = float(inner_height / max(inner_width, 1e-4))
        # 13. Lip Perimeter estimate
        lip_perimeter = float((mouth_width + lip_aperture) * 2.0)
        # 14. Lip Area estimate
        lip_area_est = float(lip_aperture * mouth_width * 0.785398)
        # 15. Jaw Depression (Nose tip to Chin)
        jaw_depression = float(np.linalg.norm(p[cls.NOSE_TIP, :2] - p[cls.CHIN, :2]))
        # 16. Jaw Lateral Shift
        jaw_lateral_shift = float(p[cls.CHIN, 0] - face_midline_x)

        # 17-24: 8 Radial distances from mouth center to outer lip contour (0, 37, 267, 291, 17, 84, 181, 61)
        outer_indices = [0, 37, 267, 291, 17, 84, 181, 61]
        outer_radials = [float(np.linalg.norm(p[idx, :2] - mouth_center[:2])) for idx in outer_indices]

        # 25-32: 8 Radial distances from mouth center to inner lip contour (13, 82, 312, 308, 14, 87, 317, 78)
        inner_indices = [13, 82, 312, 308, 14, 87, 317, 78]
        inner_radials = [float(np.linalg.norm(p[idx, :2] - mouth_center[:2])) for idx in inner_indices]

        # 33. Upper lip vermilion thickness (0 to 13)
        upper_thickness = float(np.linalg.norm(p[cls.UPPER_LIP_TOP, :2] - p[cls.UPPER_LIP_CENTER, :2]))
        # 34. Lower lip vermilion thickness (14 to 17)
        lower_thickness = float(np.linalg.norm(p[cls.LOWER_LIP_CENTER, :2] - p[cls.LOWER_LIP_BOTTOM, :2]))
        # 35. Bilateral corner symmetry ratio (distance left-to-center vs right-to-center)
        left_dist = float(np.linalg.norm(p[cls.MOUTH_LEFT_CORNER, :2] - mouth_center[:2]))
        right_dist = float(np.linalg.norm(p[cls.MOUTH_RIGHT_CORNER, :2] - mouth_center[:2]))
        corner_symmetry = float(min(left_dist, right_dist) / max(left_dist, right_dist, 1e-4))
        # 36. Jaw Protrusion (relative Z depth between nose tip and chin)
        jaw_protrusion = float(p[cls.CHIN, 2] - p[cls.NOSE_TIP, 2])
        # 37. Left Lip Curvature (angle at left corner)
        left_corner_y = float(p[cls.MOUTH_LEFT_CORNER, 1] - mouth_center[1])
        # 38. Right Lip Curvature (angle at right corner)
        right_corner_y = float(p[cls.MOUTH_RIGHT_CORNER, 1] - mouth_center[1])
        # 39. Philtrum Width (distance between top peaks 37 and 267)
        philtrum_width = float(np.linalg.norm(p[37, :2] - p[267, :2]))
        # 40. Total Lip Openness Index (composite of aperture, inner height, and jaw depression)
        openness_index = float((lip_aperture * 0.5) + (inner_height * 0.3) + (jaw_depression * 0.2))

        features = [
            lip_aperture, mouth_width, lip_aspect_ratio, philtrum_len,
            upper_elevation, lower_depression, asymmetry, lip_depth,
            lip_tilt, inner_width, inner_height, inner_aspect,
            lip_perimeter, lip_area_est, jaw_depression, jaw_lateral_shift,
            *outer_radials,
            *inner_radials,
            upper_thickness, lower_thickness, corner_symmetry, jaw_protrusion,
            left_corner_y, right_corner_y, philtrum_width, openness_index,
        ]

        assert len(features) == 40, f"Expected 40 features, got {len(features)}"
        return features

    @classmethod
    def extract_trajectory(cls, landmark_sequence: List[List[List[float]]]) -> np.ndarray:
        """Extracts a continuous (T, 40) trajectory array from a sequence of frames."""
        if not landmark_sequence:
            return np.zeros((0, 40), dtype=np.float32)
        trajectory = [cls.extract_kinematic_frame(frame) for frame in landmark_sequence]
        return np.asarray(trajectory, dtype=np.float32)

    @staticmethod
    def compute_derivatives(trajectory: np.ndarray, fps: float = 30.0) -> Dict[str, np.ndarray]:
        """Computes Velocity, Acceleration, and Jerk for articulatory trajectory."""
        dt = 1.0 / max(fps, 1.0)
        t_len = trajectory.shape[0]
        if t_len < 2:
            zeros = np.zeros_like(trajectory)
            return {"velocity": zeros, "acceleration": zeros, "jerk": zeros}

        velocity = np.gradient(trajectory, dt, axis=0)
        acceleration = np.gradient(velocity, dt, axis=0)
        jerk = np.gradient(acceleration, dt, axis=0)

        return {
            "velocity": velocity,
            "acceleration": acceleration,
            "jerk": jerk,
        }

    @staticmethod
    def compute_movement_smoothness(jerk: np.ndarray, velocity: np.ndarray) -> float:
        """Computes dimensionless motor smoothness index (Log Dimensionless Jerk).
        Higher score (closer to 1.0) indicates smooth, controlled articulatory gestures.
        Lower score indicates dysmetria, tremors, or ataxic speech motor disturbances.
        """
        if jerk.size == 0 or velocity.size == 0:
            return 1.0

        # Mean jerk magnitude squared
        jerk_mag_sq = np.mean(np.sum(jerk ** 2, axis=-1))
        # Peak velocity magnitude
        peak_vel = max(float(np.max(np.linalg.norm(velocity, axis=-1))), 1e-4)

        # Dimensionless jerk normalization: jerk^2 / peak_vel^2
        raw_ldj = jerk_mag_sq / (peak_vel ** 2 + 1e-6)
        # Convert to bounded score [0.0, 1.0] where 1.0 is smooth
        smoothness = float(1.0 / (1.0 + np.log1p(raw_ldj)))
        return round(float(np.clip(smoothness, 0.0, 1.0)), 4)

    @staticmethod
    def fast_dtw_distance(s1: np.ndarray, s2: np.ndarray) -> Tuple[float, float]:
        """Computes Dynamic Time Warping (DTW) distance and normalized similarity between two trajectories.
        
        Args:
            s1: (T1, D) trajectory array.
            s2: (T2, D) trajectory array.
        Returns:
            (dtw_distance, similarity_score_0_to_1)
        """
        t1, d1 = s1.shape
        t2, d2 = s2.shape
        if t1 == 0 or t2 == 0:
            return 0.0, 0.0

        # Align dimensions if necessary
        d = min(d1, d2)
        x = s1[:, :d]
        y = s2[:, :d]

        # Cost matrix
        cost = np.zeros((t1 + 1, t2 + 1), dtype=np.float64)
        cost[0, 1:] = np.inf
        cost[1:, 0] = np.inf

        for i in range(1, t1 + 1):
            diff = x[i - 1, :] - y  # (t2, d)
            dist_i = np.linalg.norm(diff, axis=-1)  # (t2,)
            for j in range(1, t2 + 1):
                cost[i, j] = dist_i[j - 1] + min(cost[i - 1, j], cost[i, j - 1], cost[i - 1, j - 1])

        total_cost = float(cost[t1, t2])
        path_len = float(t1 + t2)
        norm_cost = total_cost / max(path_len, 1.0)

        # Normalized similarity in [0.0, 1.0] using exponential decay
        similarity = float(np.exp(-norm_cost * 1.5))
        return round(norm_cost, 4), round(float(np.clip(similarity, 0.0, 1.0)), 4)

    @classmethod
    def generate_canonical_trajectory(cls, target_phoneme_type: str, num_frames: int = 30) -> np.ndarray:
        """Generates a reference articulatory trajectory for target phoneme classes (30 frames / 1 sec)."""
        t = np.linspace(0, np.pi, num_frames)
        template = np.zeros((num_frames, 40), dtype=np.float32)

        # Fill with baseline neutral features
        template[:, 0] = 0.25   # baseline aperture
        template[:, 1] = 0.50   # baseline width
        template[:, 2] = 0.50   # aspect ratio
        template[:, 20] = 0.95  # baseline bilateral symmetry

        if target_phoneme_type == "open_vowel":
            # Swell in aperture: 0.25 -> 0.65 -> 0.25
            aperture_curve = 0.25 + (0.40 * np.sin(t))
            template[:, 0] = aperture_curve
            template[:, 2] = aperture_curve / template[:, 1]
            template[:, 14] = 0.60 + (0.15 * np.sin(t))  # jaw depression
        elif target_phoneme_type == "spread_vowel":
            # Width increase: 0.50 -> 0.75 -> 0.50 with narrow aperture
            template[:, 0] = 0.18 + (0.05 * np.sin(t))
            template[:, 1] = 0.50 + (0.25 * np.sin(t))
            template[:, 2] = template[:, 0] / template[:, 1]
        elif target_phoneme_type == "rounded_vowel":
            # Narrow width and medium aperture (puckering)
            template[:, 0] = 0.20 + (0.10 * np.sin(t))
            template[:, 1] = 0.50 - (0.15 * np.sin(t))
            template[:, 2] = template[:, 0] / np.maximum(template[:, 1], 1e-4)
        elif target_phoneme_type == "bilabial":
            # Closure: 0.25 -> 0.02 -> 0.25
            template[:, 0] = np.maximum(0.02, 0.25 - (0.23 * np.sin(t)))
            template[:, 2] = template[:, 0] / template[:, 1]

        return template
