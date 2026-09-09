"""Provision isolated test accounts/exercise for Chromium; never touches real databases."""
import asyncio
import json
import os
import sys
import uuid
import wave
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parents[2]/'scripts'))
from sqlalchemy import select
from sqlalchemy.engine import make_url
from app.core.auth import hash_password
from app.core.db import get_session_maker
from app.models import Exercise, Patient, ResearchParticipant, Role, User
from local_checkpoint import ensure_asr_model

async def seed():
    url = make_url(os.environ['DATABASE_URL'])
    if os.environ.get('ENVIRONMENT') != 'test' or url.host not in {'127.0.0.1', 'localhost'} or url.database != 'verification_browser':
        raise RuntimeError('Browser fixtures require local verification_browser and ENVIRONMENT=test')
    suffix = uuid.uuid4().hex[:10]
    password = 'BrowserTestOnly-123!'
    result = {'password': password, 'patients': []}
    async with get_session_maker()() as db:
        roles = {}
        for name in ['PATIENT', 'CLINICIAN', 'RESEARCHER', 'ADMIN']:
            role = (await db.execute(select(Role).where(Role.name == name))).scalar_one_or_none()
            if role is None:
                role = Role(name=name, permissions='[]'); db.add(role); await db.flush()
            roles[name] = role
        for kind in ['mobile','tablet','desktop','denied','unlinked','navigation','speech','clinician','researcher','admin']:
            role = roles[kind.upper()] if kind in ['clinician','researcher','admin'] else roles['PATIENT']
            user = User(email=f'browser-{kind}-{suffix}@example.com', password_hash=hash_password(password), role_id=role.id, is_active=True)
            db.add(user); await db.flush()
            info = {'email': user.email, 'kind': kind}
            if kind == 'researcher':
                await ensure_asr_model(db, user.id)
            if role.name == 'PATIENT':
                participant = None
                if kind != 'unlinked':
                    participant = ResearchParticipant(pseudonym_id=f'BROWSER-{kind}-{suffix}', consent_status='approved'); db.add(participant); await db.flush()
                patient = Patient(user_id=user.id, participant_id=participant.id if participant else None)
                db.add(patient); await db.flush()
                info['patient_id'] = str(patient.id)
                result['patients'].append(info)
            else: result[kind] = info
        exercise = Exercise(name=f'Browser speech practice {suffix}', description='Read the assigned Tamil phrase at your own pace. Automated test fixture.', exercise_type='speech', target_modalities=['AUDIO'], difficulty='easy', configuration={'target_phrase':'வணக்கம்'}, is_active=True)
        db.add(exercise); await db.flush()
        result.update(exercise_id=str(exercise.id), exercise_name=exercise.name, target_phrase='வணக்கம்')
        await db.commit()
    output = Path(os.environ['BROWSER_FIXTURE_FILE'])
    output.write_text(json.dumps(result), encoding='utf-8')
    with wave.open(str(output.with_name('silence.wav')), 'wb') as audio:
        audio.setnchannels(1); audio.setsampwidth(2); audio.setframerate(16000); audio.writeframes(b'\x00\x00'*16000*10)

if __name__ == '__main__': asyncio.run(seed())
