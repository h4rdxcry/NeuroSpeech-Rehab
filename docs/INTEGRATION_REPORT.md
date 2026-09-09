# Stitch integration handover — 2026-09-09

The delivered software uses the Stitch visual direction, existing backend contracts, real stored research data and explicit unavailable states. It runs locally as a research prototype. Clinical/hardware validation is not part of the software completion percentage.

## 1. Stitch ZIP audited

D:\stitch_neurospeech_rehab_platform.zip contains **16 directory entries** (root plus15content directories), **12HTML files,12PNG previews and2design specifications**. The full entry inventory and source SHA256 are in work/stitch-archive-audit.json. Every HTML file's text,controls,links and image references are indexed in work/stitch-content-audit.json. Source was safely extracted under work/stitch-source. No ZIP code was blindly substituted for the application's API logic.

## 2. Rollback snapshot

**D:\NeuroSpeech-Rehab\work\backups\frontend-before-stitch-20260909-051650\frontend.zip** contains38original frontend source/config files, with a SHA256 manifest. node_modules,dist and test output are excluded. Original DB dump: work/backups/neurospeech-before-stitch-20260909.dump,13,701,314bytes. Previous documentation is also backed up. The original PostgreSQL database was preserved; the active UI uses an upgraded clone.

## 3. Files changed

The complete source/configuration list is [CHANGED_FILES.md](CHANGED_FILES.md), with hashes in work/verification-20260909/changed-files.json. Changes include the shared workspace shell/theme; patient login/home/session/settings; research datasets/details/participants/models/recording results and pagination; route/type additions; browser and PCM/contract tests; package-lock/accessibility test dependency; local startup/checkpoint/evidence scripts; and updated documentation.

Backend application change is restricted to **backend/app/schemas/dataset.py**, plus its regression test. ML changes affect trainer evaluation correctness, training duration filtering and four regression tests. No checkpoint was retrained or overwritten. Source identity and installed runtime versions are recorded in source-manifest.json and environment.json.

## 4. Stitch components reused/adapted/removed

Adapted blue/violet luminous canvas, rounded cards and pill navigation, speech/microphone motif, large target phrase, camera mirror, clear recording controls, quiet result/history surfaces, and local accessibility settings. Rebuilt these as React/CSS using the existing local icon library/system fonts. Stock portraits and simulated sensor displays were omitted. [STITCH_FEATURE_MAP.md](STITCH_FEATURE_MAP.md) maps every source screen and design specification to actual functionality or its reason for omission.

## 5. Visible real features

Patient: login; account/enrollment lookup; open/create session; audio exercise assignment/selection; attempt lifecycle; camera preview and permission; microphone permission/capture; real stream status; backend quality and persisted transcript; session completion; saved progress/history; larger text,contrast and reduced motion.

Clinician/research: authorized patient/participant lists, sessions, recordings, annotations, saved predictions/quality/computed features, dataset provenance/splits, evaluation records and model metadata. Record lists use actual skip/limit pagination. Empty evaluations/features/quality are described as absent.

## 6. Actual API and WebSocket wiring

Authentication: POST/api/v1/auth/login and GET/api/v1/auth/me. Patient profile: GET/api/v1/participants/me. Session,exercise,assignment and attempt flows use the existing sessions/sessions,exercises/exercises,session-exercises/session-exercises and attempts/attempts GET/POST/PATCH routes. Results use predictions/predictions,recordings/recordings and signal-quality/signal-quality/{recording_id}. Research views use participants,annotations,datasets/provenance/splits,research-signals/recordings/{id}/features,evaluation-runs and model-versions.

**/ws/sessions/{session_id}?token=<access_token>** uses real session_id/attempt_id and stream_start metadata: modality=AUDIO,sample_rate=16000,channels=1,sample_width_bytes=2,encoding=pcm16. Binary frames are signed little-endian PCM16, followed by stream_stop. Backend persistence creates all predictions and quality records. See the exact route table in the feature map and wire captures in *-workflow.json.

## 7. Fake/useless options removed

No invented EEG/EMG readings, acoustic scores, recovery percentages, clinical success, streaks, charts, fictional model IDs, pseudo-landmarks or placeholder predictions. Unsupported games,telehealth,caregiver contact,scheduling,notifications,AI sensitivity,prescriptions,playback/export,device pairing and stock-patient camera images are omitted. No client-side prediction/quality creation. No locked-test mutation/evaluation control.

## 8. Responsive verification

**390×844 mobile,768×1024 tablet,1440×1000 desktop: passed.** Every size covers navigation,phrase,media preview,recording controls,feedback and history. Additional320px and200%text reflow checks pass with no page overflow. Screenshots are under work/verification-20260909. This does not claim testing on physical Safari/iOS/Android devices.

## 9. Accessibility verification

Semantic header/main/footer and navigation; skip link; visible keyboard focus; labeled controls;48–64px principal touch controls; textual Ready/Listening/Analyzing/Result/Next states; contrast and text-size settings; reduced-motion/system preference support. **0axe violations** across22saved E2E state scans and15populated-page scans. Keyboard,reflow and touch-target assertions pass. Axe incomplete checks are retained; formal conformance,screen-reader and patient usability studies remain external.

## 10. Backend exact result

**104 passed,0 failed,0 skipped;27 warnings.** Full pytest/JUnit evidence in backend.xml and backend.log. Includes the new imported-split-response regression and5camera tests. No broad backend redesign.

## 11. ML exact result

**36 passed,0 failed,0 skipped;10 warnings.** Full ML/data suite, including CUDA/CPU and4new evaluator regressions. Evidence: ml.xml and ml.log. Historical checkpoint is preserved.

## 12. Frontend exact results

Typecheck exit0. **9 unit tests passed in2files**,0 failed. ESLint exit0,0 errors,0 warnings. npm audit --audit-level=high exit0: **0 high,0 critical,2 moderate development advisories**. Production Vite 6.4.3 build exit0. Exact latest bundle sizes and elapsed build time are in build.log; these are bundle/build observations, not runtime performance claims.

## 13. Browser E2E exact result

**9 passed,0 failed,0 skipped,0 flaky** in the final Chromium run. Tests use real FastAPI and PostgreSQL, isolated verification_browser data and test-scoped media. Three silence workflows prove no invented result; one prerecorded validation-speech workflow executes the real ASR checkpoint, checks model/recording/attempt lineage, waits for final stream/lifecycle completion and verifies transcript persistence after reload. Denial,unlinked account,staff navigation and accessibility settings are also covered. Evidence: browser.json, browser.log, *-workflow.json.

## 14. PostgreSQL/Alembic

PostgreSQL **16.15**; **007_patient_participant_link** current head; **0 schema drift**.19 migration/schema checks pass, with the workflow group containing22checks. Fresh upgrade,006→007existing-row preservation,downgrade/upgrade,FK/uniqueness constraints and real WS persistence verified. Imported-data clone upgraded005→007without changing the original DB. Evidence: postgres-closeout.log,migration.log,local-migration.log.

## 15. Actual launched website and flow

**Website: http://127.0.0.1:5174/login**. **API: http://127.0.0.1:8000/docs**.

~~~powershell
cd D:\NeuroSpeech-Rehab
.\scripts\start-local.ps1
~~~

Local patient login: **patient@neurospeech.dev / NeuroSpeechDemo123!**. Clinician and researcher use the matching clinician@neurospeech.dev and researcher@neurospeech.dev accounts with the same local-development password.

The populated-site browser check passes15pages, including a real local session/exercise ready for practice, dataset metadata and recording pagination. The isolated live-server E2E proves capture→authenticated PCM→ASR→persisted transcript→reload. Local practice records are labeled not-a-study and have no dataset membership. No fake media was captured in the active imported-data clone.

## 16. Research metrics table

The complete **45-row evidence table** is [RESEARCH_METRICS.md](RESEARCH_METRICS.md); machine-readable version: work/verification-20260909/research-metrics.json. Every row records exact value,subsystem,population,split,count,version,method,date/run,computed interval,source,interpretation and limitation.

Principal observations: CER **0.13411536162582188** (13.411536%;1,795/13,384 character edits/reference characters); WER **0.6730641958967571** (67.306420%;1,017/1,511 word edits/reference words).168validation utterances,84 registered speaker IDs.95%bootstrap CER interval[0.12247722804358686,0.14498240777585333], WER[0.634049605997847,0.7090582379387208];2,000 participant-ID resamples,seed42.

SLR127 registry:89,401 recordings and1,068 registered IDs; train62,564/741 IDs,validation12,159/149 IDs,locked test14,678/178 IDs. Literal registered-ID overlap0; **196 normalized speaker-code cross-split collisions** require identity reconciliation. These are metadata counts; no locked-test audio was evaluated.

Historical run:2,000 steps;8,907.202220499996 seconds;3,323.1494140625 MiB peak allocated CUDA memory on RTX 3050 Laptop;checkpoint1,133,188,938bytes,94,409,393tensor parameters,vocabulary49. Historical CER/WER is qualified because its evaluator was flawed. New subset runtime10.918223300002865 seconds and597.2451171875 MiB allocated GPU memory are single-run observations,not API latency benchmarks. Synthetic EEG/EMG/synchronization values,software checks and audit counts are also tabulated with exact sources.

## 17. Metrics that cannot be claimed

Speaker-independent generalization is not established until normalized identity collisions are resolved. The new rates are a selected general-Tamil validation subset,not dysarthria accuracy or locked-test performance. Clinical efficacy,diagnosis,safety,EEG/EMG/camera medical accuracy and multimodal fusion accuracy are not established. Required evidence includes consented labeled dysarthric speech,identity-verified splits,paired calibrated modalities,representative camera ground truth and appropriate clinical studies. No software pass count may become clinical accuracy.

## 18. Unresolved software defects

No failing required gate or known unresolved defect remains in the delivered UI integration. The two moderate npm development advisories remain documented. Historical evaluator results and potential corpus identity aliasing are unresolved research-validity issues; corrected source does not retroactively validate the historical run. Combined camera/mic permissions,12secondASRsegment limit and ScriptProcessorNode portability remain explicit current limitations.

## 19. External hardware/clinical limitations

Physical sensor calibration,clock drift,real webcam/mic quality,patient usability,screen readers,real mobile browsers,production security/operations,and clinical/regulatory review remain external work. No trained fusion model exists. The software refuses unavailable predictions and does not manufacture physiological measurements.

## 20. Completion percentage

**100% of the ten delivered software-integration work packages** listed in [PROJECT_ROADMAP.md](PROJECT_ROADMAP.md), with the required verification gates and artifacts above. This is a transparent scope-checklist ratio. It is not a percentage of clinical readiness,research maturity,medical accuracy or test coverage. External work is explicitly listed and excluded.

