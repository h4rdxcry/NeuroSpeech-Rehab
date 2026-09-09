import pytest
from app.services.datasets.storage_guard import (
    StorageGuard,
    StorageLimitExceededError,
    BYTES_IN_GB,
    HARD_STORAGE_LIMIT_GB,
    MIN_SAFETY_BUFFER_GB,
    WARNING_THRESHOLD_GB,
)


def test_storage_guard_normal_acquisition(tmp_path):
    guard = StorageGuard(workspace_root=tmp_path, data_root=tmp_path / "data")
    # Mimetic EMG: 0.2 GB download, 0.2 GB extracted
    download_bytes = int(0.20 * BYTES_IN_GB)
    extracted_bytes = int(0.20 * BYTES_IN_GB)
    
    result = guard.check_acquisition_safety(download_bytes, extracted_bytes)
    assert result.allowed is True
    assert result.warning is False
    assert result.remaining_buffer_gb >= MIN_SAFETY_BUFFER_GB
    assert result.projected_peak_gb < WARNING_THRESHOLD_GB


def test_storage_guard_warning_threshold(tmp_path):
    guard = StorageGuard(workspace_root=tmp_path, data_root=tmp_path / "data")
    # Proposed peak near 46 GB (between 45 GB and 48 GB)
    download_bytes = int(18.0 * BYTES_IN_GB)
    extracted_bytes = int(19.0 * BYTES_IN_GB)
    
    result = guard.check_acquisition_safety(download_bytes, extracted_bytes)
    assert result.allowed is True
    assert result.warning is True
    assert result.projected_peak_gb > WARNING_THRESHOLD_GB
    assert result.remaining_buffer_gb >= MIN_SAFETY_BUFFER_GB


def test_storage_guard_blocks_over_50gb(tmp_path):
    guard = StorageGuard(workspace_root=tmp_path, data_root=tmp_path / "data")
    # Huge dataset like IndicVoices (745 GB)
    download_bytes = int(100.0 * BYTES_IN_GB)
    extracted_bytes = int(100.0 * BYTES_IN_GB)
    
    result = guard.check_acquisition_safety(download_bytes, extracted_bytes)
    assert result.allowed is False
    assert "STORAGE GUARD BLOCKED" in result.message
    assert result.projected_peak_gb > HARD_STORAGE_LIMIT_GB

    with pytest.raises(StorageLimitExceededError):
        guard.guard_or_raise(download_bytes, extracted_bytes)


def test_storage_guard_blocks_small_safety_buffer(tmp_path):
    guard = StorageGuard(workspace_root=tmp_path, data_root=tmp_path / "data")
    # Peak at 49.0 GB (only 1.0 GB buffer remaining, less than required 2.0 GB)
    download_bytes = int(20.0 * BYTES_IN_GB)
    extracted_bytes = int(20.5 * BYTES_IN_GB)
    
    result = guard.check_acquisition_safety(download_bytes, extracted_bytes)
    assert result.allowed is False
    assert "safety margin" in result.message.lower() or "blocked" in result.message.lower()

    with pytest.raises(StorageLimitExceededError):
        guard.guard_or_raise(download_bytes, extracted_bytes)


def test_storage_guard_current_usage_tracking(tmp_path):
    data_root = tmp_path / "data"
    raw_dir = data_root / "raw" / "sample_ds"
    raw_dir.mkdir(parents=True)
    sample_file = raw_dir / "sample.wav"
    sample_file.write_bytes(b"0" * 1024 * 1024)  # 1 MB

    guard = StorageGuard(workspace_root=tmp_path, data_root=data_root)
    usage = guard.get_current_data_usage()

    assert usage["raw_bytes"] == 1024 * 1024
    assert usage["total_tracked_bytes"] >= 1024 * 1024
