"""Provision development access without adding any predictions, scores or sensor data."""
import asyncio, os, sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'backend'))
from sqlalchemy import select
from sqlalchemy.engine import make_url
from app.core.db import get_session_maker
from app.core.auth import hash_password
from app.models import Role,User,Patient,ResearchParticipant,Exercise
from local_checkpoint import ensure_asr_model
async def main():
    url=make_url(os.environ['DATABASE_URL'])
    if url.host not in {'127.0.0.1','localhost'} or url.database!='neurospeech_stitch' or os.environ.get('ENVIRONMENT')!='development':
        raise RuntimeError('Local development workspace only')
    async with get_session_maker()() as db:
        users={}
        for name in ['PATIENT','CLINICIAN','RESEARCHER']:
            role=(await db.execute(select(Role).where(Role.name==name))).scalar_one_or_none()
            if not role:
                role=Role(name=name,permissions='[]');db.add(role);await db.flush()
            email=name.lower()+'@neurospeech.dev'
            user=(await db.execute(select(User).where(User.email==email))).scalar_one_or_none()
            if not user:
                user=User(email=email,password_hash=hash_password('NeuroSpeechDemo123!'),role_id=role.id,is_active=True);db.add(user);await db.flush()
            users[name]=user
        patient=(await db.execute(select(Patient).where(Patient.user_id==users['PATIENT'].id))).scalar_one_or_none()
        if not patient:
            participant=ResearchParticipant(pseudonym_id='LOCAL-PRACTICE-NOT-STUDY',consent_status='not_a_study',assigned_clinician_id=users['CLINICIAN'].id)
            db.add(participant);await db.flush()
            patient=Patient(user_id=users['PATIENT'].id,participant_id=participant.id,clinician_id=users['CLINICIAN'].id,notes='LOCAL PRACTICE: not a clinical enrollment or study outcome.')
            db.add(patient)
        exercise=(await db.execute(select(Exercise).where(Exercise.name=='Tamil phrase practice'))).scalar_one_or_none()
        if not exercise:
            db.add(Exercise(name='Tamil phrase practice',description='Read the phrase at your own pace. Stop the microphone after speaking. Keep each phrase under 12 seconds.',exercise_type='speech',target_modalities=['AUDIO'],difficulty='self-paced',configuration={'target_phrase':'வணக்கம்'},is_active=True))
        await ensure_asr_model(db, users['RESEARCHER'].id)
        await db.commit()
    print('Local access is ready. No sessions, attempts, predictions, scores or sensor values were pre-populated.')
if __name__=='__main__':asyncio.run(main())
