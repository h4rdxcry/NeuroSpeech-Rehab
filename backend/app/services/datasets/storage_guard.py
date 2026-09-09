import os
import shutil
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Optional, Union


BYTES_IN_GB = 1024 * 1024 * 1024
HARD_STORAGE_LIMIT_GB = 50.0
SAFE_TARGET_STORAGE_GB = 48.0
WARNING_THRESHOLD_GB = 45.0
MIN_SAFETY_BUFFER_GB = 2.0

HARD_STORAGE_LIMIT_BYTES = int(HARD_STORAGE_LIMIT_GB * BYTES_IN_GB)
SAFE_TARGET_STORAGE_BYTES = int(SAFE_TARGET_STORAGE_GB * BYTES_IN_GB)
WARNING_THRESHOLD_BYTES = int(WARNING_THRESHOLD_GB * BYTES_IN_GB)
MIN_SAFETY_BUFFER_BYTES = int(MIN_SAFETY_BUFFER_GB * BYTES_IN_GB)


class StorageLimitExceededError(Exception):
    """Raised when an acquisition or extraction operation exceeds the safe storage limits."""
    pass


@dataclass
class StorageCheckResult:
    allowed: bool
    current_usage_gb: float
    projected_permanent_gb: float
    projected_peak_gb: float
    remaining_buffer_gb: float
    warning: bool
    message: str
    details: Dict[str, Any]


def get_path_size(path: Union[str, Path]) -> int:
    """Calculate the total size in bytes of a file or directory tree."""
    target = Path(path)
    if not target.exists():
        return 0
    if target.is_file():
        return target.stat().st_size
    total = 0
    for root, _, files in os.walk(target):
        for f in files:
            fp = os.path.join(root, f)
            try:
                total += os.path.getsize(fp)
            except (OSError, FileNotFoundError):
                continue
    return total


class StorageGuard:
    """Enforces disk storage limits for NeuroSpeech-Rehab dataset acquisition."""

    def __init__(
        self,
        workspace_root: Optional[Union[str, Path]] = None,
        data_root: Optional[Union[str, Path]] = None,
        hard_limit_gb: float = HARD_STORAGE_LIMIT_GB,
        safe_target_gb: float = SAFE_TARGET_STORAGE_GB,
        min_buffer_gb: float = MIN_SAFETY_BUFFER_GB,
    ):
        self.workspace_root = Path(workspace_root or Path(__file__).resolve().parents[4])
        self.data_root = Path(data_root or (self.workspace_root / "data"))
        self.hard_limit_bytes = int(hard_limit_gb * BYTES_IN_GB)
        self.safe_target_bytes = int(safe_target_gb * BYTES_IN_GB)
        self.min_buffer_bytes = int(min_buffer_gb * BYTES_IN_GB)

    def get_current_data_usage(self) -> Dict[str, Any]:
        """Inspect current on-disk sizes for raw data, models, processed, and database."""
        raw_size = get_path_size(self.data_root / "raw")
        processed_size = get_path_size(self.data_root / "processed")
        models_size = get_path_size(self.data_root / "models")
        bids_size = get_path_size(self.data_root / "bids")
        db_file = self.workspace_root / "backend" / "test.db"
        db_size = get_path_size(db_file) if db_file.exists() else 0
        total_tracked_bytes = raw_size + processed_size + models_size + bids_size + db_size

        return {
            "raw_bytes": raw_size,
            "raw_gb": round(raw_size / BYTES_IN_GB, 3),
            "processed_bytes": processed_size,
            "processed_gb": round(processed_size / BYTES_IN_GB, 3),
            "models_bytes": models_size,
            "models_gb": round(models_size / BYTES_IN_GB, 3),
            "bids_bytes": bids_size,
            "bids_gb": round(bids_size / BYTES_IN_GB, 3),
            "db_bytes": db_size,
            "db_gb": round(db_size / BYTES_IN_GB, 3),
            "total_tracked_bytes": total_tracked_bytes,
            "total_tracked_gb": round(total_tracked_bytes / BYTES_IN_GB, 3),
        }

    def check_acquisition_safety(
        self,
        download_bytes: int,
        extracted_bytes: int,
        temp_workspace_bytes: int = int(1.0 * BYTES_IN_GB),
        retain_archive: bool = False,
        infrastructure_overhead_bytes: int = int(7.5 * BYTES_IN_GB),
    ) -> StorageCheckResult:
        """Pre-flight check to verify whether a proposed dataset acquisition fits safely within limits.

        Peak calculation accounts for:
        - Current baseline data (e.g. retained JapanEEG sample)
        - Incoming archive file
        - In-flight extracted directory
        - Temporary workspace / cache
        - Fixed infrastructure allowance (DB, preprocessed features)
        """
        usage = self.get_current_data_usage()
        current_tracked_bytes = usage["total_tracked_bytes"]

        # If archive is retained permanently:
        if retain_archive:
            permanent_increment = download_bytes + extracted_bytes
        else:
            permanent_increment = extracted_bytes

        projected_permanent_bytes = current_tracked_bytes + permanent_increment + infrastructure_overhead_bytes
        projected_peak_bytes = (
            current_tracked_bytes
            + download_bytes
            + extracted_bytes
            + temp_workspace_bytes
            + infrastructure_overhead_bytes
        )

        remaining_buffer_bytes = self.hard_limit_bytes - projected_peak_bytes
        remaining_buffer_gb = round(remaining_buffer_bytes / BYTES_IN_GB, 3)
        projected_peak_gb = round(projected_peak_bytes / BYTES_IN_GB, 3)
        projected_perm_gb = round(projected_permanent_bytes / BYTES_IN_GB, 3)
        current_gb = usage["total_tracked_gb"]

        warning = False
        allowed = True
        message = "Acquisition is within safe storage limits."

        if projected_peak_bytes > self.hard_limit_bytes:
            allowed = False
            message = (
                f"STORAGE GUARD BLOCKED: Projected peak ({projected_peak_gb:.2f} GB) "
                f"exceeds hard limit of {HARD_STORAGE_LIMIT_GB:.1f} GB. Operation aborted."
            )
        elif remaining_buffer_bytes < self.min_buffer_bytes:
            allowed = False
            message = (
                f"STORAGE GUARD BLOCKED: Remaining buffer ({remaining_buffer_gb:.2f} GB) "
                f"is below mandatory safety margin of {MIN_SAFETY_BUFFER_GB:.1f} GB. Operation aborted."
            )
        elif projected_peak_bytes > WARNING_THRESHOLD_BYTES:
            warning = True
            message = (
                f"STORAGE GUARD WARNING: Projected peak ({projected_peak_gb:.2f} GB) "
                f"exceeds warning threshold of {WARNING_THRESHOLD_GB:.1f} GB, but fits within safety margin."
            )

        details = {
            "current_usage": usage,
            "incoming_download_gb": round(download_bytes / BYTES_IN_GB, 3),
            "incoming_extracted_gb": round(extracted_bytes / BYTES_IN_GB, 3),
            "temp_workspace_gb": round(temp_workspace_bytes / BYTES_IN_GB, 3),
            "retain_archive": retain_archive,
            "projected_permanent_gb": projected_perm_gb,
            "projected_peak_gb": projected_peak_gb,
            "remaining_buffer_gb": remaining_buffer_gb,
            "hard_limit_gb": HARD_STORAGE_LIMIT_GB,
            "safe_target_gb": SAFE_TARGET_STORAGE_GB,
        }

        return StorageCheckResult(
            allowed=allowed,
            current_usage_gb=current_gb,
            projected_permanent_gb=projected_perm_gb,
            projected_peak_gb=projected_peak_gb,
            remaining_buffer_gb=remaining_buffer_gb,
            warning=warning,
            message=message,
            details=details,
        )

    def guard_or_raise(
        self,
        download_bytes: int,
        extracted_bytes: int,
        temp_workspace_bytes: int = int(1.0 * BYTES_IN_GB),
        retain_archive: bool = False,
    ) -> StorageCheckResult:
        """Execute pre-flight check and raise StorageLimitExceededError if not allowed."""
        result = self.check_acquisition_safety(
            download_bytes=download_bytes,
            extracted_bytes=extracted_bytes,
            temp_workspace_bytes=temp_workspace_bytes,
            retain_archive=retain_archive,
        )
        if not result.allowed:
            raise StorageLimitExceededError(result.message)
        return result
