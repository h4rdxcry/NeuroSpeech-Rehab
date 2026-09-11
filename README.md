# NeuroSpeech Rehab

An AI-assisted multimodal speech and articulatory rehabilitation platform for post-stroke survivors, dysarthria, and apraxia of speech. 

Combines a **FastAPI backend** with research-grade **Audio-Visual Speech Recognition (AV-ASR)**, **MediaPipe FaceMesh Lip Tracking**, and an approved **clinical-grade Glassmorphic UI** built in **React 19 and TypeScript**.

---

## Unified Project Architecture

```
NeuroSpeech-Rehab/
├── backend/                  # FastAPI REST API & WebSocket Services
│   ├── app/
│   │   ├── api/v1/           # Modular endpoints (rehabilitation, auth, participants, etc.)
│   │   ├── core/             # Configuration, DB sessions, RBAC, auth, audit logging
│   │   ├── models/           # SQLAlchemy ORM models (patients, sessions, attempts, datasets)
│   │   ├── schemas/          # Pydantic v2 validation models
│   │   └── services/         # Clinical scoring, audio streaming, pipeline integration
│   ├── tests/                # Automated pytest suite (RBAC, camera, integration)
│   └── requirements.txt      # Python dependencies
├── frontend/                 # Clinical Web Application
│   ├── src/
│   │   ├── api/              # Strongly-typed API client modules (zero fake data)
│   │   ├── components/       # Patient, Clinician, Researcher workspaces & Auth
│   │   ├── context/          # Global application state & live progress synchronization
│   │   └── types/            # TypeScript interfaces & data contracts
│   ├── package.json          # Node dependencies & Vite scripts
│   └── vite.config.ts        # Vite build & development server config
├── ml/                       # Machine Learning & Signal Processing Engines
│   ├── models/               # Conformer CTC, 3D-CNN, Viseme classifier, Multimodal fusion
│   └── pipelines/            # MediaPipe kinematics, One-Euro filter, FACS Action Units
├── ml_training/              # Training pipelines, checkpoints, and benchmark suites
├── docs/                     # Research metrics, architecture, and verification documentation
├── run_app.ps1               # One-click PowerShell launcher
├── run_app.bat               # Windows batch launcher
└── README.md
```

---

## Quick Start (Running the Application)

### 1. One-Click Launcher (Windows)
From the repository root in PowerShell:
```powershell
.\run_app.ps1
```
*(Or double-click `run_app.bat`)*

This launches both the FastAPI backend (`http://127.0.0.1:8000`) and the Vite frontend (`http://localhost:3000`) in synchronized development mode.

---

### 2. Manual Startup

#### Terminal 1: Backend Server
```powershell
cd d:\NeuroSpeech-Rehab
$env:PYTHONPATH="d:\NeuroSpeech-Rehab;d:\NeuroSpeech-Rehab\backend"
d:\NeuroSpeech-Rehab\backend\.venv-ml\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

#### Terminal 2: Frontend Web Server
```powershell
cd d:\NeuroSpeech-Rehab\frontend
npm run dev
```

---

## Vercel Cloud Deployment

The frontend is fully configured for seamless deployment to Vercel:

### Option A: Import from GitHub (Recommended)
1. Go to [vercel.com/new](https://vercel.com/new).
2. Select and import the repository `h4rdxcry/NeuroSpeech-Rehab`.
3. Vercel automatically detects `vercel.json` (Vite, output `frontend/dist`).
4. (Optional) Set the environment variable `VITE_API_URL` to your production backend URL.
5. Click **Deploy**.

### Option B: Deploy via Vercel CLI
```bash
npx vercel
# For production deployment:
npx vercel --prod
```

---

## Access & Demo Accounts

* **Web Application UI**: [http://localhost:3000](http://localhost:3000)
* **Backend API Health**: [http://127.0.0.1:8000/health](http://127.0.0.1:8000/health)
* **Interactive Swagger Documentation**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

All accounts are pre-seeded in local development:

| Role | Email | Password | Features & Scope |
| :--- | :--- | :--- | :--- |
| **Patient** | `patient@neurospeech.dev` | `NeuroSpeechDemo123!` | 100-Level Guided Therapy, Real MediaPipe Lip Tracking, Audio Recording & Biofeedback |
| **Clinician** | `clinician@neurospeech.dev` | `NeuroSpeechDemo123!` | Patient Management Roster, Clinical Protocol Monitoring (`IEC-MMC-2025-084`), Session Detail |
| **Researcher** | `researcher@neurospeech.dev` | `NeuroSpeechDemo123!` | OpenSLR-127 Tamil Speech Corpus, Conformer-CTC Checkpoints, Benchmark Evaluation Runs |

---

## Key Features & Scientific Capabilities

1. **100-Level Rehabilitation Progression Engine**:
   - Progressive difficulty curriculum (vowels, plosives, polysyllabic words, fluent phrases).
   - Real attempt evaluation via `POST /api/v1/rehabilitation/attempt`.
   - Unlocked levels, completed tasks, and practice streaks persist directly to the database.
2. **Zero Fake Camera/Audio Functionality**:
   - Web camera frames stream to `POST /api/v1/research-signals/camera/track-frame`.
   - MediaPipe FaceMesh 468-point tracking with real lip contours and landmark rendering.
   - Genuine microphone audio processing without synthetic score overrides.
3. **Dual-Stream Visual Speech Recognition & Kinematics**:
   - 40-dimensional 3D pose-invariant articulatory kinematic vectors.
   - Spatio-temporal 3D-CNN capturing inter-oral textures and tongue contact.
   - 8-class clinical viseme classification aligned via dynamic programming and CTC beam search.
   - FACS Action Unit extraction (`AU10`, `AU12`, `AU14`, `AU15`, `AU17`, `AU18`, `AU20`, `AU25`, `AU26`).
   - Adaptive Casiez 1€ (One-Euro) filtering reducing landmark jitter by $>60\%$.
4. **Authentic Multi-Role RBAC & Audit Trails**:
   - JWT tokens signed with secure keys and validated through `get_current_active_user`.
   - Strict HIPAA and ethics data separation between clinical care and anonymized research cohorts.

---

## Verification & Testing

### Backend & ML Test Suites
```powershell
# Run Rehabilitation & Integration Tests
$env:PYTHONPATH="d:\NeuroSpeech-Rehab;d:\NeuroSpeech-Rehab\backend"
d:\NeuroSpeech-Rehab\backend\.venv-ml\Scripts\pytest backend\tests\test_rehabilitation_integration.py -v

# Run Auth, Camera, and Registry Tests
d:\NeuroSpeech-Rehab\backend\.venv-ml\Scripts\pytest backend\tests\test_auth_rbac.py backend\tests\test_camera.py backend\tests\test_dataset_registry.py -v

# Run Advanced Tracking, Kinematics & Filter Tests
d:\NeuroSpeech-Rehab\backend\.venv-ml\Scripts\pytest ml_training\tests\test_advanced_tracking_and_prediction.py -v
```

### Frontend Typechecking & Production Build
```powershell
cd frontend
npm run lint    # Typecheck with TypeScript
npm run build   # Production Vite bundle build
```

---

## Cloud Deployment (Supabase + Render + Vercel)

The platform is designed for zero-cost, 24/7 cloud operation across:
- **Database & Storage**: [Supabase](https://supabase.com) (PostgreSQL 15+, HIPAA-compliant RLS, private buckets)
- **Backend API**: [Render](https://render.com) (1-Click Blueprint via [`render.yaml`](render.yaml) or [`Dockerfile`](Dockerfile))
- **Frontend SPA**: [Vercel](https://vercel.com) (Automated Vite deployments)

For complete setup instructions and database seeding, see the **[Supabase & 24/7 Backend Deployment Guide](docs/SUPABASE_BACKEND_SETUP_GUIDE.md)**.

---

## License & Compliance
Designed for clinical speech rehabilitation research. All patient data is managed in accordance with ethical standards and pseudonymized research protocols.
