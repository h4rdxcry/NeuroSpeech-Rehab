-- NeuroSpeech Rehabilitation Platform - Clinical Demo Seed Data
-- Idempotent Insertion into Supabase / PostgreSQL

-- 1. Standard Roles
INSERT INTO roles (id, name, permissions) VALUES ('11111111-1111-1111-1111-111111111111', 'PATIENT', '[]') ON CONFLICT (name) DO NOTHING;
INSERT INTO roles (id, name, permissions) VALUES ('22222222-2222-2222-2222-222222222222', 'CLINICIAN', '[]') ON CONFLICT (name) DO NOTHING;
INSERT INTO roles (id, name, permissions) VALUES ('33333333-3333-3333-3333-333333333333', 'RESEARCHER', '[]') ON CONFLICT (name) DO NOTHING;
INSERT INTO roles (id, name, permissions) VALUES ('44444444-4444-4444-4444-444444444444', 'ADMIN', '[]') ON CONFLICT (name) DO NOTHING;

-- 2. Initial Users (Passwords pre-hashed with Argon2/Bcrypt)
INSERT INTO users (id, email, password_hash, role_id, is_active, created_at, updated_at) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'patient@neurospeech.dev', '$2b$12$MTqac3f6UIAeO7C914.ZxOTGxTyGZ6ttKXz.1MKq9ko0IBiWZZhqC', (SELECT id FROM roles WHERE name='PATIENT'), true, now(), now()) ON CONFLICT (id) DO NOTHING;
INSERT INTO users (id, email, password_hash, role_id, is_active, created_at, updated_at) VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'researcher@neurospeech.dev', '$2b$12$wi.HEPUb3JKz4vdyZqD9venC/s7gLxw5HfLVTm6n0.LZnkesDKWP6', (SELECT id FROM roles WHERE name='RESEARCHER'), true, now(), now()) ON CONFLICT (id) DO NOTHING;
INSERT INTO users (id, email, password_hash, role_id, is_active, created_at, updated_at) VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'admin@neurospeech.dev', '$2b$12$hCGjGYz4RIHex65wyNgM4OkkOroUfLW9fye3xGVknVzlB1OvXJBCS', (SELECT id FROM roles WHERE name='ADMIN'), true, now(), now()) ON CONFLICT (id) DO NOTHING;

-- 3. Research Participant Record
INSERT INTO research_participants (id, pseudonym_id, consent_status, consent_date, demographic_summary, created_at) VALUES ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'DEMO-PATIENT-01', 'approved', CURRENT_DATE, 'Adult NeuroSpeech Rehabilitation Cohort - Baseline Trial', now()) ON CONFLICT (id) DO NOTHING;

-- 4. Patient Clinical Profile Linked to DEMO-PATIENT-01
INSERT INTO patients (id, user_id, participant_id, is_active, notes, created_at, updated_at) VALUES ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', (SELECT id FROM users WHERE email='patient@neurospeech.dev'), 'dddddddd-dddd-dddd-dddd-dddddddddddd', true, 'Baseline clinical demo patient with full articulatory sensor suite access.', now(), now()) ON CONFLICT (id) DO NOTHING;

-- 5. Standard Rehabilitation Exercises (Speech, Bilabial, Tamil, Vowel Sustains)
INSERT INTO exercises (id, name, description, exercise_type, target_modalities, difficulty, duration_seconds, configuration, created_at, updated_at) VALUES ('f1111111-1111-1111-1111-111111111111', 'Morning Sunlight (Bilabial Flow)', 'Bilabial flow, nasal resonance, and plosive closure exercise.', 'speech', '["AUDIO", "VIDEO_FACIAL"]'::json, 'easy', 120, '{"target_phrase": "Morning sunlight brings bright moments", "phonemes": "/m/, /b/, /p/"}'::json, now(), now()) ON CONFLICT (id) DO NOTHING;
INSERT INTO exercises (id, name, description, exercise_type, target_modalities, difficulty, duration_seconds, configuration, created_at, updated_at) VALUES ('f2222222-2222-2222-2222-222222222222', 'வணக்கம் (Vanakkam)', 'Tamil greeting, labial glide, and nasal harmony.', 'speech', '["AUDIO", "VIDEO_FACIAL"]'::json, 'easy', 120, '{"target_phrase": "வணக்கம்", "phonemes": "/v/, /n/, /k/, /m/"}'::json, now(), now()) ON CONFLICT (id) DO NOTHING;
INSERT INTO exercises (id, name, description, exercise_type, target_modalities, difficulty, duration_seconds, configuration, created_at, updated_at) VALUES ('f3333333-3333-3333-3333-333333333333', 'அம்மா (Amma)', 'Tamil bilabial open-vowel resonant sustain.', 'speech', '["AUDIO", "VIDEO_FACIAL"]'::json, 'easy', 120, '{"target_phrase": "அம்மா", "phonemes": "/a/, /m/, /a:/"}'::json, now(), now()) ON CONFLICT (id) DO NOTHING;
INSERT INTO exercises (id, name, description, exercise_type, target_modalities, difficulty, duration_seconds, configuration, created_at, updated_at) VALUES ('f4444444-4444-4444-4444-444444444444', 'Deep Vowel Sustain (/a:/)', 'Sustained open vowel phonation assessing vocal stability, jitter, and shimmer.', 'speech', '["AUDIO", "VIDEO_FACIAL"]'::json, 'easy', 60, '{"target_vowel": "/a:/", "target_lar": 0.45, "target_mwr": 0.52}'::json, now(), now()) ON CONFLICT (id) DO NOTHING;
INSERT INTO exercises (id, name, description, exercise_type, target_modalities, difficulty, duration_seconds, configuration, created_at, updated_at) VALUES ('f5555555-5555-5555-5555-555555555555', 'Symmetric Smile (/i:/)', 'Spreading lip gesture assessing zygomaticus major symmetry and oral aperture.', 'speech', '["VIDEO_FACIAL"]'::json, 'medium', 60, '{"target_vowel": "/i:/", "target_lar": 0.18, "target_mwr": 0.65}'::json, now(), now()) ON CONFLICT (id) DO NOTHING;

-- 6. Initial Progress Record for Demo Patient
INSERT INTO patient_rehab_progress (id, patient_id, current_level, highest_unlocked_level, completed_levels, streak_count, longest_streak, last_practice_date, created_at, updated_at)
VALUES (
    '11112222-3333-4444-5555-666677778888',
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
    1,
    1,
    '[]'::json,
    1,
    1,
    CURRENT_DATE,
    now(),
    now()
) ON CONFLICT (patient_id) DO NOTHING;

