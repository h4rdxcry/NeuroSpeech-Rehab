from pydantic import ConfigDict, BaseModel, Field
from typing import Optional, Dict, Any
from datetime import datetime
from uuid import UUID

class ModelVersionBase(BaseModel):
    model_name: str = Field(..., max_length=255)
    version: str = Field(..., max_length=64)
    model_type: str = Field(..., max_length=64)
    architecture_json: Dict[str, Any]
    training_dataset_version: str = Field(..., max_length=255)
    feature_pipeline_version: str = Field(..., max_length=255)
    training_params: Optional[Dict[str, Any]] = None
    performance_metrics: Optional[Dict[str, Any]] = None
    is_production: bool = False
    is_archived: bool = False

class ModelVersionCreate(ModelVersionBase):
    pass

class ModelVersionUpdate(BaseModel):
    model_name: Optional[str] = Field(None, max_length=255)
    version: Optional[str] = Field(None, max_length=64)
    model_type: Optional[str] = Field(None, max_length=64)
    architecture_json: Optional[Dict[str, Any]] = None
    training_dataset_version: Optional[str] = Field(None, max_length=255)
    feature_pipeline_version: Optional[str] = Field(None, max_length=255)
    training_params: Optional[Dict[str, Any]] = None
    performance_metrics: Optional[Dict[str, Any]] = None
    is_production: Optional[bool] = None
    is_archived: Optional[bool] = None

class ModelVersionResponse(ModelVersionBase):
    id: UUID
    registered_by: UUID
    registered_at: datetime

    model_config = ConfigDict(from_attributes=True)
