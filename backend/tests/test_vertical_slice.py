from conftest import seed_test_admin
import os
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.future import select
from app.main import app
from app.core.db import Base, get_db
from app.models import Role, User, ResearchParticipant, Session, Exercise, SessionExercise, Attempt, Recording, SignalQuality, ModelVersion
from app.core.auth import hash_password

TEST_DB_PATH = os.path.join(os.path.dirname(__file__), "test_vertical.db")
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


@pytest.mark.asyncio
async def test_session_exercise_crud():
    researcher_headers = await _auth_headers("RESEARCHER")
    clinician_headers = await _auth_headers("CLINICIAN")
    participant = client.post("/api/v1/participants/research-participants", json={"pseudonym_id": "SUBJ-001", "consent_status": "approved"}, headers=researcher_headers).json()
    session = client.post("/api/v1/sessions/sessions", json={"participant_id": participant["id"], "session_date": "2026-09-04", "session_number": 1}, headers=researcher_headers).json()
    exercise = client.post("/api/v1/exercises/exercises", json={"name": "Sustained vowel", "exercise_type": "vowel", "target_modalities": ["AUDIO"], "difficulty": "easy"}, headers=clinician_headers).json()

    response = client.post("/api/v1/session-exercises/session-exercises", json={"session_id": session["id"], "exercise_id": exercise["id"], "order_index": 0}, headers=researcher_headers)
    assert response.status_code == 201
    session_exercise = response.json()
    assert session_exercise["status"] == "pending"

    response = client.get(f"/api/v1/session-exercises/session-exercises/{session_exercise['id']}", headers=researcher_headers)
    assert response.status_code == 200

    response = client.patch(f"/api/v1/session-exercises/session-exercises/{session_exercise['id']}", json={"status": "in_progress"}, headers=researcher_headers)
    assert response.status_code == 200
    assert response.json()["status"] == "in_progress"


@pytest.mark.asyncio
async def test_attempt_crud():
    researcher_headers = await _auth_headers("RESEARCHER")
    clinician_headers = await _auth_headers("CLINICIAN")
    participant = client.post("/api/v1/participants/research-participants", json={"pseudonym_id": "SUBJ-002", "consent_status": "approved"}, headers=researcher_headers).json()
    session = client.post("/api/v1/sessions/sessions", json={"participant_id": participant["id"], "session_date": "2026-09-04", "session_number": 1}, headers=researcher_headers).json()
    exercise = client.post("/api/v1/exercises/exercises", json={"name": "Sustained vowel", "exercise_type": "vowel", "target_modalities": ["AUDIO"], "difficulty": "easy"}, headers=clinician_headers).json()
    session_exercise = client.post("/api/v1/session-exercises/session-exercises", json={"session_id": session["id"], "exercise_id": exercise["id"], "order_index": 0}, headers=researcher_headers).json()

    response = client.post("/api/v1/attempts/attempts", json={"session_exercise_id": session_exercise["id"], "attempt_number": 1, "started_at": "2026-09-04T00:00:00Z"}, headers=researcher_headers)
    assert response.status_code == 201
    attempt = response.json()
    assert attempt["attempt_number"] == 1

    response = client.get(f"/api/v1/attempts/attempts/{attempt['id']}", headers=researcher_headers)
    assert response.status_code == 200

    response = client.patch(f"/api/v1/attempts/attempts/{attempt['id']}", json={"outcome": "completed"}, headers=researcher_headers)
    assert response.status_code == 200
    assert response.json()["outcome"] == "completed"


@pytest.mark.asyncio
async def test_prediction_crud():
    researcher_headers = await _auth_headers("RESEARCHER")
    clinician_headers = await _auth_headers("CLINICIAN")
    participant = client.post("/api/v1/participants/research-participants", json={"pseudonym_id": "SUBJ-003", "consent_status": "approved"}, headers=researcher_headers).json()
    session = client.post("/api/v1/sessions/sessions", json={"participant_id": participant["id"], "session_date": "2026-09-04", "session_number": 1}, headers=researcher_headers).json()
    exercise = client.post("/api/v1/exercises/exercises", json={"name": "Sustained vowel", "exercise_type": "vowel", "target_modalities": ["AUDIO"], "difficulty": "easy"}, headers=clinician_headers).json()
    session_exercise = client.post("/api/v1/session-exercises/session-exercises", json={"session_id": session["id"], "exercise_id": exercise["id"], "order_index": 0}, headers=researcher_headers).json()
    attempt = client.post("/api/v1/attempts/attempts", json={"session_exercise_id": session_exercise["id"], "attempt_number": 1, "started_at": "2026-09-04T00:00:00Z"}, headers=researcher_headers).json()
    model = client.post("/api/v1/model-versions/model-versions", json={"model_name": "wav2vec2-tamil-baseline", "version": "v1", "model_type": "asr", "architecture_json": {"framework": "transformers"}, "training_dataset_version": "slr127-v1", "feature_pipeline_version": "fp-v1"}, headers=researcher_headers).json()

    response = client.post("/api/v1/predictions/predictions", json={"attempt_id": attempt["id"], "model_id": model["id"], "model_version": "v1", "feature_pipeline_version": "fp-v1", "training_dataset_version": "slr127-v1", "prediction_type": "asr_transcript", "predicted_label": "hello", "signal_quality_state": "GOOD", "timestamp": "2026-09-04T00:00:00Z"}, headers=researcher_headers)
    assert response.status_code == 201
    prediction = response.json()
    assert prediction["predicted_label"] == "hello"


@pytest.mark.asyncio
async def test_recording_validation_rejects_missing_file():
    headers = await _auth_headers("RESEARCHER")
    participant = client.post("/api/v1/participants/research-participants", json={"pseudonym_id": "SUBJ-004", "consent_status": "approved"}, headers=headers).json()
    session = client.post("/api/v1/sessions/sessions", json={"participant_id": participant["id"], "session_date": "2026-09-04", "session_number": 1}, headers=headers).json()
    response = client.post("/api/v1/recordings/recordings", json={"session_id": session["id"], "modality": "AUDIO", "device_id": "dev-1", "file_path": "/nonexistent/file.wav", "file_format": "wav", "start_timestamp": "2026-09-04T00:00:00Z"}, headers=headers)
    assert response.status_code == 400
