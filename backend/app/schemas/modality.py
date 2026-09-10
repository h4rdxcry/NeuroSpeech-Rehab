from pydantic import ConfigDict, BaseModel, Field
from typing import Optional
from datetime import datetime
from uuid import UUID

class ModalityBase(BaseModel):
    name: str = Field(..., max_length=64)
    description: Optional[str] = None
    required_for_sync: bool = False

class ModalityCreate(ModalityBase):
    pass

class ModalityUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=64)
    description: Optional[str] = None
    required_for_sync: Optional[bool] = None

class ModalityResponse(ModalityBase):
    id: UUID
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
