from pydantic import ConfigDict, BaseModel, Field
from typing import Optional
from datetime import datetime
from uuid import UUID

class DatasetSplitBase(BaseModel):
    dataset_id: Optional[UUID] = None
    participant_id: str = Field(..., max_length=255)
    split_type: str = Field(..., max_length=32)
    split_version: Optional[str] = Field(None, max_length=64)
    is_locked: bool = False
    final_test_flag: bool = False

class DatasetSplitCreate(DatasetSplitBase):
    pass

class DatasetSplitUpdate(BaseModel):
    split_type: Optional[str] = Field(None, max_length=32)
    split_version: Optional[str] = Field(None, max_length=64)
    is_locked: Optional[bool] = None
    final_test_flag: Optional[bool] = None

class DatasetSplitResponse(DatasetSplitBase):
    id: UUID
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
