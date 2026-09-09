from conftest import seed_test_admin
import os
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///./test.db"

import math
import tempfile
import wave
from pathlib import Path
from uuid import UUID

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.future import select

from app.main import app
from app.core.db import Base, get_db
from app.models import Dataset, DatasetProvenance, DatasetCatalog, DatasetImportLog, Recording, SignalQuality, ResearchParticipant, Session, Annotation, Role
from app.services.datasets.importers.slr127_importer import SLR127Importer, parse_slr127_parts, speaker_id_from_parts, wav_duration_seconds, load_transcript

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
    resp = client.post("/api/v1/auth/register", headers=TEST_ADMIN_HEADERS, json={"email": "researcher_slr127@example.com", "password": "password123", "role_id": str(role.id)})
    assert resp.status_code == 201
    token = client.post("/api/v1/auth/login", json={"email": "researcher_slr127@example.com", "password": "password123"}).json()["access_token"]
    return token


def _build_fake_slr127(root: Path):
    corpus = root / "mile_tamil_asr_corpus"
    files = {
        "train": [
            ("ISTL_0000202_0000009.wav", "மூர்க்கத்தனத்தினால் வரமாட்டேன் என்று சொன்னேன் அம்மா"),
            ("ISTL_0000202_0000010.wav", "அவ்வளவோ காரியங்கள் வேறுவிதமாக நடந்திருக்கலாம்"),
            ("MILE_0000221_0000037.wav", "ச unrecognixed text"),
        ],
        "test": [
            ("MILE_0000206_0000129.wav", "தமிழ் மொழியில் பதில்"),
            ("MICI_0000000_0000004.wav", "இது சோதனை உரையாடல்"),
        ],
    }
    for split, entries in files.items():
        audio_dir = corpus / split / "audio_files"
        trans_dir = corpus / split / "trans_files"
        audio_dir.mkdir(parents=True, exist_ok=True)
        trans_dir.mkdir(parents=True, exist_ok=True)
        for wav_name, text in entries:
            wav_path = audio_dir / wav_name
            txt_path = trans_dir / f"{Path(wav_name).stem}.txt"
            with wave.open(str(wav_path), "wb") as wf:
                wf.setnchannels(1)
                wf.setsampwidth(2)
                wf.setframerate(16000)
                wf.writeframes(b"\x00\x00" * 16000)
            txt_path.write_text(text, encoding="utf-8")
    return corpus.parent


@pytest.mark.asyncio
async def test_slr127_import_creates_records():
    token = await _get_researcher_token()
    client.headers = {"Authorization": f"Bearer {token}"}
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        _build_fake_slr127(root)
        resp = client.post("/api/v1/datasets/register-real", json={
            "local_path": str(root),
            "source_url": "http://www.openslr.org/127/",
            "access_type": "PUBLIC",
            "is_restricted": False,
            "is_credentialed": False,
            "metadata_override": {
                "name": "SLR127 Test",
                "version": "1.0",
                "source_organization": "OpenSLR",
                "modality": "AUDIO",
                "language": "Tamil",
                "file_format": "WAV",
                "license": "CC BY 2.0",
            },
        })
        assert resp.status_code == 201
        dataset = resp.json()
        dataset_id = dataset["id"]
        import_resp = client.post(f"/api/v1/datasets/{dataset_id}/import", json={"local_path": str(root)})
        assert import_resp.status_code == 200
        data = import_resp.json()
        assert data["imported_status"] == "imported"
        assert data["qc_status"] == "PASS"
        assert data["manifest"]["participant_count"] == 4
        assert data["manifest"]["recording_count"] == 5
        assert data["manifest"]["discovered_modalities"] == ["AUDIO"]
        assert sorted(data["manifest"]["discovered_participants"]) == sorted([
            "SLR127-TRAIN-ISTL_0000202",
            "SLR127-TRAIN-MILE_0000221",
            "SLR127-TEST-MILE_0000206",
            "SLR127-TEST-MICI_0000000",
        ])

        async with async_session_factory() as session:
            ds = await session.get(Dataset, UUID(dataset_id))
            assert ds.data_classification == "REAL"
            assert ds.language == "Tamil"
            assert sorted(ds.split_definition.get("train", [])) == sorted(["SLR127-TRAIN-ISTL_0000202", "SLR127-TRAIN-MILE_0000221"])
            assert sorted(ds.split_definition.get("test", [])) == sorted(["SLR127-TEST-MILE_0000206", "SLR127-TEST-MICI_0000000"])

            participants = (await session.execute(select(ResearchParticipant))).scalars().all()
            assert len(participants) == 4

            recordings = (await session.execute(select(Recording))).scalars().all()
            assert len(recordings) == 5
            assert all(r.data_classification == "REAL" for r in recordings)
            assert all(r.modality == "AUDIO" for r in recordings)

            annotations = (await session.execute(select(Annotation))).scalars().all()
            assert len(annotations) == 5
            assert all(a.annotation_type == "TRANSCRIPT" for a in annotations)
            assert all(a.is_ground_truth for a in annotations)


@pytest.mark.asyncio
async def test_slr127_import_is_idempotent():
    token = await _get_researcher_token()
    client.headers = {"Authorization": f"Bearer {token}"}
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        _build_fake_slr127(root)
        dataset = client.post("/api/v1/datasets/register-real", json={
            "local_path": str(root),
            "source_url": "http://www.openslr.org/127/",
            "access_type": "PUBLIC",
            "is_restricted": False,
            "is_credentialed": False,
            "metadata_override": {
                "name": "SLR127 Idempotent",
                "version": "1.0",
                "source_organization": "OpenSLR",
                "modality": "AUDIO",
                "language": "Tamil",
            },
        }).json()
        dataset_id = dataset["id"]
        client.post(f"/api/v1/datasets/{dataset_id}/import", json={"local_path": str(root)})
        async with async_session_factory() as session:
            before_participants = (await session.execute(select(ResearchParticipant))).scalars().all()
            before_recordings = (await session.execute(select(Recording))).scalars().all()
            before_annotations = (await session.execute(select(Annotation))).scalars().all()
            assert len(before_participants) == 4
            assert len(before_recordings) == 5
            assert len(before_annotations) == 5

        client.post(f"/api/v1/datasets/{dataset_id}/import", json={"local_path": str(root)})
        async with async_session_factory() as session:
            after_participants = (await session.execute(select(ResearchParticipant))).scalars().all()
            after_recordings = (await session.execute(select(Recording))).scalars().all()
            after_annotations = (await session.execute(select(Annotation))).scalars().all()
            assert len(after_participants) == len(before_participants)
            assert len(after_recordings) == len(before_recordings)
            assert len(after_annotations) == len(before_annotations)


@pytest.mark.asyncio
async def test_slr127_import_fails_without_corpus():
    token = await _get_researcher_token()
    client.headers = {"Authorization": f"Bearer {token}"}
    with tempfile.TemporaryDirectory() as tmp:
        resp = client.post("/api/v1/datasets/register-real", json={
            "local_path": tmp,
            "source_url": "http://www.openslr.org/127/",
            "access_type": "PUBLIC",
            "is_restricted": False,
            "is_credentialed": False,
            "metadata_override": {
                "name": "SLR127 Missing",
                "version": "1.0",
                "modality": "AUDIO",
            },
        })
        assert resp.status_code == 201
        dataset = resp.json()
        import_resp = client.post(f"/api/v1/datasets/{dataset['id']}/import", json={"local_path": tmp})
        assert import_resp.status_code == 200
        assert import_resp.json()["imported_status"] == "qc_failed"


@pytest.mark.asyncio
async def test_slr127_speaker_ids_are_deterministic():
    assert speaker_id_from_parts("ISTL_0000202", "0000009", "train") == "SLR127-TRAIN-ISTL_0000202"
    assert speaker_id_from_parts("MILE_0000221", "0000037", "test") == "SLR127-TEST-MILE_0000221"
    assert speaker_id_from_parts(None, "0000009", "train") is None


@pytest.mark.asyncio
async def test_slr127_filename_parsing():
    assert parse_slr127_parts(Path("ISTL_0000202_0000009.wav")) == {"speaker": "ISTL_0000202", "utterance": "0000009", "ext": ".wav"}
    assert parse_slr127_parts(Path("badname.wav")) == {"speaker": None, "utterance": None, "ext": None}
