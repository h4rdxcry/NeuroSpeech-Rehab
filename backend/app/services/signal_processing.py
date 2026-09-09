"""Deterministic research signal processing. No clinical interpretation."""
import numpy as np
from scipy import signal

PIPELINE_VERSION = "research-signals-v1"


def process_biosignal(samples, sample_rate, modality, units, channel_names):
    x = np.asarray(samples, dtype=np.float64)
    if x.ndim != 2 or not 1 <= x.shape[1] <= 64 or x.shape[0] > 120000:
        raise ValueError("Expected at most 120000 samples by 1..64 channels")
    if not np.isfinite(x).all() or not np.isfinite(sample_rate):
        raise ValueError("Non-finite samples or sampling rate")
    if len(channel_names) != x.shape[1] or len(set(channel_names)) != len(channel_names):
        raise ValueError("Unique channel names must match channel count")
    if units not in ("V", "mV", "uV"):
        raise ValueError("Calibrated units V, mV or uV are required")
    if modality not in ("EEG", "EMG"):
        raise ValueError("Expected EEG or EMG")
    low, high = (1., 40.) if modality == "EEG" else (20., 450.)
    if not 2 * high < sample_rate <= 10000 or x.shape[0] < 2 * sample_rate:
        raise ValueError("Need at least two seconds and a rate above twice the filter cutoff")
    x = x * {"V": 1e6, "mV": 1e3, "uV": 1.}[units]
    flat = np.ptp(x, axis=0) <= 1e-9
    quality = {"state": "UNUSABLE" if flat.any() else "ACCEPTABLE",
               "flat_channels": [channel_names[i] for i in np.flatnonzero(flat)],
               "nonfinite_count": 0,
               "limitations": "Flatline/finite checks only; no calibrated artifact or clinical quality score."}
    sos = signal.butter(4, [low, high], btype="bandpass", fs=sample_rate, output="sos")
    y = signal.sosfiltfilt(sos, x, axis=0)
    f, psd = signal.welch(y, fs=sample_rate, nperseg=min(len(y), int(sample_rate * 2)), axis=0)
    features = {}
    for c, name in enumerate(channel_names):
        v = y[:, c]
        result = {"rms_uV": float(np.sqrt(np.mean(v ** 2))),
                  "peak_to_peak_uV": float(np.ptp(v))}
        if modality == "EEG":
            for band, a, b in [("delta", 1, 4), ("theta", 4, 8), ("alpha", 8, 13), ("beta", 13, 30), ("gamma", 30, 40)]:
                mask = (f >= a) & (f < b)
                result[band + "_power_uV2"] = float(np.sum(psd[mask, c]) * (f[1] - f[0]))
        else:
            envelope = signal.sosfiltfilt(signal.butter(2, 5, fs=sample_rate, output="sos"), np.abs(v))
            result["mean_absolute_uV"] = float(np.mean(np.abs(v)))
            result["envelope_mean_uV"] = float(np.mean(envelope))
            result["waveform_length_uV"] = float(np.sum(np.abs(np.diff(v))))
            power = psd[:, c]
            result["median_frequency_hz"] = float(f[np.searchsorted(np.cumsum(power), power.sum()/2)]) if power.sum() > 0 else None
        features[name] = result
    return {"pipeline_version": PIPELINE_VERSION, "modality": modality,
            "sample_rate": sample_rate, "sample_count": len(x), "duration_seconds": len(x)/sample_rate,
            "units": "uV", "quality": quality, "features": features,
            "filter": {"type": "Butterworth zero-phase", "order": 4, "band_hz": [low, high]},
            "research_only": True}


def synchronize(streams, tolerance_ms=20.):
    if not 2 <= len(streams) <= 4 or not 0 < tolerance_ms <= 1000:
        raise ValueError("Need 2..4 streams and a positive tolerance up to 1000 ms")
    clocks = {s["clock_id"] for s in streams}
    if len(clocks) != 1 or not next(iter(clocks)):
        raise ValueError("Streams must have a shared clock; align/calibrate device clocks first")
    modalities = [s["modality"] for s in streams]
    if len(set(modalities)) != len(modalities):
        raise ValueError("Duplicate modalities")
    times = []
    for s in streams:
        t = np.asarray(s["timestamps_seconds"], dtype=float)
        if t.ndim != 1 or not 2 <= len(t) <= 120000 or not np.isfinite(t).all() or not (np.diff(t) > 0).all():
            raise ValueError("Timestamps must be finite and strictly increasing")
        times.append(t)
    start, end = max(t[0] for t in times), min(t[-1] for t in times)
    if end <= start:
        return {"status": "NO_OVERLAP", "research_only": True}
    reference = times[0][(times[0] >= start) & (times[0] <= end)]
    errors = {}
    for name, t in zip(modalities[1:], times[1:]):
        right = np.clip(np.searchsorted(t, reference), 0, len(t)-1)
        left = np.maximum(right-1, 0)
        distance = np.minimum(np.abs(t[right]-reference), np.abs(t[left]-reference))
        errors[name] = float(distance.max() * 1000) if len(distance) else None
    ok = len(reference) > 0 and all(v is not None and v <= tolerance_ms for v in errors.values())
    return {"status": "ALIGNED" if ok else "OUT_OF_TOLERANCE", "overlap_seconds": float(end-start),
            "max_nearest_sample_error_ms": errors, "tolerance_ms": tolerance_ms,
            "clock_id": next(iter(clocks)), "pipeline_version": PIPELINE_VERSION,
            "limitations": "Timestamp alignment does not establish hardware clock accuracy.", "research_only": True}


def prepare_fusion(processed):
    if not processed or len(processed) > 4:
        raise ValueError("Provide 1..4 processed modalities")
    vector, names = [], []
    for modality, result in sorted(processed.items()):
        if result.get("quality", {}).get("state") not in ("GOOD", "ACCEPTABLE"):
            return {"status": "SIGNAL_QUALITY_INSUFFICIENT", "prediction": None, "research_only": True}
        for channel, values in sorted(result["features"].items()):
            for feature, value in sorted(values.items()):
                if value is None or not np.isfinite(value):
                    raise ValueError("Fusion features must be finite")
                names.append(f"{modality}.{channel}.{feature}")
                vector.append(float(value))
    return {"status": "MODEL_UNAVAILABLE", "prediction": None, "feature_names": names,
            "feature_vector": vector, "pipeline_version": PIPELINE_VERSION,
            "limitations": "No trained multimodal head or fitted normalization supplied.", "research_only": True}


def facial_features(landmarks):
    p = np.asarray(landmarks, dtype=float)
    if p.ndim != 2 or p.shape[0] < 468 or p.shape[0] > 478 or p.shape[1] != 3 or not np.isfinite(p).all():
        raise ValueError("Expected 468..478 finite MediaPipe x,y,z landmarks")
    scale = np.linalg.norm(p[33, :2]-p[263, :2])
    if scale <= 1e-6:
        raise ValueError("Degenerate facial geometry")
    return {"pipeline_version": PIPELINE_VERSION,
            "features": {"face": {"lip_aperture_ratio": float(np.linalg.norm(p[13, :2]-p[14, :2])/scale),
                                    "mouth_width_ratio": float(np.linalg.norm(p[61, :2]-p[291, :2])/scale)}},
            "quality": {"state": "ACCEPTABLE", "limitations": "Geometry validity only; tracker confidence not inferred."},
            "research_only": True}
