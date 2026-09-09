"""Versioned research features with raw source digest.

Revision ID: 006_computed_features
Revises: 80f7e31435e9
"""
from alembic import op
import sqlalchemy as sa

revision = "006_computed_features"
down_revision = "80f7e31435e9"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table("feature_records",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column("recording_id", sa.UUID(), sa.ForeignKey("recordings.id"), nullable=False),
        sa.Column("pipeline_version", sa.String(64), nullable=False),
        sa.Column("source_sha256", sa.String(64), nullable=False),
        sa.Column("result", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("recording_id", "pipeline_version", name="uq_feature_recording_pipeline"))


def downgrade():
    op.drop_table("feature_records")
