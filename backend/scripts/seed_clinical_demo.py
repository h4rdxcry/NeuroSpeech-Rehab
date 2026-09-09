import asyncio
import os
import sys
from datetime import date
from pathlib import Path
from sqlalchemy import select

sys.path.insert(0, r'd:\NeuroSpeech-Rehab\backend')
sys.path.insert(0, r'd:\NeuroSpeech-Rehab\scripts')

from app.core.auth import hash_password
from app.core.db import get_session_maker
from app.models import Role, User, Patient, ResearchParticipant, Exercise, Session, SessionExercise
from local_checkpoint import ensure_asr_model

async def seed_all():
    async with get_session_maker()() as db:
        # 1. Roles
        roles = {}
        for role_name in ['PATIENT', 'CLINICIAN', 'RESEARCHER', 'ADMIN']:
            r = (await db.execute(select(Role).where(Role.name == role_name))).scalar_one_or_none()
            if not r:
                r = Role(name=role_name, permissions='[]')
                db.add(r)
                await db.flush()
            roles[role_name] = r

        # 2. Researcher User (for ASR registration)
        res_user = (await db.execute(select(User).where(User.email == 'researcher@neurospeech.dev'))).scalar_one_or_none()
        if not res_user:
            res_user = User(
                email='researcher@neurospeech.dev',
                password_hash=hash_password('Researcher123!'),
                role_id=roles['RESEARCHER'].id,
                is_active=True
            )
            db.add(res_user)
            await db.flush()

        # 3. Patient User
        pat_user = (await db.execute(select(User).where(User.email == 'patient@neurospeech.dev'))).scalar_one_or_none()
        if not pat_user:
            pat_user = User(
                email='patient@neurospeech.dev',
                password_hash=hash_password('NeuroSpeechDemo123!'),
                role_id=roles['PATIENT'].id,
                is_active=True
            )
            db.add(pat_user)
            await db.flush()

        # 4. Research Participant
        participant = (await db.execute(select(ResearchParticipant).where(ResearchParticipant.pseudonym_id == 'DEMO-PATIENT-01'))).scalar_one_or_none()
        if not participant:
            participant = ResearchParticipant(
                pseudonym_id='DEMO-PATIENT-01',
                consent_status='approved',
                consent_date=date.today(),
                demographic_summary='Adult NeuroSpeech Rehabilitation Cohort',
            )
            db.add(participant)
            await db.flush()

        # 5. Patient Profile
        patient = (await db.execute(select(Patient).where(Patient.user_id == pat_user.id))).scalar_one_or_none()
        if not patient:
            patient = Patient(
                user_id=pat_user.id,
                participant_id=participant.id,
                is_active=True,
                notes='Standard clinical trial baseline demo patient'
            )
            db.add(patient)
            await db.flush()
        elif not patient.participant_id:
            patient.participant_id = participant.id
            await db.flush()

        # 6. Clinical Target Exercises
        exercise_defs = [
            {
                'name': 'Morning Sunlight (Bilabial Flow)',
                'description': 'Bilabial flow, nasal resonance, and plosive closure exercise.',
                'exercise_type': 'speech',
                'target_modalities': ['AUDIO', 'VIDEO_FACIAL'],
                'difficulty': 'easy',
                'duration_seconds': 120,
                'configuration': {'target_phrase': 'Morning sunlight brings bright moments', 'phonemes': '/m/, /b/, /p/'}
            },
            {
                'name': 'வணக்கம் (Vanakkam)',
                'description': 'Tamil greeting, labial glide, and nasal harmony.',
                'exercise_type': 'speech',
                'target_modalities': ['AUDIO', 'VIDEO_FACIAL'],
                'difficulty': 'easy',
                'duration_seconds': 120,
                'configuration': {'target_phrase': 'வணக்கம்', 'phonemes': '/v/, /n/, /k/, /m/'}
            },
            {
                'name': 'அம்மா (Amma)',
                'description': 'Bilabial sustained closure and gentle phonemic glide.',
                'exercise_type': 'speech',
                'target_modalities': ['AUDIO', 'VIDEO_FACIAL'],
                'difficulty': 'easy',
                'duration_seconds': 120,
                'configuration': {'target_phrase': 'அம்மா', 'phonemes': '/m/'}
            },
            {
                'name': 'PA - TA - KA (DDK Agility)',
                'description': 'Diadochokinetic agility: rapid sequencing across labial, alveolar, velar stops.',
                'exercise_type': 'speech',
                'target_modalities': ['AUDIO', 'VIDEO_FACIAL'],
                'difficulty': 'medium',
                'duration_seconds': 180,
                'configuration': {'target_phrase': 'PA - TA - KA', 'phonemes': '/p/, /t/, /k/'}
            },
            {
                'name': 'A - E - I - O - U (Vowel Range)',
                'description': 'Articulatory range: quadrilateral vowel envelope expansion.',
                'exercise_type': 'speech',
                'target_modalities': ['AUDIO', 'VIDEO_FACIAL'],
                'difficulty': 'easy',
                'duration_seconds': 150,
                'configuration': {'target_phrase': 'A - E - I - O - U', 'phonemes': '/a/, /e/, /i/, /o/, /u/'}
            },
        ]

        created_exercises = []
        for edef in exercise_defs:
            ex = (await db.execute(select(Exercise).where(Exercise.name == edef['name']))).scalar_one_or_none()
            if not ex:
                ex = Exercise(**edef, is_active=True)
                db.add(ex)
                await db.flush()
            created_exercises.append(ex)

        # 7. Active Session
        session = (await db.execute(select(Session).where(Session.patient_id == patient.id, Session.status == 'in_progress'))).scalar_one_or_none()
        if not session:
            session = Session(
                participant_id=participant.id,
                patient_id=patient.id,
                session_date=date.today(),
                session_number=1,
                protocol_id='NS-PROTO-2026-A',
                status='in_progress',
                environment='clinical_home'
            )
            db.add(session)
            await db.flush()

        # 8. Session Exercises
        for idx, ex in enumerate(created_exercises):
            se = (await db.execute(select(SessionExercise).where(SessionExercise.session_id == session.id, SessionExercise.exercise_id == ex.id))).scalar_one_or_none()
            if not se:
                se = SessionExercise(
                    session_id=session.id,
                    exercise_id=ex.id,
                    order_index=idx,
                    status='in_progress' if idx == 0 else 'pending'
                )
                db.add(se)
                await db.flush()

        # 9. Ensure Baseline ASR Model Registered
        try:
            model = await ensure_asr_model(db, res_user.id)
            print(f'ASR Model registered: {model.model_name} ({model.version})')
        except Exception as e:
            print(f'ASR Model check: {e}')

        await db.commit()
        print('All clinical demo data seeded successfully!')
        print(f'Patient User: {pat_user.email}')
        print(f'Participant ID: {participant.id} (pseudonym: {participant.pseudonym_id})')
        print(f'Patient Profile ID: {patient.id}')
        print(f'Active Session ID: {session.id}')
        print(f'Exercises seeded: {len(created_exercises)}')

if __name__ == '__main__':
    asyncio.run(seed_all())
