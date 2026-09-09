from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from uuid import UUID

class DatasetBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    version: str = Field(..., max_length=64)
    description: Optional[str] = None
    bids_root: Optional[str] = None
    participant_ids: List[str] = Field(default_factory=list)
    recording_ids: List[UUID] = Field(default_factory=list)
    split_definition: Dict[str, List[str]] = Field(default_factory=dict)
    is_final_test: bool = False
    is_locked: bool = False
    source_organization: Optional[str] = Field(None, max_length=255)
    source_url: Optional[str] = None
    citation: Optional[str] = None
    modality: Optional[str] = Field(None, max_length=64)
    population_description: Optional[str] = None
    participant_count: Optional[int] = None
    recording_count: Optional[int] = None
    total_duration: Optional[float] = None
    sampling_information: Optional[str] = None
    file_format: Optional[str] = Field(None, max_length=64)
    license: Optional[str] = Field(None, max_length=255)
    access_type: Optional[str] = Field(None, max_length=64)
    access_requirements: Optional[str] = None
    consent_ethics: Optional[str] = None
    clinical_or_control_population: Optional[str] = Field(None, max_length=64)
    language: Optional[str] = Field(None, max_length=64)
    task_description: Optional[str] = None
    acquisition_device: Optional[str] = Field(None, max_length=255)
    is_public: bool = False
    is_restricted: bool = False
    is_credentialed: bool = False
    imported_status: str = "pending"
    import_date: Optional[datetime] = None
    checksum: Optional[str] = Field(None, max_length=255)
    data_classification: str = "REAL"
    notes: Optional[str] = None
    manifest: Optional[Dict[str, Any]] = None
    import_error: Optional[str] = None
    qc_status: Optional[str] = None

class DatasetCreate(DatasetBase):
    pass

class DatasetUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=255)
    version: Optional[str] = Field(None, max_length=64)
    description: Optional[str] = None
    bids_root: Optional[str] = None
    participant_ids: Optional[List[str]] = None
    recording_ids: Optional[List[UUID]] = None
    split_definition: Optional[Dict[str, List[str]]] = None
    is_final_test: Optional[bool] = None
    is_locked: Optional[bool] = None
    source_organization: Optional[str] = Field(None, max_length=255)
    source_url: Optional[str] = None
    citation: Optional[str] = None
    modality: Optional[str] = Field(None, max_length=64)
    population_description: Optional[str] = None
    participant_count: Optional[int] = None
    recording_count: Optional[int] = None
    total_duration: Optional[float] = None
    sampling_information: Optional[str] = None
    file_format: Optional[str] = Field(None, max_length=64)
    license: Optional[str] = Field(None, max_length=255)
    access_type: Optional[str] = Field(None, max_length=64)
    access_requirements: Optional[str] = None
    consent_ethics: Optional[str] = None
    clinical_or_control_population: Optional[str] = Field(None, max_length=64)
    language: Optional[str] = Field(None, max_length=64)
    task_description: Optional[str] = None
    acquisition_device: Optional[str] = Field(None, max_length=255)
    is_public: Optional[bool] = None
    is_restricted: Optional[bool] = None
    is_credentialed: Optional[bool] = None
    imported_status: Optional[str] = None
    import_date: Optional[datetime] = None
    checksum: Optional[str] = Field(None, max_length=255)
    data_classification: Optional[str] = None
    notes: Optional[str] = None
    manifest: Optional[Dict[str, Any]] = None
    import_error: Optional[str] = None
    qc_status: Optional[str] = None

class DatasetResponse(DatasetBase):
    # Imported split definitions also contain version, seed and ratio metadata.
    # Preserve that stored JSON on reads without changing the write contract.
    split_definition: Dict[str, Any] = Field(default_factory=dict)
    id: UUID
    created_by: UUID
    created_at: datetime

    class Config:
        from_attributes = True
