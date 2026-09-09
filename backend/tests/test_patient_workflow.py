"""Authenticated patient REST/WebSocket workflow acceptance test."""
import os
import json
from datetime import date

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy.future import select

from conftest import seed_test_admin

os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///./patient_workflow.db"

from app.main import app
from app.core.db import Base, get_db
from app.models import Role
import app.core.db as db_module


TEST_DB_PATH = os.path.join(os.path.dirname(__file__), "patient_workflow.db")
engine = create_async_engine(f"sqlite+aiosqlite:///{TEST_DB_PATH}", echo=False)
async_session_factory = async_sessionmaker(engine, expire_on_commit=False)
client = TestClient(app)


async def override_get_db():
    async with async_session_factory() as session:
        yield session


app.dependency_overrides[get_db] = override_get_db
db_module._engine = engine
db_module._async_session_maker = async_session_factory


@pytest.fixture(autouse=True)
async def setup_db():
    if os.path.exists(TEST_DB_PATH):
        os.remove(TEST_DB_PATH)
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    await seed_test_admin(async_session_factory, globals())
    yield
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.drop_all)
    await engine.dispose()


async def auth_headers(role_name: str, email: str) -> dict:
    async with async_session_factory() as session:
        role = (await session.execute(select(Role).where(Role.name == role_name))).scalar_one_or_none()
        if role is None:
            role = Role(name=role_name, permissions="[]")
            session.add(role)
            await session.commit()
    client.post(
        "/api/v1/auth/register",
        headers=TEST_ADMIN_HEADERS,
        json={"email": email, "password": "password123", "role_id": str(role.id)},
    )
    token = client.post("/api/v1/auth/login", json={"email": email, "password": "password123"}).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


async def patient_activity_fixture():
    """Explicit synthetic identities; no patient measurement or clinical labels."""
    patient_headers = await auth_headers("PATIENT", "synthetic-lifecycle@example.com")
    admin = TEST_ADMIN_HEADERS
    participant = client.post("/api/v1/participants/research-participants", headers=admin,
        json={"pseudonym_id": "SYNTHETIC-LIFECYCLE", "consent_status": "approved"}).json()
    user = client.get("/api/v1/auth/me", headers=patient_headers).json()
    profile = client.post("/api/v1/participants/patients", headers=admin,
        json={"user_id": user["id"], "participant_id": participant["id"]}).json()
    session = client.post("/api/v1/sessions/sessions", headers=patient_headers,
        json={"participant_id": participant["id"], "patient_id": profile["id"],
              "session_date": "2026-09-08", "session_number": 1}).json()
    exercise = client.post("/api/v1/exercises/exercises", headers=admin,
        json={"name": "Synthetic activity fixture", "exercise_type": "speech",
              "target_modalities": ["AUDIO"], "difficulty": "easy"}).json()
    assignment = client.post("/api/v1/session-exercises/session-exercises", headers=patient_headers,
        json={"session_id": session["id"], "exercise_id": exercise["id"], "order_index": 0}).json()
    attempt_payload = {"session_exercise_id": assignment["id"], "attempt_number": 1,
                       "started_at": "2026-09-08T00:00:00Z"}
    attempt = client.post("/api/v1/attempts/attempts", headers=patient_headers, json=attempt_payload).json()
    return patient_headers, session, assignment, attempt, attempt_payload


@pytest.mark.asyncio
async def test_patient_session_lifecycle_persists_and_rejects_unknown_fields():
    headers, session, assignment, attempt, _ = await patient_activity_fixture()
    path = f"/api/v1/sessions/sessions/{session['id']}"
    started = client.patch(path, headers=headers, json={"status": "in_progress", "started_at": "2026-09-08T00:00:00Z"})
    assert started.status_code == 200 and started.json()["status"] == "in_progress"
    ended = client.patch(path, headers=headers, json={"status": "completed", "ended_at": "2026-09-08T00:01:00Z"})
    assert ended.status_code == 200
    stored = client.get(path, headers=headers).json()
    assert stored["status"] == "completed" and stored["ended_at"] is not None
    assert client.patch(path, headers=headers, json={"clinical_success": True}).status_code == 422
    assert client.patch(path, headers=headers, json={"status": "clinically_cured"}).status_code == 422
    assert client.patch(path, headers=headers, json={"status": None}).status_code == 422
    assert client.patch(path, headers=headers, json={"dataset_split": "test"}).status_code == 403


@pytest.mark.asyncio
async def test_patient_attempt_filter_keeps_only_requested_exercise():
    headers, session, assignment, attempt, payload = await patient_activity_fixture()
    second = client.post("/api/v1/session-exercises/session-exercises", headers=headers,
        json={"session_id": session["id"], "exercise_id": assignment["exercise_id"], "order_index": 1}).json()
    response = client.post("/api/v1/attempts/attempts", headers=headers,
        json={**payload, "session_exercise_id": second["id"]})
    assert response.status_code == 201
    response = client.get("/api/v1/attempts/attempts", headers=headers,
        params={"session_exercise_id": assignment["id"]})
    assert response.status_code == 200
    assert [item["id"] for item in response.json()] == [attempt["id"]]


@pytest.mark.asyncio
async def test_patient_cannot_submit_clinical_outcome_or_rating():
    headers, _, _, attempt, payload = await patient_activity_fixture()
    for field, value in (("outcome", "success"), ("clinician_rating", 5)):
        response = client.post("/api/v1/attempts/attempts", headers=headers,
            json={**payload, "attempt_number": 2, field: value})
        assert response.status_code == 403
        response = client.patch(f"/api/v1/attempts/attempts/{attempt['id']}", headers=headers, json={field: value})
        assert response.status_code == 403
    response = client.patch(f"/api/v1/attempts/attempts/{attempt['id']}", headers=headers,
        json={"ended_at": "2026-09-08T00:01:00Z", "notes": "Activity ended"})
    assert response.status_code == 200
    assert response.json()["outcome"] is None and response.json()["clinician_rating"] is None


@pytest.mark.asyncio
async def test_locked_final_test_session_rejects_patient_mutations():
    headers, session, assignment, attempt, payload = await patient_activity_fixture()
    session_path = f"/api/v1/sessions/sessions/{session['id']}"
    assert client.patch(session_path, headers=TEST_ADMIN_HEADERS, json={"dataset_split": "test"}).status_code == 200
    assert client.patch(session_path, headers=headers, json={"status": "in_progress"}).status_code == 403
    assert client.patch(f"/api/v1/session-exercises/session-exercises/{assignment['id']}",
        headers=headers, json={"status": "completed"}).status_code == 403
    assert client.post("/api/v1/session-exercises/session-exercises", headers=headers,
        json={"session_id": session["id"], "exercise_id": assignment["exercise_id"], "order_index": 1}).status_code == 403
    assert client.post("/api/v1/attempts/attempts", headers=headers, json=payload).status_code == 403
    assert client.patch(f"/api/v1/attempts/attempts/{attempt['id']}", headers=headers,
        json={"ended_at": "2026-09-08T00:01:00Z"}).status_code == 403
    assert client.post("/api/v1/sessions/sessions", headers=headers, json={
        "participant_id": session["participant_id"], "patient_id": session["patient_id"],
        "session_date": "2026-09-08", "session_number": 2, "dataset_split": "final_test"}).status_code == 403


@pytest.mark.asyncio
async def test_patient_can_create_owned_session_and_stream_audio():
    researcher = await auth_headers("RESEARCHER", "researcher-patient-flow@example.com")
    clinician = await auth_headers("CLINICIAN", "clinician-patient-flow@example.com")
    patient = await auth_headers("PATIENT", "patient-patient-flow@example.com")

    participant = client.post(
        "/api/v1/participants/research-participants",
        headers=researcher,
        json={"pseudonym_id": "SUBJ-PATIENT-FLOW", "consent_status": "approved"},
    ).json()
    me = client.get("/api/v1/auth/me", headers=patient).json()
    patient_profile = client.post(
        "/api/v1/participants/patients",
        headers=clinician,
        json={"user_id": me["id"], "participant_id": participant["id"]},
    ).json()

    assert client.get("/api/v1/participants/me", headers=patient).status_code == 200
    exercise = client.post(
        "/api/v1/exercises/exercises",
        headers=clinician,
        json={"name": "Patient flow exercise", "exercise_type": "speech", "target_modalities": ["AUDIO"], "difficulty": "easy"},
    ).json()
    session = client.post(
        "/api/v1/sessions/sessions",
        headers=patient,
        json={"participant_id": participant["id"], "patient_id": patient_profile["id"], "session_date": str(date.today()), "session_number": 1},
    ).json()
    assert session["patient_id"] == patient_profile["id"]
    assert [item["id"] for item in client.get("/api/v1/sessions/sessions", headers=patient).json()] == [session["id"]]

    session_exercise = client.post(
        "/api/v1/session-exercises/session-exercises",
        headers=patient,
        json={"session_id": session["id"], "exercise_id": exercise["id"], "order_index": 0},
    ).json()
    attempt = client.post(
        "/api/v1/attempts/attempts",
        headers=patient,
        json={"session_exercise_id": session_exercise["id"], "attempt_number": 1, "started_at": "2026-09-08T00:00:00Z"},
    ).json()

    token = patient["Authorization"].split(" ", 1)[1]
    with client.websocket_connect(f"/ws/sessions/{session['id']}?token={token}") as websocket:
        websocket.send_text(json.dumps({
            "type": "stream_start",
            "session_id": session["id"],
            "attempt_id": attempt["id"],
            "modality": "AUDIO",
            "sample_rate": 16000,
            "channels": 1,
            "sample_width_bytes": 2,
            "encoding": "pcm16",
        }))
        assert websocket.receive_json()["type"] == "stream_started"
        websocket.send_bytes(b"\x00\x00" * 800)
        assert websocket.receive_json()["type"] == "status"
        websocket.send_text(json.dumps({"type": "stream_stop"}))
        assert websocket.receive_json()["type"] == "stream_stopped"
