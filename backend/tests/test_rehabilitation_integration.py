"""Integration and Verification Tests for Rehabilitation API and 100-Level Progression.
Proves that:
1. Levels initialize at Level 1 with 0 completed levels.
2. Silent audio or non-matching speech CANNOT pass a level.
3. Genuine target pronunciation clears the level and unlocks the next level.
4. Progress is saved and persists in database.
5. Progress reset functions correctly.
"""
import os
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///./test_rehab.db"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy import select

from app.main import app
from app.core.db import Base, get_db
from app.models import Role, User, Patient
from app.core.auth import hash_password

TEST_DATABASE_URL = "sqlite+aiosqlite:///./test_rehab.db"
engine = create_async_engine(TEST_DATABASE_URL, echo=False)
async_session_factory = async_sessionmaker(engine, expire_on_commit=False)


async def override_get_db():
    async with async_session_factory() as session:
        yield session

app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)


@pytest.fixture(autouse=True)
async def setup_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session_factory() as session:
        # Create PATIENT role
        role = Role(name="PATIENT", permissions="[]")
        session.add(role)
        await session.flush()

        # Create patient user
        user = User(
            email="patient_test@neurospeech.dev",
            password_hash=hash_password("NeuroSpeechDemo123!"),
            role_id=role.id,
            is_active=True,
        )
        session.add(user)
        await session.flush()

        # Create patient profile
        patient = Patient(user_id=user.id, is_active=True)
        session.add(patient)
        await session.commit()

    yield

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


def test_rehabilitation_progress_lifecycle():
    # 1. Login with seeded patient credentials
    login_resp = client.post(
        "/api/v1/auth/login",
        json={"email": "patient_test@neurospeech.dev", "password": "NeuroSpeechDemo123!"},
    )
    assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
    tokens = login_resp.json()
    token = tokens["access_token"]
    client.headers = {"Authorization": f"Bearer {token}"}

    # 2. Fetch initial progress
    prog_resp = client.get("/api/v1/rehabilitation/progress")
    assert prog_resp.status_code == 200, f"Progress fetch failed: {prog_resp.text}"
    prog = prog_resp.json()
    assert prog["current_level"] == 1
    assert prog["highest_unlocked_level"] == 1
    assert prog["completed_levels"] == []

    # 3. NEGATIVE TEST A: No speech / empty transcript -> Level does NOT complete
    attempt_fail = client.post(
        "/api/v1/rehabilitation/attempt",
        json={
            "level_number": 1,
            "target_text": "அம்மா",
            "language": "ta-IN",
            "recognized_transcript": "",
            "recording_duration_seconds": 2.5,
            "peak_audio_level": 45.0,  # Loud volume must NOT pass without transcript!
        },
    )
    assert attempt_fail.status_code == 200
    res_fail = attempt_fail.json()
    assert res_fail["is_success"] is False
    assert res_fail["current_level"] == 1
    assert 1 not in res_fail["completed_levels"]

    # 4. NEGATIVE TEST B: Wrong spoken phrase -> Level does NOT complete
    attempt_wrong = client.post(
        "/api/v1/rehabilitation/attempt",
        json={
            "level_number": 1,
            "target_text": "அம்மா",
            "language": "ta-IN",
            "recognized_transcript": "வணக்கம் எப்படி இருக்கிறீர்கள்",
            "recording_duration_seconds": 3.0,
            "peak_audio_level": 50.0,
        },
    )
    assert attempt_wrong.status_code == 200
    res_wrong = attempt_wrong.json()
    assert res_wrong["is_success"] is False
    assert res_wrong["current_level"] == 1
    assert 1 not in res_wrong["completed_levels"]

    # 5. POSITIVE TEST: Correct target pronunciation -> Level COMPLETES and unlocks next level
    attempt_success = client.post(
        "/api/v1/rehabilitation/attempt",
        json={
            "level_number": 1,
            "target_text": "அம்மா",
            "language": "ta-IN",
            "recognized_transcript": "அம்மா",
            "recording_duration_seconds": 2.0,
            "peak_audio_level": 40.0,
        },
    )
    assert attempt_success.status_code == 200
    res_success = attempt_success.json()
    assert res_success["is_success"] is True
    assert res_success["match_score"] >= 0.90
    assert 1 in res_success["completed_levels"]
    assert res_success["highest_unlocked_level"] == 2
    assert res_success["current_level"] == 2
    assert res_success["streak_count"] >= 1

    # 6. Verify persistence on subsequent fetch
    prog_verify = client.get("/api/v1/rehabilitation/progress")
    assert prog_verify.status_code == 200
    data_verify = prog_verify.json()
    assert data_verify["current_level"] == 2
    assert 1 in data_verify["completed_levels"]

    # 7. Reset progress back to clean Level 1
    reset_resp = client.post("/api/v1/rehabilitation/reset-progress")
    assert reset_resp.status_code == 200
    prog_reset = reset_resp.json()
    assert prog_reset["current_level"] == 1
    assert prog_reset["highest_unlocked_level"] == 1
    assert prog_reset["completed_levels"] == []

    # 8. Test camera tracking authorization with patient token
    import base64
    from PIL import Image
    import io
    img = Image.new("RGB", (64, 64), color="white")
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    b64_img = base64.b64encode(buf.getvalue()).decode("utf-8")

    cam_resp = client.post(
        "/api/v1/research-signals/camera/track-frame",
        json={"image_base64": b64_img},
    )
    assert cam_resp.status_code == 200
    cam_data = cam_resp.json()
    assert cam_data["status"] in ("TRACKED", "NO_FACE")

