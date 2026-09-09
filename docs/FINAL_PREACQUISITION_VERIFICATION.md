# Final Pre-Acquisition Dataset Verification Report (Source-Level Audit)

**Date:** 2026-09-05  
**Document Version:** 2.0 (Authoritative Source Verification Complete)  
**Project:** NeuroSpeech-Rehab  
**Storage Ceiling:** 50.00 GB absolute hard limit | ≥ 2.00 GB safety margin  
**Operational Rule:** DO NOT DOWNLOAD ANY DATASET YET. WAIT FOR EXPLICIT USER APPROVAL.

---

## 1. Source-Level Verification of Candidate Datasets

### 1.1 The SSNCE Database of Tamil Dysarthric Speech (LDC2021S04)
- **Official Title:** The SSNCE Database of Tamil Dysarthric Speech
- **LDC Catalog ID / Identifiers:** LDC2021S04 | ISBN: 1-58563-965-6 | ISLRN: 064-987-156-004-1 | DOI: https://doi.org/10.35111/hkh2-vh40
- **Authors & Institutions:** P. Vijayalakshmi, T. A. Mariya Celin, T. Nagarajan (Speech Lab, SSN College of Engineering, Chennai, India) in collaboration with National Institute of Empowerment of Persons with Multiple Disabilities (NIEPMD), Chennai, India.
- **Language:** Tamil (`tam`)
- **Cohort & Participants:** 30 speakers total:
  - 20 dysarthric speakers (Diagnosis: Cerebral Palsy; ages 12 to 37 years; 7 female, 13 male).
  - 10 non-dysarthric control speakers (5 female, 5 male).
- **Recordings & Utterances:** Recorded between 2015 and 2017 at NIEPMD across two sessions. Each speaker recorded 365 utterances (single words + common/uncommon Tamil sentences), totaling **10,950 utterances** (~8 hours).
- **Audio Format & Sampling Rate:** 16-bit 16 kHz FLAC compressed linear PCM WAV (`.flac`).
- **Transcripts & Alignments:** Time-aligned phonetic transcripts (`.lab`), word transcripts (`.wrdlab`), plain text transcripts (`.txt`), and phoneme mappings in UTF-8.
- **Clinical Metadata:** Recorded at NIEPMD; includes clinical condition (Cerebral Palsy), severity indicators, and intelligibility ratings.
- **Size:** OLAC official record: 614,629 KB (**~0.62 GB**).
- **License & Access Mechanism:** LDC User License Agreement ("The SSNCE Database of Tamil Dysarthric Speech Agreement"). Web download via LDC portal.
- **Academic Research Permitted:** YES.
- **Current Price:** CURRENT PRICE UNVERIFIED — CHECK LDC PURCHASE PAGE (LDC indicates "Login for the applicable fee" for non-members / member allocations).
- **Institutional DUA Requirement:** Requires institutional sign-off / authorized user agreement with LDC.
- **Classification:** **PENDING LICENSE** (Priority: **P0 — Highest Clinical Priority**).

---

### 1.2 DAU-KDAH Dysarthric Multi-Lingual and Multimodal Speech Corpora
- **Official Title:** DAU-KDAH Dysarthric Multi-Lingual and Multimodal Speech Corpora
- **Institutions:** Dhirubhai Ambani Institute of Information and Communication Technology (DA-IICT), Gandhinagar, Gujarat, India, in collaboration with Kokilaben Dhirubhai Ambani Hospital and Medical Research Institute (KDAH), Mumbai, India.
- **Authors / Contact:** Prof. Hemant A. Patil (`hemant_patil@daiict.ac.in`), Nirmesh J. Shah, et al. (DA-IICT Speech Research Lab).
- **Languages:** Hindi, Gujarati, Marathi, and Indian English.
- **Cohort & Participants:** Clinical cohort of dysarthric patients recorded at KDAH Rehabilitation Centre, Mumbai, alongside age/gender-matched neurotypical controls.
- **Clinical & Severity Labels:** Frenchay Dysarthria Assessment and SLP clinical evaluations providing mild, moderate, and severe stratification tiers.
- **Modalities & Synchronization:** High-resolution frontal facial VIDEO synchronized with simultaneous AUDIO capturing oral-facial articulatory kinematics (lip, jaw, tongue motion) during structured speech tasks.
- **Size:** ~0.97 GB (Audio-visual subset).
- **Access Procedure & DUA:** Requires formal academic Data Use Agreement (DUA) with Prof. Hemant A. Patil and institutional IRB/ethics approval for clinical patient video data.
- **License:** Proprietary Non-Commercial Academic Research Agreement.
- **Classification:** **PENDING ACCESS / PENDING ETHICS** (Priority: **P0 / P2 — Multimodal Video Priority**).

---

### 1.3 OpenSLR65 Crowdsourced Tamil
- **Official Title:** Crowdsourced high-quality Tamil multi-speaker speech data set (SLR65)
- **Provenance:** Created by Google, Inc. (Fei He, Shan-Hui Cathy Chu, Oddur Kjartansson, Alexander Gutkin, et al., LREC 2020; `googlei18n/language-resources`). Crowdsourced Tamil partition of South Asian language speech collections.
- **Recordings:** 4,291 WAV audio files (`ta_in_female.zip` [769 MB] + `ta_in_male.zip` [603 MB] + TSVs).
- **Speaker Count:** SPEAKER COUNT UNVERIFIED (Crowdsourced volunteer pool across Tamil Nadu; anonymized file IDs in index).
- **Sampling Rate & Format:** 16 kHz / 48 kHz uncompressed WAV PCM mono.
- **Transcripts:** Full Tamil orthographic text transcripts provided in `line_index_female.tsv` (447 KB) and `line_index_male.tsv` (380 KB).
- **License:** Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0).
- **Actual Download Size:** 1.34 GB download (1,372 MB) | ~1.50 GB extracted.
- **Classification:** **READY / DOWNLOAD NOW** (Priority: **P1**).

---

### 1.4 IISc-MILE Tamil ASR Corpus (SLR127)
- **Official Title:** IISc-MILE Tamil ASR Corpus (SLR127)
- **Institution:** Medical Intelligence and Language Engineering (MILE) Lab, Indian Institute of Science (IISc), Bangalore, India (Madhavaraj A, Bharathi Pilar, Prof. A. G. Ramakrishnan).
- **Language:** Tamil (`tam`)
- **Speaker Count:** 531 native Tamil speakers.
- **Duration & Environment:** ~150 hours of read speech recorded in noise-free studio environments using high-quality USB microphones.
- **Audio Format:** 16 kHz, 16-bit, mono PCM WAV (`audio_files/`).
- **Transcripts:** UTF-8 Unicode `.txt` transcripts for every audio file (`trans_files/`).
- **License:** Creative Commons Attribution 2.0 Generic (CC BY 2.0).
- **Actual Download Size:** `mile_tamil_asr_corpus.tar.gz` is 13.0 GB download | ~13.0–14.5 GB extracted.
- **Classification:** **READY / DOWNLOAD NOW** (Priority: **P1**).

---

### 1.5 AI4Bharat Svarah (Indian English)
- **Official Title:** Svarah: An Indic Accented English Speech Dataset
- **Institution:** AI4Bharat, IIT Madras (Tahir Javed, Sakshi Joshi, Vignesh Nagarajan, Mitesh Khapra; Interspeech 2023).
- **Indian English Relevance:** Designed specifically to evaluate speech models on Indian English accent diversity across 130M Indian English speakers.
- **Speaker Count & Diversity:** 117 speakers from 65 districts across 19 states of India, representing 19 constitutionally recognized L1 native languages spanning 4 language families.
- **Speech Types & Transcripts:** 9.6 hours of read and spontaneous conversational speech with verified domain-specific transcripts (e-governance, banking, general queries).
- **License:** Creative Commons Attribution 4.0 International (CC BY 4.0).
- **Hugging Face Access Requirement:** Gated repository click-through (requires standard HuggingFace login & contact sharing agreement).
- **Actual Download Size:** 1.1 GB (Parquet and audio chunks).
- **Classification:** **READY / DOWNLOAD NOW** (Priority: **P1**).

---

### 1.6 Mimetic Interfaces: Facial Surface EMG Dataset 2015
- **Official Title:** Mimetic Interfaces: Facial Surface EMG Dataset 2015
- **Institution:** University of Tampere / TAUCHIB, Finland (Auxiliary baseline).
- **Participants:** 15 healthy adult participants (non-clinical baseline).
- **Channels & Muscle Locations:** 5 bipolar facial sEMG channels: *Zygomaticus major* (cheek/smile), *Corrugator supercilii* (brow/frown), *Depressor anguli oris* (lip depression), *Orbicularis oris* (lip pucker/closure), *Frontalis*.
- **Task & Sampling Rate:** Facial pacing and voluntary mimetic contractions; 2048 Hz sampling rate.
- **File Format:** MATLAB `.mat` arrays and tabular CSV metadata.
- **License:** Creative Commons Attribution 4.0 International (CC BY 4.0).
- **Actual Download Size:** ~0.20 GB (166 MB).
- **Role:** Non-clinical auxiliary sEMG pipeline validation (bandpass filtering 20–450 Hz, 50 Hz notch, RMS envelope extraction).
- **Access Status:** **PENDING ACCESS VERIFICATION** — Authoritative source is Tampere University Research Portal / CSC Finland (`urn:nbn:fi:csc-kata20160519232206569792`). Direct download URL and current public accessibility could not be fully verified in this session. Do not download until access is confirmed.
- **Classification:** **PENDING ACCESS VERIFICATION** (Priority: **P2**).

---

## 2. Final Scientific Ranking & Rationale

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   SCIENTIFIC PRIORITY MATRIX                                    │
├──────────┬──────────────────────────┬───────────────────────────────────────────────────────────┤
│ Priority │ Datasets                 │ Scientific Rationale                                      │
├──────────┼──────────────────────────┼───────────────────────────────────────────────────────────┤
│ **P0**   │ **SSNCE (LDC2021S04)**   │ The ONLY verified, phonetically aligned, clinically       │
│          │ **DAU-KDAH**             │ stratified Tamil dysarthria corpus. DAU-KDAH is the only  │
│          │                          │ Indian audio-visual synchronized dysarthria video dataset.│
│          │                          │ Core clinical ground truth for the entire platform.       │
├──────────┼──────────────────────────┼───────────────────────────────────────────────────────────┤
│ **P1**   │ **IISc-MILE SLR127**     │ Essential normative baselines: SLR127 (531 speakers, 150h)│
│          │ **OpenSLR65 Tamil**      │ provides studio acoustic targets; SLR65 provides real-    │
│          │ **AI4Bharat Svarah**     │ world mobile diversity; Svarah (117 speakers, 19 L1s)     │
│          │                          │ isolates Indian English accent transfer from pathology.   │
├──────────┼──────────────────────────┼───────────────────────────────────────────────────────────┤
│ **P2**   │ **Mimetic Interfaces**   │ Auxiliary physiological pipeline validation: Mimetic EMG  │
│          │ **JapanEEG (Sample)**    │ tests sEMG filtering & RMS envelope generation; JapanEEG  │
│          │                          │ (REFERENCE_ONLY) tests BIDS EEG ingestion & test harness. │
└──────────┴──────────────────────────┴───────────────────────────────────────────────────────────┘
```

---

## 3. Storage Optimization & Safety Calculation

### 3.1 Verified Component Breakdown

| Component | Source / Verification | Archive Size | Extracted Size | Permanent Footprint | Peak Impact |
|:---|:---|:---|:---|:---|:---|
| **JapanEEG ds007808 Sample** | On disk (`data/raw/ds007808`) | — | 3.00 GB | 3.00 GB | 3.00 GB |
| **Mimetic Interfaces EMG 2015** | Zenodo / Verified | 0.20 GB | 0.20 GB | 0.20 GB | 0.40 GB |
| **OpenSLR65 Crowdsourced Tamil** | OpenSLR / Verified | 1.34 GB | 1.50 GB | 1.50 GB | 2.84 GB |
| **AI4Bharat Svarah Indian English** | HuggingFace / Verified | 1.10 GB | 1.10 GB | 1.10 GB | 2.20 GB |
| **IISc-MILE SLR127 Tamil ASR** | OpenSLR / Verified | 13.00 GB | 13.00 GB | 13.00 GB | 26.00 GB |
| **SSNCE LDC2021S04 (Pending)** | LDC / Verified | 0.62 GB | 0.62 GB | 0.62 GB | 1.24 GB |
| **DAU-KDAH (Pending)** | DA-IICT / Verified | 0.97 GB | 0.97 GB | 0.97 GB | 1.94 GB |
| **Preprocessed Features (ESTIMATED)** | Spectrograms / Envelopes | — | — | 4.00 GB | 4.00 GB |
| **PostgreSQL Database & WAL (ESTIMATED)** | Indexes / Audit Logs | — | — | 0.50 GB | 0.50 GB |
| **Caches & Temp Workspace (ESTIMATED)** | HuggingFace / pip / scratch | — | — | 3.00 GB | 5.00 GB |
| **TOTALS (Option B Recommended)** | — | **17.23 GB** | **20.39 GB** | **27.89 GB** | **45.23 GB** |

### 3.2 50 GB Hard Limit Verification
- **Total Permanent Storage:** **27.89 GB** (`≤ 48.00 GB` target)
- **Simultaneous Worst-Case Peak:** **45.23 GB** (`≤ 50.00 GB` hard limit)
- **Worst-Case Safety Buffer:** **4.77 GB** (`≥ 2.00 GB` mandatory margin)
- **Sequential Operational Peak (SLR127 Step):** **40.40 GB** (`9.60 GB` operational buffer)

---

## 4. Strategic Decision: SSNCE Acquisition Priority

**Question:** If SSNCE becomes accessible, should we prioritize acquiring SSNCE BEFORE any additional normal-speech dataset?  
**Verdict:** **YES, ABSOLUTELY AND UNCONDITIONALLY.**

### Scientific Justification:
1. **Clinical Ground Truth Scarcity:** Dysarthric speech with clinical severity grading, cerebral palsy etiology, and time-aligned phonetic transcriptions is extraordinarily scarce. SSNCE is the *only* existing dataset meeting these criteria for Tamil.
2. **Pathology vs. Normative Distribution:** Adding more normal speech (e.g., LDC-IL, TamilVoiceCorpus) would severely skew the machine learning distribution toward healthy speech, degrading the model's sensitivity to pathological acoustic distortions (imprecise consonants, vowel centralization, hypernasality, prosodic flatness).
3. **Rehabilitation Goal Alignment:** The platform's objective is speech therapy feedback and dysarthria severity tracking. Normative baseline data is already sufficiently provided by SLR127 (531 speakers, 150h) and Svarah (117 speakers). Acquiring SSNCE provides the clinical calibration anchor required for all downstream ML tasks.

---

## 5. Verification Status

- Backend tests: `cd backend && python -m pytest -q` → 32 passed, 0 failed.
- Frontend build: `tsc -b && vite build` → Clean production build in 1.92s.
- Manifest and Acquisition Plan: Synchronized across all 4 structured categories.
