# Traceability matrix — 2026-09-09

| Requirement | Implementation / contract | Current evidence | Boundary |
|---|---|---|---|
| Full Stitch audit and real feature mapping | STITCH_FEATURE_MAP.md; work/stitch-archive-audit.json and stitch-content-audit.json | 16 directory entries,12HTML,12PNG,2 design specifications; controls indexed | Design references only |
| Rollback before replacement | work/backups/frontend-before-stitch-20260909-051650/frontend.zip and manifest; original DB dump | Source/config hashes and13,701,314-byte dump | Original DB preserved |
| Responsive visual system | frontend/src/index.css,WorkspaceLayout.tsx,patient components | Mobile/tablet/desktop screenshots and layout assertions | Representative Chromium viewports |
| Authentication/enrollment | auth.tsx,auth APIs,participants/me | Backend auth tests; browser login/unlinked/role tests; populated-site checks | Local practice labeled not-a-study |
| Session/exercise/attempt lifecycle | PatientSession.tsx; sessions/session-exercises/attempts APIs | Three browser lifecycle cases,PostgreSQL workflow | Backend IDs,real action timestamps |
| Permissions/PCM | pcmCapture.ts;16kHz AudioContext,LE PCM16 | Byte-order unit test;permission/video/binary assertions | Fake media confined to test DB |
| Final authenticated WebSocket | /ws/sessions/{session_id}?token=...;stream_start,binary,stream_stop | Backend,PostgreSQL,browser wire and persistence JSON | No client-side prediction creation |
| Ready/Listening/Analyzing/Result/Next | State steps and accessible live regions | Stage assertions;success,silence,denial | Text accompanies color/animation |
| Real prediction/quality feedback | predictions/recordings/signal-quality GET | Actual checkpoint prediction matches UI after reload | No clinical success score |
| No fabricated result | Explicit empty feedback and backend quality rejection | Three silence cases;clipping rejection;signal tests | No invented sensors/transcripts |
| Progress/history | PatientProgress.tsx,persisted session/prediction APIs | Completed session/history reload at 3sizes | Record counts,not efficacy |
| Accessible preferences | PatientSettings.tsx,preferences.ts | Persistence,focus,reduced motion,200%text,320px,axe | Only real device-local settings |
| Staff/research views | Existing authorized read APIs | Staff E2E and15populated-page checks;pagination/details | Unsupported write controls omitted |
| Imported dataset contract | backend/app/schemas/dataset.py response-only metadata tolerance | New dataset list/detail regression;4 live datasets load | Write contracts/schema preserved |
| Actual model lineage | scripts/local_checkpoint.py,model-version table | Verified checkpoint SHA256 and real model FK in speech-workflow.json | No fake model IDs or scores |
| PostgreSQL/Alembic | Existing migrations through 007 | PostgreSQL 16.15;19 schema checks with 22 workflow assertions;zero drift | Isolated test databases |
| ML and metrics | Corrected trainer,evaluate_validation.py |36 tests;168utterance audit;bootstrap;checkpoint/manifest hashes | No locked-test evaluation |
| Split integrity | Exact-ID and normalized-code grouping |0literal-ID overlap;196 normalized-code collisions | Speaker independence not established |
| EEG/EMG/synchronization | signal_processing.py,research-signals API | Synthetic tests and signal-fixtures.json | Not physiological/clinical accuracy |
| Camera landmarks | camera.py |5 tests;real image468landmarks andNO_FACE | Labeled benchmark/hardware pending |
| Full gates and startup | VERIFICATION_REPORT.md,README,start-local.ps1 | XML/JSON/logs,8000/5174 live checks | Local development deployment |
| Clinical/hardware claims | LIMITATIONS.md,RESEARCH_METRICS.md | Unsupported metrics explicitly not established | Requires labeled data and studies |

