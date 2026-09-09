from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from uuid import UUID

class DatasetProvenanceBase(BaseModel):
    dataset_id: Optional[UUID] = None
    original_source: str = Field(..., max_length=255)
    original_dataset_identifier: Optional[str] = Field(None, max_length=255)
    version: Optional[str] = Field(None, max_length=64)
    download_timestamp: Optional[datetime] = None
    source_url: Optional[str] = None
    license_access_info: Optional[str] = None
    checksum: Optional[str] = Field(None, max_length=255)
    preprocessing_pipeline_version: Optional[str] = Field(None, max_length=255)
    transformations_performed: Optional[str] = None
    responsible_user_id: Optional[UUID] = None

class DatasetProvenanceCreate(DatasetProvenanceBase):
    pass

class DatasetProvenanceUpdate(BaseModel):
    original_source: Optional[str] = Field(None, max_length=255)
    original_dataset_identifier: Optional[str] = Field(None, max_length=255)
    version: Optional[str] = Field(None, max_length=64)
    download_timestamp: Optional[datetime] = None
    source_url: Optional[str] = None
    license_access_info: Optional[str] = None
    checksum: Optional[str] = Field(None, max_length=255)
    preprocessing_pipeline_version: Optional[str] = Field(None, max_length=255)
    transformations_performed: Optional[str] = None
    responsible_user_id: Optional[UUID] = None

class DatasetProvenanceResponse(DatasetProvenanceBase):
    id: UUID
    created_at: datetime

    class Config:
        from_attributes = True
