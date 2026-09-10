from pydantic import ConfigDict, BaseModel, Field
from typing import Optional, Dict, Any, List
from datetime import datetime
from uuid import UUID
from app.schemas.enums import ModalityType


class DatasetImportRequest(BaseModel):
    local_path: Optional[str] = Field(None, max_length=255)
    source_url: Optional[str] = Field(None, max_length=255)
    access_type: Optional[str] = Field(None, max_length=64)
    access_requirements: Optional[str] = None
    is_restricted: bool = False
    is_credentialed: bool = False
    metadata_override: Optional[Dict[str, Any]] = None


class DatasetImportLogResponse(BaseModel):
    id: UUID
    dataset_id: UUID
    status: str
    message: Optional[str] = None
    import_metadata: Optional[Dict[str, Any]] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DatasetManifest(BaseModel):
    dataset_id: Optional[UUID] = None
    dataset_name: str
    version: str
    source_organization: Optional[str] = None
    source_url: Optional[str] = None
    citation: Optional[str] = None
    license: Optional[str] = None
    access_type: Optional[str] = None
    access_requirements: Optional[str] = None
    modality: Optional[str] = None
    participant_count: Optional[int] = None
    recording_count: Optional[int] = None
    total_duration: Optional[float] = None
    sampling_information: Optional[str] = None
    file_format: Optional[str] = None
    population: Optional[str] = None
    clinical_control: Optional[str] = None
    language: Optional[str] = None
    task: Optional[str] = None
    acquisition_device: Optional[str] = None
    checksum: Optional[str] = None
    import_timestamp: Optional[datetime] = None
    local_path: Optional[str] = None
    discovered_participants: List[str] = Field(default_factory=list)
    discovered_recordings: List[Dict[str, Any]] = Field(default_factory=list)
    discovered_modalities: List[str] = Field(default_factory=list)
    file_types: List[str] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)
    errors: List[str] = Field(default_factory=list)
    preprocessing_status: str = "RAW"
    importer_version: str = "0.1.0"
    bid_status: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class DatasetImportResponse(BaseModel):
    dataset_id: UUID
    imported_status: str
    qc_status: Optional[str] = None
    manifest: Optional[DatasetManifest] = None
    logs: List[DatasetImportLogResponse] = Field(default_factory=list)
