# Limitations — integrated research prototype, 2026-09-09

This application is verified for its implemented local software workflow. It is not clinically validated, certified for medical use, or evidence of therapeutic benefit. [RESEARCH_METRICS.md](RESEARCH_METRICS.md) records what was measured and what cannot be claimed.

## Research validity

- The existing Tamil checkpoint is a general OpenSLR127 speech baseline, not a dysarthria-specific model. Validation-subset WER is67.306420%; a visible transcript can be wrong and must not drive clinical decisions.
- New CER/WER covers168 utterances from84 registered speaker IDs, selected by fixed hashing before predictions. It is neither full-validation nor locked-test performance. Bootstrap intervals are conditional on this subset and its registered grouping.
- **196 normalized speaker codes cross partitions** after physical train/test prefixes are stripped. The importer may have aliased identities or reused code namespaces; the current evidence does not establish which. **Speaker-independent generalization is not established.** Corpus identity reconciliation and a newly versioned evaluation protocol are required; do not alter the frozen final-test split in place.
- Historical CER/WER used an all-zero mask, CTC-collapsed references, padded logits and potential truncation/reference mismatch. Source is corrected and regression-tested, but the historical checkpoint was not retrained and old metrics are not validated by those fixes.
- No locked final-test evaluation was run. No EEG/EMG/camera clinical accuracy, diagnosis accuracy, therapeutic efficacy, medical safety or regulatory validation is established. There is no trained multimodal fusion model; missing-model output is explicit.
- Imported EEG, EMG and speech collections are separate datasets, not an established synchronized clinical cohort. Registry participant counts represent importer metadata, not verified recruited patients.

## Hardware, browser and runtime

- Chromium tests use synthetic camera/silence and prerecorded validation audio only in an isolated test database. They verify capture/protocol/persistence, not physical webcam/microphone accuracy or calibrated latency.
- The camera UI is a local preview, with no fabricated landmark overlay. The backend camera endpoint has a real468-landmark smoke test; detection sensitivity and geometry error need labeled benchmarks.
- Physical EEG/EMG acquisition, electrode placement, artifacts and clock alignment need calibrated hardware. Synthetic signal fixtures validate numerical behavior only.
- ASR accepts16kHz mono segments up to12seconds. Speak short phrases and pause; longer continuous segments can produce an inference error. An attempt is capped at55seconds with bounded transport. Cold checkpoint loading can delay the first result.
- The current capture flow requests camera and microphone together. Missing/denied camera prevents this combined flow; no audio is sent after denial. Physical Safari/iOS/Android compatibility was not verified. The design is iOS-inspired, not an iOS native app.
- Web Audio capture uses ScriptProcessorNode, supported in tested Chromium but deprecated. A future AudioWorklet migration must preserve PCM/protocol tests.
- Playback/export, telehealth, games, schedules, prescriptions, notifications, hardware pairing and clinical scoring were omitted because complete verified UI workflows are unavailable. Research views expose supported reads, not unsupported editing tools.

## Accessibility and deployment

- Axe, keyboard/focus, touch-target, reduced-motion,200%text and mobile/tablet/desktop reflow checks pass. This is not formal WCAG certification or screen-reader/patient usability validation.
- The site is a local HTTP development deployment with clearly named development accounts. Production TLS/WSS, secrets, retention/consent operations, monitoring, recovery, load tests and security review remain target-environment work.
- The npm high gate passes with0high/0 critical and2moderate development-tool advisories. No comprehensive application or Python dependency security certification is claimed.
- Source has rollback snapshots and file-hash evidence; no Git repository/release tag existed at intake. Preserve source, checkpoint, tokenizer, evaluation manifests and permitted provenance for reproduction.
- The original database is preserved and the app uses a migrated clone. The local practice profile is explicitly not a study participant; its sessions must not enter paper outcome populations.

External evidence needed: identity-verified consented dysarthric speech labels, calibrated paired multimodal recordings, representative camera ground truth, prespecified clinical endpoints, ethics approval, independent evaluation and appropriate clinical/regulatory review. None can be inferred from test counts.

