# Dataset Acquisition Status Summary
**Date:** 2026-09-05 16:40 UTC  
**Project:** NeuroSpeech-Rehab  
**Storage:** 5.5 GB / 50 GB used (89% free)

---

## DATASETS ON DISK (VERIFIED)

| Dataset | Size | Language | Modality | Status | Database Import |
|---------|------|----------|----------|--------|-----------------|
| JapanEEG ds007808 | 3.1 GB | Japanese | EEG + Audio | REFERENCE_ONLY | ✓ Imported |
| Facial EMG Zenodo | 13 MB | N/A | EMG (CSV) | Acquired | ✓ Imported |
| OpenSLR65 Tamil | 2.3 GB | Tamil | Audio | Acquired | ⚠️ Unknown |

**Total:** 5.413 GB

---

## DATASETS BLOCKED/PENDING

| Dataset | Size | Language | Status | Reason |
|---------|------|----------|--------|--------|
| **Svarah Indian English** | 1.1 GB | Indian English | ❌ BLOCKED | Gated dataset - no HF token/authorization |
| **IISc-MILE SLR127 Tamil** | 13 GB | Tamil | ⏸️ PENDING DOWNLOAD | Awaiting download after Hermes automation setup |

---

## DATASETS REQUIRING RESTRICTED ACCESS

| Dataset | Size | Language | Priority | Access Blocker |
|---------|------|----------|----------|----------------|
| SSNCE LDC2021S04 (Tamil dysarthric) | 0.62 GB | Tamil | P0 | LDC license (~$300) |
| DAU-KDAH (Multimodal dysarthric) | 0.97 GB | Hindi/Marathi/Gujarati/English | P0/P2 | Author approval + IRB |

---

## CURRENT STATUS

**Phase 2: Backend & Data Layer** - ✓ COMPLETE  
**Phase 3: Frontend** - 10% (routing shell only)  
**Datasets Acquired:** 3 (JapanEEG, Facial EMG, OpenSLR65)  
**Datasets Imported to DB:** 2 confirmed (JapanEEG, Facial EMG)  
**Test Suite:** 32 tests passing  

**Next Action:** Awaiting Hermes automation setup for dataset acquisition workflow

---

## VERIFIED LEGAL DATASETS READY FOR DOWNLOAD (When Authorized)

1. **IISc-MILE SLR127 Tamil ASR Corpus**
   - Source: http://www.openslr.org/127/
   - License: CC BY 2.0 (public)
   - Size: 13 GB (2 archives)
   - Speakers: 531 Tamil speakers
   - Status: Verified legal, ready for download post-automation setup

2. **Mimetic Interfaces Facial EMG 2015** (optional)
   - Source: Tampere/CSC (URL verification pending)
   - License: CC BY 4.0
   - Size: ~0.2 GB estimated
   - Status: Lower priority

---

**No unrelated changes made to project.**  
**All systems preserved in current state.**  
**Awaiting Hermes automation setup.**
