import json
import pytest
from unittest.mock import MagicMock, patch
from pathlib import Path

from app.services.datasets.acquire_dataset import (
    DatasetAcquisitionEngine,
    DatasetAcquisitionSpec,
    ZenodoRecordFetcher,
    DATASET_REGISTRY,
)
from app.services.datasets.storage_guard import StorageGuard, StorageLimitExceededError, BYTES_IN_GB


MOCK_ZENODO_RECORD = {
    "id": 17158391,
    "doi": "10.5281/zenodo.17158391",
    "metadata": {
        "title": "Facial EMG Dataset",
        "doi": "10.5281/zenodo.17158391",
        "license": {"id": "cc-by-4.0"},
        "resource_type": {"title": "Dataset", "type": "dataset"},
    },
    "files": [
        {"key": f"subject_{i:02d}.csv", "size": 890000, "checksum": f"md5:checksum{i:02d}", "links": {"self": f"https://zenodo.org/api/records/17158391/files/subject_{i:02d}.csv/content"}}
        for i in range(1, 16)
    ] + [
        {"key": "filters.py", "size": 543, "checksum": "md5:filtersmd5", "links": {"self": "https://zenodo.org/api/records/17158391/files/filters.py/content"}},
        {"key": "data_preprocessing.py", "size": 1692, "checksum": "md5:preproc", "links": {"self": "https://zenodo.org/api/records/17158391/files/data_preprocessing.py/content"}},
    ]
}


def test_resolve_spec():
    engine = DatasetAcquisitionEngine()
    spec = engine.resolve_spec("mimetic_emg_2015")
    assert spec.key == "mimetic_emg_2015"
    assert spec.zenodo_record_id == "17158391"
    assert spec.modality == "EMG"
    assert spec.expected_participants == 15
    assert spec.role_description == "NON-CLINICAL AUXILIARY sEMG PIPELINE VALIDATION DATASET"

    with pytest.raises(ValueError):
        engine.resolve_spec("non_existent_dataset")


def test_dry_run_success(tmp_path):
    mock_fetcher = MagicMock(spec=ZenodoRecordFetcher)
    mock_fetcher.fetch_record.return_value = MOCK_ZENODO_RECORD

    guard = StorageGuard(workspace_root=tmp_path, data_root=tmp_path / "data")
    engine = DatasetAcquisitionEngine(workspace_root=tmp_path, fetcher=mock_fetcher, guard=guard)

    result = engine.dry_run("mimetic_emg_2015")

    assert result["dataset_key"] == "mimetic_emg_2015"
    assert result["title"] == "Facial EMG Dataset"
    assert result["doi"] == "10.5281/zenodo.17158391"
    assert result["license"] == "cc-by-4.0"
    assert result["file_count"] == 17
    assert result["checksums_available"] is True
    assert result["data_classification"] == "REAL"
    assert result["is_synthetic"] is False
    assert result["storage_guard"]["allowed"] is True


def test_dry_run_storage_rejection_above_limit(tmp_path):
    mock_fetcher = MagicMock(spec=ZenodoRecordFetcher)
    # Huge mock record exceeding 50 GB
    huge_record = {
        "id": 17158391,
        "doi": "10.5281/zenodo.17158391",
        "metadata": {"title": "Huge Dataset", "license": {"id": "cc-by-4.0"}},
        "files": [{"key": "huge.bin", "size": int(60 * BYTES_IN_GB), "checksum": "md5:abc"}],
    }
    mock_fetcher.fetch_record.return_value = huge_record

    guard = StorageGuard(workspace_root=tmp_path, data_root=tmp_path / "data")
    engine = DatasetAcquisitionEngine(workspace_root=tmp_path, fetcher=mock_fetcher, guard=guard)

    result = engine.dry_run("mimetic_emg_2015")
    assert result["storage_guard"]["allowed"] is False
