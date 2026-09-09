# Stitch integration audit — 2026-09-09

Source: `D:\stitch_neurospeech_rehab_platform.zip`. The archive has 16 directory entries (one root and 15 content directories), 12 HTML files, 12 PNGs and two design specifications. Complete entry sizes/hash are in `work/stitch-archive-audit.json`; all HTML text, controls, links and image references are indexed in `work/stitch-content-audit.json`. These are design references, not application code or clinical evidence.

Rollback snapshot: `work/backups/frontend-before-stitch-20260909-051650/frontend.zip` (38 source/configuration files, excluding dependencies/build/test output), with `manifest.json` SHA-256 for each file. Restore into a separate directory first, then replace frontend source/configuration; run `npm ci` to restore dependencies. The original ZIP is unchanged. No Git repository existed at intake.

## Screen and component decisions

| Stitch source | Retained/adapted | Actual capability | Omitted and reason |
|---|---|---|---|
| patient_home_dashboard, patient_home, neurospeech_multimodal_speech_rehabilitation_flow | Luminous canvas, rounded practice card, pill navigation, saved session list | Patient profile and persisted sessions | Named fictional patient, day streak, daily goals, estimated treatment duration, acoustic clarity, caregiver contact, ambient sound, games: no supporting records/workflow |
| live_speech_therapy_studio_1, live_speech_therapy_studio_2 | Ready/Listening/Analyzing/Result/Next sequence, large target area, camera mirror, recording controls, feedback surface | Exercise configuration/description, browser media, audio stream, persisted quality/predictions, attempt/session completion | Simulation buttons, phoneme percentages, fake landmarks, 60 FPS/48kHz claims, neural orb game, automatic clinical cues, recovery points, model playback: unsupported |
| rehabilitation_progress_insights_1, rehabilitation_progress_insights_2 | Soft summary surfaces and chronological history | Counts of saved sessions and saved analyses | Recovery percentage, fabricated plots, clinical milestones, diagnosis scores, efficacy statements: no labeled evidence |
| session_history_audio_archive | Session rows and recording metadata | Session and recording API readback | Playback/export/spectrograms absent a supported media-serving API |
| patient_settings_accessibility | Reading size, contrast and reduced motion controls | Device-local preferences with persistence; account/enrollment lookup | Notifications, clinical sensitivity, language translation, device pairing and scheduling absent implemented workflows |
| clinician_research_workspace_1, clinician_research_workspace_2 | Consistent quiet research workspace, metadata and details disclosure | Authorized patients/participants, sessions, recordings/features/quality, annotations, datasets/provenance/splits, evaluations, model versions | Telehealth, dossier export, medical interpretation, adjustable model sensitivity, push prescription, invented EEG/EMG/kinematics values |
| neurospeech_rehab_logo | Wave/speech motif adapted as a native icon | Brand/navigation only | No AI model/version badge |
| warm_and_dignified_portrait… | Omitted | Camera shows only granted live preview | Stock image would misrepresent the actual camera/patient |
| luminous_neural_arc, serene_neurocognitive | Blue/violet palette, frosted surfaces, 24–40px corners, large touch controls, gentle icon transitions | Presentation and accessible local preferences | Medical claims and pseudo-physiological animation omitted |

## Contracts retained

All paths below are relative to the backend origin; every applicable call uses the access token and backend authorization.

| UI operation | API contract |
|---|---|
| Login/account | POST `/api/v1/auth/login`; GET `/api/v1/auth/me` |
| Enrollment/patients/participants | GET `/api/v1/participants/me`, `/api/v1/participants/patients`, `/api/v1/participants/research-participants` |
| Session create/list/open/finish | GET/POST `/api/v1/sessions/sessions`; PATCH `/{id}` |
| Exercises/assignments | GET `/api/v1/exercises/exercises`; GET/POST `/api/v1/session-exercises/session-exercises`; PATCH `/{id}` |
| Attempts | GET/POST `/api/v1/attempts/attempts`; PATCH `/{id}` |
| Results | GET `/api/v1/predictions/predictions?attempt_id=…`; GET `/api/v1/recordings/recordings?session_id=…`; GET `/api/v1/signal-quality/signal-quality/{recording_id}` |
| Research | GET `/api/v1/annotations/annotations`, `/api/v1/datasets/datasets`, `/api/v1/datasets/datasets/{id}/provenance`, `/api/v1/datasets/datasets/{id}/splits`, `/api/v1/evaluation-runs/evaluation-runs`, `/api/v1/model-versions/model-versions`, `/api/v1/research-signals/recordings/{id}/features` |

WebSocket: `/ws/sessions/{session_id}?token=<access_token>`. Real backend session and attempt IDs. `stream_start` includes `type`, `session_id`, `attempt_id`, `modality: AUDIO`, `sample_rate: 16000`, `channels: 1`, `sample_width_bytes: 2`, `encoding: pcm16`. Binary frames are signed little-endian PCM16; `stream_stop` terminates capture. UI loads persisted prediction records; it never creates prediction/quality records. Browser lifecycle timestamps reflect actual actions and are persisted through the existing API. No scores or timestamps are generated to fill absent result data.

Research biosignal ingestion/synchronization/fusion endpoints remain available through the authenticated API. The UI exposes stored features and quality; it does not invent a live hardware connection or expose an untrained fusion control. Final-test mutation/evaluation controls are omitted.
