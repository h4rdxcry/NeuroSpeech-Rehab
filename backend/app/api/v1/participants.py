from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.core.db import get_db
from app.core.dependencies import get_current_active_user, require_roles
from app.models import User, Patient, ResearchParticipant
from app.schemas.participant import PatientCreate, PatientUpdate, PatientResponse, ResearchParticipantCreate, ResearchParticipantUpdate, ResearchParticipantResponse
from app.core.audit import AuditService

router = APIRouter()


async def _get_owned_patient(current_user: User, db: AsyncSession) -> Patient:
    result = await db.execute(select(Patient).where(Patient.user_id == current_user.id))
    patient = result.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient profile not found")
    return patient

@router.post("/patients", response_model=PatientResponse, status_code=status.HTTP_201_CREATED)
async def create_patient(patient_in: PatientCreate, current_user: User = Depends(require_roles("CLINICIAN", "ADMIN")), db: AsyncSession = Depends(get_db)):
    if patient_in.participant_id:
        participant = await db.get(ResearchParticipant, patient_in.participant_id)
        if not participant:
            raise HTTPException(status_code=404, detail="Research participant not found")
    patient = Patient(**patient_in.model_dump())
    db.add(patient)
    await db.flush()
    await db.refresh(patient)
    audit = AuditService(db)
    await audit.log(action="create", resource_type="patient", result="success", user=current_user, resource_id=str(patient.id))
    await db.commit()
    return patient

@router.get("/patients", response_model=list[PatientResponse])
async def list_patients(current_user: User = Depends(get_current_active_user), db: AsyncSession = Depends(get_db), skip: int = 0, limit: int = 100):
    query = select(Patient)
    if current_user.role.name == "PATIENT":
        query = query.where(Patient.user_id == current_user.id)
    result = await db.execute(query.offset(skip).limit(limit))
    return result.scalars().all()

@router.get("/patients/{patient_id}", response_model=PatientResponse)
async def get_patient(patient_id: str, current_user: User = Depends(get_current_active_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Patient).where(Patient.id == patient_id))
    patient = result.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    if current_user.role.name == "PATIENT" and patient.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Patient profile access denied")
    return patient


@router.get("/me", response_model=PatientResponse)
async def get_my_patient(current_user: User = Depends(get_current_active_user), db: AsyncSession = Depends(get_db)):
    if current_user.role.name != "PATIENT":
        raise HTTPException(status_code=403, detail="Patient profile endpoint is for patients")
    return await _get_owned_patient(current_user, db)

@router.patch("/patients/{patient_id}", response_model=PatientResponse)
async def update_patient(patient_id: str, patient_update: PatientUpdate, current_user: User = Depends(require_roles("CLINICIAN", "ADMIN")), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Patient).where(Patient.id == patient_id))
    patient = result.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    if patient_update.participant_id:
        participant = await db.get(ResearchParticipant, patient_update.participant_id)
        if not participant:
            raise HTTPException(status_code=404, detail="Research participant not found")
    for field, value in patient_update.model_dump(exclude_unset=True).items():
        setattr(patient, field, value)
    await db.flush()
    await db.refresh(patient)
    audit = AuditService(db)
    await audit.log(action="update", resource_type="patient", result="success", user=current_user, resource_id=patient_id)
    await db.commit()
    return patient

@router.post("/research-participants", response_model=ResearchParticipantResponse, status_code=status.HTTP_201_CREATED)
async def create_research_participant(participant_in: ResearchParticipantCreate, current_user: User = Depends(require_roles("RESEARCHER", "ADMIN")), db: AsyncSession = Depends(get_db)):
    participant = ResearchParticipant(**participant_in.model_dump())
    db.add(participant)
    await db.flush()
    await db.refresh(participant)
    audit = AuditService(db)
    await audit.log(action="create", resource_type="research_participant", result="success", user=current_user, resource_id=str(participant.id))
    await db.commit()
    return participant

@router.get("/research-participants", response_model=list[ResearchParticipantResponse])
async def list_research_participants(current_user: User = Depends(require_roles("RESEARCHER", "ADMIN")), db: AsyncSession = Depends(get_db), skip: int = 0, limit: int = 100):
    result = await db.execute(select(ResearchParticipant).offset(skip).limit(limit))
    return result.scalars().all()

@router.get("/research-participants/{participant_id}", response_model=ResearchParticipantResponse)
async def get_research_participant(participant_id: str, current_user: User = Depends(require_roles("RESEARCHER", "ADMIN")), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ResearchParticipant).where(ResearchParticipant.id == participant_id))
    participant = result.scalar_one_or_none()
    if not participant:
        raise HTTPException(status_code=404, detail="Research participant not found")
    return participant

@router.patch("/research-participants/{participant_id}", response_model=ResearchParticipantResponse)
async def update_research_participant(participant_id: str, participant_update: ResearchParticipantUpdate, current_user: User = Depends(require_roles("RESEARCHER", "ADMIN")), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ResearchParticipant).where(ResearchParticipant.id == participant_id))
    participant = result.scalar_one_or_none()
    if not participant:
        raise HTTPException(status_code=404, detail="Research participant not found")
    for field, value in participant_update.model_dump(exclude_unset=True).items():
        setattr(participant, field, value)
    await db.flush()
    await db.refresh(participant)
    audit = AuditService(db)
    await audit.log(action="update", resource_type="research_participant", result="success", user=current_user, resource_id=participant_id)
    await db.commit()
    return participant
