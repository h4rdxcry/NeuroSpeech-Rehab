"""Initial migration

Revision ID: 001_initial
Revises:
Create Date: 2026-09-04
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSON
import uuid

revision = "001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    op.create_table(
        "roles",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column("name", sa.String(50), unique=True, nullable=False),
        sa.Column("permissions", sa.String, nullable=False, default="[]"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_table(
        "users",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("role_id", UUID(as_uuid=True), sa.ForeignKey("roles.id"), nullable=False),
        sa.Column("is_active", sa.Boolean, default=True, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)
    op.create_table(
        "patients",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), unique=True, nullable=False),
        sa.Column("clinician_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("date_of_birth", sa.Date, nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("is_active", sa.Boolean, default=True, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )
    op.create_table(
        "research_participants",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column("pseudonym_id", sa.String(64), nullable=False),
        sa.Column("demographic_summary", sa.String, nullable=True),
        sa.Column("inclusion_criteria", sa.String, nullable=True),
        sa.Column("exclusion_criteria", sa.String, nullable=True),
        sa.Column("consent_status", sa.String(32), nullable=False, default="pending"),
        sa.Column("consent_date", sa.Date, nullable=True),
        sa.Column("assigned_clinician_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_research_participants_pseudonym_id", "research_participants", ["pseudonym_id"], unique=True)
    op.create_table(
        "exercises",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("exercise_type", sa.String(64), nullable=False),
        sa.Column("target_modalities", JSON, nullable=False, default=list),
        sa.Column("difficulty", sa.String(32), nullable=False),
        sa.Column("duration_seconds", sa.Integer, nullable=True),
        sa.Column("repetition_count", sa.Integer, nullable=True),
        sa.Column("configuration", JSON, nullable=True),
        sa.Column("is_active", sa.Boolean, default=True, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_table(
        "sessions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column("participant_id", UUID(as_uuid=True), sa.ForeignKey("research_participants.id"), nullable=False),
        sa.Column("patient_id", UUID(as_uuid=True), sa.ForeignKey("patients.id"), nullable=True),
        sa.Column("clinician_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("session_date", sa.Date, nullable=False),
        sa.Column("session_number", sa.Integer, nullable=False),
        sa.Column("protocol_id", sa.String(255), nullable=True),
        sa.Column("environment", sa.String(64), nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", sa.String(32), nullable=False, default="planned"),
        sa.Column("dataset_split", sa.String(32), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_table(
        "session_exercises",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column("session_id", UUID(as_uuid=True), sa.ForeignKey("sessions.id"), nullable=False),
        sa.Column("exercise_id", UUID(as_uuid=True), sa.ForeignKey("exercises.id"), nullable=False),
        sa.Column("order_index", sa.Integer, nullable=False),
        sa.Column("status", sa.String(32), nullable=False, default="pending"),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_table(
        "attempts",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column("session_exercise_id", UUID(as_uuid=True), sa.ForeignKey("session_exercises.id"), nullable=False),
        sa.Column("attempt_number", sa.Integer, nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("outcome", sa.String(64), nullable=True),
        sa.Column("clinician_rating", sa.Integer, nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_table(
        "modalities",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column("name", sa.String(64), unique=True, nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("required_for_sync", sa.Boolean, default=False, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_table(
        "recordings",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column("session_id", UUID(as_uuid=True), sa.ForeignKey("sessions.id"), nullable=False),
        sa.Column("session_exercise_id", UUID(as_uuid=True), nullable=True),
        sa.Column("attempt_id", UUID(as_uuid=True), nullable=True),
        sa.Column("modality", sa.String(32), nullable=False),
        sa.Column("device_id", sa.String(255), nullable=False),
        sa.Column("device_name", sa.String(255), nullable=True),
        sa.Column("file_path", sa.Text, nullable=False),
        sa.Column("file_format", sa.String(32), nullable=False),
        sa.Column("sampling_rate_hz", sa.Float, nullable=True),
        sa.Column("channel_count", sa.Integer, nullable=True),
        sa.Column("channel_names", JSON, nullable=True),
        sa.Column("duration_seconds", sa.Float, nullable=True),
        sa.Column("start_timestamp", sa.DateTime(timezone=True), nullable=False),
        sa.Column("end_timestamp", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_synthetic", sa.Boolean, default=False, nullable=False),
        sa.Column("synthetic_source", sa.String(255), nullable=True),
        sa.Column("ground_truth_available", sa.Boolean, default=False, nullable=False),
        sa.Column("processing_status", sa.String(32), nullable=False, default="raw"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_table(
        "signal_quality",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column("recording_id", UUID(as_uuid=True), sa.ForeignKey("recordings.id"), unique=True, nullable=False),
        sa.Column("quality_state", sa.String(32), nullable=False, default="UNKNOWN"),
        sa.Column("quality_score", sa.Float, nullable=True),
        sa.Column("artifact_ratio", sa.Float, nullable=True),
        sa.Column("missing_data_ratio", sa.Float, nullable=True),
        sa.Column("synchronization_status", sa.String(32), nullable=True),
        sa.Column("sampling_rate_valid", sa.Boolean, nullable=True),
        sa.Column("channel_status", JSON, nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_table(
        "annotations",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column("recording_id", UUID(as_uuid=True), sa.ForeignKey("recordings.id"), nullable=False),
        sa.Column("annotator_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("annotation_type", sa.String(64), nullable=False),
        sa.Column("start_timestamp", sa.DateTime(timezone=True), nullable=False),
        sa.Column("end_timestamp", sa.DateTime(timezone=True), nullable=True),
        sa.Column("label", sa.String(255), nullable=False),
        sa.Column("confidence", sa.Float, nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("is_ground_truth", sa.Boolean, default=False, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )
    op.create_table(
        "model_versions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column("model_name", sa.String(255), nullable=False),
        sa.Column("version", sa.String(64), nullable=False),
        sa.Column("model_type", sa.String(64), nullable=False),
        sa.Column("architecture_json", JSON, nullable=False),
        sa.Column("training_dataset_version", sa.String(255), nullable=False),
        sa.Column("feature_pipeline_version", sa.String(255), nullable=False),
        sa.Column("training_params", JSON, nullable=True),
        sa.Column("performance_metrics", JSON, nullable=True),
        sa.Column("is_production", sa.Boolean, default=False, nullable=False),
        sa.Column("is_archived", sa.Boolean, default=False, nullable=False),
        sa.Column("registered_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("registered_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
    )
    op.create_table(
        "datasets",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("version", sa.String(64), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("bids_root", sa.Text, nullable=True),
        sa.Column("participant_ids", JSON, nullable=False),
        sa.Column("recording_ids", JSON, nullable=False),
        sa.Column("split_definition", JSON, nullable=False),
        sa.Column("is_final_test", sa.Boolean, default=False, nullable=False),
        sa.Column("is_locked", sa.Boolean, default=False, nullable=False),
        sa.Column("created_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_table(
        "predictions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column("attempt_id", UUID(as_uuid=True), sa.ForeignKey("attempts.id"), nullable=False),
        sa.Column("recording_id", UUID(as_uuid=True), nullable=True),
        sa.Column("model_id", UUID(as_uuid=True), sa.ForeignKey("model_versions.id"), nullable=False),
        sa.Column("model_version", sa.String(64), nullable=False),
        sa.Column("feature_pipeline_version", sa.String(64), nullable=False),
        sa.Column("training_dataset_version", sa.String(64), nullable=False),
        sa.Column("prediction_type", sa.String(64), nullable=False),
        sa.Column("predicted_label", sa.String(255), nullable=False),
        sa.Column("confidence", sa.Float, nullable=True),
        sa.Column("uncertainty", sa.Float, nullable=True),
        sa.Column("prediction_json", JSON, nullable=True),
        sa.Column("signal_quality_state", sa.String(64), nullable=False),
        sa.Column("signal_quality_details", JSON, nullable=True),
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_table(
        "evaluation_runs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("model_version_id", UUID(as_uuid=True), sa.ForeignKey("model_versions.id"), nullable=False),
        sa.Column("dataset_version", sa.String(255), nullable=False),
        sa.Column("dataset_split", sa.String(32), nullable=False),
        sa.Column("split_definition", JSON, nullable=False),
        sa.Column("metrics", JSON, nullable=False),
        sa.Column("confusion_matrix", JSON, nullable=True),
        sa.Column("per_participant_metrics", JSON, nullable=True),
        sa.Column("per_exercise_metrics", JSON, nullable=True),
        sa.Column("latency_stats", JSON, nullable=True),
        sa.Column("failure_cases", JSON, nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("run_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_table(
        "audit_logs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("actor_role", sa.String(64), nullable=True),
        sa.Column("action", sa.String(64), nullable=False),
        sa.Column("resource_type", sa.String(64), nullable=False),
        sa.Column("resource_id", UUID(as_uuid=True), nullable=True),
        sa.Column("request_id", sa.String(255), nullable=True),
        sa.Column("result", sa.String(32), nullable=False),
        sa.Column("ip_address", sa.String(64), nullable=True),
        sa.Column("user_agent", sa.Text, nullable=True),
        sa.Column("log_metadata", JSON, nullable=True),
        sa.Column("timestamp", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

def downgrade() -> None:
    op.drop_table("audit_logs")
    op.drop_table("evaluation_runs")
    op.drop_table("predictions")
    op.drop_table("datasets")
    op.drop_table("model_versions")
    op.drop_table("annotations")
    op.drop_table("signal_quality")
    op.drop_table("recordings")
    op.drop_table("modalities")
    op.drop_table("attempts")
    op.drop_table("session_exercises")
    op.drop_table("sessions")
    op.drop_table("exercises")
    op.drop_table("research_participants")
    op.drop_table("patients")
    op.drop_table("users")
    op.drop_table("roles")
