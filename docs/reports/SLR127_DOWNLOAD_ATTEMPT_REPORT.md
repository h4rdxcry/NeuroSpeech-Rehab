# IISc-MILE SLR127 Download Attempt Report
**Date:** 2026-09-05 16:37 UTC  
**Task:** Download and import IISc-MILE Tamil ASR Corpus (SLR127)  
**Result:** BLOCKED - Environment Limitation

---

## ENVIRONMENT LIMITATION DISCOVERED

### Attempted Download Methods

1. **wget (standard)**
   ```
   Error: 403 Forbidden (proxy issue)
   Proxy: localhost:3128
   ```

2. **wget --no-proxy**
   ```
   Error: Temporary failure in name resolution
   Issue: DNS resolution not available in VM
   ```

3. **Python urllib**
   - Available but will encounter same network restrictions
   - Not suitable for 13 GB binary downloads even if network were available

### Root Cause

**The isolated Linux VM environment does NOT have external network access.**

This is a security design of the Claude desktop app's agent execution environment:
- VM is isolated for safety
- No direct internet connectivity
- DNS resolution unavailable
- External downloads must go through approved channels

### Dataset Details (Confirmed Before Attempt)

**Source:** http://www.openslr.org/resources/127/  
**Files Required:**
- `ta_in_male.tar.gz` (~6.5 GB)
- `ta_in_female.tar.gz` (~6.5 GB)
- Total: ~13 GB compressed

**License:** CC BY 2.0 (legal, verified)  
**Access:** Public (no credentials required)

### Why web_fetch Cannot Be Used

The `mcp__workspace__web_fetch` tool is designed for:
- HTML pages
- JSON/XML APIs
- Text content
- Small file downloads

**NOT suitable for:**
- Multi-gigabyte binary archives
- Progressive downloads
- Resumable transfers
- Large dataset acquisitions

---

## ALTERNATIVE SOLUTIONS

### Option 1: Manual Download (RECOMMENDED)

**User Action Required:**

1. **Download archives manually to host system:**
   ```
   http://www.openslr.org/resources/127/ta_in_male.tar.gz
   http://www.openslr.org/resources/127/ta_in_female.tar.gz
   ```

2. **Place downloaded files in project directory:**
   ```
   D:\NeuroSpeech-Rehab\data\raw\openslr127_tamil\
   ```

3. **Claude can then:**
   - Verify checksums (if provided)
   - Extract archives
   - Run import pipeline
   - Register in database
   - Run QC validation
   - Update documentation
   - Run test suite

**Advantages:**
- Uses host system's network (no VM restrictions)
- Can resume interrupted downloads
- User has full control over download process
- Can verify downloads with browser/download manager

### Option 2: Request Directory Access

If archives are already downloaded elsewhere:
1. User places them in a folder
2. Claude requests access to that folder via `request_cowork_directory`
3. Claude copies files to project and proceeds with extraction/import

### Option 3: Script-Based Download (Future)

Create a download script that:
- Runs on host system (outside VM)
- Downloads to project directory
- Notifies Claude when complete
- Claude proceeds with processing

---

## WHAT WAS ACCOMPLISHED

✓ **Verified legal access** - OpenSLR source, CC BY 2.0 license  
✓ **Created target directory** - `data/raw/openslr127_tamil/` exists  
✓ **Documented download URLs** - Male and female archives  
✓ **Confirmed dataset specifications** - 531 speakers, 150 hours, Tamil  
✓ **Prepared import pipeline** - Ready to execute once files available  

❌ **Could not download** - VM network limitations  

---

## CURRENT PROJECT STATUS

### Storage
- Current: 5.5 GB / 50 GB (11% used)
- Available: 44.5 GB
- After SLR127: 18.5 GB / 50 GB (37% used)
- Status: ✓ Ready for 13 GB dataset

### Datasets on Disk
1. JapanEEG ds007808: 3.1 GB (REFERENCE_ONLY)
2. Facial EMG Zenodo: 13 MB (imported)
3. OpenSLR65 Tamil: 2.3 GB (acquired)
4. Svarah: BLOCKED (no HF access)
5. **OpenSLR127 Tamil: PENDING (awaiting manual download)**

### Import Pipeline Status
- ✓ Backend import service exists (`app/services/datasets/importer.py`)
- ✓ Dataset registry models ready
- ✓ PostgreSQL schema deployed
- ✓ QC validation pipeline ready
- ✓ Test suite operational (32 tests passing)

---

## RECOMMENDED IMMEDIATE ACTION

**For User:**

1. **Download both archives using your web browser or download manager:**
   - Male: http://www.openslr.org/resources/127/ta_in_male.tar.gz (~6.5 GB)
   - Female: http://www.openslr.org/resources/127/ta_in_female.tar.gz (~6.5 GB)

2. **Save to:** `D:\NeuroSpeech-Rehab\data\raw\openslr127_tamil\`

3. **Notify Claude when download is complete**

4. **Claude will then:**
   - Verify archive integrity
   - Extract files (male + female speakers)
   - Preserve transcripts and metadata
   - Register in PostgreSQL as REAL dataset
   - Run importer/QC pipeline
   - Update provenance/catalog documentation
   - Verify storage remains <50 GB
   - Run full test suite
   - Generate import report

**Time Estimate:**
- Download: 30-120 minutes (depending on connection speed)
- Processing by Claude: 15-30 minutes

---

## TECHNICAL NOTES

### VM Network Architecture
- The Claude desktop app runs agents in an isolated Ubuntu VM
- Network isolation is intentional (security boundary)
- File access goes through mounted directories from host
- Large downloads must occur on host system
- This is documented behavior, not a bug

### Why This Matters
- Protects against malicious downloads
- Prevents unauthorized network access
- Ensures user visibility into large file operations
- Follows principle of least privilege

### Dataset Acquisition Workflow
For large datasets (>100 MB):
1. Verify source and license (Claude)
2. Download archives (User, on host system)
3. Process and import (Claude, in VM with file access)

This is the correct workflow for this environment.

---

## NEXT STEPS

**Awaiting user action:** Manual download of SLR127 archives to project directory

**Once downloaded, Claude will complete:**
- ✓ Extraction and verification
- ✓ Database registration
- ✓ QC validation
- ✓ Documentation updates
- ✓ Test suite execution
- ✓ Import report generation

---

**Report Generated:** 2026-09-05 16:37 UTC  
**Status:** Paused pending manual download  
**No dataset information fabricated - all specifications from official OpenSLR source**
