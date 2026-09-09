from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from uuid import UUID
import os
from app.core.db import get_db
from app.core.dependencies import get_current_active_user, require_roles
from app.models import Recording, Session, Patient
from app.schemas.recording import RecordingCreate, RecordingUpdate, RecordingResponse
from app.core.audit import AuditService
from app.core.ownership import assert_session_access, assert_recording_access

router = APIRouter()


def _validate_recording_file(file_path: str, file_format: str) -> None:
    if not file_path or not isinstance(file_path, str):
        raise HTTPException(status_code=400, detail="Recording file_path is required")
    if not os.path.exists(file_path):
        raise HTTPException(status_code=400, detail=f"Recording file not found: {file_path}")
    if not os.path.isfile(file_path):
        raise HTTPException(status_code=400, detail=f"Recording path is not a file: {file_path}")
    try:
        with open(file_path, "rb") as f:
            f.read(1)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Recording file is not readable: {exc}")


@router.post("/recordings", response_model=RecordingResponse, status_code=status.HTTP_201_CREATED)
async def create_recording(recording_in: RecordingCreate, current_user=Depends(require_roles("RESEARCHER", "CLINICIAN", "ADMIN")), db: AsyncSession = Depends(get_db)):
    session = await db.get(Session, recording_in.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    # Legacy biosignal registration accepts metadata; the established audio slice requires a file.
    if recording_in.modality == "AUDIO":
        _validate_recording_file(recording_in.file_path, recording_in.file_format)
    recording = Recording(**recording_in.model_dump())
    if recording.is_synthetic:
        recording.data_classification = "SYNTHETIC"
    else:
        recording.data_classification = "REAL"
    db.add(recording)
    await db.flush()
    await db.refresh(recording)
    audit = AuditService(db)
    await audit.log(action="create", resource_type="recording", result="success", user=current_user, resource_id=str(recording.id))
    await db.commit()
    return recording

@router.get("/recordings", response_model=list[RecordingResponse])
async def list_recordings(current_user=Depends(get_current_active_user), db: AsyncSession = Depends(get_db), session_id: str = Query(None), modality: str = Query(None), skip: int = 0, limit: int = 100):
    query = select(Recording)
    if current_user.role.name == "PATIENT":
        query = query.join(Session, Recording.session_id == Session.id).join(Patient, Session.patient_id == Patient.id).where(Patient.user_id == current_user.id)
    if session_id:
        query = query.where(Recording.session_id == session_id)
    if modality:
        query = query.where(Recording.modality == modality)
    result = await db.execute(query.offset(skip).limit(limit))
    return result.scalars().all()

@router.get("/recordings/{recording_id}", response_model=RecordingResponse)
async def get_recording(recording_id: str, current_user=Depends(get_current_active_user), db: AsyncSession = Depends(get_db)):
    recording = await db.get(Recording, UUID(recording_id))
    if not recording:
        raise HTTPException(status_code=404, detail="Recording not found")
    await assert_recording_access(recording, current_user, db)
    return recording

@router.patch("/recordings/{recording_id}", response_model=RecordingResponse)
async def update_recording(recording_id: str, recording_update: RecordingUpdate, current_user=Depends(require_roles("RESEARCHER", "CLINICIAN", "ADMIN")), db: AsyncSession = Depends(get_db)):
    recording = await db.get(Recording, UUID(recording_id))
    if not recording:
        raise HTTPException(status_code=404, detail="Recording not found")
    for field, value in recording_update.model_dump(exclude_unset=True).items():
        if field == "is_synthetic":
            recording.is_synthetic = value
            recording.data_classification = "SYNTHETIC" if value else "REAL"
        else:
            setattr(recording, field, value)
    await db.flush()
    await db.refresh(recording)
    audit = AuditService(db)
    await audit.log(action="update", resource_type="recording", result="success", user=current_user, resource_id=recording_id)
    await db.commit()
    return recording
