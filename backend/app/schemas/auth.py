from pydantic import BaseModel, Field, EmailStr, field_validator
from typing import Optional, List, Any
from datetime import datetime
from uuid import UUID

class RoleBase(BaseModel):
    name: str = Field(..., max_length=50)
    permissions: List[str] = Field(default_factory=list)

    @field_validator("permissions", mode="before")
    @classmethod
    def parse_permissions(cls, v: Any) -> List[str]:
        if isinstance(v, str):
            import json
            try:
                parsed = json.loads(v)
                if isinstance(parsed, list):
                    return parsed
            except json.JSONDecodeError:
                pass
            return []
        if isinstance(v, list):
            return v
        return []

class RoleCreate(RoleBase):
    pass

class RoleResponse(RoleBase):
    id: UUID
    created_at: datetime

    class Config:
        from_attributes = True

class UserBase(BaseModel):
    email: EmailStr
    role_id: UUID

class UserCreate(UserBase):
    password: str = Field(..., min_length=8)

class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    password: Optional[str] = Field(None, min_length=8)
    role_id: Optional[UUID] = None
    is_active: Optional[bool] = None

class UserResponse(UserBase):
    id: UUID
    is_active: bool
    created_at: datetime
    updated_at: datetime
    role: Optional[RoleResponse] = None

    class Config:
        from_attributes = True

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"

class TokenPayload(BaseModel):
    sub: UUID
    email: str
    role: str
    exp: datetime
