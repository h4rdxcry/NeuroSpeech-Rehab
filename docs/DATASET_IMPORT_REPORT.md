# JapanEEG Dataset Acquisition & Import Report — REFERENCE_ONLY / Historical

**Dataset:** EEG-Speech Brain Decoding Dataset  
**OpenNeuro ID:** ds007808  
**Version:** 1.0.0  
**Date:** 2026-09-05  
**Status:** PARTIAL IMPORT — representative sample acquired  
**Project usage:** REFERENCE_ONLY / DEPRECATED FOR PRIMARY INDIA STRATEGY

> **Strategic note:** This dataset is retained in `data/raw/ds007808` and the database as a historical prototype reference only. It is **REFERENCE_ONLY / DEPRECATED FOR PRIMARY INDIA STRATEGY** and must not be used as the main EEG or speech source for new model development. New imports should follow `docs/INDIA_DATASET_ACQUISITION_PLAN.md`.

---

## 1. Official Source Verified
Yes. Verified via OpenNeuro S3 metadata (`dataset_description.json`) and official dataset page https://openneuro.org/datasets/ds007808.

## 2. Dataset ID
ds007808

## 3. Dataset Version
1.0.0

## 4. License
CC0 (public domain)

## 5. Access Type
PUBLIC

## 6. Citation
Sato, M., Horiguchi, I., Inoue, M., Tomeoka, K., Hatakeyama, E., Kita, Y., Yamamoto, A., Fujisawa, I., & Sasai, S. (2026). JapanEEG: a 1000-hour EEG–EMG–audio dataset of Japanese speech production. OpenNeuro. https://doi.org/10.18112/openneuro.ds007808.v1.0.0

## 7. Dataset Description
EEG-Speech Brain Decoding Dataset. Multimodal recordings of Japanese speech production collected from healthy adult participants using g.Pangolin, g.SCARABEO, and eego sports acquisition systems. Provided in BIDS 1.9.0 format.

## 8. Actual Modalities
EEG, AUDIO

## 9. Actual Participant Count
3

## 10. Actual Recording/File Count
- Manifest discovered files with session context: 15
- Actual data files imported and registered as Recording records: 8
- Downloaded files total: 45 files (6 EDF, 2 WAV, 23 JSON, 11 TSV, plus root metadata)

## 11. Actual Duration
NOT DOCUMENTED in available metadata files. Dataset publication cites ~1000 hours total across full cohort; our partial sample does not expose exact duration.

## 12. Sampling Information
EEG: 256–1200 Hz depending on device; Audio: device-dependent

## 13. BIDS Status
True (BIDS 1.9.0)

## 14. Download Status
Partial. Full dataset size is approximately 1575 GB. Only a representative sample was downloaded to `data/raw/ds007808` (3.01 GB).

## 15. Import Status
imported

## 16. Import Path
`D:/NeuroSpeech-Rehab/data/raw/ds007808`

## 17. Manifest Path
Manifest is stored in the PostgreSQL `datasets.manifest` column for dataset ID `ac4b5d3d-915e-411f-9001-7c51ea33b8ec`.

## 18. Provenance Status
Created. `DatasetProvenance` records official source, URL, license, and dataset identifier.

## 19. Checksum Status
Combined SHA256 manifest checksum computed over all downloaded files.

## 20. QC Result
PASS

## 21. Duplicate Detection Result
No duplicate files detected in the downloaded sample.

## 22. Participant Pseudonymization Result
BIDS pseudonymous IDs used: `sub-01`, `sub-02`, `sub-03`. No real names stored.

## 23. Database Registration Result
- Dataset record created with classification REAL
- Provenance record created
- Catalog record created
- 3 ResearchParticipant records created
- 6 Session records created
- 8 Recording records created (REAL, raw)
- Import logs created

## 24. UI/Catalog Result
Frontend `ResearchDatasets.tsx` already supports display of name, version, modality, participant count, recording count, classification, QC status, source, license, and access. No code changes required.

## 25. Restricted/Access Considerations
CC0 public dataset. No credentials, DUA, or approval required.

## 26. Files Created
- `data/raw/ds007808/*` (downloaded dataset sample and metadata)
- `docs/DATA_SOURCES.md`
- `docs/DATASET_IMPORT_REPORT.md`

## 27. Files Modified
- `backend/app/services/datasets/importer.py`
- `backend/app/api/v1/dataset_imports.py`
- `backend/app/models/research.py` (added `index=True` to `DatasetImportLog.dataset_id`)

## 28. Tests Added/Modified
No new test files added. Existing importer tests continue to pass. Importer behavior extended to create participant, session, and recording records.

## 29. Exact Test Command
```
cd D:\NeuroSpeech-Rehab\backend
python -m pytest -q
```

## 30. Final Test Result
32 passed, 0 failed

## 31. Warnings
- Pre-existing Pydantic V1-style config deprecation warnings in `app/schemas/*.py`
- Pre-existing `datetime.utcnow()` deprecation warnings in `app/core/auth.py`, `app/services/datasets/manifest.py`, and `app/services/datasets/importer.py`
- No new warnings introduced by this work

## 32. Limitations
- Only a representative sample (~3 GB) of the ~1575 GB dataset was imported. Full acquisition is not feasible in this environment.
- `recording_count` in the dataset registry reflects manifest-discovered session paths (15) rather than fully enumerated data files, because the full file inventory was not downloaded.
- Duration and total recording count for the full dataset are NOT DOCUMENTED in the downloaded metadata files.
- Participant `sub-03` has metadata files but no data files in the downloaded sample; participant record was created, but no session or recording was registered for this participant.

## 33. Strategic Deprecation
This dataset is now marked `REFERENCE_ONLY / DEPRECATED FOR PRIMARY INDIA STRATEGY`. It remains in the database for historical and prototype reference, but is **not** part of the active India-focused acquisition strategy. New imports should follow `docs/INDIA_DATASET_ACQUISITION_PLAN.md`.

---

# Dataset #1 Acquisition & Import Report — Facial EMG Dataset (Chitkara/Zenodo)

**Dataset:** Facial EMG Dataset (Sharma, Chitkara University, 2025)  
**Zenodo Record ID:** 17158391  
**DOI:** 10.5281/zenodo.17158391  
**Author / Institution:** Deepika Sharma, Chitkara University, India  
**Date:** 2026-09-05  
**Status:** COMPLETED — 100% Acquired, Verified, & Registered  
**Project usage:** AUXILIARY sEMG PIPELINE VALIDATION (Non-clinical)  
**Classification:** REAL (`is_synthetic=False`)

> **Identity correction (2026-09-05):** This dataset is NOT the "Mimetic Interfaces Facial Surface EMG Dataset 2015". It is a separate dataset by Deepika Sharma at Chitkara University. The intended Mimetic dataset remains unacquired and is tracked separately.

---

## 1. Official Source Verified
Yes. Verified via Zenodo REST API (`https://zenodo.org/api/records/17158391`) and DOI `10.5281/zenodo.17158391`.

## 2. Dataset ID (Database)
`5481a898-e69a-4c85-955d-88cc279633fb`

## 3. Dataset Version
1.0

## 4. License
CC BY 4.0 (Open Access)

## 5. Access Type
PUBLIC (Direct HTTP download from Zenodo)

## 6. Citation
Sharma, D. (2025). Facial EMG Dataset. Zenodo. https://doi.org/10.5281/zenodo.17158391

## 7. Dataset Description
Facial surface electromyography dataset recorded from 15 healthy adult subjects during facial muscle activation tasks. Includes 15 CSV recordings and 6 digital signal processing (DSP) / machine learning scripts.

## 8. Actual Modalities
EMG (Facial surface electromyography)

## 9. Actual Participant Count
15 healthy participants (`subject_01` through `subject_15`)

## 10. Actual Recording Count
- 15 physiological CSV data recordings registered in the `recordings` table.
- 6 source/DSP scripts retained as source code artifacts in `data/raw/facial_emg_zenodo/` and indexed in the manifest file types (`.ino`, `.py`, `.txt`).

## 11. Sampling Information
Surface EMG voltage recordings across facial channels.

## 12. BIDS Status
Non-BIDS tabular format (Structured per-subject CSV files).

## 13. Download & Checksum Status
- Downloaded: 21 files, total size 13,382,288 bytes (~12.76 MB).
- Checksum verification: 100% PASS against Zenodo official MD5 hashes.
- Combined SHA256 manifest hash computed and registered.

## 14. QC Result
PASS (`errors: []`, `warnings: []`).

## 15. Duplicate Detection Result
No duplicate files detected.

## 16. Participant Pseudonymization
Pseudonyms assigned directly from verified subject IDs: `subject_01` to `subject_15`.

## 17. Database Registration
- `Dataset` row created (`data_classification="REAL"`, `imported_status="imported"`, `qc_status="PASS"`).
- `DatasetProvenance` row created with source URL, license, and Zenodo identifier.
- `DatasetCatalog` row created.
- 15 `ResearchParticipant` records created (`consent_status="imported"`).
- 15 `Session` records created (`status="imported"`).
- 15 `Recording` records created (`modality="EMG"`, `data_classification="REAL"`, `is_synthetic=False`).

## 18. Storage Impact
- Initial Tracked Storage: 3.011 GB
- New Data Added: 0.013 GB (12.76 MB)
- Total Final Tracked Storage: **3.024 GB**
- Remaining Safety Headroom: **46.976 GB** (Well below 50.00 GB hard limit).

---

# Dataset #2 Access Verification Report — Mimetic Interfaces Facial Surface EMG Dataset 2015

**Dataset:** Mimetic Interfaces: Facial Surface EMG Dataset 2015  
**Authors:** Ville Rantanen, Mirja Ilves, Antti Vehkaoja, Anton Kontunen, Jani Lylykangas, Eeva Mäkelä, Markus Rautiainen, Veikko Surakka, Jukka Lekkala  
**Institution:** Tampere University / CSC Finland  
**URN:** urn:nbn:fi:csc-kata20160519232206569792  
**Official Portal:** https://researchportal.tuni.fi/en/datasets/mimetic-interfaces-facial-surface-emg-dataset-2015/  
**Date Verified:** 2026-09-05  
**Status:** **PENDING ACCESS VERIFICATION**

## 1. Source Verification
- **Authoritative portal accessible:** YES (Tampere University Research Portal returned HTTP 200 and confirmed dataset metadata).
- **URN resolver accessible:** NO (`http://urn.fi/urn:nbn:fi:csc-kata20160519232206569792` returned HTTP 403 Forbidden with Cloudflare challenge).
- **CSC/AVAA download endpoint:** Redirects from `http://avaa.tdata.fi/...` to `https://fairdata.fi/avaa/...`; direct file access not confirmed in this session.

## 2. Verified Metadata from Authoritative Source
- **Title:** Mimetic Interfaces: Facial Surface EMG Dataset 2015
- **License:** CC BY 4.0 (data); MATLAB scripts under MIT license
- **Participants:** 15 healthy adults (8 females, 7 males), ages 26–57
- **Muscles:** Corrugator supercilii, zygomaticus major, orbicularis oris, orbicularis oculi, masseter
- **Sampling rate:** 2048 Hz
- **Tasks:** Voluntary smile, lip pucker, frown; chewing tasks; resting
- **Files:** `Data/*.mat`, `Results/*`, `Screenshots/*.jpg`, `helper_functions/*`, `CHANGELOG.txt`, `*_LICENSE.txt`, `README.txt`, `Participants.csv`, `dataprocessing.m`, `metadata.mat`
- **Publisher:** CSC
- **Date made available:** 2016

## 3. Access Decision
- **Do not download** until the public download URL is confirmed accessible without authentication.
- **Do not use** the Zenodo record `10.5281/zenodo.17158391` or `10.5281/zenodo.17585` as a substitute; both point to different datasets.
- **Next action:** Verify CSC/AVAA download endpoint accessibility and obtain actual file manifest/size before authorizing acquisition.

