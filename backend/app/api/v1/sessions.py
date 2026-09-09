from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from uuid import UUID
from app.core.db import get_db
from app.core.dependencies import get_current_active_user, require_roles
from app.models import User, Session, ResearchParticipant, Patient
from app.schemas.session import SessionCreate, SessionUpdate, SessionResponse
from app.core.audit import AuditService
from app.core.ownership import assert_session_access, assert_patient_session_writable
from datetime import date

router = APIRouter()

@router.post("/sessions", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
async def create_session(session_in: SessionCreate, current_user: User = Depends(get_current_active_user), db: AsyncSession = Depends(get_db)):
    participant = await db.get(ResearchParticipant, session_in.participant_id)
    if not participant:
        raise HTTPException(status_code=404, detail="Research participant not found")
    if session_in.patient_id:
        patient = await db.get(Patient, session_in.patient_id)
        if not patient:
            raise HTTPException(status_code=404, detail="Patient not found")
    if current_user.role.name == "PATIENT":
        result = await db.execute(select(Patient).where(Patient.user_id == current_user.id))
        patient = result.scalar_one_or_none()
        if not patient or not patient.is_active or session_in.patient_id != patient.id:
            raise HTTPException(status_code=403, detail="Patients may create sessions only for their own profile")
        if not patient.participant_id or session_in.participant_id != patient.participant_id:
            raise HTTPException(status_code=409, detail="Patient is not linked to an enrolled research participant")
    session = Session(**session_in.model_dump())
    await assert_patient_session_writable(session, current_user, db)
    db.add(session)
    await db.flush()
    await db.refresh(session)
    audit = AuditService(db)
    await audit.log(action="create", resource_type="session", result="success", user=current_user, resource_id=str(session.id))
    await db.commit()
    return session

@router.get("/sessions", response_model=list[SessionResponse])
async def list_sessions(current_user: User = Depends(get_current_active_user), db: AsyncSession = Depends(get_db), skip: int = 0, limit: int = 100, participant_id: str = Query(None), dataset_split: str = Query(None)):
    query = select(Session)
    if current_user.role.name == "PATIENT":
        result = await db.execute(select(Patient.id).where(Patient.user_id == current_user.id))
        patient_id = result.scalar_one_or_none()
        if not patient_id:
            return []
        query = query.where(Session.patient_id == patient_id)
    if participant_id:
        query = query.where(Session.participant_id == participant_id)
    if dataset_split:
        query = query.where(Session.dataset_split == dataset_split)
    result = await db.execute(query.offset(skip).limit(limit))
    return result.scalars().all()

@router.get("/sessions/{session_id}", response_model=SessionResponse)
async def get_session(session_id: str, current_user: User = Depends(get_current_active_user), db: AsyncSession = Depends(get_db)):
    session = await db.get(Session, UUID(session_id))
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    await assert_session_access(session, current_user, db)
    return session

@router.patch("/sessions/{session_id}", response_model=SessionResponse)
async def update_session(session_id: str, session_update: SessionUpdate, current_user: User = Depends(get_current_active_user), db: AsyncSession = Depends(get_db)):
    session = await db.get(Session, UUID(session_id))
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    await assert_session_access(session, current_user, db)
    await assert_patient_session_writable(session, current_user, db)
    if current_user.role.name == "PATIENT":
        disallowed = set(session_update.model_dump(exclude_unset=True)) - {"status", "started_at", "ended_at"}
        if disallowed:
            raise HTTPException(status_code=403, detail="Patients may only update session lifecycle and timing")
    for field, value in session_update.model_dump(exclude_unset=True).items():
        setattr(session, field, value)
    await db.flush()
    await db.refresh(session)
    audit = AuditService(db)
    await audit.log(action="update", resource_type="session", result="success", user=current_user, resource_id=session_id)
    await db.commit()
    return session

@router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_session(session_id: str, current_user: User = Depends(require_roles("ADMIN")), db: AsyncSession = Depends(get_db)):
    session = await db.get(Session, UUID(session_id))
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    await db.delete(session)
    audit = AuditService(db)
    await audit.log(action="delete", resource_type="session", result="success", user=current_user, resource_id=session_id)
    await db.commit()
    return None
