"""Adaptive 1€ (One-Euro) Filter & Patient Baseline Calibration Engine.
Provides high-frequency jitter suppression without phase lag during rapid speech transitions,
and zero-shot patient baseline calibration for fair clinical neuro-rehabilitation.
"""
from typing import Dict, List, Tuple, Optional, Any, Union
import numpy as np


class LowPassFilter:
    """Standard first-order exponential smoothing filter."""

    def __init__(self, alpha: Union[float, np.ndarray] = 0.5):
        self.alpha = alpha
        self.y: Optional[np.ndarray] = None

    def filter(self, x: np.ndarray, alpha: Optional[Union[float, np.ndarray]] = None) -> np.ndarray:
        if alpha is not None:
            self.alpha = alpha
        if self.y is None:
            self.y = np.array(x, dtype=np.float64).copy()
        else:
            self.y = self.alpha * x + (1.0 - self.alpha) * self.y
        return self.y

    def reset(self) -> None:
        self.y = None


class OneEuroFilter:
    """Adaptive 1€ Filter (Casiez et al., CHI 2012).
    
    Eliminates high-frequency micro-jitter during steady vocalic postures while
    dynamically opening the cutoff frequency to eliminate phase lag during rapid articulatory bursts.
    """

    def __init__(
        self,
        min_cutoff: float = 1.0,
        beta: float = 0.007,
        d_cutoff: float = 1.0,
        freq: float = 30.0,
    ):
        """
        Args:
            min_cutoff: Minimum cutoff frequency (Hz) for static/slow movements (jitter reduction).
            beta: Speed coefficient; increases cutoff frequency proportional to velocity.
            d_cutoff: Cutoff frequency (Hz) for filtering the derivative.
            freq: Default sampling rate (frames per second).
        """
        self.min_cutoff = float(min_cutoff)
        self.beta = float(beta)
        self.d_cutoff = float(d_cutoff)
        self.freq = float(freq)

        self.x_filter = LowPassFilter()
        self.dx_filter = LowPassFilter()
        self.last_time: Optional[float] = None

    def _compute_alpha(self, cutoff: Union[float, np.ndarray], dt: float) -> Union[float, np.ndarray]:
        tau = 1.0 / (2.0 * np.pi * cutoff)
        return 1.0 / (1.0 + tau / dt)

    def filter(
        self,
        x: Union[List, np.ndarray],
        timestamp: Optional[float] = None,
    ) -> np.ndarray:
        """Filters input coordinates or feature vectors.
        
        Args:
            x: Coordinate array of shape (..., D).
            timestamp: Optional timestamp in seconds. If None, assumes 1 / freq.
        Returns:
            Filtered array with same shape and type float64.
        """
        x_arr = np.asarray(x, dtype=np.float64)

        if self.last_time is None or timestamp is None:
            dt = 1.0 / self.freq
        else:
            dt = max(timestamp - self.last_time, 1e-4)

        if timestamp is not None:
            self.last_time = timestamp

        # Filter the derivative
        prev_x = self.x_filter.y
        if prev_x is None:
            dx = np.zeros_like(x_arr)
        else:
            dx = (x_arr - prev_x) / dt

        alpha_d = self._compute_alpha(self.d_cutoff, dt)
        edx = self.dx_filter.filter(dx, alpha=alpha_d)

        # Dynamic cutoff frequency based on velocity magnitude
        speed = np.abs(edx)
        cutoff = self.min_cutoff + self.beta * speed
        alpha_x = self._compute_alpha(cutoff, dt)

        return self.x_filter.filter(x_arr, alpha=alpha_x)

    def filter_sequence(
        self,
        sequence: Union[List, np.ndarray],
        fps: float = 30.0,
    ) -> np.ndarray:
        """Filters an entire temporal sequence of landmarks or features.
        
        Args:
            sequence: (T, N, D) or (T, D) array.
            fps: Frame rate.
        Returns:
            (T, ...) filtered array.
        """
        seq_arr = np.asarray(sequence, dtype=np.float64)
        t_len = seq_arr.shape[0]
        if t_len == 0:
            return seq_arr

        self.reset()
        self.freq = fps
        dt = 1.0 / fps

        filtered = []
        for i in range(t_len):
            t = i * dt
            filtered.append(self.filter(seq_arr[i], timestamp=t))

        return np.array(filtered, dtype=np.float64)

    def reset(self) -> None:
        """Resets filter state."""
        self.x_filter.reset()
        self.dx_filter.reset()
        self.last_time = None


class PatientBaselineCalibrator:
    """Calibrates articulatory measurements against a patient's individual resting baseline.
    
    Accommodates facial asymmetry, unilateral stroke hemiparesis, or dysarthric resting hypertonicity,
    ensuring clinical scores measure intentional motor excursion rather than pre-existing impairment.
    """

    def __init__(self):
        self.baseline_profile: Optional[Dict[str, Any]] = None

    def calibrate_resting_state(
        self,
        resting_landmarks_seq: Union[List, np.ndarray],
    ) -> Dict[str, Any]:
        """Calculates baseline statistics over a 3-5 second neutral resting face recording.
        
        Args:
            resting_landmarks_seq: (T, 468, 3) sequence of resting face coordinates.
        Returns:
            Baseline profile dict with mean landmarks and resting structural dimensions.
        """
        seq = np.asarray(resting_landmarks_seq, dtype=np.float64)
        if seq.ndim != 3 or seq.shape[0] < 5:
            # Fallback default baseline
            self.baseline_profile = {
                "resting_aperture_mean": 0.05,
                "resting_aperture_std": 0.01,
                "resting_width_mean": 0.50,
                "resting_width_std": 0.02,
                "resting_corner_height_delta": 0.0,
                "hemiparetic_asymmetry_baseline": 0.0,
                "num_calibration_frames": len(seq),
            }
            return self.baseline_profile

        # Compute key structural dimensions across the resting sequence
        # Landmarks: 13 (upper lip), 14 (lower lip), 61 (left corner), 291 (right corner)
        apertures = np.linalg.norm(seq[:, 13, :2] - seq[:, 14, :2], axis=-1)
        widths = np.linalg.norm(seq[:, 61, :2] - seq[:, 291, :2], axis=-1)
        # Corner height delta (indicates unilateral resting droop/paresis)
        corner_height_deltas = seq[:, 61, 1] - seq[:, 291, 1]

        mean_landmarks = np.mean(seq, axis=0)  # (468, 3)

        self.baseline_profile = {
            "mean_landmarks": mean_landmarks.tolist(),
            "resting_aperture_mean": float(np.mean(apertures)),
            "resting_aperture_std": float(max(np.std(apertures), 1e-4)),
            "resting_width_mean": float(np.mean(widths)),
            "resting_width_std": float(max(np.std(widths), 1e-4)),
            "resting_corner_height_delta": float(np.mean(corner_height_deltas)),
            "hemiparetic_asymmetry_baseline": float(np.abs(np.mean(corner_height_deltas))),
            "num_calibration_frames": int(seq.shape[0]),
        }
        return self.baseline_profile

    def compute_calibrated_excursion(
        self,
        current_kinematics: Dict[str, float],
        profile: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, float]:
        """Normalizes kinematics by subtracting resting baseline to measure active motor displacement.
        
        Args:
            current_kinematics: Dict containing raw aperture, mouth_width, bilateral_symmetry, etc.
            profile: Optional baseline profile; uses self.baseline_profile if None.
        Returns:
            Dict containing relative excursions (z-scores and delta excursions).
        """
        prof = profile or self.baseline_profile or {}
        aperture_rest = prof.get("resting_aperture_mean", 0.05)
        aperture_std = prof.get("resting_aperture_std", 0.01)
        width_rest = prof.get("resting_width_mean", 0.50)
        width_std = prof.get("resting_width_std", 0.02)
        base_asym = prof.get("hemiparetic_asymmetry_baseline", 0.0)

        raw_aperture = current_kinematics.get("lip_aperture", 0.0)
        raw_width = current_kinematics.get("mouth_width", 0.0)
        raw_sym = current_kinematics.get("bilateral_symmetry", 1.0)

        # Relative active excursion
        aperture_excursion = max(0.0, raw_aperture - aperture_rest)
        aperture_z = (raw_aperture - aperture_rest) / max(aperture_std, 1e-4)

        width_excursion = raw_width - width_rest
        width_z = (raw_width - width_rest) / max(width_std, 1e-4)

        # Baseline-compensated symmetry: do not double-penalize stroke resting asymmetry
        compensated_symmetry = min(1.0, raw_sym + (base_asym * 0.5))

        return {
            "active_aperture_excursion": round(float(aperture_excursion), 4),
            "aperture_z_score": round(float(aperture_z), 2),
            "active_width_excursion": round(float(width_excursion), 4),
            "width_z_score": round(float(width_z), 2),
            "baseline_compensated_symmetry": round(float(compensated_symmetry), 4),
        }
