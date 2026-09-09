@echo off
set DATABASE_URL=postgresql+asyncpg://verification:verification_test_only@localhost:55432/verification
"D:\NeuroSpeech-Rehab\backend\.venv-ml\Scripts\python.exe" -m uvicorn app.main:app --host 0.0.0.0 --port 8000
