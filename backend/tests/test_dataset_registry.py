from conftest import seed_test_admin
import os
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///./test.db"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from app.main import app
from app.core.db import Base, get_db
from app.models import Role, User, Dataset, DatasetProvenance, DatasetSplit, DatasetCatalog, Recording, SignalQuality, ResearchParticipant
from app.schemas.enums import ModalityType, ProjectUsage

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
    resp = client.post("/api/v1/auth/register", headers=TEST_ADMIN_HEADERS, json={"email": "researcher_reg@example.com", "password": "password123", "role_id": str(role.id)})
    assert resp.status_code == 201
    token = client.post("/api/v1/auth/login", json={"email": "researcher_reg@example.com", "password": "password123"}).json()["access_token"]
    return token


@pytest.mark.asyncio
async def test_dataset_registration():
    token = await _get_researcher_token()
    client.headers = {"Authorization": f"Bearer {token}"}
    payload = {
        "name": "Test Dataset",
        "version": "1.0",
        "description": "A test dataset",
        "modality": "EEG",
        "participant_ids": ["SUBJ-001"],
        "recording_ids": [],
        "split_definition": {},
        "is_final_test": False,
        "is_locked": False,
        "source_organization": "Test Org",
        "source_url": "https://example.com/dataset",
        "citation": "Test Citation",
        "population_description": "Healthy adults",
        "participant_count": 1,
        "recording_count": 0,
        "total_duration": 3600.0,
        "sampling_information": "256 Hz",
        "file_format": "EDF",
        "license": "CC-BY",
        "access_type": "PUBLIC",
        "access_requirements": "None",
        "consent_ethics": "IRB approved",
        "clinical_or_control_population": "control",
        "language": "en",
        "task_description": "Resting state",
        "acquisition_device": "NeuroScan",
        "is_public": True,
        "is_restricted": False,
        "is_credentialed": False,
        "imported_status": "imported",
        "checksum": "abc123",
        "notes": "Test notes",
    }
    resp = client.post("/api/v1/datasets/datasets", json=payload)
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Test Dataset"
    assert data["modality"] == "EEG"
    assert data["source_organization"] == "Test Org"
    assert data["participant_count"] == 1
    assert data["is_public"] is True


@pytest.mark.asyncio
async def test_dataset_metadata_validation():
    token = await _get_researcher_token()
    client.headers = {"Authorization": f"Bearer {token}"}
    resp = client.post("/api/v1/datasets/datasets", json={"name": "", "version": "1"})
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_imported_split_metadata_survives_dataset_api_read():
    token = await _get_researcher_token()
    client.headers = {"Authorization": f"Bearer {token}"}
    created = client.post("/api/v1/datasets/datasets", json={"name": "Imported corpus", "version": "1"})
    assert created.status_code == 201
    from uuid import UUID
    dataset_id = created.json()["id"]
    split = {"split_version": "v1", "seed": 42,
             "ratios": {"train": 0.7, "validation": 0.15, "test": 0.15}}
    async with async_session_factory() as session:
        dataset = await session.get(Dataset, UUID(dataset_id))
        dataset.split_definition = split
        await session.commit()
    detail = client.get(f"/api/v1/datasets/datasets/{dataset_id}")
    listing = client.get("/api/v1/datasets/datasets")
    assert detail.status_code == listing.status_code == 200
    assert detail.json()["split_definition"] == split
    assert next(item for item in listing.json() if item["id"] == dataset_id)["split_definition"] == split


@pytest.mark.asyncio
async def test_provenance_lifecycle():
    token = await _get_researcher_token()
    client.headers = {"Authorization": f"Bearer {token}"}
    dataset = client.post("/api/v1/datasets/datasets", json={"name": "Prov Dataset", "version": "1", "participant_ids": [], "recording_ids": [], "split_definition": {}}).json()
    prov_payload = {
        "original_source": "OpenNeuro",
        "original_dataset_identifier": "ds000001",
        "version": "1.0",
        "source_url": "https://openneuro.org/ds000001",
        "license_access_info": "CC0",
        "checksum": "sha256:abc",
        "preprocessing_pipeline_version": "pp1",
        "transformations_performed": "Filtered",
    }
    resp = client.post(f"/api/v1/datasets/datasets/{dataset['id']}/provenance", json=prov_payload)
    print("PROV DEBUG resp:", resp.status_code, resp.text[:300])
    assert resp.status_code == 201
    prov = resp.json()
    assert prov["original_source"] == "OpenNeuro"
    resp2 = client.get(f"/api/v1/datasets/datasets/{dataset['id']}/provenance")
    assert resp2.status_code == 200
    assert resp2.json()["original_dataset_identifier"] == "ds000001"


@pytest.mark.asyncio
async def test_catalog_project_usage():
    token = await _get_researcher_token()
    client.headers = {"Authorization": f"Bearer {token}"}
    dataset = client.post("/api/v1/datasets/datasets", json={"name": "Catalog Dataset", "version": "1", "participant_ids": [], "recording_ids": [], "split_definition": {}}).json()
    catalog_payload = {
        "modality": "EEG",
        "source": "OpenNeuro",
        "version": "1.0",
        "participants": 10,
        "recordings": 100,
        "duration": 36000.0,
        "population": "Healthy adults",
        "clinical_control": "control",
        "license": "CC-BY",
        "access_requirements": "None",
        "project_usage": "USED_IN_PROJECT",
    }
    resp = client.post(f"/api/v1/datasets/{dataset['id']}/catalog", json=catalog_payload)
    assert resp.status_code == 201
    data = resp.json()
    assert data["project_usage"] == "USED_IN_PROJECT"
    assert data["participants"] == 10


@pytest.mark.asyncio
async def test_modality_validation():
    token = await _get_researcher_token()
    client.headers = {"Authorization": f"Bearer {token}"}
    p = client.post("/api/v1/participants/research-participants", json={"pseudonym_id": "SUBJ-MOD", "consent_status": "approved"}).json()
    s = client.post("/api/v1/sessions/sessions", json={"participant_id": p["id"], "session_date": "2026-09-04", "session_number": 1}).json()
    recording = {
        "session_id": s["id"],
        "modality": "INVALID_MODALITY",
        "device_id": "dev-1",
        "file_path": "/data/raw/x.edf",
        "file_format": "edf",
        "start_timestamp": "2026-09-04T00:00:00Z",
    }
    resp = client.post("/api/v1/recordings/recordings", json=recording)
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_real_synthetic_classification():
    token = await _get_researcher_token()
    client.headers = {"Authorization": f"Bearer {token}"}
    p = client.post("/api/v1/participants/research-participants", json={"pseudonym_id": "SUBJ-CLS", "consent_status": "approved"}).json()
    s = client.post("/api/v1/sessions/sessions", json={"participant_id": p["id"], "session_date": "2026-09-04", "session_number": 1}).json()
    real_recording = {
        "session_id": s["id"],
        "modality": "EEG",
        "device_id": "dev-1",
        "file_path": "/data/raw/eeg.edf",
        "file_format": "edf",
        "start_timestamp": "2026-09-04T00:00:00Z",
        "is_synthetic": False,
    }
    resp = client.post("/api/v1/recordings/recordings", json=real_recording)
    assert resp.status_code == 201
    assert resp.json()["data_classification"] == "REAL"
    synthetic_recording = {
        "session_id": s["id"],
        "modality": "EEG",
        "device_id": "dev-1",
        "file_path": "/data/synth/eeg.edf",
        "file_format": "edf",
        "start_timestamp": "2026-09-04T00:00:00Z",
        "is_synthetic": True,
        "synthetic_source": "generator",
    }
    resp2 = client.post("/api/v1/recordings/recordings", json=synthetic_recording)
    assert resp2.status_code == 201
    assert resp2.json()["data_classification"] == "SYNTHETIC"


@pytest.mark.asyncio
async def test_recording_metadata_registration():
    token = await _get_researcher_token()
    client.headers = {"Authorization": f"Bearer {token}"}
    p = client.post("/api/v1/participants/research-participants", json={"pseudonym_id": "SUBJ-REC", "consent_status": "approved"}).json()
    s = client.post("/api/v1/sessions/sessions", json={"participant_id": p["id"], "session_date": "2026-09-04", "session_number": 1}).json()
    recording = {
        "session_id": s["id"],
        "modality": "EEG",
        "device_id": "dev-1",
        "device_name": "NeuroScan SynAmps",
        "file_path": "/data/raw/eeg.edf",
        "file_format": "edf",
        "sampling_rate_hz": 256.0,
        "channel_count": 64,
        "channel_names": ["Fz", "Cz", "Pz"],
        "duration_seconds": 600.0,
        "start_timestamp": "2026-09-04T00:00:00Z",
        "end_timestamp": "2026-09-04T00:10:00Z",
        "is_synthetic": False,
        "ground_truth_available": True,
        "processing_status": "raw",
        "participant_pseudonym": "SUBJ-REC",
        "session_identifier": "SES-001",
        "recording_identifier": "REC-001",
        "data_classification": "REAL",
        "units": "uV",
        "quality_status": "PASS",
        "synchronization_info": {"trigger": "photodiode"},
    }
    resp = client.post("/api/v1/recordings/recordings", json=recording)
    assert resp.status_code == 201
    data = resp.json()
    assert data["channel_count"] == 64
    assert data["sampling_rate_hz"] == 256.0
    assert data["participant_pseudonym"] == "SUBJ-REC"
    assert data["quality_status"] == "PASS"


@pytest.mark.asyncio
async def test_participant_split_isolation():
    token = await _get_researcher_token()
    client.headers = {"Authorization": f"Bearer {token}"}
    p1 = client.post("/api/v1/participants/research-participants", json={"pseudonym_id": "SUBJ-SPLIT-1", "consent_status": "approved"}).json()
    p2 = client.post("/api/v1/participants/research-participants", json={"pseudonym_id": "SUBJ-SPLIT-2", "consent_status": "approved"}).json()
    split = {"train": ["SUBJ-SPLIT-1"], "validation": ["SUBJ-SPLIT-2"], "test": []}
    dataset = client.post("/api/v1/datasets/datasets", json={"name": "Split Dataset", "version": "1", "participant_ids": ["SUBJ-SPLIT-1", "SUBJ-SPLIT-2"], "recording_ids": [], "split_definition": split}).json()
    assert dataset["split_definition"]["train"] == ["SUBJ-SPLIT-1"]
    assert dataset["split_definition"]["validation"] == ["SUBJ-SPLIT-2"]
    split_payload = {"dataset_id": dataset["id"], "participant_id": "SUBJ-SPLIT-1", "split_type": "train"}
    client.post(f"/api/v1/datasets/datasets/{dataset['id']}/splits", json=split_payload)
    split_payload2 = {"dataset_id": dataset["id"], "participant_id": "SUBJ-SPLIT-2", "split_type": "validation"}
    client.post(f"/api/v1/datasets/datasets/{dataset['id']}/splits", json=split_payload2)
    splits = client.get(f"/api/v1/datasets/datasets/{dataset['id']}/splits").json()
    assert len(splits) == 2
    train_splits = [s for s in splits if s["split_type"] == "train"]
    assert len(train_splits) == 1
    assert train_splits[0]["participant_id"] == "SUBJ-SPLIT-1"


@pytest.mark.asyncio
async def test_locked_dataset_rejects_modification():
    token = await _get_researcher_token()
    client.headers = {"Authorization": f"Bearer {token}"}
    dataset = client.post("/api/v1/datasets/datasets", json={"name": "Lock Dataset", "version": "1", "participant_ids": [], "recording_ids": [], "split_definition": {}}).json()
    lock_resp = client.post(f"/api/v1/datasets/datasets/{dataset['id']}/lock")
    assert lock_resp.status_code == 200
    update_resp = client.patch(f"/api/v1/datasets/datasets/{dataset['id']}", json={"name": "Lock Dataset Updated"})
    assert update_resp.status_code == 409


@pytest.mark.asyncio
async def test_locked_split_rejects_modification():
    token = await _get_researcher_token()
    client.headers = {"Authorization": f"Bearer {token}"}
    dataset = client.post("/api/v1/datasets/datasets", json={"name": "Split Lock Dataset", "version": "1", "participant_ids": [], "recording_ids": [], "split_definition": {}}).json()
    split_payload = {"dataset_id": dataset["id"], "participant_id": "SUBJ-LOCK", "split_type": "train"}
    split = client.post(f"/api/v1/datasets/datasets/{dataset['id']}/splits", json=split_payload).json()
    lock_resp = client.post(f"/api/v1/datasets/datasets/{dataset['id']}/splits/lock")
    assert lock_resp.status_code == 200
    update_resp = client.patch(f"/api/v1/datasets/datasets/{dataset['id']}/splits/{split['id']}", json={"split_type": "test"})
    assert update_resp.status_code == 409


@pytest.mark.asyncio
async def test_restricted_dataset_protection():
    token = await _get_researcher_token()
    client.headers = {"Authorization": f"Bearer {token}"}
    dataset = client.post("/api/v1/datasets/datasets", json={
        "name": "Restricted Dataset",
        "version": "1",
        "participant_ids": [],
        "recording_ids": [],
        "split_definition": {},
        "is_restricted": True,
        "is_credentialed": True,
    }).json()
    resp = client.get(f"/api/v1/datasets/datasets/{dataset['id']}")
    assert resp.status_code == 200
    assert resp.json()["is_restricted"] is True


@pytest.mark.asyncio
async def test_authorization_required_for_dataset_creation():
    client.headers = {}
    resp = client.post("/api/v1/datasets/datasets", json={"name": "No Auth", "version": "1", "participant_ids": [], "recording_ids": [], "split_definition": {}})
    assert resp.status_code == 401
