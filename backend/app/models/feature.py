"""Versioned computed features, never clinical predictions."""
import uuid
from sqlalchemy import Column, UUID, ForeignKey, String, JSON, DateTime, UniqueConstraint
from sqlalchemy.sql import func
from app.core.db import Base


class FeatureRecord(Base):
    __tablename__ = "feature_records"
    __table_args__ = (UniqueConstraint("recording_id", "pipeline_version", name="uq_feature_recording_pipeline"),)
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    recording_id = Column(UUID(as_uuid=True), ForeignKey("recordings.id"), nullable=False)
    pipeline_version = Column(String(64), nullable=False)
    source_sha256 = Column(String(64), nullable=False)
    result = Column(JSON, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
