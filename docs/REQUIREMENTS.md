# NeuroSpeech Rehab — Requirements

## 1. Scope

Research prototype for multimodal speech rehabilitation using EEG, facial EMG, real-time facial/lip tracking, audio analysis, and multimodal AI.

**Not a certified medical device.** No clinical diagnosis, treatment efficacy claims, or medical certification.

## 2. Functional Requirements

### 2.1 Patient Application
- FR-PAT-01: Simple login with patient credentials
- FR-PAT-02: Home screen with single primary action ("Start Session")
- FR-PAT-03: Calibration guidance with visual and optional audio instructions
- FR-PAT-04: Exercise instructions screen (minimal text, clear icons, visual demonstration)
- FR-PAT-05: Rehabilitation game interface with large, accessible controls
- FR-PAT-06: Post-exercise feedback (performance summary, encouraging visual)
- FR-PAT-07: Session completion screen with progress indicator
- FR-PAT-08: No technical terminology (EEG/EMG/signal quality) visible to patient
- FR-PAT-09: High contrast mode and large typography options
- FR-PAT-10: Optional audio instructions with mute toggle

### 2.2 Clinician Portal
- FR-CLI-01: Dashboard with session overview and patient status
- FR-CLI-02: Patient list and profile management
- FR-CLI-03: Session history with date/exercise filtering
- FR-CLI-04: Live session monitoring with signal quality indicators
- FR-CLI-05: Exercise library management (create, edit, configure difficulty)
- FR-CLI-06: Progress tracking per patient and per exercise
- FR-CLI-07: Report generation (session summaries, exportable)
- FR-CLI-08: Signal quality review panel (aggregate metrics, not raw data by default)
- FR-CLI-09: Research notes attached to sessions/participants

### 2.3 Research Portal
- FR-RES-01: Dataset manager (create, version, organize datasets)
- FR-RES-02: Participant manager (pseudonymous IDs, demographic/metadata)
- FR-RES-03: Session manager (schedule, link recordings, annotate)
- FR-RES-04: Recording manager (view, validate, label modalities)
- FR-RES-05: Annotation manager (create, edit, link ground truth)
- FR-RES-06: Signal viewer (EEG, EMG, audio waveform, video timeline)
- FR-RES-07: Model manager (register versions, track feature pipelines)
- FR-RES-08: Evaluation dashboard (metrics, confusion matrices, per-participant/exercise)
- FR-RES-09: Export functionality (CSV, JSON, BIDS-like structure)
- FR-RES-10: Ablation study comparison views

### 2.4 Signal Processing Engine
- FR-SIG-01: EEG ingestion (device metadata, timestamps, channel info, sampling rate)
- FR-SIG-02: Facial EMG ingestion (same metadata requirements)
- FR-SIG-03: Camera/video ingestion (frame metadata, timestamps, tracking quality)
- FR-SIG-04: Audio ingestion (sample metadata, timestamps, SNR estimates)
- FR-SIG-05: Cross-modal synchronization (timestamp alignment validation)
- FR-SIG-06: Signal quality assessment per modality
- FR-SIG-07: Artifact handling and flagging
- FR-SIG-08: Feature extraction per modality
- FR-SIG-09: Processing status tracking per recording

### 2.5 Multimodal AI Engine
- FR-AI-01: EEG encoder module
- FR-AI-02: EMG encoder module
- FR-AI-03: Vision encoder module
- FR-AI-04: Audio encoder module
- FR-AI-05: Multimodal fusion layer
- FR-AI-06: Task-specific prediction heads
- FR-AI-07: Ablation experiment support (all single and combination modalities)
- FR-AI-08: Confidence/uncertainty output for every prediction
- FR-AI-09: Model versioning tied to predictions
- FR-AI-10: Signal quality gate before inference (no forced predictions)

### 2.6 Rehabilitation Game
- FR-GAM-01: Therapeutic exercise targets configurable per protocol
- FR-GAM-02: Patient attempt capture synchronized with sensors
- FR-GAM-03: Real-time multimodal analysis
- FR-GAM-04: Exercise performance scoring
- FR-GAM-05: Game response (visual/audio feedback)
- FR-GAM-06: Feedback screen after each attempt
- FR-GAM-07: Difficulty configuration by clinician/protocol
- FR-GAM-08: Exercise sequence management

### 2.7 Data/Dataset Management
- FR-DAT-01: Participant-level train/validation/test splitting
- FR-DAT-02: No same-participant data leakage across splits
- FR-DAT-03: BIDS-compatible directory organization
- FR-DAT-04: Pseudonymous participant identifiers
- FR-DAT-05: Recording lineage (raw → processed → features)
- FR-DAT-06: Metadata preservation (sampling rate, device, channels)
- FR-DAT-07: Signal quality flags stored with each recording

### 2.8 Validation and Evaluation Engine
- FR-VAL-01: Independent evaluation on held-out test set
- FR-VAL-02: Metrics: accuracy, precision, recall, F1, sensitivity, specificity, AUROC
- FR-VAL-03: Confusion matrix visualization
- FR-VAL-04: Confidence intervals for metrics
- FR-VAL-05: Latency measurement
- FR-VAL-06: Per-participant performance breakdown
- FR-VAL-07: Per-exercise performance breakdown
- FR-VAL-08: Failure case analysis and export
- FR-VAL-09: Final test set isolation (no tuning on test data)

### 2.9 Audit Log
- FR-AUD-01: Log all authentication events
- FR-AUD-02: Log all data access (read, create, update, delete)
- FR-AUD-03: Log all predictions with model version and timestamp
- FR-AUD-04: Log configuration changes
- FR-AUD-05: Immutable audit trail
- FR-AUD-06: Searchable and exportable

### 2.10 Authentication and Role Management
- FR-AUTH-01: Role-based access: PATIENT, CLINICIAN, RESEARCHER, ADMIN
- FR-AUTH-02: Secure password handling (bcrypt/argon2, no plaintext)
- FR-AUTH-03: Session management (JWT or session tokens)
- FR-AUTH-04: Input validation on all endpoints
- FR-AUTH-05: Password reset workflow
- FR-AUTH-06: Role permission enforcement at API layer

## 3. Non-Functional Requirements

### 3.1 Research Integrity
- NFR-RES-01: All synthetic/demo data explicitly labeled
- NFR-RES-02: Real data distinguishable from simulated data
- NFR-RES-03: No fabricated physiological measurements
- NFR-RES-04: No LLM-generated medical values
- NFR-RES-05: Timestamps on every physiological observation
- NFR-RES-06: Synchronization support for all sensor streams

### 3.2 Performance
- NFR-PER-01: Game loop end-to-end latency < 200ms (target <100ms)
- NFR-PER-02: Signal processing pipeline < 50ms per window for real-time
- NFR-PER-03: WebSocket reconnection handling with session recovery
- NFR-PER-04: Database queries for session history < 500ms

### 3.3 Reliability
- NFR-REL-01: Graceful degradation when sensor quality drops
- NFR-REL-02: Session data persistence (no data loss on disconnect)
- NFR-REL-03: Backend restart does not corrupt active sessions
- NFR-REL-04: Signal quality gate must never crash; must return structured failure state

### 3.4 Security & Privacy
- NFR-SEC-01: Passwords never stored in plaintext
- NFR-SEC-02: Pseudonymous identifiers for research participants
- NFR-SEC-03: Role-based authorization on every endpoint
- NFR-SEC-04: Audit logging for all sensitive operations
- NFR-SEC-05: HTTPS/WSS in production
- NFR-SEC-06: Input validation and sanitization
- NFR-SEC-07: No PII stored alongside physiological data unless clinically required

### 3.5 Usability
- NFR-USA-01: Patient interface operable with motor impairments
- NFR-USA-02: Keyboard and screen-reader accessible where feasible
- NFR-USA-03: Responsive design for tablet and desktop
- NFR-USA-04: Offline resilience for patient app (local queue, sync on reconnect)

### 3.6 Maintainability
- NFR-MAIN-01: Modular backend with dependency injection
- NFR-MAIN-02: TypeScript strict mode in frontend
- NFR-MAIN-03: Automated tests for core signal processing and AI pipelines
- NFR-MAIN-04: Docker Compose for reproducible dev environments

## 4. Constraints

- Research prototype only; no medical device certification pursued in Phase 1
- No patient data collection in Phase 1; only synthetic/demo data
- AI models not trained in Phase 1; only architecture and interfaces defined
- Real EEG/EMG hardware integration deferred to Phase 2+

## 5. Assumptions

- Clinicians and researchers have basic computer literacy
- Network connectivity available during sessions
- Modern browsers (Chrome, Firefox, Edge, Safari)
- Tablet or desktop screen for patient use
- HIPAA/GDPR compliance requirements will be evaluated during institutional review

## Implemented backend acceptance criteria

The backend validates stream format and ownership, bounds request and audio sizes, rejects unsupported or inadequate signals, stores real sensor inputs with source digests and pipeline versions, refuses multimodal predictions without a trained head, protects locked final-test participants, requires administrator provisioning for privileged accounts, and rejects development secrets in production configuration. The patient frontend remains outside this backend completion scope.
