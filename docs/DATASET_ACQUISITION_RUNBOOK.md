# Dataset Acquisition Runbook & Safe Execution Protocol

**Document Version:** 2.0 (Verified Engine & CLI Integration)  
**Project:** NeuroSpeech-Rehab  
**Date:** 2026-09-05  
**Target Platform:** Research-Grade Multimodal AI Speech Rehabilitation Platform  
**Storage Ceiling:** 50.00 GB hard limit | ≥ 2.00 GB mandatory safety margin | 45.00 GB warning threshold

---

## 1. Safety Principles & Storage Guard Mandate

Before executing any dataset acquisition, the operator must adhere to the following non-negotiable rules:

1. **Strict Sequential Acquisition:** Never download multiple archives concurrently. Download one dataset, verify its integrity, extract it, execute QC and database registration, and immediately delete any temporary archive before initiating the next download.
2. **Storage Guard Pre-Flight Check:** Run `StorageGuard.guard_or_raise()` before every download. If projected peak disk usage exceeds 48.00 GB or leaves less than 2.00 GB buffer, acquisition halts immediately.
3. **Data Classification Integrity:** All acquired research datasets must be registered with `data_classification="REAL"` and `is_synthetic=False`. No synthetic or fabricated physiological signals may ever be merged into real datasets.
4. **Participant Split Protection:** Partitioning into `train`, `val`, and `test` must strictly enforce participant isolation (GroupKFold / LOSO). No participant may appear in more than one split. The `test` split remains locked.
5. **Respect License and Gating:** Restricted or credentialed datasets (SSNCE LDC2021S04, DAU-KDAH) must never be downloaded without active, signed agreements on file.

---

## 2. Storage Budget & Tracking Status

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              STORAGE ALLOCATION PROTOCOL                               │
├──────────────────────────────────────────────────────┬─────────────┬───────────────────┤
│ Component                                            │ Permanent   │ Peak Impact       │
├──────────────────────────────────────────────────────┼─────────────┼───────────────────┤
│ Existing JapanEEG ds007808 Sample (REFERENCE_ONLY)   │ 3.00 GB     │ 3.00 GB           │
│ Dataset 1: Facial Surface EMG Dataset (Zenodo)       │ 0.02 GB     │ 0.04 GB           │
│ Dataset 2: OpenSLR65 Crowdsourced Tamil              │ 1.50 GB     │ 2.84 GB           │
│ Dataset 3: AI4Bharat Svarah Indian English           │ 1.10 GB     │ 2.20 GB           │
│ Dataset 4: IISc-MILE SLR127 Tamil ASR Corpus         │ 13.00 GB    │ 26.00 GB          │
├──────────────────────────────────────────────────────┼─────────────┼───────────────────┤
│ Subtotal Authorized New Extracted Data               │ 15.62 GB    │ —                 │
│ Infrastructure: Preprocessed Features (ESTIMATED)    │ 4.00 GB     │ 4.00 GB           │
│ Infrastructure: PostgreSQL Database & Logs (EST.)    │ 0.50 GB     │ 0.50 GB           │
│ Infrastructure: Caches, Temp Workspace (EST.)        │ 3.00 GB     │ 5.00 GB           │
├──────────────────────────────────────────────────────┼─────────────┼───────────────────┤
│ TOTAL PERMANENT STORAGE (Immediate Stage 1)          │ 26.12 GB    │ —                 │
│ SEQUENTIAL OPERATIONAL PEAK (During SLR127 step)     │ —           │ 40.22 GB          │
│ SAFETY BUFFER (50.00 GB - 40.22 GB)                  │ 9.78 GB     │ ≥ 2.00 GB (PASS)  │
│ ABSOLUTE HARD CEILING                                │ 50.00 GB    │ 50.00 GB          │
└──────────────────────────────────────────────────────┴─────────────┴───────────────────┘
```

---

## 3. Dataset #1 (Zenodo Facial Surface EMG) Acquisition Protocol

### 3.1 Source Identification & Verified Metadata
- **Official Title:** Facial EMG Dataset
- **Repository:** Zenodo (`https://zenodo.org/records/17158391`)
- **DOI:** `10.5281/zenodo.17158391` (Record ID: `17158391`)
- **Authors / Institution:** Deepika Sharma (Chitkara University, India)
- **License:** CC BY 4.0 (Verified Public)
- **Role:** Non-clinical auxiliary baseline for validating sEMG 20–450 Hz bandpass filtering, 50 Hz notch filter, and RMS activation envelopes.
- **Participants:** 15 healthy adult participants (`subject_01.csv` through `subject_15.csv`).
- **Files & Size:** 21 files (15 participant CSVs, 6 DSP/preprocessing scripts), total size: **12.76 MB** (13,382,288 bytes).
- **Checksums:** MD5 checksums verified for all 21 files directly via Zenodo REST API.

---

### 3.2 Pre-Flight Dry Run Command
Run the dry-run CLI to inspect metadata, checksums, and storage guard clearance without downloading:

```bash
cd D:\NeuroSpeech-Rehab\backend
python -m app.services.datasets.acquire_dataset mimetic_emg_2015 --dry-run
```

**Expected Dry-Run Output:**
```
======================================================================
NEUROSPEECH-REHAB DATASET ACQUISITION PRE-FLIGHT AUDIT
======================================================================
DATASET:               Facial Surface EMG Dataset (Zenodo)
SOURCE:                Zenodo (Record ID: 17158391)
ZENODO TITLE:          Facial EMG Dataset
DOI:                   10.5281/zenodo.17158391
LICENSE:               cc-by-4.0 (Verified Public)
ROLE:                  NON-CLINICAL AUXILIARY sEMG PIPELINE VALIDATION DATASET
CLASSIFICATION:        REAL (is_synthetic: False)
----------------------------------------------------------------------
TOTAL FILES:           21 files (15 subject CSVs, 6 DSP scripts)
EXPECTED SIZE:         12.76 MB (13,382,288 bytes)
CHECKSUM STATUS:       AVAILABLE FOR ALL FILES (MD5)
----------------------------------------------------------------------
CURRENT STORAGE:       3.011 GB
PREDICTED PEAK STORAGE:10.636 GB
PROJECTED PERMANENT:   10.524 GB
REMAINING BUFFER:      39.364 GB (Mandatory buffer >= 2.0 GB)
STORAGE GUARD RESULT:  PASSED - SAFE TO ACQUIRE
GUARD MESSAGE:         Acquisition is within safe storage limits.
======================================================================
DRY RUN COMPLETE - NO FILES DOWNLOADED TO DISK
======================================================================
```

---

### 3.3 Actual Execution Command (Authorized Post-Approval Only)
When explicitly authorized by the project lead:

```bash
cd D:\NeuroSpeech-Rehab\backend
python -m app.services.datasets.acquire_dataset mimetic_emg_2015 --execute
```

---

## 4. Failure & Recovery Policies

1. **Network Interruptions during Download:** The engine streams to temporary buffers. If an error occurs, no partial files are registered in the database, and the temporary folder is cleaned.
2. **Checksum Mismatch:** If the computed MD5 hash differs from the Zenodo manifest, the engine aborts the transaction, logs the failure, deletes the corrupted file, and raises an error.
3. **Storage Guard Violation:** If disk usage spikes unexpectedly above 48.00 GB, the engine immediately aborts with `StorageLimitExceededError`.
4. **Database Registration Rollback:** All DB operations use atomic SQLAlchemy async transactions. A failure during recording creation triggers a complete rollback.

---

## 5. Provenance & Metadata Policy

- Every downloaded dataset must create a `DatasetProvenance` row recording:
  - `original_source`: "Zenodo (Chitkara University)"
  - `original_dataset_identifier`: "17158391"
  - `source_url`: "https://zenodo.org/records/17158391"
  - `license_access_info`: "CC BY 4.0"
  - `checksum`: "sha256:..."
- The `Dataset` record must have `data_classification="REAL"`.

---

## 6. Verification Status
- Backend tests: `pytest` → 41 passed, 0 failed.
- Frontend build: `tsc -b && vite build` → Clean.
- CLI Dry Run: Tested and verified.
