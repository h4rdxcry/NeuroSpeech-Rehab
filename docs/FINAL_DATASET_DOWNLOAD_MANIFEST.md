# Final Dataset Download Manifest

**Date:** 2026-09-05  
**Document Version:** 4.0 (Identity Corrected & Access Verified)  
**Project:** NeuroSpeech-Rehab  
**Storage Ceiling:** 50.00 GB absolute local storage limit | ≥ 2.00 GB safety margin  
**Archive Workflow:** DOWNLOAD → VERIFY CHECKSUM → EXTRACT → QC → IMPORT → DELETE ARCHIVE  
**Operational Rule:** DO NOT DOWNLOAD ANY DATASET YET. WAIT FOR EXPLICIT USER APPROVAL.

---

## Already Acquired On Disk

| Dataset | Language | India Relevance | Clinical Relevance | Modalities | Participants / Speakers | Size | License | Access | Priority | Reason |
|:---|:---|:---|:---|:---|:---|:---|:---|:---|:---|:---|
| **Facial EMG Dataset (Sharma, Chitkara University, 2025)** | N/A | Low (India-origin author, non-clinical auxiliary baseline) | Non-clinical auxiliary EMG pipeline validation | EMG (facial surface CSV recordings) | 15 healthy adults | 12.76 MB on disk | CC BY 4.0 | ACQUIRED (Zenodo 17158391) | **P2** | Already acquired and imported. Provides auxiliary sEMG signal-processing baseline. Not a clinical/dysarthric dataset. |
| **OpenSLR65 Crowdsourced Tamil** | Tamil (`tam`) | High (Google South Asian Crowdsourced Speech Corpus) | Acoustic variability baseline across real-world recording conditions | Audio (16/48 kHz WAV) | 4,291 recordings (SPEAKER_COUNT_UNVERIFIED) | 1.34 GB download / 1.50 GB extracted | CC BY-SA 4.0 | ACQUIRED (OpenSLR direct HTTP download) | **P1** | Provides real-world mobile/environmental acoustic diversity complementary to studio-clean SLR127 at low disk cost. |

---

## Category A: DOWNLOAD NOW (Access & License Verified)

| Dataset | Language | India Relevance | Clinical Relevance | Modalities | Participants / Speakers | Size | License | Access | Priority | Reason |
|:---|:---|:---|:---|:---|:---|:---|:---|:---|:---|:---|
| **IISc-MILE Tamil ASR Corpus (SLR127)** | Tamil (`tam`) | High (IISc Bangalore, native Tamil speakers from India) | Healthy control baseline for normative acoustic and phonetic modeling | Audio (16 kHz WAV) | 531 native speakers (~150 hours) | ~13.00 GB download / ~13.00 GB extracted | CC BY 2.0 | PUBLIC (OpenSLR direct HTTP download) | **P1** | High-quality studio acoustic baseline across 531 speakers; essential for Tamil phonetic alignment and speech therapy target modeling. |
| **AI4Bharat Svarah** | Indian English (`en-IN`) | High (AI4Bharat / IIT Madras; 65 districts, 19 states) | Normative baseline for Indian English acoustic variability across diverse L1 transfer | Audio (16 kHz) + Text | 117 speakers (read + spontaneous, ~9.6 hours) | ~1.10 GB download & extracted | CC BY 4.0 | READY_AFTER_REGISTRATION (Hugging Face terms acceptance) | **P1** | Essential for isolating L1 dialectal/accent variations from motor speech impairment in bilingual rehabilitation. |

---

## Category B: DOWNLOAD AFTER ACCESS/LICENSE APPROVAL (Pending Approvals)

| Dataset | Language | India Relevance | Clinical Relevance | Modalities | Participants / Speakers | Size | License | Access | Priority | Reason |
|:---|:---|:---|:---|:---|:---|:---|:---|:---|:---|:---|
| **Mimetic Interfaces: Facial Surface EMG Dataset 2015** | N/A | Auxiliary non-clinical baseline (Tampere University / CSC Finland) | Oral-facial motor activation baseline for sEMG envelope and filter testing | EMG (5 facial channels, .mat) | 15 healthy adults | ~0.20 GB (ESTIMATED) | CC BY 4.0 | **PENDING ACCESS VERIFICATION** | **P2** | Scientifically documented facial EMG pipeline baseline. Access/download URL not yet verified from authoritative CSC/Tampere repository. Do not download until public access is confirmed. |
| **The SSNCE Database of Tamil Dysarthric Speech (LDC2021S04)** | Tamil (`tam`) | High (SSN College of Engg + NIEPMD, Chennai, India) | Highest / Essential: Cerebral Palsy dysarthric individuals with severity & intelligibility scores | Audio (16 kHz FLAC) + Time-Aligned Phonetic Transcripts | 30 speakers (20 dysarthric + 10 control; 10,950 utterances, ~8 hrs) | ~0.62 GB download & extracted (614.6 MB) | LDC User License Agreement | PENDING LICENSE (LDC Membership or Non-Member License Purchase; price unverified on public page) | **P0** | The ONLY verified, phonetically aligned, clinically stratified Tamil dysarthric speech corpus. Top clinical priority for the entire platform. |
| **DAU-KDAH Dysarthric Multi-Lingual and Multimodal Speech Corpora** | Hindi, Gujarati, Marathi, Indian English | High (DA-IICT Gandhinagar + KDAH Hospital Mumbai) | High: Dysarthric patients with low/med/high severity ratings + neurotypical controls | Multimodal (Audio + Synchronized Facial Video) | Clinical dysarthric cohort + matched controls | ~0.97 GB download & extracted | Proprietary Academic Research License | PENDING ACCESS / PENDING ETHICS (Formal DUA with Prof. Hemant A. Patil + Institutional IRB) | **P0 / P2** | Crucial for validating audio-visual fusion, facial landmark tracking, and lip kinematics on Indian dysarthric speakers. |
| **HDSD (Hindi Dysarthric Speech Database)** | Hindi (`hi`) | High (Indian academic cohort) | Dysarthric speech severity analysis in Hindi | Audio | ~60 dysarthric speakers | ~1.00–3.00 GB (ESTIMATED) | Institutional Academic License | PENDING ACCESS (Academic data request to authors) | **P2** | Secondary Indian language dysarthria corpus; deferred pending Tamil/English primary completion. |
| **Indian Stroke Speech Corpus** | Hindi / English | High (Indian clinical hospital cohort) | Post-stroke dysarthria and aphasia recovery tracking | Audio | 50 stroke patients + 50 controls | ~1.00–3.00 GB (ESTIMATED) | Hospital Clinical DUA | PENDING ETHICS / PENDING ACCESS (Hospital IRB agreement) | **P2** | High clinical value for stroke speech recovery; restricted by clinical patient health data regulations. |
| **Vaani Atypical Speech (ARTPARK / IISc)** | Multiple Indian languages | High (ARTPARK, IISc Bangalore) | Exploratory atypical speech diversity | Audio (+ optional video) | UNVERIFIED | UNVERIFIED | Research Collaborator Agreement | PENDING ACCESS (ARTPARK / IISc research request) | **P2** | In exploratory development; no standalone public download with clinical severity labels published yet. |

---

## Category C: REFERENCE ONLY (Retained on Disk, Deprecated for Primary India Models)

| Dataset | Language | India Relevance | Clinical Relevance | Modalities | Participants / Speakers | Size | License | Access | Priority | Reason |
|:---|:---|:---|:---|:---|:---|:---|:---|:---|:---|:---|
| **JapanEEG ds007808 (Partial Sample)** | Japanese (`ja`) | None (Japanese cohort) | Control speech production EEG baseline | EEG (64–128 ch) + Audio | 3 participants (`sub-01`, `sub-02`, `sub-03`) | 3.00 GB existing sample (full dataset ~1575 GB) | CC0 | PUBLIC (OpenNeuro) | **Reference** | Retained on disk at `data/raw/ds007808` for BIDS ingestion regression testing and signal quality algorithms. Do not delete; do not train primary India models on it. |

---

## Category D: DO NOT DOWNLOAD (Rejected / Out of Scope)

| Dataset | Language | India Relevance | Clinical Relevance | Modalities | Participants / Speakers | Size | License | Access | Priority | Reason |
|:---|:---|:---|:---|:---|:---|:---|:---|:---|:---|:---|
| **LDC-IL Tamil Sentence Aligned Speech** | Tamil | High (LDC-IL, CIIL Mysore) | Normal speech only; no clinical/dysarthric metadata | Audio | Hundreds of speakers | ~46.40 GB | Academic / LDC-IL | Gated / Purchase | **Rejected** | Consumes 92.8% of total storage budget for normal speech alone; superseded by SLR127 (13.0 GB, 531 speakers). |
| **TamilVoiceCorpus** | Tamil | High (Crowdsourced) | Normal speech only; unstratified | Audio | UNVERIFIED | ~43.00 GB | UNVERIFIED | Open | **Rejected** | Consumes 86% of storage on unverified crowdsourced audio; superseded by OpenSLR65 (1.5 GB). |
| **AI4Bharat IndicVoices** | Multilingual Indian | High (AI4Bharat) | Multilingual normal speech | Audio | 16,000+ speakers | 745.00 GB | CC BY 4.0 | Open | **Rejected** | Exceeds 50 GB storage ceiling by 15x; per-language slices with verified standalone downloads are not provided. |
| **AI4Bharat IndicVoices-R** | Multilingual Indian | High (AI4Bharat) | Multilingual TTS speech | Audio | Thousands of speakers | 1.05 TB | CC BY 4.0 | Open | **Rejected** | Exceeds 50 GB storage ceiling by >21x. |
| **AI4Bharat NPTEL2020** | Indian English / Multi | High (AI4Bharat / NPTEL) | Academic lecture audio | Audio | Hundreds of lecturers | 1.1–1.7 TB | Open | Open | **Rejected** | Lecture audio lacks clinical relevance and exceeds storage ceiling by >25x. |
| **BhasaAnuvaad NPTEL (HF)** | Indian English / Multi | High (AI4Bharat) | Academic lecture audio | Audio | Hundreds of lecturers | 121.00 GB | Open | Open | **Rejected** | Exceeds 50 GB storage ceiling by >2.4x. |
| **SPIRE-SIES (IISc)** | Indian English | High (IISc SPIRE Lab) | Indian English accent diversity | Audio | 1567 speakers (166–170 hrs) | 15–25 GB | UNVERIFIED | Request-based | **Rejected** | Large download that strains peak storage; Svarah provides verified 117-speaker accent diversity at 1.1 GB. |
| **IndicTIMIT** | Indian English | High (IISc / Indian institutions) | Indian English read speech | Audio | 80 speakers (~240 hrs) | 2–5 GB (ESTIMATED) | UNVERIFIED | Request-based | **Rejected** | Fragmented, non-standard distribution; superseded by verified CC BY 4.0 AI4Bharat Svarah. |
| **Microsoft Indian Speech (11 langs)** | 11 Indian languages | High (Microsoft India) | Multilingual Indian normal speech | Audio | Thousands of recordings | ~12.30 GB | CC BY-SA 4.0 | OpenSLR | **Rejected** | Full download contains 10 non-target languages; only Tamil subset (OpenSLR65, 1.5 GB) is accepted. |
| **IIT-M Indian Language ASR** | Multilingual | High (IIT Madras Speech Lab) | Normal speech baseline | Audio | Hundreds of speakers | >50.00 GB | Academic | Gated | **Rejected** | Exceeds 50 GB storage ceiling; Tamil baseline is covered by open IISc-MILE SLR127 (13.0 GB). |
| **IIT-M Indic TTS Database** | Tamil | High (IIT Madras / Hear2Read) | Clean studio TTS audio | Audio | 1–2 speakers (~5 hrs) | ~1–2 GB | Open | Open | **Rejected** | Single-speaker clean TTS recordings lack speaker variability needed for speech therapy baselines. |
| **TORGO (LDC2012S02)** | Canadian English | None (Canadian cohort) | Cerebral Palsy / ALS dysarthric speech + EMA | Audio + EMA | 15 speakers (8 dysarthric + 7 control) | 18–45 GB | LDC License | RESTRICTED | **Rejected** | Non-Indian English; high storage; superseded by India-focused clinical strategy. |
| **AIKosh Indian English Dysarthria** | Indian English | High (Indian speaker) | Dysarthric speech | Audio | 1 speaker (73 sentences, 8.5 min) | <0.10 GB | Open | Open | **Rejected** | Single speaker provides insufficient statistical power for participant-independent model training/evaluation. |
| **OpenNeuro ds007358** | N/A | High (India + Tanzania) | Resting-state / cognitive EEG | EEG | 2,000 participants | >20.00 GB | CC0 | OpenNeuro | **Rejected** | Tasks are resting-state (eyes open/closed); no speech production paradigm. |
| **Speech-data/Tamil-Speech-Dataset** | Tamil | High (Tamil speech) | Normal speech | Audio | Metadata only | Metadata only | CC BY-NC-ND 4.0 | Hugging Face | **Rejected** | Listing is metadata-only without accessible audio downloads; restrictive license. |
| **EmoTa (Sri Lankan Tamil)** | Sri Lankan Tamil | Low (Sri Lankan dialect) | Emotional Tamil speech | Audio | UNVERIFIED | ~2.00 GB | Academic-Commercial | Request | **Rejected** | Sri Lankan Tamil phonology differs from Indian Tamil; request-based access. |

---

## Storage Summary

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              STORAGE BUDGET BREAKDOWN (POST DATASET #2)                │
├──────────────────────────────────────────────────────┬─────────────┬───────────────────┤
│ Component                                            │ Permanent   │ Peak Impact       │
├──────────────────────────────────────────────────────┼─────────────┼───────────────────┤
│ 1. Existing JapanEEG ds007808 Sample (REFERENCE_ONLY) │ 3.00 GB     │ 3.00 GB           │
│ 2. Chitkara Facial EMG Dataset (ACQUIRED)             │ 0.01 GB     │ 0.01 GB           │
│ 3. OpenSLR65 Crowdsourced Tamil (ACQUIRED)            │ 1.50 GB     │ 2.84 GB           │
│ 4. AI4Bharat Svarah Indian English                   │ 1.10 GB     │ 2.20 GB           │
│ 5. IISc-MILE SLR127 Tamil ASR                        │ 13.00 GB    │ 26.00 GB          │
│ 6. SSNCE Tamil Dysarthric Speech (LDC2021S04)        │ 0.62 GB     │ 1.24 GB           │
│ 7. DAU-KDAH Multimodal Dysarthric Corpora            │ 0.97 GB     │ 1.94 GB           │
├──────────────────────────────────────────────────────┼─────────────┼───────────────────┤
│ Extracted Useful Research Data Subtotal              │ 20.20 GB    │ —                 │
│ Infrastructure: Preprocessed Features (ESTIMATED)    │ 4.00 GB     │ 4.00 GB           │
│ Infrastructure: PostgreSQL Database & WAL (ESTIMATED)│ 0.50 GB     │ 0.50 GB           │
│ Infrastructure: Cache, Extraction, Temp (ESTIMATED)  │ 3.00 GB     │ 5.00 GB           │
├──────────────────────────────────────────────────────┼─────────────┼───────────────────┤
│ TOTAL PERMANENT STORAGE                              │ 27.70 GB    │ —                 │
│ WORST-CASE SIMULTANEOUS PEAK STORAGE                 │ —           │ 45.23 GB          │
│ SEQUENTIAL OPERATIONAL PEAK STORAGE                  │ —           │ 40.40 GB          │
│ MANDATORY SAFETY BUFFER (50.00 GB - 45.23 GB)        │ 4.77 GB     │ ≥ 2.00 GB (PASS)  │
│ ABSOLUTE HARD STORAGE CEILING                        │ 50.00 GB    │ 50.00 GB          │
└──────────────────────────────────────────────────────┴─────────────┴───────────────────┘
```

---

## Sequential Acquisition & Disk Safety Rules

1. **Strict Sequential Execution:** Download only one archive at a time.
2. **Mandatory Verification:** Verify SHA256 checksum and inspect audio/metadata integrity before extraction.
3. **Archive Cleanup:** Delete compressed archive immediately after successful extraction and QC validation.
4. **No Synthetic Inflation:** Do not manufacture synthetic physiological data to artificially fill storage.

**STOP. DO NOT INITIATE DOWNLOADS UNTIL EXPLICIT HUMAN APPROVAL IS PROVIDED.**
