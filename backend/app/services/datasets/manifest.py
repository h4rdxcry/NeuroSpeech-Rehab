from typing import Any, Dict, List, Optional
from datetime import datetime
from app.schemas.dataset_import import DatasetManifest


def build_manifest(
    dataset_id: Optional[Any],
    dataset_name: str,
    version: str,
    source_metadata: Optional[Dict[str, Any]] = None,
    discovered_participants: Optional[List[str]] = None,
    discovered_recordings: Optional[List[Dict[str, Any]]] = None,
    discovered_modalities: Optional[List[str]] = None,
    file_types: Optional[List[str]] = None,
    warnings: Optional[List[str]] = None,
    errors: Optional[List[str]] = None,
    local_path: Optional[str] = None,
    checksum: Optional[str] = None,
) -> DatasetManifest:
    source_metadata = source_metadata or {}
    return DatasetManifest(
        dataset_id=dataset_id,
        dataset_name=dataset_name,
        version=version,
        source_organization=source_metadata.get("source_organization"),
        source_url=source_metadata.get("source_url"),
        citation=source_metadata.get("citation"),
        license=source_metadata.get("license"),
        access_type=source_metadata.get("access_type"),
        access_requirements=source_metadata.get("access_requirements"),
        modality=source_metadata.get("modality"),
        participant_count=source_metadata.get("participant_count"),
        recording_count=source_metadata.get("recording_count"),
        total_duration=source_metadata.get("total_duration"),
        sampling_information=source_metadata.get("sampling_information"),
        file_format=source_metadata.get("file_format"),
        population=source_metadata.get("population"),
        clinical_control=source_metadata.get("clinical_control"),
        language=source_metadata.get("language"),
        task=source_metadata.get("task"),
        acquisition_device=source_metadata.get("acquisition_device"),
        checksum=checksum,
        import_timestamp=datetime.utcnow(),
        local_path=local_path,
        discovered_participants=discovered_participants or [],
        discovered_recordings=discovered_recordings or [],
        discovered_modalities=discovered_modalities or [],
        file_types=file_types or [],
        warnings=warnings or [],
        errors=errors or [],
        preprocessing_status="RAW",
        bid_status=str(source_metadata.get("bids_compatible")) if source_metadata.get("bids_compatible") is not None else None,
    )


def manifest_to_dict(manifest: DatasetManifest) -> Dict[str, Any]:
    return manifest.model_dump(mode="json")
