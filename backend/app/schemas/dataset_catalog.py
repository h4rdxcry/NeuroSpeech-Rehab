from pydantic import ConfigDict, BaseModel, Field
from typing import Optional
from datetime import datetime
from uuid import UUID
from app.schemas.enums import ProjectUsage

class DatasetCatalogBase(BaseModel):
    dataset_id: Optional[UUID] = None
    modality: Optional[str] = Field(None, max_length=64)
    source: Optional[str] = Field(None, max_length=255)
    version: Optional[str] = Field(None, max_length=64)
    participants: Optional[int] = None
    recordings: Optional[int] = None
    duration: Optional[float] = None
    population: Optional[str] = Field(None, max_length=255)
    clinical_control: Optional[str] = Field(None, max_length=64)
    license: Optional[str] = Field(None, max_length=255)
    access_requirements: Optional[str] = None
    project_usage: Optional[ProjectUsage] = None
    citation: Optional[str] = None
    url: Optional[str] = None
    notes: Optional[str] = None

class DatasetCatalogCreate(DatasetCatalogBase):
    pass

class DatasetCatalogUpdate(BaseModel):
    modality: Optional[str] = Field(None, max_length=64)
    source: Optional[str] = Field(None, max_length=255)
    version: Optional[str] = Field(None, max_length=64)
    participants: Optional[int] = None
    recordings: Optional[int] = None
    duration: Optional[float] = None
    population: Optional[str] = Field(None, max_length=255)
    clinical_control: Optional[str] = Field(None, max_length=64)
    license: Optional[str] = Field(None, max_length=255)
    access_requirements: Optional[str] = None
    project_usage: Optional[ProjectUsage] = None
    citation: Optional[str] = None
    url: Optional[str] = None
    notes: Optional[str] = None

class DatasetCatalogResponse(DatasetCatalogBase):
    id: UUID
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
