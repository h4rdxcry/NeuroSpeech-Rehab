from conftest import seed_test_admin
import os
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///./test.db"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from app.main import app
from app.core.db import Base, get_db
from app.models import Role, User, Dataset, ResearchParticipant
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
async def test_participant_split_isolation():
    role = Role(name="RESEARCHER", permissions="[]")
    async with async_session_factory() as session:
        session.add(role)
        await session.commit()
    user_resp = client.post("/api/v1/auth/register", headers=TEST_ADMIN_HEADERS, json={"email": "researcher@example.com", "password": "password123", "role_id": str(role.id)})
    assert user_resp.status_code == 201
    login_resp = client.post("/api/v1/auth/login", json={"email": "researcher@example.com", "password": "password123"})
    token = login_resp.json()["access_token"]
    client.headers = {"Authorization": f"Bearer {token}"}
    p1 = client.post("/api/v1/participants/research-participants", json={"pseudonym_id": "SUBJ-001", "consent_status": "approved"}).json()
    p2 = client.post("/api/v1/participants/research-participants", json={"pseudonym_id": "SUBJ-002", "consent_status": "approved"}).json()
    split = {"train": ["SUBJ-001"], "validation": ["SUBJ-002"], "test": []}
    dataset = client.post("/api/v1/datasets/datasets", json={"name": "ds1", "version": "1", "participant_ids": ["SUBJ-001", "SUBJ-002"], "recording_ids": [], "split_definition": split}).json()
    assert dataset["split_definition"]["train"] == ["SUBJ-001"]
    assert dataset["split_definition"]["validation"] == ["SUBJ-002"]

@pytest.mark.asyncio
async def test_locked_dataset_rejects_modification():
    role = Role(name="RESEARCHER", permissions="[]")
    async with async_session_factory() as session:
        session.add(role)
        await session.commit()
    client.post("/api/v1/auth/register", headers=TEST_ADMIN_HEADERS, json={"email": "researcher2@example.com", "password": "password123", "role_id": str(role.id)})
    token = client.post("/api/v1/auth/login", json={"email": "researcher2@example.com", "password": "password123"}).json()["access_token"]
    client.headers = {"Authorization": f"Bearer {token}"}
    dataset = client.post("/api/v1/datasets/datasets", json={"name": "ds2", "version": "1", "participant_ids": [], "recording_ids": [], "split_definition": {}}).json()
    lock_resp = client.post(f"/api/v1/datasets/datasets/{dataset['id']}/lock")
    assert lock_resp.status_code == 200
    update_resp = client.patch(f"/api/v1/datasets/datasets/{dataset['id']}", json={"name": "ds2-updated"})
    assert update_resp.status_code == 409
