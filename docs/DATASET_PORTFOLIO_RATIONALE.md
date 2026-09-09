# NeuroSpeech-Rehab — Dataset Portfolio Scientific Rationale

**Date:** 2026-09-05  
**Document Version:** 2.0  
**Project:** NeuroSpeech-Rehab  
**Core Mission:** AI-Assisted Multimodal Speech Rehabilitation for Neurological Motor Speech Disorders (Dysarthria, Apraxia, Post-Stroke, Cerebral Palsy) with Primary Focus on India (Tamil + Indian English).  
**Storage Constraint:** ≤ 50 GB hard local storage budget; ≥ 2.0 GB safety margin.

---

## 1. Executive Summary & Research Context

NeuroSpeech-Rehab is designed to provide closed-loop, objective, multimodal speech therapy for patients recovering from neurological speech impairments. Speech motor rehabilitation requires modeling both normative acoustic/phonetic targets and pathological articulatory/acoustic deviations.

A common failure mode in medical AI projects is **data hoarding**—downloading multi-hundred-gigabyte generic speech corpora that contain no clinical labels, no motor impairment metadata, and no articulatory ground truth, while exhausting computational and storage resources.

This document establishes the scientific justification for our curated, storage-efficient **India-focused dataset portfolio**. The portfolio balances:
1. **Clinical / Dysarthric Speech Data**: Primary target for pathology detection, severity grading, and intelligibility scoring.
2. **Normative Bilingual Baselines (Tamil + Indian English)**: High-diversity control speech to isolate dialectal and L1 phonological transfer from motor impairment.
3. **Auxiliary Oral-Motor Modalities (Facial Video & Surface EMG)**: Biomechanical and neuromuscular baselines for articulatory movement tracking and muscle activation analysis.
4. **Isolated Historical Multimodal Reference (JapanEEG)**: Reference architecture for BIDS compliance and EEG signal pipeline verification.

---

## 2. Scientific Evaluation Across Key Research Dimensions

### 2.1 Tamil Speech Rehabilitation (Native Target Population)
- **Clinical Need**: Tamil is spoken by over 75 million people in Tamil Nadu, Puducherry, and the global diaspora. Dysarthria manifestations in Dravidian languages involve specific articulatory challenges: retroflex consonants (`/ʈ/`, `/ɖ/`, `/ɳ/`, `/ɭ/`, `/ɻ/`), geminates, and vowel length contrasts (`/a/` vs `/aː/`).
- **Pathological Anchor**: **SSNCE Database of Tamil Dysarthric Speech (LDC2021S04)** provides 20 cerebral palsy dysarthric individuals (mild, moderate, severe) + 10 matched controls recorded in Chennai with time-aligned phonetic transcriptions and clinical intelligibility ratings.
- **Normative Baseline**: **IISc-MILE Tamil ASR Corpus (SLR127)** provides 150 hours from 531 native Tamil speakers across genders and age groups in studio-clean acoustic conditions.
- **Acoustic Robustness**: **OpenSLR65 Crowdsourced Tamil** adds 4,291 recordings across real-world smartphone and background noise conditions.
- **Scientific Value**: Allows training acoustic models that recognize dysarthric Tamil phoneme substitutions/distortions while benchmarked against 531+ healthy native speakers.

### 2.2 Indian English Speech (Bilingual & Urban Rehabilitation)
- **Clinical Need**: In urban clinical settings across India, speech therapy is frequently conducted bilingually in English and regional languages. Indian English possesses unique phonological characteristics (retroflex stops `/ʈ/`, `/ɖ/` replacing alveolar `/t/`, `/d/`; rhoticity variations; syllable-timed prosody; distinctive vowel formant spaces influenced by L1 background).
- **Normative Baseline**: **AI4Bharat Svarah** (~1.1 GB, 117 speakers) was recorded across 65 districts and 19 Indian states representing 19 distinct L1 native language backgrounds.
- **Scientific Value**: Disentangles accent-induced phonetic shifts (L1 language transfer) from motor speech pathology. Without Svarah, a speech assessment model might misclassify standard Indian English phonetic variations as dysarthric imprecision.
- **Dysarthric Target**: **DAU-KDAH** provides Indian English dysarthric speech alongside Indian languages with clinical severity labels.

### 2.3 Dysarthria Research & Severity Stratification
- **Clinical Need**: Speech rehabilitation tools must grade dysarthric severity (e.g., Frenchay Dysarthria Assessment, FDA-2, or Robertson Dysarthria Profile) and track recovery trajectories over weeks of therapy.
- **Core Assets**:
  - **SSNCE (LDC2021S04)**: Time-aligned phonetic labels for dysarthric Tamil; intelligibility scores; muscle tone / CP categorization.
  - **DAU-KDAH**: Severity-stratified recordings (mild, moderate, severe) with neurotypical controls across Indian speakers.
- **Scientific Value**: Enables training of automated intelligibility estimators, phoneme distortion detectors, and objective therapeutic progression metrics.

### 2.4 Facial Movement & Articulatory Visual Tracking
- **Clinical Need**: Apraxia of speech and flaccid/spastic dysarthria frequently manifest as reduced lip aperture, asymmetric oral excursion, or impaired bilabial closure (`/p/`, `/b/`, `/m/`).
- **Asset**: **DAU-KDAH** provides synchronized facial video paired with dysarthric speech production.
- **Pipeline Integration**: High-frame-rate landmark extractors (MediaPipe Face Mesh, OpenFace) extract dynamic oral-facial metrics:
  - Vertical lip opening (inter-lip distance)
  - Horizontal lip spread (commissure excursion)
  - Lip symmetry index (left vs. right oral deviation)
  - Bilabial contact duration during stop closure

### 2.5 Facial Surface EMG (sEMG) Research
- **Clinical Need:** Surface EMG directly captures neuromuscular activation of perioral muscles (orbicularis oris, zygomaticus major, masseter, mentalis) prior to acoustic onset, enabling silent speech decoding and articulatory effort monitoring.
- **Asset A (ACQUIRED):** **Facial EMG Dataset (Sharma, Chitkara University, 2025)** (~12.76 MB, 15 participants, CSV recordings). Already acquired from Zenodo 17158391. Provides auxiliary non-clinical sEMG signal-processing baseline.
- **Asset B (PENDING ACCESS VERIFICATION):** **Mimetic Interfaces: Facial Surface EMG Dataset 2015** (~0.20 GB ESTIMATED, 15 participants, 5 documented facial muscles, 2048 Hz, MATLAB `.mat`). Authoritative source is Tampere University / CSC Finland. Scientifically richer documentation and known muscle/sampling parameters, but download access is not yet verified.
- **Scientific Value:** Validates the backend signal preprocessing engine (notch filtering at 50/60 Hz, bandpass 20–450 Hz, rectified RMS envelope extraction, signal-to-noise ratio calculation, artifact rejection) before clinical sEMG data collection in India.
- **Portfolio Decision:** Retain Chitkara dataset as the current auxiliary baseline. Do not acquire Mimetic 2015 until its public download access is confirmed.

### 2.6 Future EEG Integration & Reference Prototype
- **Clinical Need**: Cortical tracking of speech intention (auditory-motor feedback, mu rhythm suppression, N400/P300 event-related potentials) during speech motor imagery.
- **Asset**: **JapanEEG ds007808** (~3.0 GB existing sample, 3 participants, BIDS 1.9.0).
- **Strategic Role**: Marked as `REFERENCE_ONLY / DEPRECATED FOR PRIMARY INDIA STRATEGY`. It serves exclusively as a structural and architectural testbed for BIDS compliance, channel coordinate transformation, and multi-channel EDF/BrainVision ingestion without confounding Indian speech training.

### 2.7 Multimodal Model Development & Ablation Framework
- **Clinical Need**: Determine which sensor combinations provide maximum rehabilitation benefit without overburdening patients with sensors.
- **Systematic Ablation Matrix**:
  1. Audio only (standard acoustic assessment)
  2. Vision only (silent articulation / lip reading)
  3. sEMG only (subvocal / neuromuscular effort)
  4. Audio + Vision (audio-visual articulatory assessment)
  5. Audio + sEMG (acoustic-neuromuscular coupling)
  6. Full Multimodal (Audio + Vision + sEMG + EEG)
- **Scientific Value**: The selected portfolio directly feeds this ablation matrix with real, calibrated data.

### 2.8 Participant-Level Evaluation & Generalization Rigor
- **Clinical Need**: Preventing data leakage across train, validation, and test splits.
- **Framework**: `ResearchParticipant` isolation enforced at the database and split engine level:
  - No recording from a test participant may appear in training or validation.
  - Stratified partitioning by clinical severity and speaker demographic.
  - Independent, locked final test set (`datasets.is_final_test = true`).

---

## 3. Storage Optimization & Rejection Rationale

| Candidate Dataset | Full Size | Decision | Scientific & Engineering Rationale |
|-------------------|-----------|----------|------------------------------------|
| **AI4Bharat IndicVoices** | 745 GB | REJECTED | Massive multilingual raw corpus. Downloading the entire 745 GB archive would violate the 50 GB ceiling by 15x. Per-language archive slices with verified download sizes are not publicly exposed as self-service downloads. |
| **AI4Bharat IndicVoices-R** | 1.05 TB | REJECTED | TTS-oriented database; exceeds budget by >20x. |
| **AI4Bharat NPTEL2020** | 1.1–1.7 TB | REJECTED | Lecture recordings; lacks speaker diversity metadata and clinical relevance; exceeds budget by >20x. |
| **BhasaAnuvaad NPTEL (HF)** | 121 GB | REJECTED | Exceeds 50 GB budget by >2.4x. |
| **Microsoft Indian Speech (All 11 Languages)** | ~12.3 GB | SUBSET SELECTED | Contains 11 Indian languages. Only the Tamil partition (**OpenSLR65**, ~1.5 GB) is selected; the remaining ~11 GB of Gujarati, Punjabi, Odia, etc. are rejected to preserve storage for target clinical and bilingual data. |
| **IIT-M Indian Language ASR** | >50 GB | REJECTED | Multilingual ASR corpus. Tamil partition is superseded by open, studio-quality IISc-MILE SLR127 (150 hrs, 531 spk, CC BY 2.0). |
| **IIT-M Indic TTS Database** | ~1–2 GB | REJECTED | Single-speaker clean studio recordings for TTS. Lacks speaker diversity; normative Tamil is already covered by 531 speakers in SLR127. |
| **Project Vaani (General)** | Hundreds of GB | REJECTED | Uncurated crowdsourced audio without clinical dysarthria labels; exceeds storage limit. |
| **SPIRE-SIES (IISc SPIRE Lab)** | ~15–25 GB | REJECTED | Large Indian English corpus. AI4Bharat Svarah achieves representative accent coverage (117 speakers, 19 states) in only 1.1 GB, leaving headroom for Tamil and dysarthric corpora. |
| **TORGO (LDC2012S02)** | 18–45 GB | REJECTED | English dysarthria (Canada). Not India-specific; large download; LDC license barrier. |
| **TamilVoiceCorpus** | ~43 GB | REJECTED | Consumes ~86% of total storage budget for unverified normal speech; crowdsourced Tamil is already efficiently captured in OpenSLR65 (1.5 GB). |
| **AIKosh Indian English Dysarthria** | <0.1 GB | REJECTED | Single speaker (8.5 minutes, 73 sentences); statistically inadequate for participant-independent validation. |

---

## 4. Portfolio Storage Synthesis

```
50.00 GB  ┌────────────────────────────────────────────────────────┐
           │ Safety Buffer: 7.95 GB (15.9%)                         │
42.05 GB  ├────────────────────────────────────────────────────────┤  <-- Worst-Case Peak
           │ SLR127 Archive: 13.00 GB (deleted post-validation)     │
           │ Svarah & OpenSLR Archives: 2.55 GB (deleted post-QC)   │
26.30 GB  ├────────────────────────────────────────────────────────┤  <-- Permanent Retained
           │ Preprocessed Features & Embeddings: 4.00 GB            │
           │ PostgreSQL 16 DB & Cache: 3.50 GB                      │
           │ IISc-MILE SLR127 Extracted: 13.00 GB                   │
           │ OpenSLR65 Tamil Extracted: 1.50 GB                     │
           │ AI4Bharat Svarah Extracted: 1.10 GB                    │
           │ Chitkara Facial EMG Extracted: 0.01 GB                 │
  3.00 GB  ├────────────────────────────────────────────────────────┤
           │ Existing JapanEEG ds007808 Sample: 3.00 GB (REFERENCE) │
  0.00 GB  └────────────────────────────────────────────────────────┘
```

- **Permanent Storage (Verified Baseline)**: **26.30 GB** (Leaves **21.70 GB** margin against 48 GB ceiling)
- **Worst-Case Peak (During Extraction)**: **42.05 GB** (Leaves **7.95 GB** safety buffer against 50 GB hard ceiling)
- **Sequential Acquisition Operational Peak**: **~40.40 GB** (Leaves **9.60 GB** safety buffer)
- **Expansion Reserve:** Even if **SSNCE LDC2021S04** (+0.62 GB) and **DAU-KDAH** (+0.97 GB) are acquired upon license approval, total permanent storage reaches only **27.89 GB** and peak reaches **45.23 GB**, maintaining a **4.77 GB** safety buffer.
- **Note:** The previously planned Mimetic Interfaces EMG 2015 (~0.20 GB) is **NOT counted as acquired**; it remains pending access verification. If access is confirmed, it can be added within the existing safety buffer.

---

## 5. Conclusion & Strategic Roadmap

The audited portfolio maximizes scientific value per gigabyte. Rather than amassing hundreds of gigabytes of unstructured, unannotated speech, this portfolio delivers:
1. High acoustic diversity across 531+ Tamil speakers and 117+ Indian English speakers.
2. Direct clinical pathways for Tamil dysarthria (SSNCE) and Indian English multimodal dysarthria (DAU-KDAH).
3. Validated sEMG and facial video baseline pipelines.
4. Guaranteed compliance with the 50 GB storage ceiling.
