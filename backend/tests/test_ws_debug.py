from conftest import seed_test_admin
from ws_test_utils import collect_ws_messages as _collect_ws_messages
import os
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///./test_ws.db"

import json
import math
import wave
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy.future import select
from uuid import UUID

from app.main import app
from app.core.db import Base, get_db
from app.models import Role, User, ResearchParticipant, Session, Exercise, SessionExercise, Attempt, ModelVersion

TEST_DB_PATH = os.path.join(os.path.dirname(__file__), "test_ws.db")
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

import app.core.db as db_module
db_module._engine = engine
db_module._async_session_maker = async_session_factory

client = TestClient(app)


def _make_pcm16_chunk(duration_seconds: float = 0.1, sample_rate: int = 16000, frequency: float = 440.0) -> bytes:
    num_samples = int(sample_rate * duration_seconds)
    chunk = bytearray()
    for i in range(num_samples):
        value = int(32767.0 * 0.5 * math.sin(2.0 * math.pi * frequency * i / sample_rate))
        chunk.extend(value.to_bytes(2, byteorder="little", signed=True))
    return bytes(chunk)


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


async def _create_full_chain(researcher_headers: dict, clinician_headers: dict) -> dict:
    participant = client.post("/api/v1/participants/research-participants", json={"pseudonym_id": "SUBJ-WS-001", "consent_status": "approved"}, headers=researcher_headers).json()
    session = client.post("/api/v1/sessions/sessions", json={"participant_id": participant["id"], "session_date": "2026-09-04", "session_number": 1}, headers=researcher_headers).json()
    exercise = client.post("/api/v1/exercises/exercises", json={"name": "Sustained vowel", "exercise_type": "vowel", "target_modalities": ["AUDIO"], "difficulty": "easy"}, headers=clinician_headers).json()
    session_exercise = client.post("/api/v1/session-exercises/session-exercises", json={"session_id": session["id"], "exercise_id": exercise["id"], "order_index": 0}, headers=researcher_headers).json()
    attempt = client.post("/api/v1/attempts/attempts", json={"session_exercise_id": session_exercise["id"], "attempt_number": 1, "started_at": "2026-09-04T00:00:00Z"}, headers=researcher_headers).json()
    model = client.post("/api/v1/model-versions/model-versions", json={"model_name": "wav2vec2-tamil-baseline", "version": "v1", "model_type": "asr", "architecture_json": {"framework": "transformers"}, "training_dataset_version": "slr127-v1", "feature_pipeline_version": "fp-v1", "is_production": True}, headers=researcher_headers).json()
    return {
        "participant": participant,
        "session": session,
        "exercise": exercise,
        "session_exercise": session_exercise,
        "attempt": attempt,
        "model": model,
    }


@pytest.mark.asyncio
async def test_debug_chunks():
    print("TEST START")
    researcher_headers = await _auth_headers("RESEARCHER")
    print("researcher auth done")
    clinician_headers = await _auth_headers("CLINICIAN")
    print("clinician auth done")
    chain = await _create_full_chain(researcher_headers, clinician_headers)
    print("chain created")
    token = researcher_headers["Authorization"].split(" ")[1]

    with client.websocket_connect(f"/ws/sessions/{chain['session']['id']}?token={token}") as ws:
        print("ws connected")
        ws.send_text(json.dumps({
            "type": "stream_start",
            "session_id": chain["session"]["id"],
            "attempt_id": chain["attempt"]["id"],
            "modality": "AUDIO",
            "sample_rate": 16000,
            "channels": 1,
            "sample_width_bytes": 2,
            "encoding": "pcm16",
        }))
        msgs = _collect_ws_messages(ws, timeout=1.0)
        print("stream_start msgs:", msgs)

        chunk = _make_pcm16_chunk(duration_seconds=0.05, sample_rate=16000)
        print("sending chunk, size:", len(chunk))
        ws.send_bytes(chunk)
        msgs2 = _collect_ws_messages(ws, timeout=2.0)
        print("chunk msgs:", msgs2)

    status_msgs = [m for m in msgs2 if m.get("type") == "status"]
    print("status_msgs:", status_msgs)
    assert len(status_msgs) >= 1
