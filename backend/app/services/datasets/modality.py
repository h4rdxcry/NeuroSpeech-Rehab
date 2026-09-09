from typing import Optional


EXTENSION_MODALITY_MAP = {
    ".edf": "EEG",
    ".bdf": "EEG",
    ".fif": "EEG",
    ".set": "EEG",
    ".vhdr": "EEG",
    ".eeg": "EEG",
    ".cnt": "EEG",
    ".nii": "OTHER",
    ".nii.gz": "OTHER",
    ".wav": "AUDIO",
    ".flac": "AUDIO",
    ".mp3": "AUDIO",
    ".ogg": "AUDIO",
    ".m4a": "AUDIO",
    ".aiff": "AUDIO",
    ".mp4": "VIDEO_FACIAL",
    ".avi": "VIDEO_FACIAL",
    ".mov": "VIDEO_FACIAL",
    ".webm": "VIDEO_FACIAL",
    ".mkv": "VIDEO_FACIAL",
}


def modality_from_extension(path: str) -> Optional[str]:
    lower = path.lower()
    for ext, modality in EXTENSION_MODALITY_MAP.items():
        if lower.endswith(ext):
            return modality
    return None


def normalize_modality(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    v = value.strip().upper()
    mapping = {
        "EEG": "EEG",
        "EMG": "EMG",
        "ECG": "ECG",
        "AUDIO": "AUDIO",
        "SPEECH": "AUDIO",
        "VIDEO": "VIDEO_FACIAL",
        "VIDEO_FACIAL": "VIDEO_FACIAL",
        "FACIAL": "VIDEO_FACIAL",
        "OTHER": "OTHER",
    }
    return mapping.get(v)
