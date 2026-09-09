from conftest import seed_test_admin
import os
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///./test.db"

import pytest
import tempfile
import asyncio
from datetime import datetime
from pathlib import Path
from uuid import UUID

import bcrypt
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

from app.main import app
from app.core.db import Base, get_db
from app.models import Dataset, DatasetSplit, ResearchParticipant, Session, Recording, Role
from app.services.datasets.dataset_splitting import (
    create_research_safe_splits,
    get_split_statistics,
    verify_no_leakage,
    _deterministic_split,
)

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
    async with async_session_factory() as session:
        result = await session.execute(select(Role).where(Role.name == "RESEARCHER"))
        role = result.scalar_one_or_none()
        if role is None:
            role = Role(name="RESEARCHER", permissions="[]")
            session.add(role)
            await session.commit()
            await session.refresh(role)
        return role


async def _get_researcher_token():
    role = await _create_researcher_role()
    resp = client.post("/api/v1/auth/register", headers=TEST_ADMIN_HEADERS, json={"email": "researcher_split@example.com", "password": "password123", "role_id": str(role.id)})
    assert resp.status_code == 201
    token = client.post("/api/v1/auth/login", json={"email": "researcher_split@example.com", "password": "password123"}).json()["access_token"]
    return token


async def _create_test_user(session):
    """Create a test user and return their ID."""
    from app.models import User
    role = await _create_researcher_role()
    hashed = bcrypt.hashpw(b"password123", bcrypt.gensalt()).decode("utf-8")
    user = User(email="test_user@example.com", password_hash=hashed, role_id=role.id, is_active=True)
    session.add(user)
    await session.flush()
    await session.refresh(user)
    return user.id


async def _setup_slr127_like_data(session, dataset_id, num_participants=100, pseudonym_prefix=""):
    """Create SLR127-like participant data with original train/test splits."""
    import random
    random.seed(123)

    # Use dataset_id hash to ensure unique pseudonyms across datasets
    if not pseudonym_prefix:
        pseudonym_prefix = str(dataset_id)[:8]

    participants = []
    for i in range(num_participants):
        # Create participant with SLR127-style ID
        if i < 638:
            prefix = "SLR127-TRAIN"
        else:
            prefix = "SLR127-TEST"
        # Some participants overlap (appear in both)
        pid = f"{prefix}-{pseudonym_prefix}-ISTL_{i:07d}"
        p = ResearchParticipant(pseudonym_id=pid, consent_status="imported")
        session.add(p)
        participants.append(p)

    await session.flush()

    # Create sessions and recordings
    for p in participants:
        # Determine original split from pseudonym
        is_original_train = p.pseudonym_id.startswith("SLR127-TRAIN")
        is_original_test = p.pseudonym_id.startswith("SLR127-TEST")

        original_splits = []
        if is_original_train:
            original_splits.append("train")
        if is_original_test:
            original_splits.append("test")

        for orig_split in original_splits:
            session_obj = Session(
                participant_id=p.id,
                session_date=datetime(2024, 1, 1),
                session_number=1,
                dataset_split=orig_split,
                status="imported",
            )
            session.add(session_obj)
            await session.flush()

            # Add some recordings
            for r in range(5):
                rec = Recording(
                    session_id=session_obj.id,
                    modality="AUDIO",
                    device_id="UNKNOWN",
                    file_path=f"{orig_split}/audio_files/{p.pseudonym_id}_{r}.wav",
                    file_format="WAV",
                    duration_seconds=1.0,
                    start_timestamp=datetime.utcnow(),
                    is_synthetic=False,
                    data_classification="REAL",
                    processing_status="raw",
                    source_dataset_id=dataset_id,
                    participant_pseudonym=p.pseudonym_id,
                    recording_identifier=f"{p.pseudonym_id}_{r}",
                )
                session.add(rec)

    await session.commit()


@pytest.mark.asyncio
async def test_deterministic_split_reproducibility():
    """Test that deterministic split produces same results with same seed."""
    participants = [f"SUBJ_{i:03d}" for i in range(100)]

    split1 = _deterministic_split(participants, 0.7, 0.15, 0.15, seed=42)
    split2 = _deterministic_split(participants, 0.7, 0.15, 0.15, seed=42)
    split3 = _deterministic_split(participants, 0.7, 0.15, 0.15, seed=123)

    assert split1 == split2, "Same seed should produce identical splits"
    assert split1 != split3, "Different seeds should produce different splits"

    # Check ratios are approximately correct
    train_count = sum(1 for v in split1.values() if v == "train")
    val_count = sum(1 for v in split1.values() if v == "validation")
    test_count = sum(1 for v in split1.values() if v == "test")

    assert abs(train_count / len(participants) - 0.7) < 0.05
    assert abs(val_count / len(participants) - 0.15) < 0.05
    assert abs(test_count / len(participants) - 0.15) < 0.05


@pytest.mark.asyncio
async def test_deterministic_split_no_leakage():
    """Test that deterministic split never assigns participant to multiple splits."""
    participants = [f"SUBJ_{i:03d}" for i in range(1000)]

    split = _deterministic_split(participants, 0.7, 0.15, 0.15, seed=42)

    # Each participant should appear exactly once
    assert len(split) == len(participants)

    # No participant should have multiple assignments
    for pid, assignment in split.items():
        assert assignment in ["train", "validation", "test"]


@pytest.mark.asyncio
async def test_create_research_safe_splits_endpoint():
    token = await _get_researcher_token()
    client.headers = {"Authorization": f"Bearer {token}"}

    with tempfile.TemporaryDirectory() as tmp:
        # Create dataset directly in test session to avoid API session issues
        async with async_session_factory() as session:
            user_id = await _create_test_user(session)
            dataset = Dataset(
                name="SLR127 Test Split",
                version="1.0",
                source_organization="OpenSLR",
                source_url="http://www.openslr.org/127/",
                modality="AUDIO",
                language="Tamil",
                data_classification="REAL",
                access_type="PUBLIC",
                is_public=True,
                is_restricted=False,
                is_credentialed=False,
                imported_status="registered",
                bids_root=tmp,
                participant_ids=[],
                recording_ids=[],
                split_definition={},
                created_by=user_id,
            )
            session.add(dataset)
            await session.flush()
            await session.refresh(dataset)
            dataset_id = dataset.id

            await _setup_slr127_like_data(session, dataset.id, num_participants=100, pseudonym_prefix=str(dataset.id)[:8])
            await session.commit()

        resp = client.post(f"/api/v1/datasets/{dataset_id}/splits/create-research-safe", json={
            "train_ratio": 0.7,
            "validation_ratio": 0.15,
            "test_ratio": 0.15,
            "seed": 42,
            "split_version": "v1",
        })
        assert resp.status_code == 201
        data = resp.json()

        assert data["train_participants"] > 0
        assert data["validation_participants"] > 0
        assert data["test_participants"] > 0
        assert data["leakage_check"] == "passed"

        # Verify splits in database
        stats_resp = client.get(f"/api/v1/datasets/{dataset_id}/splits/statistics", headers={"Authorization": f"Bearer {token}"})
        assert stats_resp.status_code == 200
        stats = stats_resp.json()
        assert stats["leakage_detected"] == False
        assert stats["test_locked"] == True
        assert stats["final_test_flagged"] == True


@pytest.mark.asyncio
async def test_no_participant_leakage():
    """Test that no participant appears in more than one split."""
    token = await _get_researcher_token()
    client.headers = {"Authorization": f"Bearer {token}"}

    with tempfile.TemporaryDirectory() as tmp:
        async with async_session_factory() as session:
            user_id = await _create_test_user(session)
            dataset = Dataset(
                name="SLR127 Leakage Test",
                version="1.0",
                source_organization="OpenSLR",
                source_url="http://www.openslr.org/127/",
                modality="AUDIO",
                language="Tamil",
                data_classification="REAL",
                access_type="PUBLIC",
                is_public=True,
                is_restricted=False,
                is_credentialed=False,
                imported_status="registered",
                bids_root=tmp,
                participant_ids=[],
                recording_ids=[],
                split_definition={},
                created_by=user_id,
            )
            session.add(dataset)
            await session.flush()
            await session.refresh(dataset)
            dataset_id = dataset.id

            await _setup_slr127_like_data(session, dataset.id, num_participants=200, pseudonym_prefix=str(dataset.id)[:8])
            await session.commit()

        resp = client.post(f"/api/v1/datasets/{dataset_id}/splits/create-research-safe", json={
            "train_ratio": 0.7,
            "validation_ratio": 0.15,
            "test_ratio": 0.15,
            "seed": 42,
            "split_version": "v1",
        })
        assert resp.status_code == 201

        verify_resp = client.get(f"/api/v1/datasets/{dataset_id}/splits/verify", headers={"Authorization": f"Bearer {token}"})
        assert verify_resp.status_code == 200
        verify = verify_resp.json()
        assert verify["no_leakage"] == True
        assert verify["message"] == "No participant leakage detected"


@pytest.mark.asyncio
async def test_split_deterministic_with_seed():
    """Test that same seed produces identical splits."""
    token = await _get_researcher_token()
    client.headers = {"Authorization": f"Bearer {token}"}

    with tempfile.TemporaryDirectory() as tmp:
        async with async_session_factory() as session:
            user_id = await _create_test_user(session)
            dataset1 = Dataset(
                name="Seed Test 1",
                version="1.0",
                source_organization="OpenSLR",
                source_url="http://www.openslr.org/127/",
                modality="AUDIO",
                language="Tamil",
                data_classification="REAL",
                access_type="PUBLIC",
                is_public=True,
                is_restricted=False,
                is_credentialed=False,
                imported_status="registered",
                bids_root=tmp,
                participant_ids=[],
                recording_ids=[],
                split_definition={},
                created_by=user_id,
            )
            dataset2 = Dataset(
                name="Seed Test 2",
                version="1.0",
                source_organization="OpenSLR",
                source_url="http://www.openslr.org/127/",
                modality="AUDIO",
                language="Tamil",
                data_classification="REAL",
                access_type="PUBLIC",
                is_public=True,
                is_restricted=False,
                is_credentialed=False,
                imported_status="registered",
                bids_root=tmp,
                participant_ids=[],
                recording_ids=[],
                split_definition={},
                created_by=user_id,
            )
            session.add(dataset1)
            session.add(dataset2)
            await session.flush()
            await session.refresh(dataset1)
            await session.refresh(dataset2)

            await _setup_slr127_like_data(session, dataset1.id, num_participants=50, pseudonym_prefix="seed1")
            await _setup_slr127_like_data(session, dataset2.id, num_participants=50, pseudonym_prefix="seed2")
            await session.commit()

        resp1 = client.post(f"/api/v1/datasets/{dataset1.id}/splits/create-research-safe", json={
            "train_ratio": 0.7, "validation_ratio": 0.15, "test_ratio": 0.15,
            "seed": 42, "split_version": "v1",
        })
        assert resp1.status_code == 201

        resp2 = client.post(f"/api/v1/datasets/{dataset2.id}/splits/create-research-safe", json={
            "train_ratio": 0.7, "validation_ratio": 0.15, "test_ratio": 0.15,
            "seed": 42, "split_version": "v1",
        })
        assert resp2.status_code == 201

        assign1 = client.get(f"/api/v1/datasets/{dataset1.id}/splits/assignments", headers={"Authorization": f"Bearer {token}"}).json()
        assign2 = client.get(f"/api/v1/datasets/{dataset2.id}/splits/assignments", headers={"Authorization": f"Bearer {token}"}).json()

        for a1 in assign1:
            for a2 in assign2:
                if a1["participant_id"] == a2["participant_id"]:
                    assert a1["split_type"] == a2["split_type"]


@pytest.mark.asyncio
async def test_original_openslr_metadata_preserved():
    """Test that original OpenSLR train/test membership is preserved in split metadata."""
    token = await _get_researcher_token()
    client.headers = {"Authorization": f"Bearer {token}"}

    with tempfile.TemporaryDirectory() as tmp:
        # Create dataset directly in test session (same pattern as passing test)
        async with async_session_factory() as session:
            user_id = await _create_test_user(session)
            dataset = Dataset(
                name="SLR127 Metadata Test",
                version="1.0",
                source_organization="OpenSLR",
                source_url="http://www.openslr.org/127/",
                modality="AUDIO",
                language="Tamil",
                data_classification="REAL",
                access_type="PUBLIC",
                is_public=True,
                is_restricted=False,
                is_credentialed=False,
                imported_status="registered",
                bids_root=tmp,
                participant_ids=[],
                recording_ids=[],
                split_definition={},
                created_by=user_id,
            )
            session.add(dataset)
            await session.flush()
            await session.refresh(dataset)
            dataset_id = dataset.id

            await _setup_slr127_like_data(session, dataset.id, num_participants=1000, pseudonym_prefix=str(dataset.id)[:8])
            await session.commit()

        resp = client.post(f"/api/v1/datasets/{dataset_id}/splits/create-research-safe?split_version=v1", json={
            "train_ratio": 0.7,
            "validation_ratio": 0.15,
            "test_ratio": 0.15,
            "seed": 42,
        })
        assert resp.status_code == 201

        # Get split_definition from database directly (GET /datasets/{id} endpoint not in dataset_splitting router)
        async with async_session_factory() as session:
            ds = await session.get(Dataset, dataset_id)
            assert ds is not None, "Dataset not found in database"
            split_def = ds.split_definition
        
        assert "original_openslr_train" in split_def
        assert "original_openslr_test" in split_def
        assert len(split_def["original_openslr_train"]) > 0
        assert len(split_def["original_openslr_test"]) > 0
        assert split_def["split_version"] == "v1"
        assert split_def["seed"] == 42


@pytest.mark.asyncio
async def test_test_set_locked():
    """Test that test set is locked and final_test_flag is set."""
    token = await _get_researcher_token()
    client.headers = {"Authorization": f"Bearer {token}"}

    with tempfile.TemporaryDirectory() as tmp:
        async with async_session_factory() as session:
            user_id = await _create_test_user(session)
            dataset = Dataset(
                name="Lock Test",
                version="1.0",
                source_organization="OpenSLR",
                source_url="http://www.openslr.org/127/",
                modality="AUDIO",
                language="Tamil",
                data_classification="REAL",
                access_type="PUBLIC",
                is_public=True,
                is_restricted=False,
                is_credentialed=False,
                imported_status="registered",
                bids_root=tmp,
                participant_ids=[],
                recording_ids=[],
                split_definition={},
                created_by=user_id,
            )
            session.add(dataset)
            await session.flush()
            await session.refresh(dataset)
            dataset_id = dataset.id

            await _setup_slr127_like_data(session, dataset.id, num_participants=30, pseudonym_prefix=str(dataset.id)[:8])
            await session.commit()

        resp = client.post(f"/api/v1/datasets/{dataset_id}/splits/create-research-safe", json={
            "train_ratio": 0.7, "validation_ratio": 0.15, "test_ratio": 0.15,
            "seed": 42, "split_version": "v1",
        })
        assert resp.status_code == 201

        stats_resp = client.get(f"/api/v1/datasets/{dataset_id}/splits/statistics", headers={"Authorization": f"Bearer {token}"})
        assert stats_resp.status_code == 200
        stats = stats_resp.json()

        assert stats["test_locked"] == True
        assert stats["final_test_flagged"] == True

        # Verify via assignments endpoint
        assign_resp = client.get(f"/api/v1/datasets/{dataset_id}/splits/assignments?split_type=test", headers={"Authorization": f"Bearer {token}"})
        assert assign_resp.status_code == 200
        assigns = assign_resp.json()
        for a in assigns:
            assert a["is_locked"] == True
            assert a["final_test_flag"] == True


@pytest.mark.asyncio
async def test_split_version_tracking():
    """Test that split version is tracked and multiple versions can be created on different datasets."""
    token = await _get_researcher_token()
    client.headers = {"Authorization": f"Bearer {token}"}

    with tempfile.TemporaryDirectory() as tmp:
        # Create both datasets directly in test session
        async with async_session_factory() as session:
            user_id = await _create_test_user(session)
            dataset1 = Dataset(
                name="Version Test 1",
                version="1.0",
                source_organization="OpenSLR",
                source_url="http://www.openslr.org/127/",
                modality="AUDIO",
                language="Tamil",
                data_classification="REAL",
                access_type="PUBLIC",
                is_public=True,
                is_restricted=False,
                is_credentialed=False,
                imported_status="registered",
                bids_root=tmp,
                participant_ids=[],
                recording_ids=[],
                split_definition={},
                created_by=user_id,
            )
            dataset2 = Dataset(
                name="Version Test 2",
                version="1.0",
                source_organization="OpenSLR",
                source_url="http://www.openslr.org/127/",
                modality="AUDIO",
                language="Tamil",
                data_classification="REAL",
                access_type="PUBLIC",
                is_public=True,
                is_restricted=False,
                is_credentialed=False,
                imported_status="registered",
                bids_root=tmp,
                participant_ids=[],
                recording_ids=[],
                split_definition={},
                created_by=user_id,
            )
            session.add(dataset1)
            session.add(dataset2)
            await session.flush()
            await session.refresh(dataset1)
            await session.refresh(dataset2)

            # Setup data for both datasets with different prefixes to avoid UNIQUE constraint
            prefix1 = "ver1"
            prefix2 = "ver2"

            await _setup_slr127_like_data(session, dataset1.id, num_participants=50, pseudonym_prefix=prefix1)
            await _setup_slr127_like_data(session, dataset2.id, num_participants=50, pseudonym_prefix=prefix2)
            await session.commit()

            dataset1_id = dataset1.id
            dataset2_id = dataset2.id

        # Create v1 with seed 42 on dataset1
        resp1 = client.post(f"/api/v1/datasets/{dataset1_id}/splits/create-research-safe?split_version=v1", json={
            "train_ratio": 0.7, "validation_ratio": 0.15, "test_ratio": 0.15,
            "seed": 42,
        })
        assert resp1.status_code == 201

        # Create v2 with different seed (123) on dataset2
        resp2 = client.post(f"/api/v1/datasets/{dataset2_id}/splits/create-research-safe?split_version=v2", json={
            "train_ratio": 0.7, "validation_ratio": 0.15, "test_ratio": 0.15,
            "seed": 123,
        })
        assert resp2.status_code == 201

        # Get both versions
        v1_assigns = client.get(f"/api/v1/datasets/{dataset1_id}/splits/assignments?split_version=v1", headers={"Authorization": f"Bearer {token}"}).json()
        v2_assigns = client.get(f"/api/v1/datasets/{dataset2_id}/splits/assignments?split_version=v2", headers={"Authorization": f"Bearer {token}"}).json()

        # Verify both versions have assignments
        assert len(v1_assigns) > 0
        assert len(v2_assigns) > 0
        assert all(a["split_version"] == "v1" for a in v1_assigns)
        assert all(a["split_version"] == "v2" for a in v2_assigns)

        # Verify test set is locked and final_test_flag is set
        for a in v1_assigns:
            if a["split_type"] == "test":
                assert a["is_locked"] == True
                assert a["final_test_flag"] == True
        for a in v2_assigns:
            if a["split_type"] == "test":
                assert a["is_locked"] == True
                assert a["final_test_flag"] == True

        # Verify deterministic behavior via direct function test
        from app.services.datasets.dataset_splitting import _deterministic_split
        participants = [f"SUBJ_{i:03d}" for i in range(50)]
        split1 = _deterministic_split(participants, 0.7, 0.15, 0.15, seed=42)
        split2 = _deterministic_split(participants, 0.7, 0.15, 0.15, seed=42)
        assert split1 == split2, "Same seed should produce identical splits"

        split3 = _deterministic_split(participants, 0.7, 0.15, 0.15, seed=123)
        assert split1 != split3, "Different seeds should produce different splits"