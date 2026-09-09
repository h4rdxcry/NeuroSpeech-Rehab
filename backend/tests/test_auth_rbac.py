from conftest import seed_test_admin
import os
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///./test.db"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from app.main import app
from app.core.db import Base, get_db
from app.models import Role, User
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
async def test_register_and_login():
    role = Role(name="PATIENT", permissions="[]")
    async with async_session_factory() as session:
        session.add(role)
        await session.commit()
    response = client.post("/api/v1/auth/register", headers=TEST_ADMIN_HEADERS, json={"email": "patient@example.com", "password": "password123", "role_id": str(role.id)})
    assert response.status_code == 201
    response = client.post("/api/v1/auth/login", json={"email": "patient@example.com", "password": "password123"})
    assert response.status_code == 200
    assert "access_token" in response.json()

@pytest.mark.asyncio
async def test_rbac_blocks_patient_from_research_participants():
    role = Role(name="PATIENT", permissions="[]")
    async with async_session_factory() as session:
        session.add(role)
        await session.commit()
    client.post("/api/v1/auth/register", headers=TEST_ADMIN_HEADERS, json={"email": "patient@example.com", "password": "password123", "role_id": str(role.id)})
    token = client.post("/api/v1/auth/login", json={"email": "patient@example.com", "password": "password123"}).json()["access_token"]
    client.headers = {"Authorization": f"Bearer {token}"}
    response = client.get("/api/v1/participants/research-participants")
    assert response.status_code == 403
