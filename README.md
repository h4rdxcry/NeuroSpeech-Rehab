# NeuroSpeech Rehab

An integrated AI-assisted speech rehabilitation **research software prototype**, with a Stitch-adapted, iOS-inspired responsive interface and the existing FastAPI/PostgreSQL backend. Patient pages use real saved records and actual Tamil ASR inference, with explicit empty/error states. No clinical accuracy, therapeutic efficacy or medical-device validation is claimed.

## Open the local website

From PowerShell:

~~~powershell
cd D:\NeuroSpeech-Rehab
.\scripts\start-local.ps1
~~~

- Website: **http://127.0.0.1:5174/login**
- API health: **http://127.0.0.1:8000/health**
- API documentation: **http://127.0.0.1:8000/docs**
- Patient: **patient@neurospeech.dev**
- Clinician: **clinician@neurospeech.dev**
- Researcher: **researcher@neurospeech.dev**
- Password for these local development accounts: **NeuroSpeechDemo123!**

The patient profile is labeled **Local practice — not a study** and has no research dataset membership. Setup creates no predictions, quality readings or progress scores. Existing account passwords are not reset. The script verifies the actual checkpoint hash before registering its real model metadata, and refuses to replace a different active model.

Choose **Therapy**, create/open a session, choose **Tamil phrase practice**, and add the exercise if needed. Enable camera/microphone, select **Start attempt**, speak a short phrase, then select **Stop attempt**. Wait for saved analysis, finish the session and open History. Silence or unusable audio can correctly produce no transcript. Practice completion is not a clinical score. Keep spoken segments under 12 seconds and pause; recording is bounded to 55 seconds per attempt. The first real inference may load the checkpoint.

The app uses the preserved database clone **neurospeech_stitch** in Docker container **neurospeech-stitch-verification**, at 127.0.0.1:55432. The original neurospeech database/container is preserved. Startup logs/process metadata are in work/local-runtime. The script reuses recognized project services and does not kill unrelated processes on conflicting ports.

## Implemented UI

Patient login, account/enrollment lookup, current practice, create/open session, audio exercise assignment/selection, attempt lifecycle, camera preview, microphone capture, authenticated audio WebSocket, real backend quality/transcript feedback, completion/history, and device-local larger-text/contrast/reduced-motion settings.

Authorized clinician/research views show patients/participants, sessions, recordings, persisted predictions/quality/computed features, annotations, datasets/provenance/splits, evaluation records and actual model metadata. Large record views use backend pagination. Unsupported games, telehealth, playback/export, scheduling, clinical scores, sensor simulations and imaginary AI options were omitted.

Audio contract: **/ws/sessions/{session_id}?token=<access_token>**, with real session/attempt IDs. Send stream_start with session_id,attempt_id,modality=AUDIO,sample_rate=16000,channels=1,sample_width_bytes=2,encoding=pcm16; then binary signed little-endian PCM16 and stream_stop. Prediction/model/recording lineage is persisted by the backend; the browser does not create predictions or quality values.

## Verification and research evidence

- [Verification report](docs/VERIFICATION_REPORT.md): backend 104,ML 36,frontend 9,Chromium 9 tests; PostgreSQL and15populated-page checks; exact commands/evidence.
- [Research metrics](docs/RESEARCH_METRICS.md):45 evidence rows with exact values,methods,populations,counts,versions,intervals,sources and limitations.
- [Integration handover](docs/INTEGRATION_REPORT.md):20requested closeout items, changed files and completion scope.
- [Stitch feature map](docs/STITCH_FEATURE_MAP.md): design reuse, omissions and actual API mapping.
- [Traceability](docs/TRACEABILITY_MATRIX.md), [roadmap](docs/PROJECT_ROADMAP.md), [limitations](docs/LIMITATIONS.md).
- [Architecture](docs/ARCHITECTURE.md), [requirements](docs/REQUIREMENTS.md), [data model](docs/DATA_MODEL.md), [security](docs/SECURITY.md), [risk register](docs/RISK_REGISTER.md), [validation plan](docs/VALIDATION_PLAN.md).

The validation-subset result is **CER13.411536% / WER67.306420%** on168utterances from84registered speaker IDs. This is not clinical accuracy or independent locked-test performance. There are196normalized speaker-code collisions across partitions; authoritative identity reconciliation is required before claiming speaker independence. Historical training CER/WER used a flawed evaluator and remains marked historical. No locked final-test evaluation was run. Read the full metrics report before copying numbers into a paper.

## Dependencies and manual startup

Tested locally with Windows,Python 3.11.15,Node/npm,Docker Desktop,PostgreSQL 16.15 and backend/.venv-ml. The checkpoint is ml_training/outputs/baseline/best-checkpoint.pt; the tokenizer and cached Wav2Vec2 base model must be available. Exact installed package versions are recorded in work/verification-20260909/environment.json. The older broad requirements.txt is not a complete frozen environment lock.

Restore frontend dependencies and Chromium in an existing checkout:

~~~powershell
cd D:\NeuroSpeech-Rehab\frontend
npm ci
npx playwright install chromium
~~~

Manual backend startup from backend:

~~~powershell
$env:DATABASE_URL='postgresql+asyncpg://verification:verification_test_only@127.0.0.1:55432/neurospeech_stitch'
$env:ENVIRONMENT='development'
$env:CORS_ORIGINS='http://127.0.0.1:5174,http://localhost:5174'
$env:HF_HUB_OFFLINE='1'
.\.venv-ml\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --no-access-log --log-level warning
~~~

Manual frontend startup from frontend, in a second PowerShell:

~~~powershell
$env:VITE_API_URL='http://127.0.0.1:8000'
npm run dev -- --host 127.0.0.1 --port 5174 --strictPort
~~~

Use backend/.env.example and frontend/.env.example as configuration references. Never include real deployment credentials in a handover archive. No public deployment was performed.

## Reproduce verification

Complete commands are in [VERIFICATION_REPORT.md](docs/VERIFICATION_REPORT.md). Browser tests use separate backend8001/frontend5173 processes and guarded verification_browser. Clear inherited DATABASE_URL before running the E2E command, or explicitly set that test database URL. Test media is scoped to that database. The populated-site check separately visits8000/5174without physical media.

~~~powershell
cd D:\NeuroSpeech-Rehab\frontend
npm run typecheck
npm run test
npm run lint
npm audit --audit-level=high
npm run build
Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
npm run test:e2e
cd ..
node scripts/check_live_site.cjs
~~~

## Backup and recovery

Old frontend source/configuration: **work/backups/frontend-before-stitch-20260909-051650/frontend.zip**, with a 38-file SHA256 manifest. Expand into a new review directory first; the ZIP contains a frontend directory. Restore source/configuration after checking the destination and run npm ci. Keep the current source snapshot as a second rollback point.

Original PostgreSQL custom-format dump: **work/backups/neurospeech-before-stitch-20260909.dump**, SHA256 **fdba5733244e1adaa5d157332c357c7f84efe1c9f0cd059c23757ebe4522cef5**. Recover into a newly named empty database with pg_restore --no-owner --no-privileges, never over the preserved source. Point DATABASE_URL at the new database and run existing Alembic upgrades through 007. Normal Docker stop/start preserves the current container database; removing its volume is not a restart step. A fresh recovered clone needs account and model registration before patient practice.

No Git repository existed at intake. File-hash and changed-file inventories under work/verification-20260909 identify the delivered state. Clinical recruitment, calibrated hardware, identity-safe final evaluation and production deployment remain external work.

