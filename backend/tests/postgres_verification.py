"""Explicit automated integration verification on a disposable PostgreSQL database.

Run with DATABASE_URL pointing to a database named verification and ENVIRONMENT=test.
All generated samples are synthetic test fixtures. Never targets a production database.
"""
import os
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import asyncio
import json
import uuid
import numpy as np
from sqlalchemy.engine import make_url
from sqlalchemy import select

url = make_url(os.environ["DATABASE_URL"])
if not (url.database == "verification" or url.database.startswith("verification_fresh_")) or url.host not in {"localhost", "127.0.0.1"} or os.environ.get("ENVIRONMENT") != "test":
    raise RuntimeError("Only the disposable verification database in test environment is allowed")
from fastapi.testclient import TestClient
from app.main import app
from app.core.db import get_session_maker, get_engine
from app.core.auth import hash_password, create_access_token
from app.models import Role, User, Recording
from app.models.feature import FeatureRecord


async def bootstrap():
    async with get_session_maker()() as db:
        role = Role(name="ADMIN", permissions="[]")
        db.add(role)
        await db.flush()
        user = User(email="synthetic-verification@example.invalid", role_id=role.id, password_hash=hash_password("synthetic-test-only"))
        db.add(user)
        patient_role = Role(name="PATIENT", permissions="[]")
        db.add(patient_role)
        await db.flush()
        db.add(User(email="synthetic-patient@example.com", role_id=patient_role.id,
                    password_hash=hash_password("synthetic-test-only")))
        await db.commit()
        token = create_access_token({"sub": str(user.id), "email": user.email, "role": "ADMIN"})
    await get_engine().dispose()
    return token


def main():
    token = asyncio.run(bootstrap())
    checks = []
    with TestClient(app) as client:
        client.headers["Authorization"] = "Bearer " + token
        def post(url, payload):
            response = client.post(url, json=payload)
            assert response.status_code == 201, (url, response.status_code, response.text)
            checks.append(url)
            return response.json()
        assert client.get("/health").status_code == 200
        checks.append("health")
        p = post("/api/v1/participants/research-participants", {"pseudonym_id": "synthetic-postgres-verification", "consent_status": "approved"})
        s = post("/api/v1/sessions/sessions", {"participant_id": p["id"], "session_date": "2026-09-08", "session_number": 1})
        e = post("/api/v1/exercises/exercises", {"name": "Synthetic fixture", "exercise_type": "vowel", "target_modalities": ["EEG"], "difficulty": "easy"})
        se = post("/api/v1/session-exercises/session-exercises", {"session_id": s["id"], "exercise_id": e["id"], "order_index": 0})
        a = post("/api/v1/attempts/attempts", {"session_exercise_id": se["id"], "attempt_number": 1, "started_at": "2026-09-08T00:00:00Z"})
        t = np.arange(512)/256
        result = post("/api/v1/research-signals/biosignals", {"session_id": s["id"], "attempt_id": a["id"], "modality": "EEG", "device_id": "synthetic-postgres", "sample_rate": 256, "units": "uV", "channel_names": ["Cz"], "samples": (10*np.sin(2*np.pi*10*t))[:, None].tolist(), "started_at": "2026-09-08T00:00:00Z", "clock_id": "synthetic-test-clock", "is_synthetic": True})
        response = client.get(f"/api/v1/research-signals/recordings/{result['recording_id']}/features")
        assert response.status_code == 200 and response.json()[0]["source_sha256"] == result["source_sha256"]
        checks.append("feature persistence and source hash")
        response = client.post("/api/v1/research-signals/fusion/prepare", json={"feature_ids": [result["feature_id"]]})
        assert response.status_code == 200 and response.json()["prediction"] is None
        checks.append("fusion refuses missing model")
        login = client.post("/api/v1/auth/login", json={"email": "synthetic-patient@example.com", "password": "synthetic-test-only"})
        assert login.status_code == 200, login.text
        patient_token = login.json()["access_token"]
        patient_headers = {"Authorization": "Bearer " + patient_token}
        me = client.get("/api/v1/auth/me", headers=patient_headers)
        assert me.status_code == 200 and me.json()["role"]["name"] == "PATIENT"
        checks.append("patient login and auth state")
        profile = post("/api/v1/participants/patients", {"user_id": me.json()["id"], "participant_id": p["id"]})
        assert client.get("/api/v1/participants/me", headers=patient_headers).json()["id"] == profile["id"]
        checks.append("patient enrollment profile")
        client.headers.update(patient_headers)
        patient_session = post("/api/v1/sessions/sessions", {"participant_id": p["id"], "patient_id": profile["id"], "session_date": "2026-09-08", "session_number": 2})
        patient_exercise = post("/api/v1/session-exercises/session-exercises", {"session_id": patient_session["id"], "exercise_id": e["id"], "order_index": 0})
        patient_attempt = post("/api/v1/attempts/attempts", {"session_exercise_id": patient_exercise["id"], "attempt_number": 1, "started_at": "2026-09-08T00:00:00Z"})
        session_path = f"/api/v1/sessions/sessions/{patient_session['id']}"
        assert client.patch(session_path, json={"status": "in_progress", "started_at": "2026-09-08T00:00:00Z"}).status_code == 200
        checks.append("patient session lifecycle start")
        with client.websocket_connect(f"/ws/sessions/{patient_session['id']}?token={patient_token}") as socket:
            socket.send_json({"type": "stream_start", "session_id": patient_session["id"], "attempt_id": patient_attempt["id"], "modality": "AUDIO", "sample_rate": 16000, "channels": 1, "sample_width_bytes": 2, "encoding": "pcm16"})
            started = socket.receive_json()
            assert started["type"] == "stream_started", started
            # Deliberately clipped PCM is an automation fixture, never medical evidence.
            socket.send_bytes(b"\xff\x7f" * 16000)
            buffered = socket.receive_json()
            assert buffered["type"] == "status", buffered
            socket.send_json({"type": "stream_stop"})
            messages = [socket.receive_json(), socket.receive_json()]
            assert any(m.get("code") == "poor_signal_quality" for m in messages), messages
            assert messages[-1]["type"] == "stream_stopped", messages
            # Receive server close after the transaction commits.
            assert socket.receive()["type"] == "websocket.close"
        checks.append("authenticated patient WebSocket PCM start binary stop")
        recording_id = started["recording_id"]
        recording = client.get(f"/api/v1/recordings/recordings/{recording_id}")
        assert recording.status_code == 200 and recording.json()["attempt_id"] == patient_attempt["id"], recording.text
        checks.append("patient recording persisted with session and attempt FKs")
        quality = client.get(f"/api/v1/signal-quality/signal-quality/{recording_id}")
        assert quality.status_code == 200 and quality.json()["quality_state"] == "UNUSABLE", quality.text
        assert "Clipping ratio 100.00%" in quality.json()["rejection_reason"]
        checks.append("real computed clipping quality rejects test audio")
        predictions = client.get("/api/v1/predictions/predictions", params={"attempt_id": patient_attempt["id"]})
        assert predictions.status_code == 200 and predictions.json() == [], predictions.text
        checks.append("rejected audio creates no fabricated prediction")
        assert client.patch(f"/api/v1/attempts/attempts/{patient_attempt['id']}", json={"ended_at": "2026-09-08T00:01:00Z"}).status_code == 200
        assert client.patch(f"/api/v1/session-exercises/session-exercises/{patient_exercise['id']}", json={"status": "completed", "ended_at": "2026-09-08T00:01:00Z"}).status_code == 200
        assert client.patch(session_path, json={"status": "completed", "ended_at": "2026-09-08T00:01:00Z"}).status_code == 200
        persisted = client.get(session_path).json()
        assert persisted["status"] == "completed" and persisted["ended_at"] is not None
        checks.append("patient activity completion persisted and reloaded")
        assert client.get(f"/api/v1/sessions/sessions/{s['id']}").status_code == 403
        checks.append("patient cannot read unrelated research session")
    print(json.dumps({"status": "passed", "checks": checks, "check_count": len(checks), "database": "disposable PostgreSQL", "synthetic_test_fixtures": True}, indent=2))


if __name__ == "__main__":
    main()
