from conftest import seed_test_admin
import os
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///./test.db"

import wave
import math
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.future import select
from uuid import UUID

from app.main import app
from app.core.db import Base, get_db
from app.models import (
    Role,
    User,
    ResearchParticipant,
    Session,
    Exercise,
    SessionExercise,
    Attempt,
    Recording,
    SignalQuality,
    ModelVersion,
    Prediction,
)
from app.services.asr import TamilASRInference

TEST_DB_PATH = os.path.join(os.path.dirname(__file__), "test.db")
TEST_DATABASE_URL = f"sqlite+aiosqlite:///{TEST_DB_PATH}"

engine = create_async_engine(TEST_DATABASE_URL, echo=False)
async_session_factory = async_sessionmaker(engine, expire_on_commit=False)


@pytest.fixture(autouse=True)
async def setup_db():
    if os.path.exists(TEST_DB_PATH):
        os.remove(TEST_DB_PATH)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await seed_test_admin(async_session_factory, globals())
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


async def override_get_db():
    async with async_session_factory() as session:
        yield session


app.dependency_overrides[get_db] = override_get_db

client = TestClient(app)

FIXTURE_WAV_PATH = os.path.join(os.path.dirname(__file__), "fixture_audio.wav")


def _create_fixture_wav(path: str, duration_seconds: float = 0.5, frequency: float = 440.0) -> None:
    sample_rate = 16000
    with wave.open(path, "w") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(sample_rate)
        for i in range(int(sample_rate * duration_seconds)):
            value = int(32767.0 * 0.5 * math.sin(2.0 * math.pi * frequency * i / sample_rate))
            wav.writeframesraw(value.to_bytes(2, byteorder="little", signed=True))


@pytest.fixture(scope="module", autouse=True)
def ensure_fixture_wav():
    if not os.path.exists(FIXTURE_WAV_PATH):
        _create_fixture_wav(FIXTURE_WAV_PATH)


async def _auth_headers(role_name: str):
    async with async_session_factory() as session:
        result = await session.execute(select(Role).where(Role.name == role_name))
        role = result.scalar_one_or_none()
        if not role:
            role = Role(name=role_name, permissions="[]")
            session.add(role)
            await session.commit()
        else:
            await session.commit()
    email = f"{role_name.lower()}@example.com"
    client.post("/api/v1/auth/register", headers=TEST_ADMIN_HEADERS, json={"email": email, "password": "password123", "role_id": str(role.id)})
    token = client.post("/api/v1/auth/login", json={"email": email, "password": "password123"}).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


async def _create_full_chain(headers: dict, clinician_headers: dict) -> dict:
    participant = client.post("/api/v1/participants/research-participants", json={"pseudonym_id": "SUBJ-ASR-001", "consent_status": "approved"}, headers=headers).json()
    session = client.post("/api/v1/sessions/sessions", json={"participant_id": participant["id"], "session_date": "2026-09-04", "session_number": 1}, headers=headers).json()
    exercise = client.post("/api/v1/exercises/exercises", json={"name": "Sustained vowel", "exercise_type": "vowel", "target_modalities": ["AUDIO"], "difficulty": "easy"}, headers=clinician_headers).json()
    session_exercise = client.post("/api/v1/session-exercises/session-exercises", json={"session_id": session["id"], "exercise_id": exercise["id"], "order_index": 0}, headers=headers).json()
    attempt = client.post("/api/v1/attempts/attempts", json={"session_exercise_id": session_exercise["id"], "attempt_number": 1, "started_at": "2026-09-04T00:00:00Z"}, headers=headers).json()
    recording = client.post("/api/v1/recordings/recordings", json={"session_id": session["id"], "modality": "AUDIO", "device_id": "dev-1", "file_path": FIXTURE_WAV_PATH, "file_format": "wav", "start_timestamp": "2026-09-04T00:00:00Z"}, headers=headers).json()
    signal_quality = client.post("/api/v1/signal-quality/signal-quality", json={"recording_id": recording["id"], "quality_state": "GOOD", "artifact_indicators": {}}, headers=headers).json()
    model = client.post("/api/v1/model-versions/model-versions", json={"model_name": "wav2vec2-tamil-baseline", "version": "v1", "model_type": "asr", "architecture_json": {"framework": "transformers"}, "training_dataset_version": "slr127-v1", "feature_pipeline_version": "fp-v1", "is_production": True}, headers=headers).json()
    return {
        "participant": participant,
        "session": session,
        "exercise": exercise,
        "session_exercise": session_exercise,
        "attempt": attempt,
        "recording": recording,
        "signal_quality": signal_quality,
        "model": model,
    }


@pytest.mark.asyncio
async def test_run_asr_success_real_inference():
    researcher_headers = await _auth_headers("RESEARCHER")
    clinician_headers = await _auth_headers("CLINICIAN")
    chain = await _create_full_chain(researcher_headers, clinician_headers)

    response = client.post("/api/v1/predictions/predictions/run-asr", params={"attempt_id": chain["attempt"]["id"], "recording_id": chain["recording"]["id"]}, headers=researcher_headers)
    assert response.status_code == 201, response.text
    prediction = response.json()
    assert prediction["prediction_type"] == "asr_transcript"
    assert prediction["model_id"] == chain["model"]["id"]
    assert prediction["model_version"] == "v1"
    assert prediction["signal_quality_state"] == "GOOD"
    assert isinstance(prediction["predicted_label"], str)
    assert prediction["prediction_json"] is not None
    assert prediction["prediction_json"]["model_name"] == "facebook/wav2vec2-base"
    assert prediction["prediction_json"]["model_scope"] == "IISc-MILE Tamil ASR Corpus (OpenSLR 127) general speech baseline"
    assert prediction["prediction_json"]["notes"] == "This model is a general Tamil speech baseline, not a dysarthria-specific model."

    async with async_session_factory() as session:
        db_pred = await session.get(Prediction, UUID(prediction["id"]))
        assert db_pred is not None
        assert db_pred.predicted_label == prediction["predicted_label"]
        assert db_pred.model_id == UUID(chain["model"]["id"])
        assert db_pred.prediction_json is not None
        assert "transcript" in db_pred.prediction_json


@pytest.mark.asyncio
async def test_run_asr_missing_signal_quality_rejected():
    researcher_headers = await _auth_headers("RESEARCHER")
    clinician_headers = await _auth_headers("CLINICIAN")
    chain = await _create_full_chain(researcher_headers, clinician_headers)

    async with async_session_factory() as session:
        sq = await session.get(SignalQuality, UUID(chain["signal_quality"]["id"]))
        await session.delete(sq)
        await session.commit()

    response = client.post("/api/v1/predictions/predictions/run-asr", params={"attempt_id": chain["attempt"]["id"], "recording_id": chain["recording"]["id"]}, headers=researcher_headers)
    assert response.status_code == 400
    assert "SignalQuality" in response.json()["detail"] or "signal quality" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_run_asr_inadequate_signal_quality_rejected():
    researcher_headers = await _auth_headers("RESEARCHER")
    clinician_headers = await _auth_headers("CLINICIAN")
    chain = await _create_full_chain(researcher_headers, clinician_headers)
    client.patch(f"/api/v1/signal-quality/signal-quality/{chain['recording']['id']}", json={"quality_state": "POOR"}, headers=researcher_headers)

    response = client.post("/api/v1/predictions/predictions/run-asr", params={"attempt_id": chain["attempt"]["id"], "recording_id": chain["recording"]["id"]}, headers=researcher_headers)
    assert response.status_code == 400
    assert "GOOD or ACCEPTABLE" in response.json()["detail"]


@pytest.mark.asyncio
async def test_run_asr_missing_recording_rejected():
    researcher_headers = await _auth_headers("RESEARCHER")
    clinician_headers = await _auth_headers("CLINICIAN")
    chain = await _create_full_chain(researcher_headers, clinician_headers)
    fake_recording_id = "00000000-0000-0000-0000-000000000000"
    response = client.post("/api/v1/predictions/predictions/run-asr", params={"attempt_id": chain["attempt"]["id"], "recording_id": fake_recording_id}, headers=researcher_headers)
    assert response.status_code == 404
    assert "Recording not found" in response.json()["detail"]


@pytest.mark.asyncio
async def test_run_asr_invalid_audio_rejected():
    researcher_headers = await _auth_headers("RESEARCHER")
    clinician_headers = await _auth_headers("CLINICIAN")
    chain = await _create_full_chain(researcher_headers, clinician_headers)
    bad_path = os.path.join(os.path.dirname(__file__), "nonexistent_audio.wav")
    client.patch(f"/api/v1/recordings/recordings/{chain['recording']['id']}", json={"file_path": bad_path}, headers=researcher_headers)

    response = client.post("/api/v1/predictions/predictions/run-asr", params={"attempt_id": chain["attempt"]["id"], "recording_id": chain["recording"]["id"]}, headers=researcher_headers)
    assert response.status_code == 400
    assert "WAV" in response.json()["detail"] or "not found" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_run_asr_idempotent_no_duplicate():
    researcher_headers = await _auth_headers("RESEARCHER")
    clinician_headers = await _auth_headers("CLINICIAN")
    chain = await _create_full_chain(researcher_headers, clinician_headers)

    response1 = client.post("/api/v1/predictions/predictions/run-asr", params={"attempt_id": chain["attempt"]["id"], "recording_id": chain["recording"]["id"]}, headers=researcher_headers)
    assert response1.status_code == 201
    pred1 = response1.json()

    response2 = client.post("/api/v1/predictions/predictions/run-asr", params={"attempt_id": chain["attempt"]["id"], "recording_id": chain["recording"]["id"]}, headers=researcher_headers)
    assert response2.status_code == 201
    pred2 = response2.json()
    assert pred2["id"] == pred1["id"]
