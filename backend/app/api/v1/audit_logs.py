from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.core.db import get_db
from app.core.dependencies import get_current_active_user, require_roles
from app.models import AuditLog
from app.schemas.audit_log import AuditLogResponse
from app.core.audit import AuditService

router = APIRouter()

@router.get("/audit-logs", response_model=list[AuditLogResponse])
async def list_audit_logs(current_user=Depends(require_roles("ADMIN", "RESEARCHER")), db: AsyncSession = Depends(get_db), resource_type: str = Query(None), action: str = Query(None), skip: int = 0, limit: int = 100):
    query = select(AuditLog)
    if resource_type:
        query = query.where(AuditLog.resource_type == resource_type)
    if action:
        query = query.where(AuditLog.action == action)
    result = await db.execute(query.order_by(AuditLog.timestamp.desc()).offset(skip).limit(limit))
    return result.scalars().all()

@router.get("/audit-logs/{log_id}", response_model=AuditLogResponse)
async def get_audit_log(log_id: str, current_user=Depends(require_roles("ADMIN")), db: AsyncSession = Depends(get_db)):
    log = await db.get(AuditLog, log_id)
    if not log:
        raise HTTPException(status_code=404, detail="Audit log not found")
    return log
