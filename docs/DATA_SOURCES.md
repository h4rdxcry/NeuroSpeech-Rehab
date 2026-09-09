# Data Sources

## DEPRECATED — JapanEEG (ds007808)

| Field | Value |
|-------|-------|
| Dataset name | EEG-Speech Brain Decoding Dataset |
| Dataset ID | ds007808 |
| Version | 1.0.0 |
| Source organization | Araya Inc. |
| Official URL | https://openneuro.org/datasets/ds007808 |
| Citation | Sato, M., Horiguchi, I., Inoue, M., Tomeoka, K., Hatakeyama, E., Kita, Y., Yamamoto, A., Fujisawa, I., & Sasai, S. (2026). JapanEEG: a 1000-hour EEG–EMG–audio dataset of Japanese speech production. OpenNeuro. https://doi.org/10.18112/openneuro.ds007808.v1.0.0 |
| Modality | EEG, AUDIO |
| Participants | 3 |
| Recordings | Partial import (see notes) |
| Duration | NOT DOCUMENTED in metadata files |
| Population | Healthy control adults |
| Clinical/control status | control |
| Language | ja |
| License | CC0 |
| Access | PUBLIC |
| Project usage | REFERENCE_ONLY / DEPRECATED FOR PRIMARY INDIA STRATEGY — historical prototype reference |
| Import status | IMPORTED (partial sample) |
| QC status | PASS |
| Notes | Only a representative sample of files was imported due to dataset size (~1575 GB). Full dataset available at https://openneuro.org/datasets/ds007808 |

---

## India-Focused Acquisition Strategy (Active)

**Constraint:** 50 GB hard storage/download budget.  
**Target:** 45–48 GB total local storage with ≥2 GB buffer.  
**Plan doc:** `docs/INDIA_DATASET_ACQUISITION_PLAN.md`

---

## SSNCE Database of Tamil Dysarthric Speech (LDC2021S04)

| Field | Value |
|-------|-------|
| Dataset name | SSNCE Database of Tamil Dysarthric Speech |
| Source ID | LDC2021S04 |
| Official URL | https://catalog.ldc.upenn.edu/LDC2021S04 |
| Citation | SSNCE Database of Tamil Dysarthric Speech. LDC2021S04. 2021. |
| Language | Tamil |
| Modality | AUDIO |
| Population | Dysarthric speakers |
| Participants | 20 dysarthric + 10 controls |
| Download size | ~0.62 GB estimated |
| License | LDC license |
| Access | RESTRICTED — requires LDC membership or non-member agreement |
| Access Status | PENDING_ACCESS — LDC agreement (~$300) not yet obtained |
| Project usage | RECOMMENDED — highest priority for Tamil dysarthric target |
| Notes | India-based (SSN College of Engineering + NIEPMD). Time-aligned phonetic transcripts and clinical metadata. Size estimated from OLAC extent metadata (614,629 KB). UNVERIFIED exact package size. |

---

## IISc-MILE Tamil ASR Corpus (SLR127)

| Field | Value |
|-------|-------|
| Dataset name | IISc-MILE Tamil ASR Corpus |
| Source ID | SLR127 |
| Official URL | http://www.openslr.org/127 |
| Citation | IISc-MILE Tamil ASR Corpus |
| Language | Tamil |
| Modality | AUDIO |
| Population | Normal speakers |
| Participants | 531 |
| Duration | ~150 hours |
| Download size | ~13 GB |
| License | CC BY 2.0 |
| Access | PUBLIC |
| Access Status | READY — direct HTTP download from OpenSLR |
| Project usage | RECOMMENDED — Tamil normal speech baseline |
| Notes | Verified via OpenSLR catalog. High-quality read speech in noise-free studio. |

---

## OpenSLR65 Crowdsourced Tamil

| Field | Value |
|-------|-------|
| Dataset name | OpenSLR65 Crowdsourced Tamil |
| Source ID | OpenSLR65 |
| Official URL | http://www.openslr.org/65/ |
| Citation | OpenSLR65 Crowdsourced Tamil |
| Language | Tamil |
| Modality | AUDIO |
| Population | Normal speakers |
| Participants | UNVERIFIED — 4,291 recordings listed; unique speaker count unconfirmed |
| Duration | UNVERIFIED |
| Download size | ~1.45 GB (female 769 MB + male 682 MB) |
| License | CC BY-SA 4.0 |
| Access | PUBLIC |
| Access Status | READY — direct HTTP download from OpenSLR |
| Project usage | RECOMMENDED — Tamil normal speech supplement |
| Notes | Verified file sizes from OpenSLR listing. Adds crowdsourced diversity. |

---

## Speech-data/Tamil-Speech-Dataset

| Field | Value |
|-------|-------|
| Dataset name | Tamil-Speech-Dataset |
| Official URL | https://huggingface.co/datasets/speech-data/Tamil-Speech-Dataset |
| Citation | Speech-data/Tamil-Speech-Dataset |
| Language | Tamil |
| Modality | AUDIO |
| Population | Normal speakers |
| Participants | UNVERIFIED |
| Duration | 112 hours |
| Download size | ~428 MB |
| License | UNVERIFIED |
| Access | PUBLIC |
| Project usage | EVALUATED_BUT_NOT_USED |
| Notes | Verified via Hugging Face dataset card. Small Tamil supplement. |

---

## OpenNeuro ds007358 (Indian Subset)

| Field | Value |
|-------|-------|
| Dataset name | Large-scale EEG from India and Tanzania |
| Source ID | ds007358 |
| Official URL | https://openneuro.org/datasets/ds007358 |
| Citation | Large-scale EEG from India and Tanzania |
| Modality | EEG |
| Population | Mixed (India + Tanzania) |
| Participants | UNVERIFIED — full dataset lists 2,000 participants on NEMAR; India-only breakdown unconfirmed |
| Duration | UNVERIFIED |
| Download size | UNVERIFIED |
| License | UNVERIFIED |
| Access | PUBLIC |
| Project usage | EVALUATED_BUT_NOT_USED — not speech-production paradigm |
| Notes | Mixed cohort. Tasks include eyes closed/open and an unverified "pc" task; not suitable for speech rehab pipeline. |

---

## AI4Bharat Svarah

| Field | Value |
|-------|-------|
| Dataset name | AI4Bharat Svarah |
| Official URL | https://huggingface.co/datasets/ai4bharat/Svarah |
| Citation | AI4Bharat Svarah (Indian-accented English speech) |
| Language | English (Indian accent) |
| Modality | AUDIO |
| Population | Mixed speakers |
| Participants | UNVERIFIED |
| Duration | UNVERIFIED |
| Download size | ~1.1 GB estimated |
| License | AI4Bharat dataset conditions |
| Access | PUBLIC with conditions |
| Access Status | READY_AFTER_REGISTRATION — accept HuggingFace dataset conditions on ai4bharat/Svarah page before download |
| Project usage | RECOMMENDED — Indian English accent diversity baseline |
| Notes | Requires accepting dataset conditions on Hugging Face before download. Size estimated from public metadata. |

---

## Facial EMG Dataset (Zenodo 17158391) — ACQUIRED

| Field | Value |
|-------|-------|
| Dataset name | Facial EMG Dataset (Sharma, Chitkara University, 2025) |
| Official URL | https://zenodo.org/records/17158391 |
| DOI | 10.5281/zenodo.17158391 |
| Citation | Sharma, D. (2025). Facial EMG Dataset. Zenodo. https://doi.org/10.5281/zenodo.17158391 |
| Modality | EMG (facial surface) |
| Participants | 15 healthy adult subjects (`subject_01` to `subject_15`) |
| Duration | Continuous surface EMG recording tasks |
| Download size | 12.76 MB (13,382,288 bytes) |
| License | CC BY 4.0 |
| Access | PUBLIC |
| Access Status | ACQUIRED & IMPORTED (100% Verified) |
| Project usage | AUXILIARY sEMG PIPELINE VALIDATION (Non-clinical) |
| Notes | Chitkara University, India (Deepika Sharma). 15 subject CSVs + 6 DSP scripts. 100% MD5 checksum verified. This is NOT the Mimetic Interfaces Facial Surface EMG Dataset 2015. |

---

## Mimetic Interfaces: Facial Surface EMG Dataset 2015 — PENDING ACCESS VERIFICATION

| Field | Value |
|-------|-------|
| Dataset name | Mimetic Interfaces: Facial Surface EMG Dataset 2015 |
| Official URL | https://researchportal.tuni.fi/en/datasets/mimetic-interfaces-facial-surface-emg-dataset-2015/ |
| URN | urn:nbn:fi:csc-kata20160519232206569792 |
| Citation | Rantanen, V. T., et al. (2016). Mimetic Interfaces: Facial Surface EMG Dataset 2015. CSC. |
| Modality | EMG (facial surface) |
| Participants | 15 healthy adults (8 females, 7 males) |
| Muscles | Corrugator supercilii, zygomaticus major, orbicularis oris, orbicularis oculi, masseter |
| Sampling rate | 2048 Hz |
| File format | MATLAB `.mat`, CSV metadata, screenshots, helper functions |
| Download size | ~0.20 GB (ESTIMATED) |
| License | CC BY 4.0 |
| Access | PENDING ACCESS VERIFICATION |
| Access Status | PENDING ACCESS VERIFICATION — Authoritative source is Tampere University / CSC Finland. Direct download URL and current public accessibility not yet verified. |
| Project usage | AUXILIARY sEMG PIPELINE VALIDATION (Non-clinical) — potential future candidate if access confirmed |
| Notes | This is the original Tampere/CSC dataset. It is NOT the same as Zenodo 17158391 (Facial EMG Dataset by Deepika Sharma). Do not confuse the two. |

---

## DAU-KDAH Dysarthric Multi-Lingual and Multimodal Speech Corpora

| Field | Value |
|-------|-------|
| Dataset name | DAU-KDAH Dysarthric Multi-Lingual and Multimodal Speech Corpora |
| Official URL | https://github.com/dakshtrehan/DAU-KDAH-Dysarthric-Multi-Lingual-and-Multimodal-Speech-Corpora |
| Citation | DAU-KDAH Dysarthric Multi-Lingual and Multimodal Speech Corpora |
| Language | Hindi, Marathi, Gujarati, Indian English |
| Modality | AUDIO + VIDEO |
| Population | Dysarthric speakers |
| Participants | UNVERIFIED |
| Duration | UNVERIFIED |
| Download size | ~0.97 GB estimated |
| License | UNVERIFIED — authors state academic/research use only |
| Access | RESTRICTED — available upon request from corresponding author (Prof. Hemant A. Patil) |
| Access Status | PENDING_ACCESS — author request + ethics approval required; not yet obtained |
| Project usage | RECOMMENDED — Indian English dysarthric speech with severity labels |
| Notes | Includes severity annotations and simultaneous audio-video capture. Exact license and participant counts UNVERIFIED. |
 
---
 
## HDSD (Hindi Dysarthric Speech Database)
 
| Field | Value |
|-------|-------|
| Dataset name | HDSD (Hindi Dysarthric Speech Database) |
| Language | Hindi |
| Modality | AUDIO |
| Population | Dysarthric speakers |
| Participants | 60 (reported) |
| Download size | UNVERIFIED |
| License | UNVERIFIED |
| Access | UNVERIFIED — likely restricted, author request |
| Access Status | UNVERIFIED — no public metadata, access, or license found |
| Project usage | NOT RECOMMENDED — cannot verify access/size/license |
| Notes | Reported as 60 dysarthric Hindi speakers. No public metadata, download link, or license found. Cannot verify for acquisition. |
 
---
 
## Indian Stroke Speech Corpus
 
| Field | Value |
|-------|-------|
| Dataset name | Indian Stroke Speech Corpus |
| Language | Likely Hindi/English |
| Modality | AUDIO |
| Population | Stroke patients (dysarthric) + controls |
| Participants | 50 stroke + 50 controls (reported) |
| Download size | UNVERIFIED |
| License | UNVERIFIED |
| Access | UNVERIFIED — clinical data, ethics approval required |
| Access Status | UNVERIFIED — no public metadata, access, or license found |
| Project usage | NOT RECOMMENDED — cannot verify access/size/license |
| Notes | Patient vs control design with clinical metadata reported. No public metadata, download link, or license found. Cannot verify for acquisition. |
 
---
 
## Vaani-Atypical-Speech-Corpus (ARTPARK IISc)
 
| Field | Value |
|-------|-------|
| Dataset name | Vaani-Atypical-Speech-Corpus |
| Language | Multiple Indian |
| Modality | AUDIO (+video?) |
| Population | Atypical speech |
| Participants | UNVERIFIED |
| Download size | UNVERIFIED |
| License | UNVERIFIED |
| Access | UNVERIFIED — ARTPARK/IISc restricted |
| Access Status | UNVERIFIED — no public metadata, access, or license found |
| Project usage | NOT RECOMMENDED — cannot verify access/size/license |
| Notes | Multiple conditions/languages reported. No public metadata, download link, or license found. Cannot verify for acquisition. |
 
---
 
## SSN-TDSC (Tamil Dysarthric Speech Corpus)
 
| Field | Value |
|-------|-------|
| Dataset name | SSN-TDSC (Tamil Dysarthric Speech Corpus) |
| Language | Tamil |
| Modality | AUDIO |
| Population | Dysarthric speakers |
| Participants | UNVERIFIED |
| Download size | UNVERIFIED |
| License | UNVERIFIED |
| Access | UNVERIFIED |
| Access Status | UNVERIFIED — no public metadata; may overlap LDC2021S04 |
| Project usage | NOT RECOMMENDED — cannot verify access/size/license; may duplicate LDC2021S04 |
| Notes | No public metadata, download link, or license found. May overlap with SSNCE LDC2021S04. Cannot verify for acquisition. |
 
---
 
## IndicTIMIT
 
| Field | Value |
|-------|-------|
| Dataset name | IndicTIMIT |
| Language | English (Indian) |
| Modality | AUDIO |
| Population | Normal speakers |
| Participants | 80 (reported) |
| Download size | UNVERIFIED |
| License | UNVERIFIED |
| Access | UNVERIFIED — may require request |
| Access Status | UNVERIFIED — no public metadata, access, or license found |
| Project usage | NOT RECOMMENDED — cannot verify access/size/license |
| Notes | Phonetically balanced Indian English reported. No public metadata, download link, or license found. Cannot verify for acquisition. |
 
---
 
## SPIRE-SIES
 
| Field | Value |
|-------|-------|
| Dataset name | SPIRE-SIES |
| Language | English (Indian) |
| Modality | AUDIO |
| Population | Normal speakers |
| Participants | 1567 (reported) |
| Download size | UNVERIFIED |
| License | UNVERIFIED |
| Access | UNVERIFIED |
| Access Status | UNVERIFIED — no public metadata; subset availability unknown |
| Project usage | NOT RECOMMENDED — cannot verify access/size/license; subset availability unknown |
| Notes | Large speaker diversity for Indian English reported. No public metadata, download link, or license found. Cannot verify for acquisition. Subset availability unknown. |
 
---
 
## TORGO Dysarthric Speech (LDC2012S02)

| Field | Value |
|-------|-------|
| Dataset name | TORGO Dysarthric Speech |
| Source ID | LDC2012S02 |
| Official URL | https://catalog.ldc.upenn.edu/LDC2012S02 |
| Citation | TORGO Dysarthric Speech. LDC2012S02. 2012. |
| Language | English |
| Modality | AUDIO |
| Population | Dysarthric speakers |
| Participants | UNVERIFIED |
| Duration | UNVERIFIED |
| Download size | UNVERIFIED (reported range 18–45 GB) |
| License | LDC license |
| Access | RESTRICTED — requires LDC membership |
| Project usage | EVALUATED_BUT_NOT_USED — English only, not India-specific |
| Notes | Useful as dysarthric speech reference but does not meet India-language priority. |

---

## OpenNeuro ds007602

| Field | Value |
|-------|-------|
| Dataset name | ds007602 |
| Official URL | https://openneuro.org/datasets/ds007602 |
| Citation | ds007602 |
| Modality | UNVERIFIED |
| Population | UNVERIFIED |
| Participants | UNVERIFIED |
| Duration | UNVERIFIED |
| Download size | UNVERIFIED |
| License | UNVERIFIED |
| Access | PUBLIC |
| Project usage | EVALUATED_BUT_NOT_USED — details unverified |
| Notes | Candidate identified during India-focused review. Exact modality, population, and size not yet confirmed. |

---

## TamilVoiceCorpus

| Field | Value |
|-------|-------|
| Dataset name | TamilVoiceCorpus |
| Official URL | https://github.com/Chaitya62/TamilVoiceCorpus |
| Citation | TamilVoiceCorpus |
| Language | Tamil |
| Modality | AUDIO |
| Population | Normal speakers |
| Participants | UNVERIFIED |
| Duration | UNVERIFIED |
| Download size | ~43 GB estimated |
| License | UNVERIFIED |
| Access | PUBLIC |
| Project usage | EVALUATED_BUT_NOT_USED — download size exceeds individual dataset comfort margin within 50 GB total |
| Notes | Large Tamil corpus; exact size and license terms UNVERIFIED. Subset strategy would be needed if included. |

---

## Speech-data/Tamil-Speech-Dataset

| Field | Value |
|-------|-------|
| Dataset name | Tamil-Speech-Dataset |
| Official URL | https://huggingface.co/datasets/speech-data/Tamil-Speech-Dataset |
| Citation | Speech-data/Tamil-Speech-Dataset |
| Language | Tamil |
| Modality | AUDIO |
| Population | Normal speakers |
| Participants | UNVERIFIED |
| Duration | 112 hours |
| Download size | ~428 MB |
| License | UNVERIFIED |
| Access | PUBLIC |
| Project usage | EVALUATED_BUT_NOT_USED — license restricts reuse; actual audio files not freely downloadable from Hugging Face index |
| Notes | Verified via Hugging Face dataset card. CC BY-NC-ND 4.0 metadata listing; actual audio availability questionable. |

---

## EmoTa (Sri Lankan Tamil)

| Field | Value |
|-------|-------|
| Dataset name | EmoTa |
| Official URL | https://github.com/suryakantmishra/EmoTa |
| Citation | EmoTa |
| Language | Tamil (Sri Lankan dialect) |
| Modality | AUDIO |
| Population | Normal speakers |
| Participants | UNVERIFIED |
| Duration | UNVERIFIED |
| Download size | UNVERIFIED |
| License | Academic-commercial |
| Access | RESTRICTED — available upon request |
| Project usage | EVALUATED_BUT_NOT_USED — Sri Lankan Tamil dialects, not India-specific |
| Notes | Access requires email request. Dialect mismatch with Tamil Nadu rehabilitation target. |

---

## Rasmalai / IndicVoices-R / Rasa (Rejected)

| Field | Value |
|-------|-------|
| Dataset name | Rasmalai / IndicVoices-R / Rasa |
| Official URL | https://huggingface.co/datasets/ai4bharat/IndicVoices-R |
| Citation | IndicVoices-R |
| Language | Multilingual Indian |
| Modality | AUDIO |
| Population | Normal speakers |
| Participants | UNVERIFIED |
| Duration | UNVERIFIED |
| Download size | 1.05 TB total |
| License | UNVERIFIED |
| Access | PUBLIC |
| Project usage | REJECTED — exceeds 50 GB hard budget |
| Notes | Multi-hundred-GB TTS dataset. Not viable under current storage constraint. |

---

## Microsoft Indian Language Speech Corpus (OpenSLR 63-66, 100-106)

| Field | Value |
|-------|-------|
| Dataset name | Microsoft Speech Corpus (Indian languages) |
| Official URL | http://www.openslr.org/ |
| Citation | Microsoft Speech Corpus (Indian Languages) |
| Language | Multilingual (11 Indian languages: Tamil, Telugu, Gujarati, Marathi, Hindi, Bengali, Kannada, Malayalam, Odia, Punjabi, Urdu) |
| Modality | AUDIO |
| Population | Normal crowdsourced speakers |
| Participants | Thousands of recordings across 11 languages |
| Download size | ~12.3 GB total |
| License | CC BY-SA 4.0 |
| Access | PUBLIC |
| Project usage | SUBSET SELECTED — OpenSLR 65 (Tamil, ~1.5 GB) selected; remaining 10 non-target languages rejected to conserve storage. |
| Notes | Only the Tamil partition (OpenSLR 65) is retained for the India rehabilitation strategy. Downloading all 11 languages would waste ~11 GB on non-target languages. |

---

## IIT-M Indian Language ASR Corpus

| Field | Value |
|-------|-------|
| Dataset name | IIT-M Indian Language ASR Corpus |
| Source organization | IIT Madras Speech Lab |
| Language | Multilingual Indian (Tamil, Telugu, Malayalam, Kannada, Hindi, etc.) |
| Modality | AUDIO |
| Population | Normal speakers |
| Participants | Hundreds of speakers (~490 hours) |
| Download size | >50 GB |
| License | Academic research / Gated distribution |
| Access | RESTRICTED |
| Project usage | REJECTED — exceeds storage budget; Tamil baseline is better served by open IISc-MILE SLR127 (150 hrs, CC BY 2.0). |
| Notes | Multilingual ASR corpus. Does not fit within 50 GB local storage ceiling. |

---

## IIT-M Indic TTS Database (Hear2Read / SYSPIN / OpenSLR 55)

| Field | Value |
|-------|-------|
| Dataset name | IIT-M Indic TTS Database |
| Source organization | IIT Madras / Hear2Read |
| Language | Tamil, Hindi, other Indian languages |
| Modality | AUDIO |
| Population | Studio voice talents (normal) |
| Participants | 1–2 speakers per language (~5 hours clean audio) |
| Download size | ~1–2 GB per language |
| License | Open / Academic research |
| Access | PUBLIC |
| Project usage | REJECTED — clean single-speaker TTS recordings lack the speaker diversity needed for speech rehabilitation; normative Tamil is already covered by 531 speakers in SLR127. |
| Notes | High acoustic quality but minimal speaker variability. |

---

## Project Vaani (General Release)

| Field | Value |
|-------|-------|
| Dataset name | Project Vaani |
| Source organization | ARTPARK / IISc Bangalore / Google |
| Language | Multilingual Indian (80+ districts) |
| Modality | AUDIO |
| Population | General crowdsourced population |
| Participants | Thousands of speakers across districts |
| Download size | Hundreds of GB |
| License | Open / CC BY 4.0 |
| Access | PUBLIC (HuggingFace / ARTPARK) |
| Project usage | REJECTED — uncurated general conversational speech without clinical dysarthria metadata; massive volume exceeds 50 GB limit. |
| Notes | Project Vaani general releases are not curated for speech motor disorders. |

---

## AI4Bharat IndicVoices (Rejected)

| Field | Value |
|-------|-------|
| Dataset name | AI4Bharat IndicVoices |
| Official URL | https://huggingface.co/datasets/ai4bharat/IndicVoices |
| Citation | IndicVoices |
| Language | Multilingual Indian |
| Modality | AUDIO |
| Population | Normal speakers |
| Participants | UNVERIFIED |
| Duration | UNVERIFIED |
| Download size | 745 GB total |
| License | UNVERIFIED |
| Access | PUBLIC |
| Project usage | REJECTED — exceeds 50 GB hard budget |
| Notes | Full dataset is 745 GB; per-language archive sizes not published, making safe subset selection impossible. |

---

## AI4Bharat IndicVoices-R (Rejected)

| Field | Value |
|-------|-------|
| Dataset name | AI4Bharat IndicVoices-R |
| Official URL | https://huggingface.co/datasets/ai4bharat/IndicVoices-R |
| Citation | IndicVoices-R |
| Language | Multilingual Indian |
| Modality | AUDIO |
| Population | Normal speakers |
| Participants | UNVERIFIED |
| Duration | UNVERIFIED |
| Download size | 1.05 TB total |
| License | UNVERIFIED |
| Access | PUBLIC |
| Project usage | REJECTED — exceeds 50 GB hard budget |
| Notes | 1.05 TB total. Not viable under current storage constraint. |

---

## AI4Bharat NPTEL Datasets (Rejected)

| Field | Value |
|-------|-------|
| Dataset name | AI4Bharat NPTEL2020 / BhasaAnuvaad NPTEL |
| Official URL | https://huggingface.co/datasets/ai4bharat/NPTEL2020 |
| Citation | NPTEL2020 / BhasaAnuvaad |
| Language | Multilingual Indian |
| Modality | AUDIO |
| Population | Normal speakers |
| Participants | UNVERIFIED |
| Duration | UNVERIFIED |
| Download size | 121 GB total (HuggingFace); original 1.1 TB compressed / 1.7 TB uncompressed |
| License | UNVERIFIED |
| Access | PUBLIC |
| Project usage | REJECTED — exceeds 50 GB hard budget |
| Notes | Both original and HuggingFace-hosted versions exceed budget. |

