-- Migration: 20260911000001_rehab_progress_rls_storage.sql
-- Description: Add patient rehabilitation progress, level attempt logs, RLS policies, and private storage buckets

-- 1. Ensure updated_at on exercises
ALTER TABLE IF EXISTS exercises ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL;

-- 2. Patient Rehabilitation Progress Table (Tracks 100-Level Journey & Streaks)
CREATE TABLE IF NOT EXISTS patient_rehab_progress (
	id UUID NOT NULL,
	patient_id UUID NOT NULL,
	current_level INTEGER DEFAULT 1 NOT NULL,
	highest_unlocked_level INTEGER DEFAULT 1 NOT NULL,
	completed_levels JSON DEFAULT '[]'::json NOT NULL,
	streak_count INTEGER DEFAULT 0 NOT NULL,
	longest_streak INTEGER DEFAULT 0 NOT NULL,
	last_practice_date DATE,
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	PRIMARY KEY (id),
	UNIQUE (patient_id),
	FOREIGN KEY (patient_id) REFERENCES patients (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS ix_patient_rehab_progress_patient ON patient_rehab_progress (patient_id);

-- 3. Patient Level Attempts Table (Multimodal Clinical Trial Logs)
CREATE TABLE IF NOT EXISTS patient_level_attempts (
	id UUID NOT NULL,
	patient_id UUID NOT NULL,
	session_id UUID,
	level_number INTEGER NOT NULL,
	target_text VARCHAR(255) NOT NULL,
	language VARCHAR(16) NOT NULL,
	transcript TEXT,
	speech_detected BOOLEAN DEFAULT false NOT NULL,
	match_score FLOAT DEFAULT 0.0 NOT NULL,
	is_success BOOLEAN DEFAULT false NOT NULL,
	metrics JSON,
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	PRIMARY KEY (id),
	FOREIGN KEY (patient_id) REFERENCES patients (id) ON DELETE CASCADE,
	FOREIGN KEY (session_id) REFERENCES sessions (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS ix_patient_level_attempts_patient ON patient_level_attempts (patient_id);
CREATE INDEX IF NOT EXISTS ix_patient_level_attempts_level ON patient_level_attempts (level_number);
CREATE INDEX IF NOT EXISTS ix_patient_level_attempts_created ON patient_level_attempts (created_at DESC);

-- 4. Initial Progress Baseline for Demo Patient
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

-- 5. Row Level Security (RLS) Policies
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_rehab_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_level_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE research_participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_full_access_patients" ON patients;
CREATE POLICY "service_role_full_access_patients" ON patients TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_full_access_progress" ON patient_rehab_progress;
CREATE POLICY "service_role_full_access_progress" ON patient_rehab_progress TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_full_access_attempts" ON patient_level_attempts;
CREATE POLICY "service_role_full_access_attempts" ON patient_level_attempts TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_full_access_sessions" ON sessions;
CREATE POLICY "service_role_full_access_sessions" ON sessions TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_full_access_recordings" ON recordings;
CREATE POLICY "service_role_full_access_recordings" ON recordings TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_full_access_audit_logs" ON audit_logs;
CREATE POLICY "service_role_full_access_audit_logs" ON audit_logs TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_full_access_users" ON users;
CREATE POLICY "service_role_full_access_users" ON users TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_full_access_participants" ON research_participants;
CREATE POLICY "service_role_full_access_participants" ON research_participants TO service_role USING (true) WITH CHECK (true);

-- Public read-only tables (exercises, modalities)
ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE modalities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_read_exercises" ON exercises;
CREATE POLICY "public_read_exercises" ON exercises FOR SELECT USING (true);
DROP POLICY IF EXISTS "public_read_modalities" ON modalities;
CREATE POLICY "public_read_modalities" ON modalities FOR SELECT USING (true);

-- 6. Private HIPAA/GDPR Storage Buckets
DO $$
BEGIN
    INSERT INTO storage.buckets (id, name, public)
    VALUES 
        ('recordings', 'recordings', false),
        ('biosignals', 'biosignals', false),
        ('patient-reports', 'patient-reports', false)
    ON CONFLICT (id) DO NOTHING;

    DROP POLICY IF EXISTS "service_role_storage_all" ON storage.objects;
    CREATE POLICY "service_role_storage_all" ON storage.objects
        TO service_role USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "auth_upload_recordings" ON storage.objects;
    CREATE POLICY "auth_upload_recordings" ON storage.objects
        FOR INSERT TO authenticated
        WITH CHECK (bucket_id IN ('recordings', 'biosignals'));

    DROP POLICY IF EXISTS "auth_select_recordings" ON storage.objects;
    CREATE POLICY "auth_select_recordings" ON storage.objects
        FOR SELECT TO authenticated
        USING (bucket_id IN ('recordings', 'biosignals', 'patient-reports'));
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Storage bucket configuration notice: %', SQLERRM;
END $$;
