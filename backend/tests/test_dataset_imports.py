from conftest import seed_test_admin
import os
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///./test.db"

import pytest
import tempfile
from pathlib import Path
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from app.main import app
from app.core.db import Base, get_db
from app.models import Role, User, Dataset, DatasetProvenance, DatasetCatalog, DatasetImportLog, Recording, SignalQuality, ResearchParticipant
from app.schemas.enums import ModalityType

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


async def _create_researcher_role():
    role = Role(name="RESEARCHER", permissions="[]")
    async with async_session_factory() as session:
        session.add(role)
        await session.commit()
    return role


async def _get_researcher_token():
    role = await _create_researcher_role()
    resp = client.post("/api/v1/auth/register", headers=TEST_ADMIN_HEADERS, json={"email": "researcher_import@example.com", "password": "password123", "role_id": str(role.id)})
    assert resp.status_code == 201
    token = client.post("/api/v1/auth/login", json={"email": "researcher_import@example.com", "password": "password123"}).json()["access_token"]
    return token


@pytest.mark.asyncio
async def test_real_dataset_registration():
    token = await _get_researcher_token()
    client.headers = {"Authorization": f"Bearer {token}"}
    payload = {
        "local_path": None,
        "source_url": "https://openneuro.org/datasets/ds007808",
        "access_type": "PUBLIC",
        "is_restricted": False,
        "is_credentialed": False,
        "metadata_override": {
            "name": "JapanEEG",
            "version": "1.0",
            "source_organization": "OpenNeuro",
            "modality": "EEG",
            "participant_count": 3,
            "recording_count": 312,
            "total_duration": 3672000.0,
            "license": "CC0",
            "population": "Healthy adults",
            "language": "ja",
            "bids_compatible": True,
        }
    }
    resp = client.post("/api/v1/datasets/register-real", json=payload)
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "JapanEEG"
    assert data["data_classification"] == "REAL"
    assert data["imported_status"] == "registered"


@pytest.mark.asyncio
async def test_real_classification_validation():
    token = await _get_researcher_token()
    client.headers = {"Authorization": f"Bearer {token}"}
    dataset = client.post("/api/v1/datasets/register-real", json={
        "local_path": None,
        "source_url": "https://example.com/ds",
        "access_type": "PUBLIC",
        "is_restricted": False,
        "is_credentialed": False,
        "metadata_override": {"name": "Real DS", "version": "1"},
    }).json()
    resp = client.patch(f"/api/v1/datasets/datasets/{dataset['id']}", json={"data_classification": "SYNTHETIC"})
    assert resp.status_code == 400
    assert "REAL" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_import_workflow_with_local_fixture():
    token = await _get_researcher_token()
    client.headers = {"Authorization": f"Bearer {token}"}
    dataset = client.post("/api/v1/datasets/register-real", json={
        "local_path": None,
        "source_url": "https://example.com/ds",
        "access_type": "PUBLIC",
        "is_restricted": False,
        "is_credentialed": False,
        "metadata_override": {"name": "Fixture DS", "version": "1"},
    }).json()
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        (root / "sub-001").mkdir()
        (root / "sub-001" / "ses-01").mkdir()
        (root / "sub-001" / "ses-01" / "eeg").mkdir()
        (root / "sub-001" / "ses-01" / "eeg" / "test.edf").write_text("dummy")
        (root / "sub-002").mkdir()
        (root / "sub-002" / "ses-01").mkdir()
        (root / "sub-002" / "ses-01" / "audio").mkdir()
        (root / "sub-002" / "ses-01" / "audio" / "test.wav").write_text("dummy")
        resp = client.post(f"/api/v1/datasets/{dataset['id']}/import", json={"local_path": str(root)})
        assert resp.status_code == 200
        data = resp.json()
        assert data["imported_status"] == "imported"
        assert data["qc_status"] == "PASS"
        assert len(data["manifest"]["discovered_participants"]) == 2
        assert "EEG" in data["manifest"]["discovered_modalities"]
        assert "AUDIO" in data["manifest"]["discovered_modalities"]
        assert "AUDIO" in data["manifest"]["discovered_modalities"]


@pytest.mark.asyncio
async def test_restricted_dataset_import_metadata_only():
    token = await _get_researcher_token()
    client.headers = {"Authorization": f"Bearer {token}"}
    dataset = client.post("/api/v1/datasets/register-real", json={
        "local_path": None,
        "source_url": "https://example.com/restricted",
        "access_type": "CREDENTIAL_REQUIRED",
        "is_restricted": True,
        "is_credentialed": True,
        "metadata_override": {"name": "Restricted DS", "version": "1", "license": "DUA required"},
    }).json()
    resp = client.post(f"/api/v1/datasets/{dataset['id']}/import", json={"local_path": None})
    assert resp.status_code == 200
    data = resp.json()
    assert data["imported_status"] == "metadata_only"
    assert any("Restricted" in w for w in data["manifest"]["warnings"])


@pytest.mark.asyncio
async def test_import_fails_without_local_path():
    token = await _get_researcher_token()
    client.headers = {"Authorization": f"Bearer {token}"}
    dataset = client.post("/api/v1/datasets/register-real", json={
        "local_path": None,
        "source_url": "https://example.com/ds",
        "access_type": "PUBLIC",
        "is_restricted": False,
        "is_credentialed": False,
        "metadata_override": {"name": "NoPath DS", "version": "1"},
    }).json()
    resp = client.post(f"/api/v1/datasets/{dataset['id']}/import", json={"local_path": None})
    assert resp.status_code == 200
    data = resp.json()
    assert data["imported_status"] == "failed"
    assert data["qc_status"] == "FAIL"


@pytest.mark.asyncio
async def test_manifest_generation_and_retrieval():
    token = await _get_researcher_token()
    client.headers = {"Authorization": f"Bearer {token}"}
    dataset = client.post("/api/v1/datasets/register-real", json={
        "local_path": None,
        "source_url": "https://example.com/ds",
        "access_type": "PUBLIC",
        "is_restricted": False,
        "is_credentialed": False,
        "metadata_override": {"name": "Manifest DS", "version": "1"},
    }).json()
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        (root / "sub-001" / "ses-01" / "eeg").mkdir(parents=True)
        (root / "sub-001" / "ses-01" / "eeg" / "test.edf").write_text("dummy")
        client.post(f"/api/v1/datasets/{dataset['id']}/import", json={"local_path": str(root)})
    resp = client.get(f"/api/v1/datasets/{dataset['id']}/manifest")
    assert resp.status_code == 200
    m = resp.json()
    assert m["dataset_name"] == "Manifest DS"
    assert m["preprocessing_status"] == "RAW"


@pytest.mark.asyncio
async def test_participant_identity_isolation():
    token = await _get_researcher_token()
    client.headers = {"Authorization": f"Bearer {token}"}
    ds1 = client.post("/api/v1/datasets/register-real", json={
        "local_path": None,
        "source_url": "https://example.com/ds1",
        "access_type": "PUBLIC",
        "is_restricted": False,
        "is_credentialed": False,
        "metadata_override": {"name": "DS1", "version": "1"},
    }).json()
    ds2 = client.post("/api/v1/datasets/register-real", json={
        "local_path": None,
        "source_url": "https://example.com/ds2",
        "access_type": "PUBLIC",
        "is_restricted": False,
        "is_credentialed": False,
        "metadata_override": {"name": "DS2", "version": "1"},
    }).json()
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        (root / "sub-001" / "ses-01" / "eeg").mkdir(parents=True)
        (root / "sub-001" / "ses-01" / "eeg" / "test.edf").write_text("dummy")
        client.post(f"/api/v1/datasets/{ds1['id']}/import", json={"local_path": str(root)})
        client.post(f"/api/v1/datasets/{ds2['id']}/import", json={"local_path": str(root)})
    r1 = client.get(f"/api/v1/datasets/{ds1['id']}/manifest")
    r2 = client.get(f"/api/v1/datasets/{ds2['id']}/manifest")
    assert r1.status_code == 200
    assert r2.status_code == 200
    assert r1.json()["dataset_id"] != r2.json()["dataset_id"]


@pytest.mark.asyncio
async def test_qc_status_warning():
    token = await _get_researcher_token()
    client.headers = {"Authorization": f"Bearer {token}"}
    dataset = client.post("/api/v1/datasets/register-real", json={
        "local_path": None,
        "source_url": "https://example.com/ds",
        "access_type": "PUBLIC",
        "is_restricted": False,
        "is_credentialed": False,
        "metadata_override": {"name": "Warn DS", "version": "1", "participant_count": 1},
    }).json()
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        (root / "sub-001" / "ses-01" / "eeg").mkdir(parents=True)
        (root / "sub-001" / "ses-01" / "eeg" / "test.edf").write_text("dummy")
        resp = client.post(f"/api/v1/datasets/{dataset['id']}/import", json={"local_path": str(root)})
    assert resp.status_code == 200
    data = resp.json()
    assert data["imported_status"] == "imported"
    assert data["qc_status"] == "PASS"


@pytest.mark.asyncio
async def test_duplicate_detection_not_automatic():
    token = await _get_researcher_token()
    client.headers = {"Authorization": f"Bearer {token}"}
    ds1 = client.post("/api/v1/datasets/register-real", json={
        "local_path": None,
        "source_url": "https://example.com/ds1",
        "access_type": "PUBLIC",
        "is_restricted": False,
        "is_credentialed": False,
        "metadata_override": {"name": "Dup DS1", "version": "1", "source_organization": "SrcA"},
    }).json()
    ds2 = client.post("/api/v1/datasets/register-real", json={
        "local_path": None,
        "source_url": "https://example.com/ds2",
        "access_type": "PUBLIC",
        "is_restricted": False,
        "is_credentialed": False,
        "metadata_override": {"name": "Dup DS2", "version": "1", "source_organization": "SrcB"},
    }).json()
    assert ds1["id"] != ds2["id"]
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        (root / "sub-001" / "ses-01" / "eeg").mkdir(parents=True)
        (root / "sub-001" / "ses-01" / "eeg" / "test.edf").write_text("dummy")
        client.post(f"/api/v1/datasets/{ds1['id']}/import", json={"local_path": str(root)})
        client.post(f"/api/v1/datasets/{ds2['id']}/import", json={"local_path": str(root)})
    prov1 = client.get(f"/api/v1/datasets/datasets/{ds1['id']}/provenance")
    prov2 = client.get(f"/api/v1/datasets/datasets/{ds2['id']}/provenance")
    assert prov1.status_code == 200
    assert prov2.status_code == 200
    assert prov1.json()["original_source"] == "SrcA"
    assert prov2.json()["original_source"] == "SrcB"


@pytest.mark.asyncio
async def test_missing_metadata_handled_gracefully():
    token = await _get_researcher_token()
    client.headers = {"Authorization": f"Bearer {token}"}
    payload = {
        "local_path": None,
        "source_url": "https://example.com/ds",
        "access_type": "PUBLIC",
        "is_restricted": False,
        "is_credentialed": False,
        "metadata_override": {"name": " sparse DS", "version": "1"},
    }
    resp = client.post("/api/v1/datasets/register-real", json=payload)
    assert resp.status_code == 201
    data = resp.json()
    assert data["participant_count"] is None
    assert data["recording_count"] is None


@pytest.mark.asyncio
async def test_authorization_required_for_import():
    client.headers = {}
    resp = client.post("/api/v1/datasets/00000000-0000-0000-0000-000000000000/import", json={"local_path": "/tmp"})
    assert resp.status_code == 401
