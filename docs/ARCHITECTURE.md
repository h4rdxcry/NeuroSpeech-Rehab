# NeuroSpeech Rehab — Architecture

## 1. Stack Selection

| Layer | Technology | Rationale |
|-------|------------|-----------|
| Frontend | React 18 + Vite + TypeScript | Modern, fast DX, strong TS support, accessible component ecosystem |
| UI Library | shadcn/ui + Tailwind CSS | Customizable, accessible, clinical-research aesthetic |
| Backend | Python 3.11 + FastAPI | Async-native, OpenAPI docs, strong ML ecosystem integration |
| Database | PostgreSQL 16 | Relational integrity for research data, JSONB for flexible sensor metadata |
| Real-time | FastAPI WebSockets | Native WebSocket support for live sensor streaming and game loop |
| ORM | SQLAlchemy 2.0 + Alembic | Mature migrations, async support |
| AI/ML | PyTorch + Lightning | Modular encoder/fusion architecture, experiment tracking friendly |
| Experiment Tracking | MLflow or Weights & Biases | Model versioning, reproducibility, ablation comparison |
| Containerization | Docker + Docker Compose | Reproducible environments across dev/staging/research |
| Task Queue | Celery + Redis (optional Phase 2+) | Async signal processing and model inference |
| BIDS | Python bids + custom validators | Neuroimaging-compatible organization where applicable |

## 2. System Modules

```
┌─────────────────────────────────────────────────────────────┐
│                     NeuroSpeech Rehab                        │
├─────────────┬─────────────┬─────────────┬───────────────────┤
│  Patient    │ Clinician   │ Research    │  Admin            │
│  App        │ Portal      │ Portal      │  Portal           │
│  (React)    │ (React)     │ (React)     │  (React)          │
└──────┬──────┴────────┬────┴───────┬────┴────────┬──────────┘
       │               │            │             │
       └───────────────┴────────────┴─────────────┘
                         │
              ┌──────────▼──────────┐
              │   FastAPI Gateway   │
              │  (Auth + Routing)   │
              └──────────┬──────────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
   ┌────▼────┐      ┌────▼────┐     ┌────▼────┐
   │ Signal  │      │  ML     │     │  Data   │
   │ Engine  │      │ Engine  │     │ Mgmt    │
   └────┬────┘      └────┬────┘     └────┬────┘
        │                │                │
        └────────────────┼────────────────┘
                         │
              ┌──────────▼──────────┐
              │    PostgreSQL        │
              │  + Redis (cache)     │
              └─────────────────────┘
```

## 3. Primary Modules

### 3.1 Patient Application
- Extremely simplified UX
- One primary action per screen
- Large buttons, high contrast, minimal text
- No technical terminology
- Workflow: Login → Home → Start Session → Calibration → Instructions → Game → Feedback → Complete → Progress

### 3.2 Clinician Portal
- Dashboard, patient management, session history
- Live session monitoring with signal quality indicators
- Exercise management and configuration
- Progress reports
- Signal quality review without exposing raw engineering to patients

### 3.3 Research Portal
- Dataset, participant, session, recording, annotation management
- Signal viewer (EEG/EMG/audio/video)
- Model manager with version tracking
- Evaluation dashboard with metrics and confusion matrices
- Export in research-friendly formats

### 3.4 Signal Processing Engine
- Modular ingestion for EEG, EMG, Camera, Audio
- Per-modality: raw data, timestamps, device metadata, sampling rate, signal quality, processing status
- Pipeline stages: acquisition → validation → filtering → artifact handling → feature extraction → quality assessment
- All pipelines must support synchronization metadata

### 3.5 Multimodal AI Engine
- Encoder per modality: EEG, EMG, Vision, Audio
- Multimodal fusion layer
- Task-specific prediction heads
- Ablation support: EEG-only, EMG-only, Vision-only, Audio-only, pairwise combinations, full multimodal
- Confidence/uncertainty outputs
- Model versioning tied to every prediction

### 3.6 Rehabilitation Game
- Therapeutic exercise loop: target → attempt → sensor acquisition → analysis → game response → feedback → next
- Difficulty configurable by clinician/research protocol
- Engaging but clinically appropriate
- No autonomous clinical treatment prescription

### 3.7 Data/Dataset Management
- BIDS-compatible organization where applicable
- Pseudonymous participant identifiers
- Train/validation/test splitting at participant level
- Recording-level lineage and provenance

### 3.8 Validation and Evaluation Engine
- Participant-level evaluation
- Per-exercise performance
- Confusion matrix, accuracy, precision, recall, F1, sensitivity, specificity, AUROC
- Confidence intervals, latency
- Failure case analysis
- Isolated final test set (no tuning on test data)

### 3.9 Audit Log
- Immutable log of all data access, predictions, model usage, configuration changes
- User, action, timestamp, resource, metadata

### 3.10 Authentication and Role Management
- Roles: PATIENT, CLINICIAN, RESEARCHER, ADMIN
- Secure password handling (bcrypt/argon2)
- Session management
- Role-based access control (RBAC)

## 4. Data Flow

### 4.1 Real-time Session Flow
1. Patient starts session → backend creates session record
2. Sensors begin streaming → Signal Engine ingests and timestamps
3. Signal Quality Gate evaluates each modality
4. If quality sufficient → features extracted → AI inference → game response
5. If quality insufficient → state `SIGNAL_QUALITY_INSUFFICIENT` returned, no forced prediction
6. All predictions, confidence scores, timestamps, model versions stored
7. Session ends → recordings finalized, audit logged

### 4.2 Research Data Flow
1. Raw recordings stored with metadata
2. Signal processing produces processed signals and features
3. Annotations and ground truth linked to recordings
4. Model training uses only training partition
5. Validation uses validation partition
6. Final test set remains isolated until final evaluation
7. Evaluation results include confidence intervals and participant-level breakdowns

## 5. Signal Quality Gate

Before any AI prediction, the system must evaluate:
- EEG signal quality (channel validation, impedance proxy, artifact level)
- EMG signal quality (baseline stability, artifact level)
- Camera quality (frame rate, lighting, face detection confidence)
- Audio quality (SNR, voice activity detection confidence)
- Synchronization (cross-modal timestamp alignment within tolerance)

**Required behavior:**
- If any required modality is insufficient, return structured state `SIGNAL_QUALITY_INSUFFICIENT`
- Do not force a prediction
- Log the quality failure with details
- Allow clinician/researcher override for research annotation purposes only (not for patient-facing prediction)

## 6. Model Versioning & Reproducibility

Every prediction record must contain:
- `model_id`
- `model_version`
- `training_dataset_version`
- `feature_pipeline_version`
- `timestamp`

Model registry must support:
- Registration of new versions
- Ablation experiment tracking
- Comparison across versions
- Rollback capability

## 7. BIDS Compatibility

Where applicable, raw data organization follows BIDS principles:
- `sub-<participant_id>`
- `ses-<session_id>`
- `task-<exercise_id>`
- `modality-<eeg|emg|audio|video>`
- Metadata sidecars (`.json`) for device, sampling rate, channels
- Participant identifiers pseudonymous and consistent across modalities

BIDS compatibility is for organization and future interoperability, not claiming full BIDS certification for all modalities.

## 8. Real-time Considerations

- WebSocket connections for live sensor streaming
- Frame budget for game loop: target <100ms end-to-end latency for patient feedback
- Async signal processing where possible
- Graceful degradation when latency spikes
- Quality assessment before inference to avoid garbage-in predictions

## 9. Clinical/Research Guardrails

- No diagnosis or treatment efficacy claims in UI or model outputs
- All demo/synthetic data explicitly labeled `DEMO/SIMULATION`
- Real sensor data distinguishable from simulated/replayed data
- No fabricated physiological measurements
- No LLM-generated medical measurements
- No accuracy claims (>98% etc.) without independent test set validation
- AI does not autonomously prescribe treatment
- Research results never display invented values

## 10. Technology Decisions Summary

**Chosen: React + Vite + TypeScript + FastAPI + PostgreSQL + PyTorch**

Rejected alternatives and rationale:
- Angular: heavier bundle, slower dev iteration for research prototype
- Django: less flexible for real-time WebSocket + ML pipeline integration compared to FastAPI
- MongoDB: weaker guarantees for research data lineage and relational integrity
- TensorFlow: acceptable, but PyTorch more common in research and better for modular encoder ablation designs
- Flutter: unnecessary native app overhead; web-first with responsive design suffices for prototype

## Backend implementation status (2026-09-08)

The backend now contains executable research-prototype slices for authenticated REST/WebSocket access; bounded 16 kHz mono PCM16 streaming with VAD, quality gating, WAV persistence, and the local Tamil Wav2Vec2 checkpoint; camera frame validation with an optional MediaPipe adapter; EEG and facial-EMG filtering and features; shared-clock synchronization; fusion-vector preparation that returns an unavailable-model state rather than inventing a prediction; participant-bootstrap evaluation; source hashes; audit events; and versioned feature persistence. Heavy signal processing and ASR calls run off the FastAPI event loop. Production startup does not create schemas; PostgreSQL/Alembic owns that state.
