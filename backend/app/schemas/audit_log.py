from pydantic import ConfigDict, BaseModel, Field
from typing import Optional, Dict, Any
from datetime import datetime
from uuid import UUID

class AuditLogBase(BaseModel):
    user_id: Optional[UUID] = None
    actor_role: Optional[str] = Field(None, max_length=64)
    action: str = Field(..., max_length=64)
    resource_type: str = Field(..., max_length=64)
    resource_id: Optional[UUID] = None
    request_id: Optional[str] = Field(None, max_length=255)
    result: str = Field(..., max_length=32)
    ip_address: Optional[str] = Field(None, max_length=64)
    user_agent: Optional[str] = None
    log_metadata: Optional[Dict[str, Any]] = None

class AuditLogCreate(AuditLogBase):
    pass

class AuditLogResponse(AuditLogBase):
    id: UUID
    timestamp: datetime

    model_config = ConfigDict(from_attributes=True)
