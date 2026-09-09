import enum


class ModalityType(str, enum.Enum):
    EEG = "EEG"
    EMG = "EMG"
    ECG = "ECG"
    AUDIO = "AUDIO"
    VIDEO_FACIAL = "VIDEO_FACIAL"
    OTHER = "OTHER"


class ProjectUsage(str, enum.Enum):
    USED_IN_PROJECT = "USED_IN_PROJECT"
    EVALUATED_BUT_NOT_USED = "EVALUATED_BUT_NOT_USED"
    REFERENCE_ONLY = "REFERENCE_ONLY"
