# Project roadmap — Stitch integration closeout

## Delivered software integration work packages

- [x] Full Stitch archive/content audit and backend capability map.
- [x] Frontend rollback snapshot and original database dump; migrated active clone.
- [x] iOS-inspired patient login/profile, session/exercise/attempt lifecycle, media capture, authenticated PCM WebSocket, persisted results and history.
- [x] Authorized clinician/research navigation, participants, sessions, recordings/quality/predictions/features, annotations, datasets/provenance/splits, evaluations and models.
- [x] Explicit empty, permission-denied and unavailable states; unsupported options and invented scores/sensors omitted.
- [x] Responsive mobile/tablet/desktop, semantic landmarks, focus/touch targets, reading/contrast/motion preferences and accessibility checks.
- [x] Narrow imported-dataset response fix with regression test and hash-verified local checkpoint registration.
- [x] Backend104,ML 36,frontend 9,Chromium 9 tests,15 populated-page checks and PostgreSQL/Alembic verification.
- [x] Historical evaluator corrected; existing checkpoint preserved; validation-only measured audit with intervals and identity limitations.
- [x] Startup instructions, feature map, verification, traceability, limitations and evidence-only research metrics.

## External research and operational work

- [ ] Reconcile196 normalized speaker-code collisions using authoritative corpus identities; establish a newly versioned identity-safe evaluation protocol without tuning against locked final-test data.
- [ ] Retrain/evaluate under the corrected method when justified by a prespecified study; measure dysarthria-specific performance on suitable labeled data.
- [ ] Train/register and independently evaluate multimodal fusion on synchronized paired modalities and validated labels.
- [ ] Validate physical EEG/EMG/webcam/microphone acquisition, calibration, artifacts and clocks.
- [ ] Test real Safari/iOS/Android devices and screen readers; conduct patient usability studies. Consider AudioWorklet and microphone-only capture as separately tested enhancements.
- [ ] Harden target deployment: TLS/WSS,secrets,security review,dependency maintenance,consent/retention,monitoring,recovery and load tests.

## Clinical validation

- [ ] Obtain ethics approval and define population/protocol.
- [ ] Recruit participants and collect calibrated labeled outcomes with appropriate controls.
- [ ] Execute independent evaluation, report uncertainty/subgroups/failures, assess safety and applicable regulatory obligations.

Completion is **100% of the ten delivered software-integration work packages**, conditional on their linked verification gates. This is a scope-checklist ratio, not code coverage, medical accuracy, research maturity or clinical completion. External milestones remain open.

