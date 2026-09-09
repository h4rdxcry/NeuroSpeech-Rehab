# NeuroSpeech Rehab — Traceability Matrix

## Purpose

Map requirements to implementation, tests, and verification status for Phase 2.

## Format

| Requirement ID | Requirement Description | Implementation | Test | Status |
|----------------|------------------------|----------------|------|--------|
| FR-AUTH-01 | Role-based access: PATIENT, CLINICIAN, RESEARCHER, ADMIN | `backend/app/core/dependencies.py`, `backend/app/api/v1/auth.py`, `backend/app/models/user.py` | `tests/test_auth_rbac.py::test_rbac_blocks_patient_from_research_participants` | VERIFIED |
| FR-AUTH-02 | Secure password handling (bcrypt/argon2, no plaintext) | `backend/app/core/auth.py` | `tests/test_auth_rbac.py::test_register_and_login` | VERIFIED |
| FR-AUTH-03 | Session management (JWT or session tokens) | `backend/app/core/auth.py`, `backend/app/api/v1/auth.py` | `tests/test_auth_rbac.py::test_register_and_login` | VERIFIED |
| FR-AUTH-04 | Input validation on all endpoints | Pydantic schemas in `backend/app/schemas/` | `tests/test_api_validation.py::test_api_validation_errors` | VERIFIED |
| FR-AUTH-06 | Role permission enforcement at API layer | `backend/app/core/dependencies.py::require_roles` | `tests/test_auth_rbac.py::test_rbac_blocks_patient_from_research_participants` | VERIFIED |
| FR-AUD-01 | Log all authentication events | `backend/app/core/audit.py`, `backend/app/models/research.py::AuditLog` | `tests/test_audit_logging.py::test_audit_log_created_on_login` | VERIFIED |
| FR-AUD-02 | Log all data access (read, create, update, delete) | `backend/app/core/audit.py` | `tests/test_audit_logging.py` | VERIFIED |
| FR-AUD-05 | Immutable audit trail | `backend/app/models/research.py::AuditLog` (no update/delete API) | Manual review of schema and API | VERIFIED |
| FR-DAT-01 | Participant-level train/validation/test splitting | `backend/app/models/session_detail.py::Session.dataset_split`, `backend/app/schemas/dataset.py::DatasetCreate.split_definition` | `tests/test_dataset_splits.py::test_participant_split_isolation` | VERIFIED |
| FR-DAT-02 | No same-participant data leakage across splits | Application-level enforcement in dataset API and session metadata | `tests/test_dataset_splits.py::test_participant_split_isolation` | VERIFIED |
| FR-DAT-04 | Pseudonymous participant identifiers | `backend/app/models/patient.py::ResearchParticipant.pseudonym_id` | `tests/test_dataset_splits.py` | VERIFIED |
| FR-DAT-06 | Metadata preservation (sampling rate, device, channels) | `backend/app/models/recording.py::Recording` | `tests/test_api_validation.py::test_recording_metadata_validation` | VERIFIED |
| FR-RES-01 | Dataset manager (create, version, organize datasets) | `backend/app/api/v1/datasets.py` | `tests/test_dataset_splits.py` | VERIFIED |
| FR-RES-02 | Participant manager (pseudonymous IDs, demographic/metadata) | `backend/app/api/v1/participants.py` | `tests/test_dataset_splits.py` | VERIFIED |
| FR-RES-03 | Session manager (schedule, link recordings, annotate) | `backend/app/api/v1/sessions.py` | `tests/test_api_validation.py` | VERIFIED |
| FR-RES-04 | Recording manager (view, validate, label modalities) | `backend/app/api/v1/recordings.py` | `tests/test_api_validation.py::test_recording_metadata_validation` | VERIFIED |
| FR-RES-05 | Annotation manager (create, edit, link ground truth) | `backend/app/api/v1/annotations.py` | Not yet automated (UI shell only) | PARTIAL |
| FR-SIG-01 | EEG ingestion (device metadata, timestamps, channel info, sampling rate) | `backend/app/models/recording.py`, `backend/app/schemas/recording.py` | `tests/test_api_validation.py` | VERIFIED |
| FR-SIG-02 | Facial EMG ingestion (same metadata requirements) | Same recording schema/modality | `tests/test_api_validation.py` | VERIFIED |
| FR-SIG-06 | Signal quality assessment per modality | `backend/app/models/recording.py::SignalQuality`, `backend/app/schemas/signal_quality.py` | Schema validation tests | VERIFIED |
| FR-DAT-07 | Signal quality flags stored with each recording | `backend/app/api/v1/signal_quality.py` | Manual review | VERIFIED |
| FR-VAL-09 | Final test set isolation (no tuning on test data) | `backend/app/models/research.py::Dataset.is_final_test`, `backend/app/api/v1/datasets.py::lock_dataset` | `tests/test_dataset_splits.py::test_locked_dataset_rejects_modification` | VERIFIED |
| NFR-SEC-01 | Passwords never stored in plaintext | `backend/app/core/auth.py::hash_password` | `tests/test_auth_rbac.py` | VERIFIED |
| NFR-SEC-02 | Pseudonymous identifiers for research participants | `backend/app/models/patient.py` | `tests/test_dataset_splits.py` | VERIFIED |
| NFR-SEC-03 | Role-based authorization on every endpoint | `backend/app/core/dependencies.py` | `tests/test_auth_rbac.py` | VERIFIED |
| NFR-SEC-04 | Audit logging for all sensitive operations | `backend/app/core/audit.py` | `tests/test_audit_logging.py` | VERIFIED |
| NFR-SEC-06 | Input validation and sanitization | Pydantic schemas + FastAPI validation | `tests/test_api_validation.py` | VERIFIED |
| NFR-RES-01 | All synthetic/demo data explicitly labeled | `backend/app/models/recording.py::Recording.is_synthetic` | `tests/test_api_validation.py::test_recording_metadata_validation` | VERIFIED |
| NFR-RES-02 | Real data distinguishable from simulated data | `is_synthetic` boolean in recording schema | Manual review | VERIFIED |
| NFR-RES-05 | Timestamps on every physiological observation | `start_timestamp`, `end_timestamp`, `timestamp` fields | Schema review | VERIFIED |
| NFR-RES-06 | Synchronization support for all sensor streams | `signal_quality.synchronization_status`, `SignalQualitySchema.sync_quality` | Schema review | VERIFIED |
| NFR-MAIN-04 | Docker Compose for reproducible dev environments | `docker-compose.yml`, `docker/Dockerfile.*` | `docker compose up` manual check | VERIFIED |
| FR-PAT-01 | Simple login with patient credentials | `frontend/src/components/patient/Login.tsx`, `backend/app/api/v1/auth.py` | Manual UI test | VERIFIED |
| FR-PAT-02 | Home screen with single primary action ("Start Session") | `frontend/src/components/patient/PatientHome.tsx` | Manual UI test | VERIFIED |
| FR-PAT-08 | No technical terminology visible to patient | Patient UI components avoid EEG/EMG terms | Manual review | VERIFIED |
| FR-CLI-01 | Dashboard with session overview and patient status | `frontend/src/components/clinician/ClinicianDashboard.tsx` | Manual UI test | VERIFIED |
| FR-CLI-02 | Patient list and profile management | `frontend/src/components/clinician/ClinicianPatients.tsx` | Manual UI test | VERIFIED |
| FR-CLI-03 | Session history with date/exercise filtering | `frontend/src/components/clinician/ClinicianSessions.tsx` | Manual UI test | VERIFIED |
| FR-RES-08 | Evaluation dashboard (metrics, confusion matrices, per-participant/exercise) | `frontend/src/components/research/ResearchEvaluation.tsx` | Manual UI test | VERIFIED |

## Notes

- Phase 2 focuses on foundation: database, auth, RBAC, dataset management, recording metadata, signal quality schema, audit logging, WebSocket foundation, and application shells.
- AI models, rehabilitation game, and real sensor integration are explicitly out of scope for Phase 2.
- No fabricated clinical values or patient data are present.

## Backend research slices added (2026-09-08)

Audio streaming: `backend/app/main.py`, `audio_pipeline.py`, `audio_protocol.py`, WebSocket tests. EEG/EMG features: `signal_processing.py`, signal tests. Camera boundary: `camera.py`, `test_camera.py`. Feature lineage: `models/feature.py`, migration `006_computed_features.py`, research-signal API tests. Synchronization/fusion: `signal_processing.py`, API tests. Participant-bootstrap evaluation: `services/evaluation.py`, evaluation tests. Final-test isolation: `services/test_isolation.py`, research-signal isolation test. PostgreSQL integrity: migration round-trip and `alembic check`.
