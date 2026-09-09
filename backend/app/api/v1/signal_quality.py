from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from uuid import UUID
from app.core.db import get_db
from app.core.dependencies import get_current_active_user, require_roles
from app.models import SignalQuality, Recording
from app.schemas.signal_quality import SignalQualityCreate, SignalQualityUpdate, SignalQualityResponse
from app.core.audit import AuditService
from app.core.ownership import assert_recording_access

router = APIRouter()

@router.post("/signal-quality", response_model=SignalQualityResponse, status_code=status.HTTP_201_CREATED)
async def create_signal_quality(signal_in: SignalQualityCreate, current_user=Depends(require_roles("RESEARCHER", "CLINICIAN", "ADMIN")), db: AsyncSession = Depends(get_db)):
    recording = await db.get(Recording, signal_in.recording_id)
    if not recording:
        raise HTTPException(status_code=404, detail="Recording not found")
    await assert_recording_access(recording, current_user, db)
    existing = await db.execute(select(SignalQuality).where(SignalQuality.recording_id == signal_in.recording_id))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Signal quality already recorded for this recording")
    signal = SignalQuality(**signal_in.model_dump())
    db.add(signal)
    await db.flush()
    await db.refresh(signal)
    audit = AuditService(db)
    await audit.log(action="create", resource_type="signal_quality", result="success", user=current_user, resource_id=str(signal.id))
    await db.commit()
    return signal

@router.get("/signal-quality/{recording_id}", response_model=SignalQualityResponse)
async def get_signal_quality(recording_id: str, current_user=Depends(get_current_active_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SignalQuality).where(SignalQuality.recording_id == UUID(recording_id)))
    signal = result.scalar_one_or_none()
    if not signal:
        raise HTTPException(status_code=404, detail="Signal quality not found")
    if current_user.role.name == "PATIENT":
        recording = await db.get(Recording, signal.recording_id)
        if not recording:
            raise HTTPException(status_code=404, detail="Recording not found")
        await assert_recording_access(recording, current_user, db)
    return signal

@router.patch("/signal-quality/{recording_id}", response_model=SignalQualityResponse)
async def update_signal_quality(recording_id: str, signal_update: SignalQualityUpdate, current_user=Depends(require_roles("RESEARCHER", "CLINICIAN", "ADMIN")), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SignalQuality).where(SignalQuality.recording_id == UUID(recording_id)))
    signal = result.scalar_one_or_none()
    if not signal:
        raise HTTPException(status_code=404, detail="Signal quality not found")
    for field, value in signal_update.model_dump(exclude_unset=True).items():
        setattr(signal, field, value)
    await db.flush()
    await db.refresh(signal)
    audit = AuditService(db)
    await audit.log(action="update", resource_type="signal_quality", result="success", user=current_user, resource_id=str(signal.id))
    await db.commit()
    return signal
