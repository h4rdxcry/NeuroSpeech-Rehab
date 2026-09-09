"""Build the paper evidence table from measured artifacts, without rerunning evaluation."""
import json
import xml.etree.ElementTree as ET
from pathlib import Path
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT/'work/verification-20260909'
RUN = 'asr-validation-20260909T054856Z'
read = lambda path: json.loads(path.read_text(encoding='utf-8-sig'))
m = read(OUT/RUN/'metrics.json')
training = read(ROOT/'ml_training/outputs/baseline/training_config.json')
checkpoint = read(OUT/'checkpoint.json')
browser = read(OUT/'browser.json')['stats']
signal = read(OUT/'signal-fixtures.json')
audit = read(OUT/'npm-audit.json')['metadata']['vulnerabilities']
live = read(OUT/'live-site.json')
rows = []

def add(name, value, subsystem, population, split, count, model, method, run, ci, source, interpretation, limitation):
    rows.append(dict(metric=name, exact_value=value, subsystem=subsystem, population=population, split=split, sample_or_participant_count=count, model_or_version=model, method=method, run=run, confidence_interval=ci, source=source, interpretation=interpretation, limitation=limitation))

asr_source = f'work/verification-20260909/{RUN}/metrics.json; predictions.jsonl; manifest.json'
asr_limit = 'Descriptive validation subset only; checkpoint selected on validation historically. 196 normalized speaker-code cross-split collisions require identity reconciliation. The bootstrap groups registered pseudonyms, not verified unique people. General Tamil speech, not a dysarthria population; no clinical interpretation.'
for metric in ['cer','wer']:
    numerator = m['character_edits' if metric == 'cer' else 'word_edits']
    denominator = m['reference_characters' if metric == 'cer' else 'reference_words']
    add('Tamil ASR validation-subset '+metric.upper(), f'{m[metric]!r} = {m[metric]*100:.6f}% ({numerator}/{denominator})', 'ML performance', 'IISc-MILE / OpenSLR127, deterministic two eligible utterances per registered validation pseudonym', 'validation subset; NOT locked test', '168 utterances / 84 registered speaker IDs; 1,078.22225 audio seconds', 'facebook/wav2vec2-base; best-checkpoint.pt; SHA256 '+checkpoint['sha256'], m['method'], m['run_id'], f"95% participant-ID bootstrap interval {m[metric+'_ci95']}; 2,000 resamples, seed 42", asr_source, 'Observed error rate; lower is better. Do not convert to clinical accuracy.', asr_limit)
add('Validation selection population', '12159 queried; 9382 eligible; 168 evaluated; 2777 excluded before selection', 'Dataset/evaluation', 'Registered validation records with transcript annotations', 'validation', '149 registered validation IDs; 84 eligible/evaluated IDs', 'split v1, seed 42', 'Header inspection for 16kHz mono, 0<duration<=12s, existing reference/file, no physical test path; fixed hash ordering before predictions', m['run_id'], 'Not computed', asr_source, 'Makes the evaluated subset denominator explicit.', '65 registered validation IDs were not represented. WAV headers on allowed validation paths only; official physical test paths excluded.')
for s in m['split_metadata']:
    add('SLR127 registered '+s['split_type']+' size', f"{s['recordings']} recordings; {s['participants']} registered IDs; all_locked={s['all_locked']}", 'Dataset registry', 'Imported SLR127 records and split metadata', s['split_type'], f"{s['participants']} registered IDs", 'split v1, seed42', 'Read-only SQL counts, joins by registered participant identity', m['run_id'], 'Not applicable (enumeration)', asr_source, 'Registry partition sizes, totaling 89,401 recordings and 1,068 registered IDs.', 'These are importer identities, not independently verified unique people. Only metadata was read for locked test.')
add('Registered-ID overlap across partitions', '0', 'Dataset integrity', 'SLR127 dataset_splits', 'train/validation/test metadata', '1068 registered IDs', 'split v1', 'Group participant_id; count distinct split_type > 1', m['run_id'], 'Not applicable', asr_source, 'Split-qualified IDs are disjoint.', 'Does NOT prove speaker independence: see normalized code collisions below.')
collisions = read(OUT/'speaker-code-collisions.json')
add('Normalized speaker-code cross-split collisions', str(len(collisions)), 'Dataset integrity', 'SLR127 participant identifiers after removing SLR127-TRAIN-/SLR127-TEST-', 'metadata across train/validation/test', '196 distinct normalized codes', 'existing split v1', "GROUP BY regexp_replace(participant_id, '^SLR127-(TRAIN|TEST)-', '') HAVING count(DISTINCT split_type)>1", '2026-09-09 closeout', 'Not applicable', 'work/verification-20260909/speaker-code-collisions.json', 'Potential aliasing/leakage signal requiring corpus identity reconciliation.', 'Collision is not confirmed same-person leakage; cannot claim an independent speaker-held-out estimate. Frozen splits were not edited.')
for dataset in read(OUT/'live-datasets.json'):
    add('Imported registry size: '+dataset['name'], f"{dataset['recording_count']} recordings; {dataset['participant_count']} participant records", 'Dataset registry', dataset['name'], 'Registry totals; not evaluation split', f"{dataset['recording_count']} recordings", 'dataset '+dataset['id'], 'Authenticated GET /api/v1/datasets/datasets', '2026-09-09 local clone', 'Not applicable', 'work/verification-20260909/live-datasets.json', 'Existing imported metadata counts.', 'No accuracy or paired multimodal population is established. A zero participant count means no count recorded by this importer, not zero speakers.')
add('Legacy training validation CER / WER', f"{training['best_cer']!r} / {training['best_wer']!r}", 'Historical ML log (not recommended paper performance)', 'Historical configured train=62294, validation=12066', 'historical validation', 'Exact contributing predictions not retained', 'same checkpoint; MLflow 4b1c45b3ba534928affb6c46b9854753', 'Legacy evaluator CTC-collapsed labels, all-zero mask and padded logits; corrected source now has regression tests', training['completed_at'], 'Not computed', 'ml_training/outputs/baseline/training_config.json; work/verification-20260909/checkpoint.json', 'Preserves historical provenance only.', 'Not directly comparable to corrected inference audit; not a valid independent accuracy claim; checkpoint not retrained.')
for name, value, method in [
    ('Training steps', training['final_global_step'], 'Recorded trainer global step'),
    ('Training elapsed seconds', training['elapsed_seconds'], 'Recorded training timer; one historical run'),
    ('Training peak allocated GPU MiB', training['peak_gpu_memory_mb'], 'Trainer torch.cuda.max_memory_allocated()/1024**2; metadata key says mb but units are MiB'),
    ('Checkpoint tensor parameter count', checkpoint['parameter_count'], 'Sum of saved model-state tensor elements'),
    ('Checkpoint bytes', checkpoint['bytes'], 'Filesystem size'),
    ('Tokenizer vocabulary size', checkpoint['vocab_size'], 'Stored model/tokenizer metadata')]:
    add(name, repr(value), 'Training/model reproducibility', 'Existing general Tamil ASR baseline run', 'train + historical validation', 'configured train 62294 / validation 12066; batch2, accumulation4, effective8', 'facebook/wav2vec2-base; RTX3050 Laptop; torch2.3.1+cu121', method, training['completed_at'], 'Not computed', 'ml_training/outputs/baseline/training_config.json; work/verification-20260909/checkpoint.json', 'Describes this checkpoint/run, not clinical performance.', 'Single recorded run; no repeatability interval or device-wide memory benchmark.')
for name, value in [('Validation inference-loop wall seconds',m['evaluation_wall_seconds']),('Validation peak allocated GPU MiB',m['peak_allocated_gpu_mib']),('Empty transcripts in validation subset',m['empty_predictions'])]:
    add(name, repr(value), 'Measured evaluation runtime', 'Same 168-utterance validation subset', 'validation subset', '168 utterances / 84 registered IDs', 'RTX3050 Laptop GPU; same checkpoint', 'Single run after model loading; loop includes file reads, inference, decoding, edit distances and artifact writes; CUDA synchronized', m['run_id'], 'Not computed', asr_source, 'Reproducible local run observation.', 'Not HTTP/WS latency, throughput benchmark, cold-start measurement or clinical validity. Nonempty transcripts can be wrong.')
for subsystem, filename in [('Backend','backend.xml'),('ML/data','ml.xml')]:
    suite = ET.parse(OUT/filename).getroot().find('testsuite')
    add(subsystem+' automated tests', f"{suite.get('tests')} passed, {suite.get('failures')} failures, {suite.get('errors')} errors, {suite.get('skipped')} skipped", 'Software verification', 'Full repository '+subsystem+' suite', 'test fixtures; not held-out ML test', suite.get('tests')+' test cases', 'current source; see source-manifest.json', 'pytest with JUnit evidence', suite.get('timestamp'), 'Not applicable', 'work/verification-20260909/'+filename, 'Automated software checks passed.', 'Test pass rates are not clinical accuracy; no code coverage percentage was measured.')
add('Frontend verification', '9 unit tests; typecheck=0, lint=0, build=0 exit codes; lint 0 errors/0 warnings', 'Software verification', 'React/TypeScript frontend', 'unit fixtures', '9 tests in 2 files', 'Vite6.4.3; React18; current package-lock', 'npm typecheck/test/lint/build', '2026-09-09 closeout', 'Not applicable', 'work/verification-20260909/frontend-checks.json; frontend-tests.json; lint.log; build.log', 'Compile, unit, lint and bundle gates pass.', 'Does not establish therapeutic benefit or exhaustive browser compatibility.')
add('Chromium patient/staff E2E', f"{browser['expected']} passed, {browser['unexpected']} failed, {browser['skipped']} skipped, {browser['flaky']} flaky", 'Software integration', 'Real PostgreSQL and HTTP/WS; isolated verification_browser fixtures', 'Test-only media injection', '3 responsive workflows + 6 other scenarios', 'Chromium / Playwright1.63.0; actual ASR checkpoint for speech scenario', 'Login, lifecycle, camera/mic, wire PCM, real ASR, persistence, silence, denial, RBAC and navigation', browser['startTime'], 'Not applicable', 'work/verification-20260909/browser.json; *-workflow.json', 'End-to-end implemented flow works.', 'Synthetic camera and prerecorded audio test the browser plumbing, not physical hardware accuracy.')
add('Populated local website checks', f"{len(live['pages'])} pages passed; {len(live['failures'])} runtime/API failures", 'Live integration', 'neurospeech_stitch clone with imported corpus metadata; local practice account', 'Not a study', '15 page/role checks', 'http://127.0.0.1:5174 + API8000', 'Real browser login/navigation, dataset details, record pagination, exercise assignment; no synthetic media', live['checkedAt'], 'Not applicable', 'work/verification-20260909/live-site.json', 'Website loads with existing research data.', 'No real-person camera/mic capture performed.')
axe_files = list(OUT.glob('axe-*.json'))
violations = sum(len(read(p)['violations']) for p in axe_files) + sum(len(p['violations']) for p in live['pages'])
add('Automated accessibility', f'{violations} violations across {len(axe_files)} E2E page/state scans and {len(live["pages"])} populated-page scans', 'Accessibility verification', 'Patient, clinician and research pages', 'Browser test scenarios', f'{len(axe_files)+len(live["pages"])} scans', 'axe-core / Playwright, WCAG2 A/AA,2.1AA,2.2AA tags', 'Automated axe + keyboard/focus, reduced motion, touch targets, 200% text and 320px reflow assertions', '2026-09-09 closeout', 'Not applicable', 'work/verification-20260909/axe-*.json; live-site.json; browser.json', 'No automated violations in scanned states.', 'Not a formal accessibility conformance certification; screen-reader and patient usability studies not performed; axe incomplete checks retained.')
add('PostgreSQL migration/schema/workflow', '19 migration/schema checks; 22 workflow checks; 0 failed; 0 skipped; metadata drift=0', 'Database verification', 'Disposable PostgreSQL plus preserved imported-data clone', 'Test databases', '19 checks including workflow group; workflow group has22 assertions', 'PostgreSQL16.15; Alembic007_patient_participant_link', 'Fresh upgrade,006->007 preserving data,downgrade/upgrade,alembic check,FK/unique constraints,real protocol and persistence', '2026-09-09 closeout', 'Not applicable', 'work/verification-20260909/postgres-closeout.log; migration.log; local-migration.log', 'Schema head and real PostgreSQL workflow verified.', '19 and22 are nested checks, not 41 independent tests; original database remained at its prior revision, local clone migrated.')
add('Frontend npm security audit', json.dumps(audit,sort_keys=True), 'Dependency audit', 'Installed frontend dependency tree', 'Runtime + development dependencies', '440 dependency inventory total (npm audit metadata)', 'package-lock.json', 'npm audit --audit-level=high --json; exit0', '2026-09-09 closeout', 'Not applicable', 'work/verification-20260909/npm-audit.json', 'No high/critical advisory at the recorded audit.', 'Two moderate development-tool advisories remain (Vitest and mocker); not a comprehensive application security audit.')
add('Camera landmark smoke test', '5 camera tests passed;468 landmarks on real face fixture;NO_FACE without fabricated landmarks', 'Software/camera verification', 'Public-domain astronaut face image plus blank/invalid frames', 'Test fixtures; not a labeled clinical benchmark', '5 test cases;1 positive face frame', 'MediaPipe0.10.14; OpenCV4.9.0.80', 'FaceMesh static-image inference and geometry/invalid-input assertions', '2026-09-09 backend run', 'Not computed', 'backend/tests/test_camera.py; work/verification-20260909/backend.xml', 'Real library inference and no-face behavior execute.', 'No face-detection sensitivity/specificity, landmark error, real webcam calibration or clinical accuracy established.')
for modality, channel in [('eeg','Cz'),('emg','masseter')]:
    for feature,value in signal[modality]['features'][channel].items():
        add('Synthetic '+modality.upper()+' '+feature, repr(value), 'Signal-processing verification', json.dumps(signal[modality+'_input']), 'Mathematical fixture; no people', str(signal[modality+'_input']['samples'])+' samples,1 channel', signal[modality]['pipeline_version'], 'Butterworth4 zero-phase bandpass then implemented feature function; see measure_signal_fixtures.py', signal['measured_at'], 'Not computed', 'work/verification-20260909/signal-fixtures.json', 'Numerical output for a known synthetic waveform.', 'Edge/filter effects apply. Not EEG/EMG accuracy on labeled physiological data.')
add('Synthetic synchronization nearest-sample error', repr(signal['sync']['max_nearest_sample_error_ms']['EMG'])+' ms', 'Signal-processing verification', 'Two three-timestamp arrays offset by1ms on one declared clock', 'Synthetic fixture', '3 timestamps per modality', 'research-signals-v1', 'Nearest-neighbor alignment', signal['measured_at'], 'Not computed', 'work/verification-20260909/signal-fixtures.json', 'Implemented alignment produces the expected fixture offset.', 'Does not establish physical sensor clock accuracy, drift or end-to-end latency.')

payload = {'generated_at':datetime.now(timezone.utc).isoformat(), 'metrics':rows}
(OUT/'research-metrics.json').write_text(json.dumps(payload,indent=2,ensure_ascii=False),encoding='utf-8')
intro = '''# Research metrics — measured evidence, 2026-09-09

The current integrated application is a research software prototype. This document separates **ML error rates**, **software verification**, **dataset integrity**, and **clinical validation**. A software test pass is never clinical accuracy. Exact machine-readable values and provenance are in [research-metrics.json](../work/verification-20260909/research-metrics.json).

## Findings that affect paper claims

The existing checkpoint produced **CER 13.411536%** and **WER 67.306420%** on a fixed subset of **168 validation utterances / 84 registered speaker IDs**. The 95% bootstrap intervals are **12.247723–14.498241% CER** and **63.404961–70.905824% WER**, with 2,000 participant-ID resamples and seed42. These describe the selected validation subset, not a locked-test or clinical population. High WER means many words remain incorrect even where character error is lower; do not advertise this as reliable clinical transcription.

The registered participant IDs have zero literal overlap between partitions. A stricter audit found **196 normalized speaker codes in multiple partitions** after stripping the physical train/test prefix from imported IDs. This is an unresolved identity/aliasing issue, not proof that each collision is the same person. Until authoritative corpus identities are reconciled, **speaker-independent generalization is not established**. The confidence intervals cluster by registered IDs and do not resolve that uncertainty. Preserve the current locked split; do not repair it in place and reuse it for tuning. A future study needs a newly versioned, identity-verified partition and a predeclared final evaluation.

The legacy training metrics used an all-zero attention mask, decoded reference labels with CTC collapse, included padded logits, and could compare cropped audio to a full reference. Those code paths were corrected with four regression tests. The historical checkpoint and its training log were preserved; no retraining was done. Historical CER/WER must remain labeled as historical and methodologically noncomparable.

**No locked final-test evaluation was run or unlocked.** Reading locked partition counts did not open its audio. The validation script also excluded physical corpus paths containing a `test` component. The failed initial validation selection produced no performance result and is not used below.

## Exact evidence table

Every row contains the value, subsystem/population/split/count, model/version, method/run, confidence interval if computed, source, interpretation and limitation. Paths are relative to the project root. Repeated metadata is intentional so individual rows retain their qualification when copied into a paper worksheet.

| Metric and exact value | Subsystem; population; split; N | Model/version | Method; date/run; confidence interval | Evidence source | Interpretation and limitation |
|---|---|---|---|---|---|
'''
def esc(value): return str(value).replace('|','\\|').replace('\n',' ')
lines=[]
for r in rows:
    cells=[r['metric']+' **'+r['exact_value']+'**', f"{r['subsystem']}; {r['population']}; {r['split']}; {r['sample_or_participant_count']}",r['model_or_version'], f"{r['method']}; {r['run']}; CI: {r['confidence_interval']}",r['source'],r['interpretation']+' '+r['limitation']]
    lines.append('| '+' | '.join(esc(c) for c in cells)+' |')
ending='''

## Claims not established and required evidence

- Dysarthric Tamil ASR performance: requires consented, representative labeled dysarthric speech, verified participant identities, severity and subgroup annotations, and a prospective held-out protocol.
- Final-test CER/WER: not run. Requires a documented deliberate final evaluation, immutable model and code, locked population, leakage resolution and an evaluation ledger. Do not infer it from validation.
- EEG/EMG clinical classification, sensor accuracy, artifact detection sensitivity/specificity: requires calibrated physical acquisition and expert-labeled ground truth with matched outcomes.
- Camera detection accuracy or landmark error: requires a labeled multi-person image/video benchmark with visibility, pose, skin-tone and impairment coverage; report sensitivity, failure rates and landmark distances.
- Multimodal prediction accuracy: no trained/registered fusion model. Requires synchronized paired modalities, validated labels, training plus independent evaluation. Current missing-model behavior is deliberate.
- Therapeutic efficacy, diagnosis accuracy, clinical safety and medical-device validation: not established; require ethics approval, a clinical study with appropriate controls and prespecified outcome measures, and applicable external review.
- Production API latency percentiles, concurrent throughput, uptime, device-wide memory, hardware clock accuracy and energy use: not measured. The single evaluation-loop timer and allocated GPU memory are not substitutes; use a repeatable deployment benchmark and calibrated hardware.
- Accessibility for the intended patient population: automated checks and keyboard/reflow checks passed; assistive-technology and patient usability assessment remains needed.

## Reproduction without touching locked test

From the project root, use the preserved local environment and database clone:

```powershell
$env:DATABASE_URL='postgresql+asyncpg://verification:verification_test_only@127.0.0.1:55432/neurospeech_stitch'
$env:HF_HUB_OFFLINE='1'
backend/.venv-ml/Scripts/python.exe scripts/evaluate_validation.py
backend/.venv-ml/Scripts/python.exe scripts/measure_signal_fixtures.py
backend/.venv-ml/Scripts/python.exe scripts/build_research_metrics.py
```

`evaluate_validation.py` creates a new timestamped validation-only artifact directory without registering predictions or changing the database. The report builder reads the specifically named frozen run above; it does not automatically substitute a more favorable later run. Checkpoint SHA256: `17e15394ae0e58a95664b40f6ff606d5de44674c791114005af36271f4afb991`. Evaluation manifest SHA256: `e30d1e29daa1a265a37c8ed30c0762c1e878a584d3c2a742cd15e64f8ef32905`. Training manifest hash is recorded separately in the original training configuration. No Git revision existed; use the delivered file hash manifest for source identity.
'''
(ROOT/'docs/RESEARCH_METRICS.md').write_text(intro+'\n'.join(lines)+ending,encoding='utf-8')
print(f'Wrote {len(rows)} evidence rows.')
