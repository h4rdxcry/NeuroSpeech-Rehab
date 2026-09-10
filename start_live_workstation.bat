@echo off
title NeuroSpeech Rehab - Live PC Workstation
cd /d "%~dp0"
echo Starting NeuroSpeech Rehab Live PC Workstation...
backend\.venv-ml\Scripts\python.exe run_live_workstation.py
pause
