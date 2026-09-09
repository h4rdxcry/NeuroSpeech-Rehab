"""Reject ordinary processing of locked final-test participants before source I/O."""
from sqlalchemy import select, or_
from app.models import ResearchParticipant, DatasetSplit, Session


async def is_final_test_session(db, session):
    if session.dataset_split and session.dataset_split.lower() in ("test", "final_test"):
        return True
    participant = await db.get(ResearchParticipant, session.participant_id)
    identities = [str(session.participant_id)]
    if participant:
        identities.append(participant.pseudonym_id)
    found = (await db.execute(select(DatasetSplit.id).where(
        DatasetSplit.participant_id.in_(identities),
        or_(DatasetSplit.final_test_flag.is_(True), DatasetSplit.split_type == "test")
    ).limit(1))).first()
    return found is not None
