# NeuroSpeech Rehab — Risk Register

## Purpose

Document risks for the NeuroSpeech Rehab research prototype, their causes, impacts, mitigations, and verification methods.

## Risk Register

| Risk ID | Risk | Cause | Potential Impact | Mitigation | Verification Method | Status |
|---------|------|-------|------------------|------------|---------------------|--------|
| R-01 | Incorrect signal interpretation | Poor calibration, noise, artifact | Wrong patient feedback, research data corruption | Signal quality gate with `SIGNAL_QUALITY_INSUFFICIENT` state; clinician review before training | Code review + test suite | MITIGATED |
| R-02 | Poor signal quality | Sensor placement, environment, hardware faults | Session aborted, no prediction | Per-modality quality assessment; graceful degradation | Schema + API tests | MITIGATED |
| R-03 | Sensor disconnect during session | Network/WiFi drop, USB disconnect, battery | Data loss, incomplete session | WebSocket disconnect handling; session recovery; audit logging | Architecture review | MITIGATED |
| R-04 | Timestamp desynchronization | Clock drift, network latency, buffering | Invalid multimodal analysis, incorrect epoching | Cross-modal synchronization validation; `synchronization_status` in signal quality | Schema + test suite | MITIGATED |
| R-05 | Data leakage across train/validation/test | Human error, software bug, participant reassignment | Overestimated model performance, invalid research conclusions | Participant-level split enforcement; locked final test set; audit logging | `tests/test_dataset_splits.py` | MITIGATED |
| R-06 | Unauthorized patient access | Auth bypass, weak passwords, stolen tokens | Privacy violation, regulatory breach | JWT auth, RBAC, HTTPS/WSS, rate limiting, audit logging | `tests/test_auth_rbac.py` | MITIGATED |
| R-07 | Unauthorized dataset/model manipulation | Researcher/admin privilege misuse | Tampered evaluation, corrupted research record | RBAC, audit logging, immutable audit trail | `tests/test_audit_logging.py` | MITIGATED |
| R-08 | Incorrect AI prediction | Model bug, bad features, domain shift | Wrong feedback, patient confusion, invalid research output | Confidence/uncertainty outputs; signal quality gate; clinician review | Architecture review | DEFERRED |
| R-09 | Missing data | Dropped packets, failed upload, disk full | Incomplete records, failed evaluation | Recording metadata validation; processing status tracking; audit logging | Schema review | MITIGATED |
| R-10 | Dataset bias | Non-representative participant pool, collection bias | Poor generalization, invalid conclusions | Participant metadata; demographic summary; transparent reporting | Manual review during data collection | DEFERRED |
| R-11 | Patient usability problems | Complex UI, small buttons, high cognitive load | Patient unable to use system | Large buttons, high contrast, minimal text, accessible focus states | Manual usability review | DEFERRED |
| R-12 | Software failure during session | Crash, OOM, deadlock | Session data loss, patient frustration | Async architecture; session persistence; graceful shutdown; audit logging | Architecture review | MITIGATED |
| R-13 | Fabricated clinical claims | Overstatement in UI or docs | Regulatory, ethical, reputational harm | Explicit "research prototype" labeling; no fake metrics; review process | Manual review | MITIGATED |
| R-14 | LLM-generated medical measurements | Future AI feature misused | Invalid data, patient harm | Policy: no LLM for medical measurements; schema validation | Policy + review | MITIGATED |
| R-15 | Password/token exposure | Logs, error messages, client storage | Account takeover | No plaintext logging; secure token storage; HttpOnly cookies in production | Code review | MITIGATED |

## Notes

- Phase 2 addresses risks related to software foundation: auth, data integrity, synchronization, leakage, and usability shells.
- Risks related to AI accuracy (R-08), dataset bias (R-10), and full usability testing (R-11) are deferred to later phases where models and full UI exist.

## Current verification update (2026-09-08)

The final closeout passed 103 backend tests, 32 ML tests, 5 camera tests, 22 disposable-PostgreSQL workflow checks, 19 migration/constraint checks, and the authenticated Chromium browser workflow with zero failures or software skips. Audio, sensor, synchronization, final-test isolation, request-size, ownership, and privilege-escalation mitigations are covered by automated tests. The remaining high-impact risks are external: calibrated hardware has not been verified here, no dysarthria-specific multimodal fusion model is registered, and no clinical or efficacy claim is supported.
