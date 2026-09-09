from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.core.db import get_db
from app.core.dependencies import get_current_active_user, require_roles
from app.models import Annotation, Recording, User
from app.schemas.annotation import AnnotationCreate, AnnotationUpdate, AnnotationResponse
from app.core.audit import AuditService

router = APIRouter()

@router.post("/annotations", response_model=AnnotationResponse, status_code=status.HTTP_201_CREATED)
async def create_annotation(annotation_in: AnnotationCreate, current_user=Depends(get_current_active_user), db: AsyncSession = Depends(get_db)):
    recording = await db.get(Recording, str(annotation_in.recording_id))
    if not recording:
        raise HTTPException(status_code=404, detail="Recording not found")
    annotation = Annotation(**annotation_in.model_dump(), annotator_id=current_user.id)
    db.add(annotation)
    await db.flush()
    await db.refresh(annotation)
    audit = AuditService(db)
    await audit.log(action="create", resource_type="annotation", result="success", user=current_user, resource_id=str(annotation.id))
    await db.commit()
    return annotation

@router.get("/annotations", response_model=list[AnnotationResponse])
async def list_annotations(current_user=Depends(get_current_active_user), db: AsyncSession = Depends(get_db), recording_id: str = Query(None), skip: int = 0, limit: int = 100):
    query = select(Annotation)
    if recording_id:
        query = query.where(Annotation.recording_id == recording_id)
    result = await db.execute(query.offset(skip).limit(limit))
    return result.scalars().all()

@router.patch("/annotations/{annotation_id}", response_model=AnnotationResponse)
async def update_annotation(annotation_id: str, annotation_update: AnnotationUpdate, current_user=Depends(get_current_active_user), db: AsyncSession = Depends(get_db)):
    annotation = await db.get(Annotation, annotation_id)
    if not annotation:
        raise HTTPException(status_code=404, detail="Annotation not found")
    if annotation.annotator_id != current_user.id and current_user.role.name != "ADMIN":
        raise HTTPException(status_code=403, detail="Not authorized to update this annotation")
    for field, value in annotation_update.model_dump(exclude_unset=True).items():
        setattr(annotation, field, value)
    await db.flush()
    await db.refresh(annotation)
    audit = AuditService(db)
    await audit.log(action="update", resource_type="annotation", result="success", user=current_user, resource_id=annotation_id)
    await db.commit()
    return annotation
