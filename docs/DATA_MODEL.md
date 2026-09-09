# NeuroSpeech Rehab — Data Model

## 1. Design Principles

- **Pseudonymity**: Research participants use stable pseudonymous IDs. PII separated from physiological data.
- **Lineage**: Every data element traces back to source recording, processing pipeline version, and model version.
- **Temporal**: Every observation has `timestamp` and `session_id`.
- **Splitting**: Participant-level isolation for train/validation/test sets.
- **BIDS Compatibility**: Directory organization and metadata sidecars follow BIDS conventions where applicable.
- **Signal Quality**: Quality flags stored alongside raw and processed data.
- **Reproducibility**: Model predictions include model, feature pipeline, and dataset version.

## 2. Entity-Relationship Overview

```
users (1) ──< roles
clinicians (1) ──< patients
patients (0..1) ──1 research_participants (enrollment link)
research_participants (1) ──< sessions
sessions (1) ──< exercises
sessions (1) ──< recordings
recordings (1) ──< modalities
recordings (1) ──< annotations
recordings (1) ──< signal_quality
exercises (1) ──< attempts
attempts (1) ──< predictions
predictions (1) ──< model_versions
model_versions (1) ──< evaluation_runs
evaluation_runs (1) ──< datasets
datasets (1) ──< dataset_provenance
datasets (1) ──< dataset_splits
datasets (1) ──< dataset_catalog
recordings (1) ──< datasets
users (1) ──< audit_logs
```

## 3. Core Tables

### 3.1 users
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| email | VARCHAR(255) | UNIQUE, NOT NULL | Login identifier |
| password_hash | VARCHAR(255) | NOT NULL | bcrypt/argon2 |
| role_id | UUID | FK → roles.id | |
| is_active | BOOLEAN | DEFAULT true | Soft delete |
| created_at | TIMESTAMPTZ | NOT NULL | |
| updated_at | TIMESTAMPTZ | NOT NULL | |

### 3.2 roles
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| name | VARCHAR(50) | UNIQUE, NOT NULL | PATIENT, CLINICIAN, RESEARCHER, ADMIN |
| permissions | JSONB | NOT NULL | Fine-grained permission set |
| created_at | TIMESTAMPTZ | NOT NULL | |

### 3.3 patients
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| user_id | UUID | FK → users.id, UNIQUE | Linked login |
| participant_id | UUID | FK → research_participants.id, UNIQUE, NULL | Explicit enrollment link for patient-owned sessions |
| clinician_id | UUID | FK → users.id | Assigned clinician |
| date_of_birth | DATE | NULL | Optional, for age-based protocol selection |
| notes | TEXT | NULL | Clinician notes (non-PII preferred) |
| is_active | BOOLEAN | DEFAULT true | |
| created_at | TIMESTAMPTZ | NOT NULL | |

### 3.4 research_participants
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| pseudonym_id | VARCHAR(64) | UNIQUE, NOT NULL | Stable research ID (e.g., `SUBJ-001`) |
| demographic_summary | JSONB | NULL | Age range, sex, handedness, etc. (no PII) |
| inclusion_criteria | JSONB | NULL | |
| exclusion_criteria | JSONB | NULL | |
| consent_status | VARCHAR(32) | NOT NULL | pending, approved, withdrawn |
| consent_date | DATE | NULL | |
| assigned_clinician_id | UUID | FK → users.id | NULL |
| created_at | TIMESTAMPTZ | NOT NULL | |

### 3.5 sessions
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| participant_id | UUID | FK → research_participants.id | |
| patient_id | UUID | FK → patients.id | NULL (research-only sessions may lack patient record) |
| clinician_id | UUID | FK → users.id | NULL |
| session_date | DATE | NOT NULL | |
| session_number | INTEGER | NOT NULL | Sequential per participant |
| protocol_id | VARCHAR(255) | NULL | Research protocol identifier |
| environment | VARCHAR(64) | NULL | clinic, home, lab |
| notes | TEXT | NULL | |
| started_at | TIMESTAMPTZ | NULL | |
| ended_at | TIMESTAMPTZ | NULL | |
| status | VARCHAR(32) | NOT NULL | planned, active, completed, aborted |
| dataset_split | VARCHAR(32) | NULL | train, validation, test, unassigned |
| created_at | TIMESTAMPTZ | NOT NULL | |

### 3.6 exercises
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| name | VARCHAR(255) | NOT NULL | |
| description | TEXT | NULL | |
| exercise_type | VARCHAR(64) | NOT NULL | e.g., lip_round, tongue_tap, vowel_sustain |
| target_modalities | JSONB | NOT NULL | Which sensors required |
| difficulty | VARCHAR(32) | NOT NULL | easy, medium, hard, custom |
| duration_seconds | INTEGER | NULL | Target duration |
| repetition_count | INTEGER | NULL | Target repetitions |
| configuration | JSONB | NULL | Protocol-specific parameters |
| is_active | BOOLEAN | DEFAULT true | |
| created_at | TIMESTAMPTZ | NOT NULL | |

### 3.7 session_exercises (junction)
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| session_id | UUID | FK → sessions.id | |
| exercise_id | UUID | FK → exercises.id | |
| order_index | INTEGER | NOT NULL | Sequence within session |
| status | VARCHAR(32) | NOT NULL | pending, active, completed, skipped |
| started_at | TIMESTAMPTZ | NULL | |
| ended_at | TIMESTAMPTZ | NULL | |
| created_at | TIMESTAMPTZ | NOT NULL | |

### 3.8 attempts
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| session_exercise_id | UUID | FK → session_exercises.id | |
| attempt_number | INTEGER | NOT NULL | |
| started_at | TIMESTAMPTZ | NOT NULL | |
| ended_at | TIMESTAMPTZ | NULL | |
| outcome | VARCHAR(64) | NULL | completed, aborted, quality_insufficient |
| clinician_rating | INTEGER | NULL | 1-5 or NULL |
| notes | TEXT | NULL | |
| created_at | TIMESTAMPTZ | NOT NULL | |

### 3.9 recordings
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| session_id | UUID | FK → sessions.id | |
| session_exercise_id | UUID | FK → session_exercises.id | NULL |
| attempt_id | UUID | FK → attempts.id | NULL |
| modality | VARCHAR(32) | NOT NULL | eeg, emg, audio, video |
| device_id | VARCHAR(255) | NOT NULL | |
| device_name | VARCHAR(255) | NULL | |
| file_path | TEXT | NOT NULL | Relative to data root |
| file_format | VARCHAR(32) | NOT NULL | edf, wav, mp4, fif, etc. |
| sampling_rate_hz | FLOAT | NULL | |
| channel_count | INTEGER | NULL | |
| channel_names | JSONB | NULL | Array of channel labels |
| duration_seconds | FLOAT | NULL | |
| start_timestamp | TIMESTAMPTZ | NOT NULL | Synchronized start |
| end_timestamp | TIMESTAMPTZ | NULL | |
| is_synthetic | BOOLEAN | NOT NULL DEFAULT false | Critical for research integrity |
| synthetic_source | VARCHAR(255) | NULL | e.g., "demo_dataset_v1" |
| ground_truth_available | BOOLEAN | NOT NULL DEFAULT false | |
| processing_status | VARCHAR(32) | NOT NULL DEFAULT raw | raw, processing, processed, failed |
| created_at | TIMESTAMPTZ | NOT NULL | |
| participant_pseudonym | VARCHAR(64) | NULL | Pseudonymous participant ID |
| session_identifier | VARCHAR(255) | NULL | External session ID |
| recording_identifier | VARCHAR(255) | NULL | External recording ID |
| data_classification | VARCHAR(32) | NOT NULL DEFAULT REAL | REAL, SYNTHETIC, DEMO |
| units | VARCHAR(64) | NULL | Measurement units |
| source_dataset_id | UUID | FK → datasets.id | NULL |
| quality_status | VARCHAR(32) | NULL | PASS, FAIL, REVIEW |
| synchronization_info | JSONB | NULL | Sync details across modalities |

### 3.10 modalities
Lookup/enumeration table for modality types and device capabilities.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| name | VARCHAR(64) | UNIQUE, NOT NULL | eeg, emg_facial, audio, video |
| description | TEXT | NULL | |
| required_for_sync | BOOLEAN | NOT NULL DEFAULT false | |
| created_at | TIMESTAMPTZ | NOT NULL | |

### 3.11 signal_quality
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| recording_id | UUID | FK → recordings.id | |
| quality_state | VARCHAR(32) | NOT NULL DEFAULT UNKNOWN | PASS, FAIL, REVIEW, UNKNOWN |
| quality_score | FLOAT | NULL | 0.0-1.0 if computed |
| artifact_ratio | FLOAT | NULL | 0.0-1.0 |
| missing_data_ratio | FLOAT | NULL | 0.0-1.0 |
| synchronization_status | VARCHAR(32) | NULL | Sync quality across modalities |
| sampling_rate_valid | BOOLEAN | NULL | |
| channel_status | JSONB | NULL | Per-channel status |
| missing_channels | JSONB | NULL | List of missing channels |
| corrupted_files | BOOLEAN | NULL | |
| clipping | BOOLEAN | NULL | |
| artifact_indicators | JSONB | NULL | Detected artifacts |
| sampling_problems | JSONB | NULL | Sampling irregularities |
| synchronization_problems | JSONB | NULL | Sync issues |
| rejection_reason | TEXT | NULL | Why recording was rejected |
| qc_timestamp | TIMESTAMPTZ | NULL | When QC was performed |
| notes | TEXT | NULL | |
| created_at | TIMESTAMPTZ | NOT NULL | |

### 3.12 annotations
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| recording_id | UUID | FK → recordings.id | |
| annotator_id | UUID | FK → users.id | |
| annotation_type | VARCHAR(64) | NOT NULL | event, segment, phoneme, movement, quality |
| start_timestamp | TIMESTAMPTZ | NOT NULL | |
| end_timestamp | TIMESTAMPTZ | NULL | |
| label | VARCHAR(255) | NOT NULL | |
| confidence | FLOAT | NULL | Annotator confidence |
| notes | TEXT | NULL | |
| is_ground_truth | BOOLEAN | NOT NULL DEFAULT false | |
| created_at | TIMESTAMPTZ | NOT NULL | |
| updated_at | TIMESTAMPTZ | NOT NULL | |

### 3.13 predictions
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| attempt_id | UUID | FK → attempts.id | |
| recording_id | UUID | FK → recordings.id | NULL (if multimodal aggregation) |
| model_id | UUID | FK → model_versions.id | |
| model_version | VARCHAR(64) | NOT NULL | Redundant for versioning stability |
| feature_pipeline_version | VARCHAR(64) | NOT NULL | |
| training_dataset_version | VARCHAR(64) | NOT NULL | |
| prediction_type | VARCHAR(64) | NOT NULL | e.g., movement_quality, phoneme, exercise_score |
| predicted_label | VARCHAR(255) | NOT NULL | |
| confidence | FLOAT | NULL | |
| uncertainty | FLOAT | NULL | If model provides uncertainty quantification |
| prediction_json | JSONB | NULL | Full model output (logits, probabilities) |
| signal_quality_state | VARCHAR(64) | NOT NULL | sufficient, insufficient, partial |
| signal_quality_details | JSONB | NULL | Details if insufficient |
| timestamp | TIMESTAMPTZ | NOT NULL | Prediction timestamp |
| created_at | TIMESTAMPTZ | NOT NULL | |

### 3.14 model_versions
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| model_name | VARCHAR(255) | NOT NULL | |
| version | VARCHAR(64) | NOT NULL | Semantic or UUID |
| model_type | VARCHAR(64) | NOT NULL | eeg_only, emg_only, vision_only, audio_only, eeg_emg, eeg_vision, eeg_emg_vision, full_multimodal |
| architecture_json | JSONB | NOT NULL | Encoder/fusion/head config |
| training_dataset_version | VARCHAR(255) | NOT NULL | |
| feature_pipeline_version | VARCHAR(255) | NOT NULL | |
| training_params | JSONB | NULL | Hyperparameters |
| performance_metrics | JSONB | NULL | Validation metrics at training time |
| is_production | BOOLEAN | NOT NULL DEFAULT false | |
| is_archived | BOOLEAN | NOT NULL DEFAULT false | |
| registered_at | TIMESTAMPTZ | NOT NULL | |
| registered_by | UUID | FK → users.id | |

### 3.15 evaluation_runs
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| name | VARCHAR(255) | NOT NULL | |
| model_version_id | UUID | FK → model_versions.id | |
| dataset_version | VARCHAR(255) | NOT NULL | train, validation, test, custom |
| dataset_split | VARCHAR(32) | NOT NULL | train, validation, test |
| split_definition | JSONB | NOT NULL | Participant IDs and recording IDs included |
| metrics | JSONB | NOT NULL | accuracy, precision, recall, f1, sensitivity, specificity, auroc, ci_lower, ci_upper |
| confusion_matrix | JSONB | NULL | |
| per_participant_metrics | JSONB | NULL | |
| per_exercise_metrics | JSONB | NULL | |
| latency_stats | JSONB | NULL | mean, median, p95, p99 |
| failure_cases | JSONB | NULL | List of failing sample IDs with reasons |
| notes | TEXT | NULL | |
| run_by | UUID | FK → users.id | |
| started_at | TIMESTAMPTZ | NOT NULL | |
| completed_at | TIMESTAMPTZ | NULL | |

### 3.16 datasets
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| name | VARCHAR(255) | NOT NULL | |
| version | VARCHAR(64) | NOT NULL | |
| description | TEXT | NULL | |
| bids_root | TEXT | NULL | Path to BIDS root if applicable |
| participant_ids | JSONB | NOT NULL | List of pseudonymous IDs included |
| recording_ids | JSONB | NOT NULL | List of recording IDs included |
| split_definition | JSONB | NOT NULL | train/val/test participant assignments |
| is_final_test | BOOLEAN | NOT NULL DEFAULT false | Isolated from tuning |
| is_locked | BOOLEAN | NOT NULL DEFAULT false | No new samples added |
| created_by | UUID | FK → users.id | |
| created_at | TIMESTAMPTZ | NOT NULL | |
| source_organization | VARCHAR(255) | NULL | Original data provider |
| source_url | TEXT | NULL | Link to source dataset |
| citation | TEXT | NULL | Recommended citation |
| modality | VARCHAR(64) | NULL | Primary modality |
| population_description | TEXT | NULL | Clinical or control population description |
| participant_count | INTEGER | NULL | |
| recording_count | INTEGER | NULL | |
| total_duration | FLOAT | NULL | Seconds |
| sampling_information | TEXT | NULL | Sampling rates, channel counts |
| file_format | VARCHAR(64) | NULL | EDF, WAV, FIF, etc. |
| license | VARCHAR(255) | NULL | Data license |
| access_type | VARCHAR(64) | NULL | public, restricted, credentialed |
| access_requirements | TEXT | NULL | How to obtain access |
| consent_ethics | TEXT | NULL | IRB/ethics information |
| clinical_or_control_population | VARCHAR(64) | NULL | |
| language | VARCHAR(64) | NULL | Stimulus or participant language |
| task_description | TEXT | NULL | Experimental task description |
| acquisition_device | VARCHAR(255) | NULL | Device make/model |
| is_public | BOOLEAN | NOT NULL DEFAULT false | |
| is_restricted | BOOLEAN | NOT NULL DEFAULT false | Requires approval |
| is_credentialed | BOOLEAN | NOT NULL DEFAULT false | Requires credentials |
| imported_status | VARCHAR(32) | NOT NULL DEFAULT pending | pending, importing, imported, failed |
| import_date | TIMESTAMPTZ | NULL | |
| checksum | VARCHAR(255) | NULL | Integrity hash |
| notes | TEXT | NULL | |

### 3.17 dataset_provenance
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| dataset_id | UUID | FK → datasets.id, UNIQUE | One provenance record per dataset |
| original_source | VARCHAR(255) | NOT NULL | e.g., OpenNeuro, PhysioNet |
| original_dataset_identifier | VARCHAR(255) | NULL | Source dataset ID |
| version | VARCHAR(64) | NULL | Source version |
| download_timestamp | TIMESTAMPTZ | NULL | When data was acquired |
| source_url | TEXT | NULL | Original download URL |
| license_access_info | TEXT | NULL | License terms and access details |
| checksum | VARCHAR(255) | NULL | Source checksum |
| preprocessing_pipeline_version | VARCHAR(255) | NULL | Pipeline used to prepare data |
| transformations_performed | TEXT | NULL | Description of transformations |
| responsible_user_id | UUID | FK → users.id | Who performed import |
| created_at | TIMESTAMPTZ | NOT NULL | |

### 3.18 dataset_splits
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| dataset_id | UUID | FK → datasets.id | |
| participant_id | VARCHAR(255) | NOT NULL | Pseudonymous participant ID |
| split_type | VARCHAR(32) | NOT NULL | train, validation, test |
| split_version | VARCHAR(64) | NULL | Version of split definition |
| is_locked | BOOLEAN | NOT NULL DEFAULT false | Prevents modification |
| final_test_flag | BOOLEAN | NOT NULL DEFAULT false | Marked as final test set |
| created_at | TIMESTAMPTZ | NOT NULL | |

### 3.19 dataset_catalog
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| dataset_id | UUID | FK → datasets.id, UNIQUE | One catalog entry per dataset |
| modality | VARCHAR(64) | NULL | |
| source | VARCHAR(255) | NULL | |
| version | VARCHAR(64) | NULL | |
| participants | INTEGER | NULL | |
| recordings | INTEGER | NULL | |
| duration | FLOAT | NULL | Seconds |
| population | VARCHAR(255) | NULL | |
| clinical_control | VARCHAR(64) | NULL | |
| license | VARCHAR(255) | NULL | |
| access_requirements | TEXT | NULL | |
| project_usage | VARCHAR(32) | NULL | USED_IN_PROJECT, EVALUATED_BUT_NOT_USED, REFERENCE_ONLY |
| citation | TEXT | NULL | |
| url | TEXT | NULL | |
| notes | TEXT | NULL | |
| created_at | TIMESTAMPTZ | NOT NULL | |
| updated_at | TIMESTAMPTZ | NOT NULL | |

### 3.17 audit_logs
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| user_id | UUID | FK → users.id | NULL for system events |
| actor_role | VARCHAR(64) | NULL | Role at time of action |
| action | VARCHAR(64) | NOT NULL | create, read, update, delete, login, prediction |
| resource_type | VARCHAR(64) | NOT NULL | session, recording, model, etc. |
| resource_id | UUID | NULL | |
| request_id | VARCHAR(255) | NULL | Correlation ID |
| result | VARCHAR(32) | NOT NULL | success, failure |
| ip_address | VARCHAR(64) | NULL | |
| user_agent | TEXT | NULL | |
| metadata | JSONB | NULL | |
| timestamp | TIMESTAMPTZ | NOT NULL DEFAULT now() | |

## 4. Participant-Level Data Splitting Strategy

### 4.1 Splitting Rules
- Split at the **participant** level, never at the recording or window level within a participant.
- A participant's recordings must belong entirely to one partition (train, validation, or test).
- Final test set participants are locked and excluded from training and validation.
- Test set is never used for hyperparameter tuning or model selection.

### 4.2 Split Storage
- `datasets.split_definition` stores the mapping: `{"train": ["SUBJ-001", ...], "validation": [...], "test": [...]}`
- `sessions.dataset_split` stores the partition for each session.
- `evaluation_runs.split_definition` stores exact participant and recording IDs used.

### 4.3 Leakage Prevention
- Data ingestion pipeline validates that no participant appears in multiple partitions.
- Model training jobs receive only training partition IDs.
- Evaluation jobs receive only the target partition IDs.
- Audit log records all dataset access and split changes.

## 5. BIDS Compatibility

### 5.1 Directory Structure
```
data/
  bids/
    sub-SUBJ001/
      ses-01/
        eeg/
          sub-SUBJ001_ses-01_task-exercise_eeg.edf
          sub-SUBJ001_ses-01_task-exercise_eeg.json
        emg/
          sub-SUBJ001_ses-01_task-exercise_emg.edf
          sub-SUBJ001_ses-01_task-exercise_emg.json
        audio/
          sub-SUBJ001_ses-01_task-exercise_audio.wav
          sub-SUBJ001_ses-01_task-exercise_audio.json
        video/
          sub-SUBJ001_ses-01_task-exercise_video.mp4
          sub-SUBJ001_ses-01_task-exercise_video.json
        beh/
          sub-SUBJ001_ses-01_task-exercise_beh.tsv
          sub-SUBJ001_ses-01_task-exercise_beh.json
    sub-SUBJ002/
      ...
```

### 5.2 Metadata Sidecars
Each data file has a `.json` sidecar containing:
- `SamplingFrequency`
- `PowerLineFrequency`
- `EEGChannelCount` / `EMGChannelCount`
- `EEGChannelNames` / `EMGChannelNames`
- `RecordingDuration`
- `TaskDescription`
- `DeviceManufacturer`
- `DeviceModel`
- `is_synthetic`
- `synthetic_source` (if applicable)

### 5.3 Events
Behavioral events in `beh/*.tsv`:
- `onset` (seconds relative to session start)
- `duration` (seconds)
- `trial_type`
- `exercise_id`
- `attempt_number`
- `response`

## 6. Data Preservation Requirements

Every stored record preserves:
- `participant_id` (pseudonymous)
- `session_id`
- `recording_id`
- `exercise_id`
- `timestamp`
- `modality`
- `device`
- `sampling_rate`
- `channel information`
- `signal_quality`
- `ground_truth` (where annotated)
- `prediction`
- `confidence`
- `model_version`

## 7. Indexing Strategy

| Table | Key Indexes |
|-------|-------------|
| sessions | participant_id, session_date, dataset_split, status |
| recordings | session_id, modality, is_synthetic, start_timestamp |
| predictions | attempt_id, model_id, model_version, timestamp |
| signal_quality | recording_id, overall_quality |
| annotations | recording_id, annotation_type, start_timestamp |
| audit_logs | user_id, resource_type, timestamp |
| evaluation_runs | model_version_id, dataset_split |

## 8. Data Retention

- Raw recordings: retained per institutional review board (IRB) policy
- Processed features: retained with version
- Predictions: retained indefinitely for audit and reproducibility
- Audit logs: retained indefinitely
- Test sets: retained in isolated, read-only state until study completion

## 9. Dataset Registry and Provenance

### 9.1 Dataset Registration
Every external dataset imported into the system must have a corresponding `datasets` record. The dataset registry captures:
- Source organization and URL
- Citation and license information
- Modality and population description
- Participant count, recording count, and total duration
- Sampling information and file format
- Access type (public, restricted, credentialed)
- Consent/ethics information
- Import status, import date, and checksum

### 9.2 Provenance Tracking
Each dataset has exactly one `dataset_provenance` record that preserves:
- Original source and dataset identifier
- Version and download timestamp
- Source URL and license/access information
- Checksum for integrity verification
- Preprocessing pipeline version
- Transformations performed
- Responsible user/process

### 9.3 Real vs Synthetic Classification
Every recording must have an explicit `data_classification`:
- `REAL` — Physiologically recorded from a human participant
- `SYNTHETIC` — Generated by a model or simulator
- `DEMO` — Created for demonstration purposes only

Synthetic and demo recordings must never be represented as real research data. The `is_synthetic` flag and `synthetic_source` field provide additional context.

### 9.4 Modality Classification
Recordings must identify their actual modality:
- `EEG` — Electroencephalography
- `EMG` — Electromyography (facial surface EMG)
- `ECG` — Electrocardiography
- `AUDIO` — Speech/audio recordings
- `VIDEO_FACIAL` — Facial/video movement data
- `OTHER` — Any other modality

These modalities are not interchangeable. A recording's modality must match the actual data type.

### 9.5 Dataset Import Workflow
1. Researcher creates a `datasets` record with metadata
2. Provenance is recorded in `dataset_provenance`
3. Recordings are registered with `data_classification` and modality
4. Signal quality is assessed and stored in `signal_quality`
5. Participants are assigned to train/validation/test splits in `dataset_splits`
6. Final test splits may be locked to prevent modification
7. Catalog entry is created in `dataset_catalog` with `project_usage` status

### 9.6 Quality Control Workflow
1. Raw recordings are ingested with `processing_status = raw`
2. Automated QC populates `signal_quality` records
3. Manual review may update quality flags
4. `quality_status` on recordings indicates PASS, FAIL, or REVIEW
5. Rejected recordings are documented with `rejection_reason`

### 9.7 Split Strategy
- Participant-level splitting ensures no participant appears in multiple partitions
- `dataset_splits` tracks each participant's assignment
- `final_test_flag` marks participants reserved for final evaluation
- `is_locked` prevents further modification to splits
- `is_locked` on the dataset prevents any modifications

### 9.8 Client Dataset Catalog
The `dataset_catalog` provides a project-facing view of datasets:
- `USED_IN_PROJECT` — Actively used in the current project
- `EVALUATED_BUT_NOT_USED` — Evaluated but excluded from the project
- `REFERENCE_ONLY` — Included for reference only

A dataset is marked as used only after actual import and use in the project.

### 9.9 Security and Access Control
- Restricted datasets require explicit `is_restricted` flag
- Credentialed datasets require `is_credentialed` flag
- RBAC controls who can create, update, or view restricted datasets
- Audit logging records all dataset access and modifications
- No unnecessary PII is stored; pseudonymous IDs are used throughout

## 10. Database Migration Workflow

Production schema changes are managed through Alembic migrations against PostgreSQL. The application uses async SQLAlchemy at runtime (`postgresql+asyncpg`), while Alembic uses a synchronous driver (`postgresql+psycopg2`) internally.

### Commands

```bash
cd backend

# Show current and head revisions
alembic current
alembic heads

# Apply all pending migrations
alembic upgrade head

# Generate a new migration from model changes
alembic revision --autogenerate -m "describe change"

# Downgrade one revision (for development only)
alembic downgrade -1
```

### Environment

Migrations read `DATABASE_URL` from the environment. The `alembic/env.py` configuration converts `postgresql+asyncpg` URLs to `postgresql+psycopg2` automatically.

### Schema Verification

After applying migrations, verify with:

```bash
alembic current
alembic heads
```

Both commands should report the same revision (`003_fix_schema_drift` or later).

## Current feature lineage

`feature_records` stores one computed result per `(recording_id, pipeline_version)` with a SHA-256 digest of the raw source, processing result, version, and timestamp. It does not replace the raw recording or imply a clinical interpretation. Migration `006_computed_features` was followed by `007_patient_participant_link`, which adds the explicit enrollment link used by patient-owned sessions. Offline migration generation succeeds; live PostgreSQL migration verification requires the configured PostgreSQL service.
