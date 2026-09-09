from conftest import seed_test_admin
import os
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///./test_ws.db"

import pytest
import json
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy.future import select
from uuid import UUID

from app.main import app
from app.core.db import Base, get_db
from app.models import Role, User, ResearchParticipant, Session, Exercise, SessionExercise, Attempt

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
async def test_simple_ws_connect():
    researcher_headers = await _auth_headers("RESEARCHER")
    clinician_headers = await _auth_headers("CLINICIAN")
    async with async_session_factory() as session:
        result = await session.execute(select(Role).where(Role.name == "CLINICIAN"))
        clinician_role = result.scalar_one_or_none()
        if not clinician_role:
            clinician_role = Role(name="CLINICIAN", permissions="[]")
            session.add(clinician_role)
            await session.commit()

    participant = client.post("/api/v1/participants/research-participants", json={"pseudonym_id": "SUBJ-WS-001", "consent_status": "approved"}, headers=researcher_headers).json()
    session = client.post("/api/v1/sessions/sessions", json={"participant_id": participant["id"], "session_date": "2026-09-04", "session_number": 1}, headers=researcher_headers).json()
    exercise = client.post("/api/v1/exercises/exercises", json={"name": "Sustained vowel", "exercise_type": "vowel", "target_modalities": ["AUDIO"], "difficulty": "easy"}, headers=clinician_headers).json()
    print("exercise keys:", exercise.keys())
    print("exercise id:", exercise.get("id"))
    session_exercise = client.post("/api/v1/session-exercises/session-exercises", json={"session_id": session["id"], "exercise_id": exercise["id"], "order_index": 0}, headers=researcher_headers).json()
    attempt = client.post("/api/v1/attempts/attempts", json={"session_exercise_id": session_exercise["id"], "attempt_number": 1, "started_at": "2026-09-04T00:00:00Z"}, headers=researcher_headers).json()

    token = researcher_headers["Authorization"].split(" ")[1]
    with client.websocket_connect(f"/ws/sessions/{session['id']}?token={token}") as ws:
        ws.send_text(json.dumps({
            "type": "stream_start",
            "session_id": session["id"],
            "attempt_id": attempt["id"],
            "modality": "AUDIO",
            "sample_rate": 16000,
            "channels": 1,
            "sample_width_bytes": 2,
            "encoding": "pcm16",
        }))
        msgs = []
        while True:
            try:
                msg = ws.receive()
                if "text" in msg:
                    msgs.append(json.loads(msg["text"]))
                    break
            except Exception:
                break
        print("Messages:", msgs)
        assert len(msgs) >= 1
