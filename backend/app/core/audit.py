from datetime import datetime
from typing import Optional, Dict, Any
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.models import AuditLog, User
from app.schemas.audit_log import AuditLogCreate

class AuditService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def log(
        self,
        action: str,
        resource_type: str,
        result: str,
        user: Optional[User] = None,
        resource_id: Optional[str] = None,
        request_id: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ):
        resolved_resource_id = None
        if resource_id is not None:
            if isinstance(resource_id, str):
                resolved_resource_id = UUID(resource_id)
            else:
                resolved_resource_id = resource_id
        log_entry = AuditLog(
            user_id=user.id if user else None,
            actor_role=user.role.name if user else None,
            action=action,
            resource_type=resource_type,
            resource_id=resolved_resource_id,
            request_id=request_id,
            result=result,
            ip_address=ip_address,
            user_agent=user_agent,
            log_metadata=metadata,
        )
        self.db.add(log_entry)
        await self.db.flush()
