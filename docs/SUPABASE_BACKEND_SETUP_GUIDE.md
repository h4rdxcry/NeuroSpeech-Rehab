# NeuroSpeech Rehab - Supabase Cloud & 24/7 Online Backend Setup Guide

**Supabase Project Reference:** `tmdqmbrnbuikzmtbkntk`  
**Supabase Dashboard:** [https://supabase.com/dashboard/project/tmdqmbrnbuikzmtbkntk](https://supabase.com/dashboard/project/tmdqmbrnbuikzmtbkntk)  
**Frontend Deployment:** [https://neuro-speech-rehab.vercel.app](https://neuro-speech-rehab.vercel.app)  
**GitHub Repository:** [https://github.com/h4rdxcry/NeuroSpeech-Rehab](https://github.com/h4rdxcry/NeuroSpeech-Rehab)  

---

## 1. Architecture Overview

```
 ┌─────────────────────────────────────────────────────────────┐
 │                     Vercel Frontend                         │
 │          https://neuro-speech-rehab.vercel.app              │
 │   • React 19 + Vite SPA                                     │
 │   • MediaPipe Lip & Facial Tracking in browser (WASM)        │
 └──────────────────────────────┬──────────────────────────────┘
                                │ HTTPS Requests (VITE_API_URL)
                                ▼
 ┌─────────────────────────────────────────────────────────────┐
 │             24/7 Free Cloud Backend (Render / Koyeb)        │
 │              https://<your-backend>.onrender.com            │
 │   • FastAPI + Uvicorn server                                │
 │   • PyTorch Wav2Vec2 & Acoustic DSP feature extraction      │
 │   • asyncpg connection pooling with statement_cache_size=0  │
 └──────────────────────────────┬──────────────────────────────┘
                                │ PostgreSQL Protocol (DATABASE_URL)
                                ▼
 ┌─────────────────────────────────────────────────────────────┐
 │             Supabase Cloud (tmdqmbrnbuikzmtbkntk)           │
 │              https://tmdqmbrnbuikzmtbkntk.supabase.co       │
 │   • PostgreSQL 15+ Database (22 clinical schema tables)     │
 │   • Row Level Security (RLS) policies                       │
 │   • Private HIPAA/GDPR Storage Buckets (recordings, audio)  │
 │   • Auth & User Management                                  │
 └─────────────────────────────────────────────────────────────┘
```

---

## 2. Supabase Configuration (Step-by-Step)

### Step 2.1 — Run the SQL Initialization Script
1. Navigate to your Supabase SQL Editor:  
   👉 **[https://supabase.com/dashboard/project/tmdqmbrnbuikzmtbkntk/sql/new](https://supabase.com/dashboard/project/tmdqmbrnbuikzmtbkntk/sql/new)**
2. Open the file [`supabase/full_setup_one_click.sql`](../supabase/full_setup_one_click.sql) in this repository.
3. Copy the entire contents and paste into the SQL Editor.
4. Click **Run** (or press `Ctrl+Enter`).
5. You will see the validation summary at the bottom showing:
   - `public_tables_count`: 22
   - `seeded_users_count`: 4
   - `seeded_exercises_count`: 5
   - Private storage buckets created: `recordings`, `biosignals`, `patient-reports`.
   - Row Level Security (RLS) active on all patient health information.

### Step 2.2 — Configure Authentication URLs
1. Navigate to:  
   👉 **[https://supabase.com/dashboard/project/tmdqmbrnbuikzmtbkntk/auth/url-configuration](https://supabase.com/dashboard/project/tmdqmbrnbuikzmtbkntk/auth/url-configuration)**
2. Set **Site URL** to:
   ```
   https://neuro-speech-rehab.vercel.app
   ```
3. In **Redirect URLs**, add:
   ```
   https://neuro-speech-rehab.vercel.app/**
   https://neuro-speech-rehab.vercel.app/patient/rehab
   http://localhost:5173/**
   http://localhost:3000/**
   ```
4. Click **Save**.

### Step 2.3 — Copy Database Connection String
1. Navigate to:  
   👉 **[https://supabase.com/dashboard/project/tmdqmbrnbuikzmtbkntk/settings/database](https://supabase.com/dashboard/project/tmdqmbrnbuikzmtbkntk/settings/database)**
2. Scroll to **Connection string**.
3. Select **URI** (or **Node.js**) tab.
4. Select **Session** or **Transaction** mode (Port `6543` or `5432`).
5. Copy the string. It looks like:
   ```
   postgresql://postgres.tmdqmbrnbuikzmtbkntk:[YOUR-PASSWORD]@aws-0-ap-south-1.pooler.supabase.com:6543/postgres
   ```
   *(Replace `[YOUR-PASSWORD]` with the database password you created when opening the Supabase project).*

---

## 3. Deploy the Backend 24/7 for Free

### Option A: Render.com (Recommended — 1-Click Blueprint)
Render provides free 24/7 web services directly connected to your GitHub repository.

1. Go to: **[https://dashboard.render.com/blueprints/new](https://dashboard.render.com/blueprints/new)**
2. Connect your GitHub repository: `h4rdxcry/NeuroSpeech-Rehab`
3. Render will detect the [`render.yaml`](../render.yaml) file automatically!
4. It will prompt you for:
   - `DATABASE_URL`: Paste your Supabase connection string from Step 2.3.
5. Click **Apply**.
6. Render will install dependencies and start the Uvicorn server.
7. Your backend will be online at:  
   `https://neurospeech-backend-xxxx.onrender.com`

### Option B: Koyeb / Hugging Face Spaces / Docker
You can also deploy with the root [`Dockerfile`](../Dockerfile) on any container platform:
1. Create a new service pointing to `h4rdxcry/NeuroSpeech-Rehab`.
2. Add environment variable:
   - `DATABASE_URL`: Your Supabase connection string
   - `ENVIRONMENT`: `production`
   - `CORS_ORIGINS`: `https://neuro-speech-rehab.vercel.app`
3. Deploy!

---

## 4. Connect Vercel Frontend to the Backend

1. Open your Vercel Project Dashboard:  
   👉 **[https://vercel.com/dashboard](https://vercel.com/dashboard)** -> Select `neuro-speech-rehab`
2. Go to **Settings** -> **Environment Variables**.
3. Add the following variable:
   - **Key:** `VITE_API_URL`
   - **Value:** `https://neurospeech-backend-xxxx.onrender.com` *(your live backend URL from Step 3)*
4. (Optional) If using direct Supabase client in frontend:
   - **Key:** `VITE_SUPABASE_URL` -> `https://tmdqmbrnbuikzmtbkntk.supabase.co`
   - **Key:** `VITE_SUPABASE_ANON_KEY` -> *(from Supabase Project Settings -> API)*
5. Go to **Deployments** tab and click **Redeploy** on the latest deployment.

---

## 5. Pre-Configured Demo Credentials

Once the setup script is run, the following clinical accounts are immediately active:

| Role | Email | Password | Access Scope |
| :--- | :--- | :--- | :--- |
| **Patient** | `patient@neurospeech.dev` | `NeuroSpeechDemo123!` | 100-Level Rehab Journey, Voice & Lip Exercises |
| **Clinician** | `clinician@neurospeech.dev` | `ClinicianDemo123!` | Patient Management, Biomarker Reviews |
| **Researcher** | `researcher@neurospeech.dev` | `Researcher123!` | Signal Analysis, Dataset Imports, Model Evaluations |
| **Admin** | `admin@neurospeech.dev` | `AdminSecure2026!` | Full System Administration & Audit Logs |
