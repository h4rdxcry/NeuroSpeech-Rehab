"""Add the explicit patient-to-research-participant enrollment link.

Revision ID: 007_patient_participant_link
Revises: 006_computed_features
"""
from alembic import op
import sqlalchemy as sa


revision = "007_patient_participant_link"
down_revision = "006_computed_features"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "patients",
        sa.Column("participant_id", sa.UUID(), nullable=True),
    )
    op.create_foreign_key(
        "fk_patients_participant_id",
        "patients",
        "research_participants",
        ["participant_id"],
        ["id"],
    )
    op.create_unique_constraint("uq_patients_participant_id", "patients", ["participant_id"])


def downgrade() -> None:
    op.drop_constraint("uq_patients_participant_id", "patients", type_="unique")
    op.drop_constraint("fk_patients_participant_id", "patients", type_="foreignkey")
    op.drop_column("patients", "participant_id")
