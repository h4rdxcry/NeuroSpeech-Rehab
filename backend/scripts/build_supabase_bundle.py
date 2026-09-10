import sys
import uuid
import json
from pathlib import Path
from sqlalchemy.dialects import postgresql
from sqlalchemy.schema import CreateTable, CreateIndex

sys.path.insert(0, r'd:\NeuroSpeech-Rehab\backend')
from app.models import Base
from app.core.auth import hash_password

supabase_dir = Path(r'd:\NeuroSpeech-Rehab\supabase')
supabase_dir.mkdir(parents=True, exist_ok=True)
migrations_dir = supabase_dir / 'migrations'
migrations_dir.mkdir(parents=True, exist_ok=True)

dialect = postgresql.dialect()

# 1. Schema DDL
schema_statements = [
    '-- NeuroSpeech Rehabilitation Platform - Cloud PostgreSQL / Supabase Schema',
    '-- Target: Supabase / PostgreSQL 15+',
    'CREATE EXTENSION IF NOT EXISTS "uuid-ossp";',
    'CREATE EXTENSION IF NOT EXISTS "pgcrypto";\n'
]

for table in Base.metadata.sorted_tables:
    stmt = str(CreateTable(table).compile(dialect=dialect)).strip()
    stmt = stmt.replace('CREATE TABLE ', 'CREATE TABLE IF NOT EXISTS ')
    schema_statements.append(stmt + ';\n')
    for idx in table.indexes:
        idx_stmt = str(CreateIndex(idx).compile(dialect=dialect)).strip()
        idx_stmt = idx_stmt.replace('CREATE INDEX ', 'CREATE INDEX IF NOT EXISTS ')
        schema_statements.append(idx_stmt + ';\n')

schema_sql = '\n'.join(schema_statements)
schema_path = migrations_dir / '20260910000001_neurospeech_schema.sql'
with open(schema_path, 'w', encoding='utf-8') as f:
    f.write(schema_sql)

print(f'Wrote Schema SQL to {schema_path} ({len(schema_sql)} bytes)')

# 2. Seed Data SQL
patient_pass = hash_password('NeuroSpeechDemo123!')
researcher_pass = hash_password('Researcher123!')
admin_pass = hash_password('AdminSecure2026!')

role_pat_id = '11111111-1111-1111-1111-111111111111'
role_cli_id = '22222222-2222-2222-2222-222222222222'
role_res_id = '33333333-3333-3333-3333-333333333333'
role_adm_id = '44444444-4444-4444-4444-444444444444'

user_pat_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
user_res_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
user_adm_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'

part_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'
pat_profile_id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'

ex_1_id = 'f1111111-1111-1111-1111-111111111111'
ex_2_id = 'f2222222-2222-2222-2222-222222222222'
ex_3_id = 'f3333333-3333-3333-3333-333333333333'
ex_4_id = 'f4444444-4444-4444-4444-444444444444'
ex_5_id = 'f5555555-5555-5555-5555-555555555555'

seed_statements = [
    '-- NeuroSpeech Rehabilitation Platform - Clinical Demo Seed Data',
    '-- Idempotent Insertion into Supabase / PostgreSQL\n',
    '-- 1. Standard Roles',
    f"INSERT INTO roles (id, name, permissions) VALUES ('{role_pat_id}', 'PATIENT', '[]') ON CONFLICT (name) DO NOTHING;",
    f"INSERT INTO roles (id, name, permissions) VALUES ('{role_cli_id}', 'CLINICIAN', '[]') ON CONFLICT (name) DO NOTHING;",
    f"INSERT INTO roles (id, name, permissions) VALUES ('{role_res_id}', 'RESEARCHER', '[]') ON CONFLICT (name) DO NOTHING;",
    f"INSERT INTO roles (id, name, permissions) VALUES ('{role_adm_id}', 'ADMIN', '[]') ON CONFLICT (name) DO NOTHING;\n",

    '-- 2. Initial Users (Passwords pre-hashed with Argon2/Bcrypt)',
    f"INSERT INTO users (id, email, password_hash, role_id, is_active, created_at, updated_at) VALUES ('{user_pat_id}', 'patient@neurospeech.dev', '{patient_pass}', (SELECT id FROM roles WHERE name='PATIENT'), true, now(), now()) ON CONFLICT (id) DO NOTHING;",
    f"INSERT INTO users (id, email, password_hash, role_id, is_active, created_at, updated_at) VALUES ('{user_res_id}', 'researcher@neurospeech.dev', '{researcher_pass}', (SELECT id FROM roles WHERE name='RESEARCHER'), true, now(), now()) ON CONFLICT (id) DO NOTHING;",
    f"INSERT INTO users (id, email, password_hash, role_id, is_active, created_at, updated_at) VALUES ('{user_adm_id}', 'admin@neurospeech.dev', '{admin_pass}', (SELECT id FROM roles WHERE name='ADMIN'), true, now(), now()) ON CONFLICT (id) DO NOTHING;\n",

    '-- 3. Research Participant Record',
    f"INSERT INTO research_participants (id, pseudonym_id, consent_status, consent_date, demographic_summary, created_at) VALUES ('{part_id}', 'DEMO-PATIENT-01', 'approved', CURRENT_DATE, 'Adult NeuroSpeech Rehabilitation Cohort - Baseline Trial', now()) ON CONFLICT (id) DO NOTHING;\n",

    '-- 4. Patient Clinical Profile Linked to DEMO-PATIENT-01',
    f"INSERT INTO patients (id, user_id, participant_id, is_active, notes, created_at, updated_at) VALUES ('{pat_profile_id}', (SELECT id FROM users WHERE email='patient@neurospeech.dev'), '{part_id}', true, 'Baseline clinical demo patient with full articulatory sensor suite access.', now(), now()) ON CONFLICT (id) DO NOTHING;\n",

    '-- 5. Standard Rehabilitation Exercises (Speech, Bilabial, Tamil, Vowel Sustains)',
    f"INSERT INTO exercises (id, name, description, exercise_type, target_modalities, difficulty, duration_seconds, configuration, created_at, updated_at) VALUES ('{ex_1_id}', 'Morning Sunlight (Bilabial Flow)', 'Bilabial flow, nasal resonance, and plosive closure exercise.', 'speech', '[\"AUDIO\", \"VIDEO_FACIAL\"]'::json, 'easy', 120, '{{\"target_phrase\": \"Morning sunlight brings bright moments\", \"phonemes\": \"/m/, /b/, /p/\"}}'::json, now(), now()) ON CONFLICT (id) DO NOTHING;",
    f"INSERT INTO exercises (id, name, description, exercise_type, target_modalities, difficulty, duration_seconds, configuration, created_at, updated_at) VALUES ('{ex_2_id}', 'வணக்கம் (Vanakkam)', 'Tamil greeting, labial glide, and nasal harmony.', 'speech', '[\"AUDIO\", \"VIDEO_FACIAL\"]'::json, 'easy', 120, '{{\"target_phrase\": \"வணக்கம்\", \"phonemes\": \"/v/, /n/, /k/, /m/\"}}'::json, now(), now()) ON CONFLICT (id) DO NOTHING;",
    f"INSERT INTO exercises (id, name, description, exercise_type, target_modalities, difficulty, duration_seconds, configuration, created_at, updated_at) VALUES ('{ex_3_id}', 'அம்மா (Amma)', 'Tamil bilabial open-vowel resonant sustain.', 'speech', '[\"AUDIO\", \"VIDEO_FACIAL\"]'::json, 'easy', 120, '{{\"target_phrase\": \"அம்மா\", \"phonemes\": \"/a/, /m/, /a:/\"}}'::json, now(), now()) ON CONFLICT (id) DO NOTHING;",
    f"INSERT INTO exercises (id, name, description, exercise_type, target_modalities, difficulty, duration_seconds, configuration, created_at, updated_at) VALUES ('{ex_4_id}', 'Deep Vowel Sustain (/a:/)', 'Sustained open vowel phonation assessing vocal stability, jitter, and shimmer.', 'speech', '[\"AUDIO\", \"VIDEO_FACIAL\"]'::json, 'easy', 60, '{{\"target_vowel\": \"/a:/\", \"target_lar\": 0.45, \"target_mwr\": 0.52}}'::json, now(), now()) ON CONFLICT (id) DO NOTHING;",
    f"INSERT INTO exercises (id, name, description, exercise_type, target_modalities, difficulty, duration_seconds, configuration, created_at, updated_at) VALUES ('{ex_5_id}', 'Symmetric Smile (/i:/)', 'Spreading lip gesture assessing zygomaticus major symmetry and oral aperture.', 'speech', '[\"VIDEO_FACIAL\"]'::json, 'medium', 60, '{{\"target_vowel\": \"/i:/\", \"target_lar\": 0.18, \"target_mwr\": 0.65}}'::json, now(), now()) ON CONFLICT (id) DO NOTHING;\n"
]

seed_sql = '\n'.join(seed_statements)
seed_path = supabase_dir / 'seed.sql'
with open(seed_path, 'w', encoding='utf-8') as f:
    f.write(seed_sql)

print(f'Wrote Seed SQL to {seed_path} ({len(seed_sql)} bytes)')

# 3. Combined One-Click Setup Script
full_setup_sql = f"""-- ====================================================================
-- NEUROSPEECH REHABILITATION PLATFORM - SUPABASE ONE-CLICK SETUP
-- ====================================================================
-- How to run:
-- 1. Open Supabase Dashboard: https://supabase.com/dashboard/project/<your-project-ref>/sql
-- 2. Paste this entire script into the SQL Editor
-- 3. Click 'Run'
-- 4. All 22 tables, foreign keys, indexes, and initial demo accounts will be created!
-- ====================================================================

{schema_sql}

{seed_sql}

-- ====================================================================
-- Setup Complete! Demo credentials:
-- Patient:    patient@neurospeech.dev / NeuroSpeechDemo123!
-- Researcher: researcher@neurospeech.dev / Researcher123!
-- Admin:      admin@neurospeech.dev / AdminSecure2026!
-- ====================================================================
"""

full_path = supabase_dir / 'full_setup_one_click.sql'
with open(full_path, 'w', encoding='utf-8') as f:
    f.write(full_setup_sql)

print(f'Wrote Full One-Click SQL to {full_path} ({len(full_setup_sql)} bytes)')
