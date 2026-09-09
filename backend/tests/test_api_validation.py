from conftest import seed_test_admin
import os
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///./test.db"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from app.main import app
from app.core.db import Base, get_db
from app.models import Role, User, Session, ResearchParticipant, Recording
from app.core.auth import hash_password

TEST_DATABASE_URL = "sqlite+aiosqlite:///./test.db"
engine = create_async_engine(TEST_DATABASE_URL, echo=False)
async_session_factory = async_sessionmaker(engine, expire_on_commit=False)

@pytest.fixture(autouse=True)
async def setup_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await seed_test_admin(async_session_factory, globals())
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

async def override_get_db():
    async with async_session_factory() as session:
        yield session

app.dependency_overrides[get_db] = override_get_db

client = TestClient(app)

@pytest.mark.asyncio
async def test_recording_metadata_validation():
    role = Role(name="RESEARCHER", permissions="[]")
    async with async_session_factory() as session:
        session.add(role)
        await session.commit()
    user_resp = client.post("/api/v1/auth/register", headers=TEST_ADMIN_HEADERS, json={"email": "researcher3@example.com", "password": "password123", "role_id": str(role.id)})
    assert user_resp.status_code == 201
    token = client.post("/api/v1/auth/login", json={"email": "researcher3@example.com", "password": "password123"}).json()["access_token"]
    client.headers = {"Authorization": f"Bearer {token}"}
    p = client.post("/api/v1/participants/research-participants", json={"pseudonym_id": "SUBJ-003", "consent_status": "approved"}).json()
    s = client.post("/api/v1/sessions/sessions", json={"participant_id": p["id"], "session_date": "2026-09-04", "session_number": 1}).json()
    recording = {
        "session_id": s["id"],
        "modality": "EEG",
        "device_id": "dev-1",
        "file_path": "/data/raw/eeg.edf",
        "file_format": "edf",
        "start_timestamp": "2026-09-04T00:00:00Z",
        "is_synthetic": True,
        "synthetic_source": "demo",
    }
    response = client.post("/api/v1/recordings/recordings", json=recording)
    assert response.status_code == 201
    data = response.json()
    assert data["is_synthetic"] is True
    assert data["synthetic_source"] == "demo"

@pytest.mark.asyncio
async def test_api_validation_errors():
    role = Role(name="RESEARCHER", permissions="[]")
    async with async_session_factory() as session:
        session.add(role)
        await session.commit()
    user_resp = client.post("/api/v1/auth/register", headers=TEST_ADMIN_HEADERS, json={"email": "researcher_validation@example.com", "password": "password123", "role_id": str(role.id)})
    assert user_resp.status_code == 201
    token = client.post("/api/v1/auth/login", json={"email": "researcher_validation@example.com", "password": "password123"}).json()["access_token"]
    client.headers = {"Authorization": f"Bearer {token}"}
    response = client.post("/api/v1/participants/research-participants", json={"pseudonym_id": "", "consent_status": "approved"})
    assert response.status_code == 422
