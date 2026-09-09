# NeuroSpeech Rehab — Validation Plan

## 1. Purpose

Define the research validation strategy for NeuroSpeech Rehab to ensure reproducible, statistically sound evaluation of multimodal speech rehabilitation AI models.

## 2. Core Principles

- **Participant-level splitting**: No same-participant data leakage across train/validation/test.
- **Isolated final test set**: Never tuned against; only evaluated after final model selection.
- **Ablation support**: Systematic comparison of modality combinations.
- **Transparency**: All metrics include confidence intervals and failure analysis.
- **No fabricated results**: Only measured values displayed; no invented accuracy numbers.

## 3. Dataset Splitting Strategy

### 3.1 Levels
1. **Training Data**: Used for model training and hyperparameter tuning.
2. **Validation Data**: Used for model selection and early stopping during training.
3. **Final Test Data**: Used once for final evaluation after all training and tuning is complete. Locked until final evaluation.

### 3.2 Participant-Level Isolation
- Split assignment is **participant-level**, not recording-level or window-level.
- If participant `SUBJ-001` is assigned to training, **all** their recordings belong to training.
- Cross-participant generalization is the primary research question; participant-level split enforces this.

### 3.3 Split Ratios
Common ratios (adjustable per study protocol):
- 60% train / 20% validation / 20% test
- 70% train / 15% validation / 15% test
- Stratified by exercise type and difficulty where possible

### 3.4 Split Storage
- `datasets.split_definition`: JSON mapping participant IDs to partitions.
- `sessions.dataset_split`: Denormalized partition label per session.
- `datasets.is_final_test = true`: Marks isolated test set.
- `datasets.is_locked = true`: Prevents new samples from being added.

### 3.5 Leakage Prevention
- Training scripts receive only training participant IDs.
- Validation scripts receive only validation participant IDs.
- Test scripts receive only test participant IDs.
- Pipeline validation checks that no participant ID appears in multiple partitions.
- Audit log records all dataset access and partition assignments.

## 4. Evaluation Metrics

### 4.1 Classification Metrics (where applicable)
- Accuracy
- Precision (macro, weighted)
- Recall / Sensitivity (macro, weighted)
- F1 Score (macro, weighted)
- Specificity (per class, macro)
- AUROC (where probabilistic outputs exist)
- Confusion Matrix (normalized and raw counts)

### 4.2 Regression / Scoring Metrics (where applicable)
- Mean Absolute Error (MAE)
- Mean Squared Error (MSE)
- R² Score
- Concordance Correlation Coefficient

### 4.3 Operational Metrics
- Latency: mean, median, P95, P99 (end-to-end and per-modality)
- Throughput: predictions per second
- Signal rejection rate: percentage of predictions returning `SIGNAL_QUALITY_INSUFFICIENT`

### 4.4 Statistical Rigor
- **Confidence Intervals**: 95% CIs for all primary metrics (bootstrapped).
- **Multiple Comparison Correction**: Bonferroni or Holm-Bonferroni when comparing >2 models.
- **Effect Sizes**: Cohen's d or similar for paired comparisons.
- **Significance Testing**: Paired t-tests or Wilcoxon signed-rank tests for model comparisons at participant level.

## 5. Evaluation Dimensions

### 5.1 Overall Performance
- Aggregated across all participants and exercises.

### 5.2 Per-Participant Performance
- Individual participant metrics to assess generalization.
- Identify outlier participants.
- Report mean and std of per-participant accuracy.

### 5.3 Per-Exercise Performance
- Breakdown by exercise type (lip rounding, vowel sustain, etc.).
- Identify exercises where model underperforms.

### 5.4 Modality Ablation
Systematic evaluation of:
- EEG only
- EMG only
- Vision only
- Audio only
- EEG + EMG
- EEG + Vision
- EMG + Vision
- Audio + Vision
- EEG + EMG + Vision
- Full multimodal (EEG + EMG + Vision + Audio)

Each ablation variant must be:
- Trained with identical protocol where possible
- Evaluated on same validation and test sets
- Compared with statistical tests

### 5.5 Failure Case Analysis
- Samples where prediction confidence < threshold.
- Samples with `SIGNAL_QUALITY_INSUFFICIENT`.
- Samples with high uncertainty.
- Per-participant and per-exercise failure patterns.
- Exportable failure case reports.

## 6. Evaluation Workflow

```
1. Dataset Versioning
   └── Lock test set, record participant IDs

2. Model Training
   └── Train on training set only
   └── Validate on validation set
   └── Log all hyperparameters and checkpoints

3. Model Selection
   └── Select best model based on validation metrics
   └── Do NOT use test set for selection

4. Final Evaluation
   └── Run selected model on test set exactly once
   └── Compute all metrics with confidence intervals
   └── Generate per-participant and per-exercise reports
   └── Analyze failure cases
   └── Record evaluation_run in database

5. Ablation Comparison
   └── Compare ablation variants with statistical tests
   └── Document which modalities contribute most

6. Reporting
   └── Export results (CSV, JSON, PDF)
   └── Include model version, dataset version, feature pipeline version
   └── Include timestamp and evaluator ID
```

## 7. Reproducibility Requirements

### 7.1 Random Seeds
- All random operations use fixed seeds documented in `training_params`.
- Seeds recorded in `model_versions.training_params`.

### 7.2 Environment Capture
- Python version
- Package versions (requirements or poetry.lock)
- CUDA/cuDNN versions if GPU used
- Docker image hash if containerized

### 7.3 Data Provenance
- `training_dataset_version` linked to exact `datasets.version`.
- `feature_pipeline_version` linked to exact feature extraction code/config.
- `model_version` linked to architecture and weights.

### 7.4 Code Versioning
- Git commit hash stored with model registration.
- If weights are stored, checksum (SHA256) recorded.

## 8. Confidence Intervals

- **Method**: Bootstrap (10,000 resamples) for metrics where distribution is unknown.
- **Coverage**: 95% confidence intervals reported for all primary metrics.
- **Paired CI**: For model comparisons, compute paired differences and CI.
- **Visualization**: Error bars on all bar charts; shaded regions on ROC curves.

## 9. Signal Quality in Evaluation

- Evaluate performance on **sufficient-quality** samples separately from **all samples**.
- Report rejection rate and reason.
- Do not impute or interpolate predictions for rejected samples.
- If evaluating clinical utility, report metrics with quality gating enabled.

## 10. Final Test Set Policy

- Final test set participants are identified before training begins.
- Test set recordings are marked `dataset_split = test` and `datasets.is_final_test = true`.
- Test set is **locked**: no new recordings added after locking.
- Test set is **isolated**: training and validation scripts cannot access test participant IDs.
- Test evaluation is performed **once** by a designated researcher.
- Test results are published/finalized only after review.
- If test set is exhausted, a new test set must be collected and locked before additional evaluation.

## 11. Documentation

Every evaluation run must produce:
- `evaluation_run` database record with all metrics, splits, and metadata.
- Exported report (JSON/CSV) with identical data.
- Confusion matrix image (PNG/SVG).
- Per-participant and per-exercise breakdown tables.
- Failure case list with sample IDs and reasons.
- Ablation comparison table with statistical significance markers.

## 12. Ethical Review

- Validation plan must be reviewed by institutional review board (IRB) or equivalent.
- Consent forms must cover data use for model training and evaluation.
- Participants may request data removal; pipeline must support right-to-erasure where legally required.
- No participant-level identifiers in exported research datasets.

## Executed verification (2026-09-08)

Backend: `cd D:\NeuroSpeech-Rehab\backend; .\.venv-ml\Scripts\python.exe -m pytest tests -q --tb=short --junitxml=verification_final.xml` — 95 passed, 0 failed. ML pipeline: `cd D:\NeuroSpeech-Rehab\ml_training; ..\backend\.venv-ml\Scripts\python.exe -m pytest tests -q --tb=short` — 32 passed, 0 failed. Disposable PostgreSQL upgraded through `006_computed_features`, performed a downgrade/upgrade round trip, and passed `alembic check`; its end-to-end verification exercised health, authenticated CRUD setup, sensor persistence, source hashing, and fusion refusal. Synthetic inputs were used only in tests.

## 13. What This Plan Does NOT Cover

- Clinical efficacy validation (deferred to clinical trials, not this prototype).
- Medical device certification or regulatory submission.
- Real-time safety-critical guarantees.
