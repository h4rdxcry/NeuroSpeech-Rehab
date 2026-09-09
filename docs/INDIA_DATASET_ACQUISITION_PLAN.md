# India Dataset Acquisition Plan

**Date:** 2026-09-05  
**Status:** ACTIVE — supersedes prior JapanEEG-first strategy  
**Scope:** India-focused bilingual (Tamil + Indian English) speech rehabilitation dataset portfolio, with EEG and facial EMG/video baselines.  
**Hard limit:** 50 GB total local storage.  
**Target:** 45–48 GB total local storage (reproducible scenario).  
**Safety buffer:** ≥ 2 GB remaining.  

---

## 1. Objective

Acquire a scientifically useful, real-dataset portfolio for:
- Tamil dysarthric speech
- Tamil normal speech (baseline/control)
- Indian English speech
- Indian English dysarthric speech
- EEG (India-relevant baseline)
- Facial EMG baseline
- Facial/lip tracking capability

All acquisitions must preserve pseudonymization, BIDS compatibility where applicable, full provenance, and must not exceed the 50 GB hard storage limit.

---

## 2. Storage Budget

| Budget Line | Allocation |
|-------------|-----------|
| Absolute maximum | 50 GB |
| Target ceiling | 48 GB |
| Safety buffer | 2 GB |
| Existing JapanEEG reference sample | 3 GB (already on disk; retained as REFERENCE_ONLY) |
| Available for new acquisitions | ~45 GB |

---

## 3. Recommended Datasets

| Dataset | Language | Modality | Participants/Speakers | Full Dataset Size | Download Size | Extracted Size | Permanent Size | Peak Temporary Storage | Archive Retained? | License | Access Requirement | Scientific Purpose | Status |
|---------|----------|----------|----------------------|-------------------|---------------|----------------|----------------|----------------------|-------------------|---------|-------------------|-------------------|--------|
| JapanEEG ds007808 (partial sample) | Japanese | EEG, AUDIO | 3 | ~1575 GB (full) | ~3.0 GB | ~3.0 GB | ~3.0 GB | ~0 GB | Yes | CC0 | PUBLIC | REFERENCE_ONLY / DEPRECATED FOR PRIMARY INDIA STRATEGY — historical prototype reference | REFERENCE_ONLY |
| SSNCE Database of Tamil Dysarthric Speech (LDC2021S04) | Tamil | AUDIO | 20 dysarthric + 10 controls | ~0.62 GB | ~0.62 GB | ~0.62 GB | ~0.62 GB | ~1.24 GB | Yes | LDC license | RESTRICTED — LDC membership or non-member agreement required | Tamil dysarthric speech + control baseline; time-aligned phonetic transcripts; clinical metadata (intelligibility scores, CP type, muscle tone) | RECOMMENDED (pending access) |
| IISc-MILE Tamil ASR Corpus (SLR127) | Tamil | AUDIO | 531 | ~13 GB | ~13.0 GB tar.gz | ~13.0 GB | ~13.0 GB | ~26.0 GB | Yes | CC BY 2.0 | PUBLIC | Tamil normal speech baseline; 531 speakers; high-quality read speech; transcripts | RECOMMENDED |
| OpenSLR65 Crowdsourced Tamil | Tamil | AUDIO | UNVERIFIED — 4,291 recordings listed; unique speaker count unconfirmed | ~1.5 GB extracted | ~1.45 GB zip | ~1.5 GB | ~1.5 GB | ~2.95 GB | Yes | CC BY-SA 4.0 | PUBLIC | Tamil normal speech supplement; crowdsourced diversity; transcripts | RECOMMENDED |
| AI4Bharat Svarah | English (Indian accent) | AUDIO | 117 | ~1.1 GB | ~1.1 GB | ~1.1 GB | ~1.1 GB | ~2.2 GB | Yes | CC BY 4.0 (with HuggingFace conditions) | PUBLIC with HuggingFace conditions acceptance | Indian English accent diversity; 117 speakers; 65 districts; 19 states; 19 native languages; read + spontaneous; transcripts + speaker metadata | RECOMMENDED |
| DAU-KDAH Dysarthric Multi-Lingual and Multimodal Speech Corpora | Hindi, Marathi, Gujarati, Indian English | AUDIO + VIDEO | UNVERIFIED | ~0.97 GB | ~0.97 GB | ~0.97 GB | ~0.97 GB | ~1.94 GB | Yes | UNVERIFIED — likely academic/research use only | RESTRICTED — available upon request from corresponding author (Prof. Hemant A. Patil) | Indian English dysarthric speech with severity labels; audio-video multimodal; controls included | RECOMMENDED (pending access) |
| Mimetic Interfaces Facial Surface EMG Dataset 2015 | N/A | EMG (facial surface) | 15 | UNVERIFIED (<1 GB estimated) | ~0.2 GB estimated | ~0.2 GB estimated | ~0.2 GB estimated | ~0.4 GB estimated | Yes | CC BY 4.0 | PUBLIC | Facial EMG baseline for pipeline development; 15 participants; MATLAB + metadata | RECOMMENDED (baseline only) |

**Total proposed download:** ~17.34 GB  
**Total extracted permanent data:** ~17.39 GB  
**Existing JapanEEG sample retained:** 3 GB  

---

## 4. Dataset Rationale

### 4.1 Tamil Dysarthric Speech
**SSNCE Database of Tamil Dysarthric Speech (LDC2021S04)** is the only publicly identified Tamil dysarthric speech corpus. It provides:
- 20 dysarthric speakers (cerebral palsy, ages 12–37) + 10 matched controls
- ~8 hours of 16 kHz FLAC audio
- Time-aligned phonetic transcripts and phoneme mappings
- Clinical metadata (intelligibility scores, CP type, muscle tone)
- Severity stratification (mild/moderate/severe)

No replacement dataset exists. It is the highest-priority acquisition despite the LDC access barrier.

### 4.2 Tamil Normal Speech
**IISc-MILE SLR127** provides ~150 hours of high-quality read speech from 531 native Tamil speakers in a noise-free studio environment. It is the strongest available Tamil ASR baseline.

**OpenSLR65** provides ~7 hours from ~4,291 crowdsourced speakers, adding speaker diversity and conversational variability. Together these two datasets give ~157 hours of Tamil control speech, which is scientifically sufficient for baseline acoustic modeling.

### 4.3 Indian English
**AI4Bharat Svarah** is the strongest open Indian English speech benchmark: 9.6 hours, 117 speakers, 65 districts, 19 states, 19 native languages, read + spontaneous speech, CC BY 4.0, and detailed speaker metadata.

**DAU-KDAH** adds Indian English dysarthric speech with severity annotations and simultaneous audio-video capture. It covers low/medium/high severity levels and includes neurotypical controls. The total corpus is only ~970 MB, making it a high-value addition. Access requires ethics-compliant request to the authors.

### 4.4 EEG
No open India-specific speech-production EEG dataset was identified. **OpenNeuro ds007358** is the only large-scale open dataset with Indian participant metadata, but its tasks (eyes closed/open, and an unverified "pc" task) are not speech-production paradigms, and the cohort mixes Indian and Tanzanian participants. 

**Decision:** Mark ds007358 as EVALUATED_BUT_NOT_USED for the primary India strategy. Seek India-specific speech EEG or collect pilot data under IRB supervision.

### 4.5 Facial EMG
**Mimetic Interfaces Facial Surface EMG Dataset 2015** is the only open facial EMG dataset found. It records from 15 healthy participants across 5 facial muscles during facial pacing tasks. While Finland-based and not India-specific, it is useful for baseline pipeline development and signal-quality validation. Exact file size is UNVERIFIED but expected to be <1 GB.

### 4.6 Facial / Lip Tracking
No suitable open India-specific lip-tracking or facial-video dataset for speech rehabilitation was identified. 

**Decision:** Use open-source landmark extractors (MediaPipe Face Mesh, OpenFace) during pilot data collection. Do not acquire a commercial video dataset at this stage.

---

## 5. Rejected Datasets

| Dataset | Reason |
|---------|--------|
| JapanEEG ds007808 (full) | Japanese language and population; superseded by India strategy. Retained partial sample as REFERENCE_ONLY. |
| Speech-data/Tamil-Speech-Dataset | License is CC BY-NC-ND 4.0, which restricts research reuse; actual audio files are not freely downloadable from the Hugging Face index (metadata-only listing). |
| AI4Bharat IndicVoices | 745 GB total; far exceeds budget. Subset download sizes per language/version are UNVERIFIED, making safe subset selection impossible. |
| AI4Bharat IndicVoices-R | 1.05 TB total; far exceeds budget. |
| AI4Bharat NPTEL2020 original | 1.1 TB compressed / 1.7 TB uncompressed; far exceeds budget. |
| AI4Bharat NPTEL (HuggingFace BhasaAnuvaad) | 121 GB total; far exceeds budget. |
| Microsoft Indian Speech (All 11 Languages) | ~12.3 GB total across 11 languages; only Tamil subset (OpenSLR65, ~1.5 GB) is selected; remaining ~11 GB non-target languages rejected. |
| IIT-M Indian Language ASR | >50 GB; exceeds budget; Tamil baseline is better served by open IISc-MILE SLR127 (150 hrs, CC BY 2.0). |
| IIT-M Indic TTS Database | Single-speaker clean studio audio lacks speaker diversity; normative Tamil is covered by 531 speakers in SLR127. |
| Project Vaani (General) | Hundreds of GB; uncurated crowdsourced audio without clinical dysarthria metadata; exceeds storage limit. |
| SPIRE-SIES (IISc SPIRE Lab) | ~15–25 GB; Svarah (1.1 GB, 117 speakers) provides required Indian English accent diversity with verified CC BY 4.0 license at low disk cost. |
| IndicTIMIT | Fragmented distribution; superseded by modern, open AI4Bharat Svarah. |
| TORGO (LDC2012S02) | 18–45 GB; English only, not India-specific, LDC license barrier. |
| Indian English Dysarthric Speech (AIKosh) | Single speaker, 8.5 minutes, 73 sentences; insufficient participant diversity for train/validation/test splits. |
| TamilVoiceCorpus | ~43 GB download; exceeds individual dataset comfort margin within 50 GB total. |
| EmoTa (Sri Lankan Tamil) | Sri Lankan Tamil dialects, not India-specific; access requires email request; academic-commercial license. |
| OpenNeuro ds007358 | Mixed India+Tanzania cohort; tasks are not speech-production paradigms; low scientific relevance for speech rehab. |
| Rasmalai / IndicVoices-R / Rasa | Multi-hundred-GB or TB-scale TTS datasets; exceed budget. |

---

## 6. Storage Calculation

### 6.1 Permanent Storage (archives deleted after validation)

| Category | Allocation |
|----------|-----------|
| Existing JapanEEG ds007808 partial sample | 3.0 GB |
| SSNCE LDC2021S04 extracted | 0.62 GB |
| IISc-MILE SLR127 extracted | 13.0 GB |
| OpenSLR65 Tamil extracted | 1.5 GB |
| AI4Bharat Svarah extracted | 1.1 GB |
| DAU-KDAH extracted | 0.97 GB |
| Mimetic Interfaces EMG extracted | 0.2 GB |
| **Extracted datasets subtotal** | **17.39 GB** |
| Preprocessed features (spectrograms, MFCC, landmarks, EMG envelopes) | 4.0 GB |
| PostgreSQL database + WAL + temp | 0.5 GB |
| HuggingFace / pip / extraction caches and temp working space | 3.0 GB |
| **Infrastructure subtotal** | **7.5 GB** |
| **TOTAL PERMANENT STORAGE** | **27.89 GB** |

### 6.2 Peak Storage (worst case — all archives retained)

| Category | Allocation |
|----------|-----------|
| Existing JapanEEG ds007808 partial sample | 3.0 GB |
| SSNCE LDC2021S04 archive + extracted | 1.24 GB |
| IISc-MILE SLR127 archive + extracted | 26.0 GB |
| OpenSLR65 Tamil archive + extracted | 2.95 GB |
| AI4Bharat Svarah archive + extracted | 2.2 GB |
| DAU-KDAH archive + extracted | 1.94 GB |
| Mimetic Interfaces EMG archive + extracted | 0.4 GB |
| **Archives + extracted subtotal** | **34.73 GB** |
| Preprocessed features | 4.0 GB |
| PostgreSQL database + WAL + temp | 0.5 GB |
| HuggingFace / pip / extraction caches and temp working space | 3.0 GB |
| **Infrastructure subtotal** | **7.5 GB** |
| **TOTAL PEAK STORAGE** | **45.23 GB** |

**Recommended scenario:** Reproducible (keep archives + extracted + processed).  
**Projected total peak:** 45.23 GB  
**Remaining buffer:** 4.77 GB  
**Status:** Within 50 GB hard limit.

> Note: If the Mimetic Interfaces EMG dataset turns out to be larger than estimated, the archive-retention scenario may approach 46–47 GB. Monitor exact download size before acquisition.

> Operational peak during sequential acquisition (delete archive after each dataset extraction): existing 3.0 GB + maximum single-dataset archive+extracted (SLR127: 26.0 GB) + growing extracted corpus + infrastructure ≈ 40.9 GB at the SLR127 extraction step. This remains below the 50 GB hard limit.

---

## 7. Large Dataset Subset Strategies

### 7.1 IndicVoices (745 GB)
- Full dataset size: 745 GB
- Proposed subset: NONE — subset sizes per language/version are UNVERIFIED
- Selection criteria: Cannot safely select subset without verified per-language archive sizes
- Scientific reason: High-value multilingual Indian speech corpus, but budget does not permit full download and safe subset selection is impossible
- Access/license restrictions: UNVERIFIED

**Decision:** REJECTED for current acquisition. Monitor for future subset release or storage expansion.

### 7.2 IndicVoices-R (1.05 TB)
- Full dataset size: 1.05 TB
- Proposed subset: NONE
- Selection criteria: Budget limit
- Scientific reason: TTS-focused; lower priority than dysarthric and ASR speech for rehabilitation pipeline
- Access/license restrictions: UNVERIFIED

**Decision:** REJECTED.

### 7.3 NPTEL2020 (1.1 TB compressed / 1.7 TB uncompressed)
- Full dataset size: 1.1 TB compressed / 1.7 TB uncompressed
- Proposed subset: NONE
- Selection criteria: Budget limit
- Scientific reason: Large lecture corpus; scientifically useful for ASR but exceeds storage budget by >20x
- Access/license restrictions: UNVERIFIED

**Decision:** REJECTED. The HuggingFace BhasaAnuvaad mirror (121 GB) also exceeds budget.

### 7.4 LDC-IL Tamil Sentence Aligned Speech Corpus (~46.4 GB)
- Full dataset size: ~46.4 GB
- Proposed subset: NONE
- Selection criteria: Single dataset would consume entire budget; no room for other priority datasets
- Scientific reason: High-quality Tamil speech, but acquisition would preclude Tamil dysarthric data (LDC2021S04) and Indian English datasets
- Access/license restrictions: LDC license, membership required

**Decision:** REJECTED in favor of a balanced multi-dataset portfolio. Revisit only if LDC2021S04 access is permanently denied.

---

## 8. Access Requirements and Action Items

| Dataset | Action Required | Blocker |
|---------|-----------------|---------|
| SSNCE LDC2021S04 | Obtain LDC membership or execute non-member license agreement (~$300 for non-members). | LDC agreement + download |
| DAU-KDAH | Email Prof. Hemant A. Patil (hemant_patil@daiict.ac.in) with institutional affiliation and intended use; await ethics-committee approval. | Author approval |
| AI4Bharat Svarah | Accept Hugging Face dataset conditions on the ai4bharat/Svarah page. | Hugging Face gated access |
| All others | No special approval needed. | None |

---

## 9. Data Integrity Classification

Every dataset in this plan is classified as **REAL**. No synthetic, demo, or fabricated data is proposed. Participant counts, storage sizes, licenses, and annotations are drawn from official sources or marked UNVERIFIED where the official source does not publish the exact value.

| Dataset | Classification |
|---------|---------------|
| JapanEEG ds007808 (partial) | REAL |
| SSNCE LDC2021S04 | REAL |
| IISc-MILE SLR127 | REAL |
| OpenSLR65 Tamil | REAL |
| AI4Bharat Svarah | REAL |
| DAU-KDAH | REAL |
| Mimetic Interfaces EMG 2015 | REAL |

Note: Separate datasets are NOT claimed to be synchronized multimodal data. Each dataset is independent and will be processed through the standard single-modality pipeline unless paired audio-video is explicitly noted (DAU-KDAH only).

---

## 10. UNVERIFIED Information

| Field | Dataset | Value | Why UNVERIFIED |
|-------|---------|-------|----------------|
| Exact download size | SSNCE LDC2021S04 | ~0.62 GB | OLAC catalog lists extent as 614,629 KB; exact package size may vary slightly by distribution format. |
| Exact download size | Mimetic Interfaces EMG 2015 | <1 GB estimated | No exact byte count found in public metadata; described only as "small MATLAB files." |
| Exact subset size | IndicVoices Tamil | UNVERIFIED | Full dataset is 745 GB; per-language archive sizes are not published, making safe subset selection impossible. |
| Participant count | ds007358 India-only subset | UNVERIFIED | Full dataset lists 2,000 participants on NEMAR, but India vs Tanzania breakdown is not published. |
| License terms | DAU-KDAH | UNVERIFIED | Repository README does not state a license file; authors describe it as academic/research use only pending ethics approval. |
| Exact speaker count | OpenSLR65 | UNVERIFIED | 4,291 recordings are listed, but whether each recording is a unique speaker or multiple recordings per speaker is not confirmed. |
| Full dataset size | Mimetic Interfaces EMG 2015 | UNVERIFIED (<1 GB) | No exact byte count found in public metadata. |

---

## 11. Scientific Priorities and Trade-offs

1. **Dysarthria first:** SSNCE and DAU-KDAH are prioritized over larger normal-speech corpora because the project's core mission is speech rehabilitation, not general ASR.
2. **Tamil coverage:** SLR127 + OpenSLR65 provide a strong control baseline; SSNCE provides the only available dysarthric Tamil data.
3. **Indian English coverage:** Svarah provides benchmark-grade accent diversity; DAU-KDAH provides dysarthric severity labels.
4. **Modality balance:** Audio dominates the portfolio because open facial-EMG and lip-video datasets for Indian speech are essentially unavailable. The pipeline should be designed to ingest new modalities as pilot data is collected.
5. **No fabrication:** Exact sizes, licenses, and access requirements are documented. Where information cannot be verified, it is marked UNVERIFIED.
6. **No data hoarding:** Large datasets that exceed the storage limit are rejected outright rather than partially downloaded without a validated subset strategy.

---

## 12. Next Steps

1. Obtain LDC non-member agreement for SSNCE LDC2021S04.
2. Accept Hugging Face conditions and download AI4Bharat Svarah.
3. Download IISc-MILE SLR127 and OpenSLR65.
4. Email Prof. Hemant A. Patil requesting DAU-KDAH access.
5. Download Mimetic Interfaces EMG dataset.
6. Do NOT download ds007358 or any JapanEEG files at this stage.
7. Do NOT start model training or Phase 5/6 work until datasets are registered, split, and QC-complete.

---

## 13. Relationship to JapanEEG ds007808

JapanEEG ds007808 remains in `data/raw/ds007808` and in the database as a **REFERENCE_ONLY** historical sample. It is **deprecated for the primary India strategy** and must not be used as the main EEG or speech source for new model development. All new acquisitions must follow this document.

---

## 14. Final Candidate Audit (2026-09-05)

The following candidates were researched but not included in the initial plan. Each is evaluated for scientific value within the 50 GB limit.

### 14.1 High-Priority Dysarthric/Atypical Speech Candidates

| Dataset | Language | Modality | Participants | Full Size | Proposed Subset | Extracted Size | Permanent Size | Peak Temp | License | Access | Scientific Benefit | Confidence |
|---------|----------|----------|--------------|-----------|-----------------|----------------|----------------|-----------|---------|--------|-------------------|------------|
| HDSD (Hindi Dysarthric Speech Database) | Hindi | AUDIO | 60 dysarthric | UNVERIFIED (~1-3 GB est.) | Full (if ≤3 GB) | UNVERIFIED (~1-3 GB) | UNVERIFIED (~1-3 GB) | UNVERIFIED (~2-6 GB) | UNVERIFIED | UNVERIFIED — likely restricted, author request | Hindi dysarthric speech; cross-linguistic severity analysis; 60 speakers | UNVERIFIED |
| Indian Stroke Speech Corpus | Likely Hindi/English | AUDIO | 50 stroke patients + 50 controls | UNVERIFIED (~1-3 GB est.) | Full (if ≤3 GB) | UNVERIFIED (~1-3 GB) | UNVERIFIED (~1-3 GB) | UNVERIFIED (~2-6 GB) | UNVERIFIED | UNVERIFIED — clinical data, ethics approval required | Stroke dysarthria; patient vs control design; clinical metadata | UNVERIFIED |
| Vaani-Atypical-Speech-Corpus (ARTPARK IISc) | Multiple Indian | AUDIO (+video?) | UNVERIFIED | UNVERIFIED | UNVERIFIED | UNVERIFIED | UNVERIFIED | UNVERIFIED | UNVERIFIED | UNVERIFIED — ARTPARK/IISc restricted | Atypical speech diversity; multiple conditions/languages | UNVERIFIED |
| SSN-TDSC (Tamil Dysarthric Speech Corpus) | Tamil | AUDIO | UNVERIFIED | UNVERIFIED | UNVERIFIED | UNVERIFIED | UNVERIFIED | UNVERIFIED | UNVERIFIED | UNVERIFIED | Additional Tamil dysarthric data if distinct from LDC2021S04 | UNVERIFIED |

### 14.2 Medium-Priority Indian English Normal Speech Candidates

| Dataset | Language | Modality | Participants | Full Size | Proposed Subset | Extracted Size | Permanent Size | Peak Temp | License | Access | Scientific Benefit | Confidence |
|---------|----------|----------|--------------|-----------|-----------------|----------------|----------------|-----------|---------|--------|-------------------|------------|
| IndicTIMIT | English (Indian) | AUDIO | 80 | UNVERIFIED (~2-5 GB est.) | Full (if ≤5 GB) | UNVERIFIED (~2-5 GB) | UNVERIFIED (~2-5 GB) | UNVERIFIED (~4-10 GB) | UNVERIFIED | UNVERIFIED — may require request | Phonetically balanced Indian English; 80 speakers; good for ASR/pronunciation | UNVERIFIED |
| SPIRE-SIES | English (Indian) | AUDIO | 1567 | UNVERIFIED (~5-15 GB est.) | Subset (not verified available) | UNVERIFIED | UNVERIFIED | UNVERIFIED | UNVERIFIED | UNVERIFIED | Large speaker diversity for Indian English | UNVERIFIED |

### 14.3 Rejected — Too Large or Insufficient Value

| Dataset | Reason |
|---------|--------|
| LDC-IL Tamil Sentence Aligned Speech Corpus | ~46.4 GB full; consumes entire budget; subset access not verified; LDC license |
| TamilVoiceCorpus | ~43 GB download; exceeds individual dataset margin; no verified subset |
| AIKosh Indian English Dysarthric Speech | Single speaker, 8.5 minutes, 73 sentences; insufficient diversity |
| AI4Bharat IndicVoices | 745 GB total; per-language sizes UNVERIFIED; safe subset selection impossible |
| AI4Bharat IndicVoices-R | 1.05 TB total; exceeds budget |
| AI4Bharat NPTEL2020 | 1.1 TB compressed / 1.7 TB uncompressed; HuggingFace mirror 121 GB also exceeds budget |

---

## 15. Access Verification (2026-09-05)

Verified against official sources. Only datasets with **READY** or **READY_AFTER_REGISTRATION** status are included in the final download manifest.

| Dataset | Access Status | Verification |
|---------|---------------|--------------|
| IISc-MILE SLR127 | READY | CC BY 2.0, public download from OpenSLR (http://www.openslr.org/127) |
| OpenSLR65 Tamil | READY | CC BY-SA 4.0, public download from OpenSLR (http://www.openslr.org/65/) |
| Mimetic Interfaces EMG 2015 | READY | CC BY 4.0, public download from Zenodo (https://zenodo.org/record/17585) |
| AI4Bharat Svarah | READY_AFTER_REGISTRATION | CC BY 4.0, public on HuggingFace (ai4bharat/Svarah) after accepting dataset conditions |
| SSNCE LDC2021S04 | PENDING_ACCESS | LDC license, requires LDC membership or non-member agreement (~$300). Access not yet obtained. |
| DAU-KDAH | PENDING_ACCESS | License UNVERIFIED (academic/research use stated). Requires author request to Prof. Hemant A. Patil + ethics approval. Access not yet obtained. |
| HDSD | UNVERIFIED | No public metadata, access, or license found. Cannot verify. |
| Indian Stroke Speech Corpus | UNVERIFIED | No public metadata, access, or license found. Cannot verify. |
| Vaani-Atypical-Speech-Corpus | UNVERIFIED | No public metadata, access, or license found. Cannot verify. |
| SSN-TDSC | UNVERIFIED | No public metadata; may overlap LDC2021S04. Cannot verify. |
| IndicTIMIT | UNVERIFIED | No public metadata, access, or license found. Cannot verify. |
| SPIRE-SIES | UNVERIFIED | No public metadata; subset availability unknown. Cannot verify. |

---

## 16. Final Portfolio (Access-Verified Only)

### 16.1 FINAL DOWNLOAD MANIFEST (READY + READY_AFTER_REGISTRATION)

| Dataset | Language | Modality | Participants | Permanent Size | Status |
|---------|----------|----------|--------------|----------------|--------|
| JapanEEG ds007808 (partial) | Japanese | EEG, AUDIO | 3 | 3.0 GB | REFERENCE_ONLY / DEPRECATED FOR PRIMARY INDIA STRATEGY |
| IISc-MILE SLR127 | Tamil | AUDIO | 531 | 13.0 GB | READY |
| OpenSLR65 Tamil | Tamil | AUDIO | UNVERIFIED | 1.5 GB | READY |
| Mimetic Interfaces EMG 2015 | N/A | EMG | 15 | 0.2 GB | READY |
| AI4Bharat Svarah | Indian English | AUDIO | 117 | 1.1 GB | READY_AFTER_REGISTRATION |

**Total extracted permanent data (new):** 15.8 GB  
**Plus existing JapanEEG:** 3.0 GB  
**Plus infrastructure (features, DB, cache):** 7.5 GB  
**TOTAL PERMANENT (verified only):** 26.3 GB

### 16.2 PENDING ACCESS (High Value — Do NOT Download Until Access Confirmed)

| Dataset | Priority | Language | Modality | Est. Permanent | Access Blocker |
|---------|----------|----------|----------|----------------|----------------|
| SSNCE LDC2021S04 | P0 (Dysarthric) | Tamil | AUDIO | 0.62 GB | LDC agreement (~$300) |
| DAU-KDAH | P2 (Dysarthric) | Hi/Mr/Gu/En | AUDIO+VIDEO | 0.97 GB | Author request + ethics |

**Action:** Obtain written access confirmation, exact size, and license terms before download. If both added: +1.59 GB permanent, peak remains ≤ 45.23 GB.

### 16.3 UNVERIFIED (Cannot Verify — Do NOT Download)

- HDSD, Indian Stroke Speech Corpus, Vaani-Atypical-Speech-Corpus, SSN-TDSC, IndicTIMIT, SPIRE-SIES

### 16.4 REJECTED

- LDC-IL Tamil (~46.4 GB)
- TamilVoiceCorpus (~43 GB)
- AIKosh Indian English Dysarthric (single speaker)
- AI4Bharat IndicVoices (745 GB)
- AI4Bharat IndicVoices-R (1.05 TB)
- AI4Bharat NPTEL2020 (1.1-1.7 TB)
- Speech-data/Tamil-Speech-Dataset (CC BY-NC-ND, audio not downloadable)
- EmoTa (Sri Lankan Tamil)
- OpenNeuro ds007358 (not speech-production)
- TORGO LDC2012S02 (English only, LDC)
- Rasmalai/IndicVoices-R/Rasa (multi-hundred-GB)

---

## 17. Final Storage Calculation

### 17.1 Permanent Storage (after archive cleanup — VERIFIED DATASETS ONLY)

| Category | Allocation |
|----------|-----------|
| Existing JapanEEG ds007808 partial sample | 3.0 GB |
| IISc-MILE SLR127 extracted | 13.0 GB |
| OpenSLR65 Tamil extracted | 1.5 GB |
| AI4Bharat Svarah extracted | 1.1 GB |
| Mimetic Interfaces EMG extracted | 0.2 GB |
| **Extracted datasets subtotal** | **15.8 GB** |
| Preprocessed features (spectrograms, MFCC, landmarks, EMG envelopes) | 4.0 GB |
| PostgreSQL database + WAL + temp | 0.5 GB |
| HuggingFace / pip / extraction caches and temp working space | 3.0 GB |
| **Infrastructure subtotal** | **7.5 GB** |
| **TOTAL PERMANENT STORAGE (verified)** | **26.3 GB** |

### 17.2 Peak Storage (worst case — all verified archives retained during acquisition)

| Category | Allocation |
|----------|-----------|
| Existing JapanEEG ds007808 partial sample | 3.0 GB |
| IISc-MILE SLR127 archive + extracted | 26.0 GB |
| OpenSLR65 Tamil archive + extracted | 2.95 GB |
| AI4Bharat Svarah archive + extracted | 2.2 GB |
| Mimetic Interfaces EMG archive + extracted | 0.4 GB |
| **Archives + extracted subtotal** | **31.55 GB** |
| Preprocessed features | 4.0 GB |
| PostgreSQL database + WAL + temp | 0.5 GB |
| HuggingFace / pip / extraction caches and temp working space | 3.0 GB |
| **Infrastructure subtotal** | **7.5 GB** |
| **TOTAL PEAK STORAGE (verified)** | **42.05 GB** |

### 17.3 Operational Peak (Sequential Acquisition, Delete Archives After Each)

| Step | Peak at Step |
|------|--------------|
| Start (existing only) | 3.0 GB |
| After Mimetic EMG (archive + extracted) | 3.6 GB |
| After OpenSLR65 (archive + extracted) | 6.55 GB |
| After AI4Bharat Svarah (archive + extracted) | 8.75 GB |
| After IISc-MILE SLR127 (archive + extracted) — **MAX** | **40.8 GB** |
| After all archives deleted | 26.3 GB |

### 17.4 Safety Check

| Metric | Value | Limit | Status |
|--------|-------|-------|--------|
| Permanent storage (verified) | 26.3 GB | ≤ 48 GB | PASS (21.7 GB margin) |
| Worst-case peak (verified) | 42.05 GB | ≤ 50 GB | PASS (7.95 GB margin) |
| Operational peak (sequential) | ~40.8 GB | ≤ 50 GB | PASS (9.2 GB margin) |
| Safety buffer | ≥ 7.95 GB | ≥ 2 GB | PASS |

### 17.5 If PENDING_ACCESS Datasets Added Later (After Access Confirmed)

| Scenario | Permanent | Worst-Case Peak | Operational Peak |
|----------|-----------|-----------------|------------------|
| Add SSNCE LDC2021S04 | +0.62 GB = 26.92 GB | +1.24 GB = 43.29 GB | +1.24 GB at its step |
| Add DAU-KDAH | +0.97 GB = 27.89 GB | +1.94 GB = 45.23 GB | +1.94 GB at its step |
| Add Both | 27.89 GB | 45.23 GB | ~42.7 GB |

**Both PENDING_ACCESS datasets can be added later without exceeding 50 GB peak.**

---

## 18. Why This Portfolio Is Better

1. **Dysarthria-first allocation:** SSNCE LDC2021S04 (P0) and DAU-KDAH (P2) are prioritized for future acquisition; current verified portfolio establishes Tamil and Indian English normal speech baselines first.
2. **Balanced language coverage:** Tamil (14.5 GB) + Indian English (1.1 GB) = 15.6 GB extracted speech data in verified portfolio.
3. **No archive hoarding:** Permanent storage (26.3 GB) excludes archives; archives deleted after validation per DOWNLOAD → VERIFY → EXTRACT → QC → IMPORT → DELETE workflow.
4. **Headroom for PENDING ACCESS:** 21.7 GB permanent margin allows promoting SSNCE + DAU-KDAH (+1.59 GB) when access confirmed.
5. **Peak never exceeds 50 GB:** Even worst-case archive retention (42.05 GB) leaves 7.95 GB buffer.
6. **No fabricated subsets:** Large datasets rejected rather than partially downloaded without verified subset availability.
7. **JapanEEG properly isolated:** Marked REFERENCE_ONLY / DEPRECATED FOR PRIMARY INDIA STRATEGY; not used for training.
8. **Access-verified only:** Only datasets with confirmed obtainable access (READY or READY_AFTER_REGISTRATION) in final download manifest.

---

## 19. License / Access Requirements Summary (Verified Portfolio)

| Dataset | License | Access | Status |
|---------|---------|--------|--------|
| IISc-MILE SLR127 | CC BY 2.0 | PUBLIC | READY |
| OpenSLR65 Tamil | CC BY-SA 4.0 | PUBLIC | READY |
| Mimetic Interfaces EMG 2015 | CC BY 4.0 | PUBLIC | READY |
| AI4Bharat Svarah | CC BY 4.0 + HF conditions | PUBLIC with HF conditions acceptance | READY_AFTER_REGISTRATION |
| JapanEEG ds007808 | CC0 | PUBLIC (existing sample) | REFERENCE_ONLY |

**PENDING ACCESS (not in verified download manifest until confirmed):**
| Dataset | License | Access | Status |
|---------|---------|--------|--------|
| SSNCE LDC2021S04 | LDC license | RESTRICTED — LDC membership or non-member agreement (~$300) | PENDING ACCESS |
| DAU-KDAH | UNVERIFIED (academic/research) | RESTRICTED — Prof. Hemant A. Patil request + ethics | PENDING ACCESS |

**PENDING ACCESS datasets require:** confirmed access terms, exact download size ≤ budget, license compatible with research use.

---

## 20. UNVERIFIED Items (Verified Portfolio)

| Field | Dataset | Value | Why UNVERIFIED |
|-------|---------|-------|----------------|
| Exact download size | Mimetic Interfaces EMG 2015 | <1 GB estimated | No byte count in public metadata |
| Exact speaker count | OpenSLR65 | UNVERIFIED | 4,291 recordings; unique speaker count unconfirmed |
| Exact download size | AI4Bharat Svarah | ~1.1 GB estimated | Size from public metadata; exact may vary |
| Full size / access / license | SSNCE LDC2021S04 | UNVERIFIED until LDC agreement | OLAC catalog 614,629 KB; package format may vary |
| Full size / access / license | DAU-KDAH | UNVERIFIED until author response | No license file; authors state academic/research only |
| All fields | HDSD | UNVERIFIED | No public metadata found |
| All fields | Indian Stroke Speech Corpus | UNVERIFIED | No public metadata found |
| All fields | Vaani-Atypical-Speech-Corpus | UNVERIFIED | No public metadata found |
| All fields | SSN-TDSC | UNVERIFIED | May overlap LDC2021S04; no public metadata |
| All fields | IndicTIMIT | UNVERIFIED | No public metadata found |
| All fields | SPIRE-SIES | UNVERIFIED | No public metadata; subset availability unknown |

All UNVERIFIED items must be confirmed before download.
