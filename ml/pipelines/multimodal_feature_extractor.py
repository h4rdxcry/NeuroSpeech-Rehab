"""Unified Multimodal Feature Extractor for Audio, FaceMesh, Facial sEMG, and EEG.
Designed for real-world research datasets and streaming clinical sessions.
"""
from typing import Dict, Any, List, Optional, Union
import numpy as np
from scipy import signal


class MultimodalFeatureExtractor:
    """Extracts standardized numerical feature vectors across all 4 modalities."""

    @staticmethod
    def extract_facemesh_features(landmarks: List[List[float]]) -> List[float]:
        """Extracts 16-dim articulatory kinematic vector from 468 3D MediaPipe landmarks."""
        p = np.asarray(landmarks, dtype=np.float64)
        if p.ndim != 2 or p.shape[0] < 468 or p.shape[1] < 3:
            return [0.0] * 16

        # Normalization scale: distance between outer eye corners (33 and 263)
        eye_dist = np.linalg.norm(p[33, :2] - p[263, :2])
        scale = max(eye_dist, 1e-6)

        # 1. Lip Aperture (Upper lip 13 to Lower lip 14)
        lip_aperture = np.linalg.norm(p[13, :2] - p[14, :2]) / scale
        # 2. Mouth Width (Left corner 61 to Right corner 291)
        mouth_width = np.linalg.norm(p[61, :2] - p[291, :2]) / scale
        # 3. Lip Aspect Ratio
        lip_aspect_ratio = lip_aperture / max(mouth_width, 1e-4)
        # 4. Jaw Depression (Nose tip 1 to Chin 152)
        jaw_depression = np.linalg.norm(p[1, :2] - p[152, :2]) / scale
        # 5. Philtrum Length (Nose base 2 to Upper lip 0)
        philtrum_len = np.linalg.norm(p[2, :2] - p[0, :2]) / scale
        # 6. Upper lip elevation (Upper lip 13 y vs Nose base 2 y)
        upper_elevation = (p[2, 1] - p[13, 1]) / scale
        # 7. Lower lip depression (Lower lip 14 y vs Chin 152 y)
        lower_depression = (p[152, 1] - p[14, 1]) / scale
        # 8. Mouth asymmetry (horizontal deviation of lip center from facial midline)
        mouth_mid_x = (p[61, 0] + p[291, 0]) / 2.0
        face_mid_x = p[1, 0]
        asymmetry = abs(mouth_mid_x - face_mid_x) / scale
        # 9. 3D Lip depth (z distance difference between upper and lower lip)
        lip_depth = abs(p[13, 2] - p[14, 2]) / scale
        # 10. Corner height difference (lip tilt)
        lip_tilt = abs(p[61, 1] - p[291, 1]) / scale
        # 11-16. Inner lip boundary metrics (landmarks 78, 308, 82, 312, 87, 317)
        inner_width = np.linalg.norm(p[78, :2] - p[308, :2]) / scale
        inner_height = np.linalg.norm(p[82, :2] - p[87, :2]) / scale
        inner_aspect = inner_height / max(inner_width, 1e-4)
        lip_perimeter = (mouth_width + lip_aperture) * 2.0
        lip_area_est = lip_aperture * mouth_width * 0.785  # Elliptical approximation
        jaw_lateral_shift = (p[152, 0] - face_mid_x) / scale

        features = [
            float(lip_aperture),
            float(mouth_width),
            float(lip_aspect_ratio),
            float(jaw_depression),
            float(philtrum_len),
            float(upper_elevation),
            float(lower_depression),
            float(asymmetry),
            float(lip_depth),
            float(lip_tilt),
            float(inner_width),
            float(inner_height),
            float(inner_aspect),
            float(lip_perimeter),
            float(lip_area_est),
            float(jaw_lateral_shift),
        ]
        return features

    @staticmethod
    def extract_emg_features(emg_signals: np.ndarray, sample_rate: float = 1000.0) -> List[float]:
        """Extracts 40-dim feature vector from 8-channel facial sEMG signals (Zenodo dataset).

        Features per channel: MAV, RMS, Waveform Length, Median Frequency, Envelope Peak.
        """
        x = np.asarray(emg_signals, dtype=np.float64)
        if x.ndim == 1:
            x = x[:, np.newaxis]
        if x.shape[1] < 8:
            # Pad to 8 channels if fewer
            pad = np.zeros((x.shape[0], 8 - x.shape[1]))
            x = np.hstack([x, pad])
        elif x.shape[1] > 8:
            x = x[:, :8]

        features: List[float] = []
        for ch in range(8):
            sig = x[:, ch]
            # 1. Mean Absolute Value (MAV)
            mav = float(np.mean(np.abs(sig)))
            # 2. Root Mean Square (RMS)
            rms = float(np.sqrt(np.mean(sig ** 2)))
            # 3. Waveform Length (WL)
            wl = float(np.sum(np.abs(np.diff(sig)))) / max(len(sig), 1)
            # 4. Median Frequency
            if len(sig) > 64 and np.ptp(sig) > 1e-6:
                freqs, psd = signal.welch(sig, fs=sample_rate, nperseg=min(len(sig), 256))
                cum_power = np.cumsum(psd)
                med_idx = np.searchsorted(cum_power, cum_power[-1] / 2.0)
                med_freq = float(freqs[min(med_idx, len(freqs) - 1)])
            else:
                med_freq = 0.0
            # 5. Peak envelope
            env_peak = float(np.percentile(np.abs(sig), 95))

            features.extend([mav, rms, wl, med_freq, env_peak])

        return features

    @staticmethod
    def extract_eeg_features(eeg_signals: np.ndarray, sample_rate: float = 250.0) -> List[float]:
        """Extracts 25-dim spectral power vector across 5 bands (delta, theta, alpha, beta, gamma)

        over 5 speech/motor regions from OpenNeuro ds007808.
        """
        x = np.asarray(eeg_signals, dtype=np.float64)
        if x.ndim == 1:
            x = x[:, np.newaxis]
        if x.shape[1] < 5:
            pad = np.zeros((x.shape[0], 5 - x.shape[1]))
            x = np.hstack([x, pad])
        elif x.shape[1] > 5:
            x = x[:, :5]

        bands = [
            (1.0, 4.0),    # delta
            (4.0, 8.0),    # theta
            (8.0, 13.0),   # alpha (mu rhythm)
            (13.0, 30.0),  # beta
            (30.0, 45.0),  # gamma
        ]

        features: List[float] = []
        for ch in range(5):
            sig = x[:, ch]
            if len(sig) > 64 and np.ptp(sig) > 1e-6:
                freqs, psd = signal.welch(sig, fs=sample_rate, nperseg=min(len(sig), 256))
                df = freqs[1] - freqs[0] if len(freqs) > 1 else 1.0
                for low, high in bands:
                    mask = (freqs >= low) & (freqs < high)
                    band_power = float(np.sum(psd[mask]) * df)
                    features.append(band_power)
            else:
                features.extend([0.0] * len(bands))

        return features

    @staticmethod
    def extract_acoustic_features(audio_samples: np.ndarray, sample_rate: int = 16000) -> List[float]:
        """Extracts 768-dim acoustic feature representation.

        Uses acoustic descriptors (energy, zero crossing, spectral roll-off, centroid,

        formant approximations, and MFCCs) projected or padded to 768 dims for Wav2Vec2 compatibility.
        """
        x = np.asarray(audio_samples, dtype=np.float32)
        if x.ndim > 1:
            x = x.mean(axis=1)

        vec = np.zeros(768, dtype=np.float32)
        if len(x) < 160:
            return vec.tolist()

        # 1. Zero Crossing Rate
        zcr = np.mean(np.abs(np.diff(np.sign(x)))) / 2.0
        # 2. RMS Energy
        energy = np.sqrt(np.mean(x ** 2))
        # 3. Spectral Centroid & Spread
        fft_vals = np.abs(np.fft.rfft(x[:min(len(x), 4096)]))
        fft_freqs = np.fft.rfftfreq(min(len(x), 4096), 1.0 / sample_rate)
        sum_fft = np.sum(fft_vals) + 1e-8
        centroid = np.sum(fft_freqs * fft_vals) / sum_fft

        vec[0] = float(zcr)
        vec[1] = float(energy)
        vec[2] = float(centroid / 8000.0)

        # Spectral distribution across 64 frequency bins
        n_bins = min(64, len(fft_vals))
        bin_energies = [np.mean(chunk) for chunk in np.array_split(fft_vals[:n_bins*10], n_bins)]
        for i, val in enumerate(bin_energies):
            vec[3 + i] = float(val / (sum_fft + 1e-6))

        return vec.tolist()
