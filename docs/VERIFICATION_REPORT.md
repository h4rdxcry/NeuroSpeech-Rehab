# Integrated software verification — 2026-09-09

This report supersedes the 2026-09-08 frontend closeout. The application uses the Stitch visual direction and existing FastAPI/PostgreSQL contracts. It is a research software prototype; software tests do not measure clinical accuracy. Qualified research evidence is in [RESEARCH_METRICS.md](RESEARCH_METRICS.md).

## Current verification gates

| Gate | Measured result | Evidence under work/verification-20260909 |
|---|---|---|
| Full backend pytest | **104 passed, 0 failed, 0 skipped**; 27 warnings | backend.xml, backend.log |
| Full ML/data pytest | **36 passed, 0 failed, 0 skipped**; 10 warnings | ml.xml, ml.log |
| TypeScript | Exit 0 | typecheck.log, frontend-checks.json |
| Frontend unit tests | **9 passed in 2 files**, 0 failed | frontend-tests.json |
| ESLint | Exit 0; **0 errors / 0 warnings** | lint.log |
| npm audit high gate | Exit 0; **0 high / 0 critical**, **2 moderate** development-tool advisories | npm-audit.json |
| Production build | Exit 0; Vite 6.4.3 bundle generated | build.log |
| Chromium E2E | **9 passed, 0 failed, 0 skipped, 0 flaky** | browser.json, browser.log, *-workflow.json |
| Populated local site | **15 page/role checks passed**, 0 runtime/API failures | live-site.json |
| PostgreSQL | **19 migration/schema checks**, including a workflow group with **22 workflow checks**; 0 failed/skipped | postgres-closeout.log |
| Alembic | Current head **007_patient_participant_link**; **0 metadata drift** | migration.log, local-migration.log |
| Camera subset | **5 of the 104 backend tests passed**; 468 landmarks on a real face fixture; explicit no-face behavior | backend.xml; backend/tests/test_camera.py |
| Accessibility | **0 axe violations** in saved E2E scans and 15 populated-page scans; keyboard/focus/reflow assertions pass | axe-*.json, live-site.json, browser.json |

Use the JSON/XML timestamps for precise final run times. Do not sum nested test groups as independent tests. Test pass counts are not clinical accuracy or formal accessibility certification.

## Browser and responsive scope

Mobile **390×844**, tablet **768×1024**, and desktop **1440×1000** each exercise real login, session creation, exercise assignment, attempt creation, camera/microphone permission and video preview, authenticated WebSocket metadata, binary PCM frames, stop acknowledgement, persisted recording/quality/prediction readback, attempt/session completion and history reload. Every stream uses backend session/attempt IDs and **16kHz mono signed little-endian PCM16**. All three silence fixtures persist recordings and create no invented transcript.

Additional scenarios verify permission denial sends no audio, unlinked patients cannot create sessions, patient routes reject staff access, staff navigation uses real APIs, local settings persist, focus is visible, **200% text** reflows, **320px width** does not overflow, and reduced motion disables transitions. Tested essential controls are at least44px tall; principal touch controls are48–64px. Landmarks, skip navigation, labels and textual statuses accompany the visual design.

The ninth test injects a documented validation utterance through Chromium's fake audio device **only into verification_browser**. The actual checkpoint emits a prediction with real model/recording/attempt lineage; the displayed transcript matches persisted data before and after reload. This verifies integration, not WER. Tests create no client-side predictions or quality values.

The separate populated-site check visits four patient pages, seven research pages, and four clinician pages. It opens real provenance/split details, quality/features disclosures and recording pagination, and leaves a local practice session/exercise ready. No synthetic or physical media is captured by this separate check.

## Integration fixes

- Imported SLR127 metadata caused HTTP500 because DatasetResponse.split_definition accepted only lists while stored JSON also contained a seed, version and ratios. The **response-only** schema now preserves that JSON. Request schemas and database schema are unchanged. A regression test covers list/detail readback. This is the only backend application-code change.
- The preserved database lacked an active ASR model registration. scripts/local_checkpoint.py verifies the existing checkpoint SHA256 before registering actual model metadata. It refuses to replace a different active model; no predictions or performance scores are seeded.
- Recording, annotation and session lists use backend skip/limit pagination. Unsupported Stitch controls and invented scores were omitted; absent data has explicit empty/error states.
- ML-only evaluator corrections fix invalid masking, CTC-collapsed references, padded logits and silent long-audio truncation. Four regression tests were added. The existing checkpoint is unchanged. Research metrics explicitly qualify historical values and identity ambiguity.

## Preservation and rollback

- Design ZIP: D:\stitch_neurospeech_rehab_platform.zip, SHA256 **04005551a5326f141ecfd1f74122458e5027fdcba12e9cbb61366d8c9af98d4c**.
- Frontend snapshot: work/backups/frontend-before-stitch-20260909-051650/frontend.zip, with a 38-file source/configuration SHA256 manifest; dependencies/build output excluded.
- Original PostgreSQL dump: work/backups/neurospeech-before-stitch-20260909.dump, **13,701,314 bytes**, SHA256 **fdba5733244e1adaa5d157332c357c7f84efe1c9f0cd059c23757ebe4522cef5**.
- Original neurospeech database in neurospeech-rehab-db-1 was not migrated in place. A restored clone, neurospeech_stitch in neurospeech-stitch-verification, was upgraded005→006→007. Tests use separate disposable databases.
- Local practice accounts have no research dataset membership and are labeled not-a-study. No fake progress or sensor values were seeded.
- Previous documents: work/backups/docs-before-closeout-20260909.zip.

## Actual startup and exact verification commands

Website: **http://127.0.0.1:5174/login**. API: **http://127.0.0.1:8000**. API docs: **http://127.0.0.1:8000/docs**. Startup logs/process metadata are in work/local-runtime.

~~~powershell
cd D:\NeuroSpeech-Rehab
.\scripts\start-local.ps1

cd backend
.\.venv-ml\Scripts\python.exe -m pytest -q --junitxml=../work/verification-20260909/backend.xml
$env:ENVIRONMENT='test'
$env:DATABASE_URL='postgresql+asyncpg://verification:verification_test_only@127.0.0.1:55432/verification'
.\.venv-ml\Scripts\python.exe -m alembic current
.\.venv-ml\Scripts\python.exe -m alembic check
.\.venv-ml\Scripts\python.exe tests/postgres_closeout.py

cd ..\ml_training
..\backend\.venv-ml\Scripts\python.exe -m pytest -q --junitxml=../work/verification-20260909/ml.xml

cd ..\frontend
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

The PostgreSQL closeout script creates/discards guarded **test databases**; use the isolated verification server, never an operational database. Playwright defaults to verification_browser, starts backend8001/frontend5173, and provisions unique test accounts. The active app uses8000/5174. The speech fixture needs the existing local checkpoint and the frozen validation manifest.

## Remaining limitations

No failing checks or known unresolved defects remain in the delivered integrated UI workflow. Two moderate Vitest-chain development advisories remain; the requested high gate passes. This is a local HTTP development deployment. Production operations/security, calibrated physical hardware, real Safari/iOS devices, assistive-technology/patient usability, identity-reconciled evaluation, clinical studies and regulatory review remain external work. Long continuous speech can exceed the12-second ASR segment limit; speak short phrases and pause. The55-second attempt cap does not extend the model limit. See [LIMITATIONS.md](LIMITATIONS.md).


WebSocket query-token values are redacted in the delivered browser logs. Startup uses warning-level server logging so future normal connection logs do not print the token-bearing URL; the authenticated protocol itself is unchanged.
