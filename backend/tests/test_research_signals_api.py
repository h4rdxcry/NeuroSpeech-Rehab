"""End-to-end persistence with explicitly synthetic sensor fixtures."""
import hashlib
from pathlib import Path
import numpy as np
import pytest
from sqlalchemy import select
from app.models import Recording, AuditLog
from app.models.feature import FeatureRecord
from app.api.v1 import research_signals
from test_asr_vertical_slice import (setup_db, engine, async_session_factory, override_get_db,
                                     client, _auth_headers, _create_full_chain)


@pytest.mark.asyncio
async def test_sensor_ingest_persist_features_fusion_and_audit(tmp_path, monkeypatch):
    monkeypatch.setattr(research_signals, "STORAGE_ROOT", tmp_path)
    researcher = await _auth_headers("RESEARCHER")
    clinician = await _auth_headers("CLINICIAN")
    chain = await _create_full_chain(researcher, clinician)
    t = np.arange(512)/256
    payload = {"session_id": chain["session"]["id"], "attempt_id": chain["attempt"]["id"],
               "modality": "EEG", "device_id": "synthetic-fixture", "sample_rate": 256,
               "units": "uV", "channel_names": ["Cz"], "samples": (20*np.sin(2*np.pi*10*t))[:, None].tolist(),
               "started_at": "2026-09-08T00:00:00Z", "clock_id": "synthetic-clock", "is_synthetic": True}
    r = client.post("/api/v1/research-signals/biosignals", json=payload, headers=researcher)
    assert r.status_code == 201, r.text
    result = r.json()
    async with async_session_factory() as db:
        feature = (await db.execute(select(FeatureRecord))).scalar_one()
        recording = await db.get(Recording, feature.recording_id)
        assert recording.is_synthetic
        assert hashlib.sha256(Path(recording.file_path).read_bytes()).hexdigest() == feature.source_sha256
        logs = (await db.execute(select(AuditLog).where(AuditLog.action == "process_signal"))).scalars().all()
        assert len(logs) == 1
    fetched = client.get(f"/api/v1/research-signals/recordings/{result['recording_id']}/features", headers=researcher)
    assert fetched.status_code == 200
    fusion = client.post("/api/v1/research-signals/fusion/prepare", json={"feature_ids": [result["feature_id"]]}, headers=researcher)
    assert fusion.status_code == 200, fusion.text
    assert fusion.json()["prediction"] is None
    assert fusion.json()["status"] == "MODEL_UNAVAILABLE"
    payload["attempt_id"] = "00000000-0000-0000-0000-000000000000"
    assert client.post("/api/v1/research-signals/biosignals", json=payload, headers=researcher).status_code == 404


@pytest.mark.asyncio
async def test_privilege_escalation_and_refresh_rejected():
    from app.models import Role
    from app.core.auth import create_access_token
    async with async_session_factory() as db:
        role = (await db.execute(select(Role).where(Role.name == "ADMIN"))).scalar_one()
    response = client.post("/api/v1/auth/register", json={"email": "admin-attack@example.com", "password": "password123", "role_id": str(role.id)})
    assert response.status_code == 403
    refresh = create_access_token({"sub": "00000000-0000-0000-0000-000000000000", "type": "refresh"})
    assert client.get("/api/v1/auth/me", headers={"Authorization": "Bearer " + refresh}).status_code == 401


@pytest.mark.asyncio
async def test_locked_participant_rejected_before_sensor_processing(tmp_path, monkeypatch):
    from app.models import Dataset, DatasetSplit, User
    monkeypatch.setattr(research_signals, "STORAGE_ROOT", tmp_path)
    researcher = await _auth_headers("RESEARCHER")
    clinician = await _auth_headers("CLINICIAN")
    chain = await _create_full_chain(researcher, clinician)
    async with async_session_factory() as db:
        owner = (await db.execute(select(User))).scalars().first()
        dataset = Dataset(name="synthetic-locked-test", version="test", participant_ids=[chain["participant"]["pseudonym_id"]], recording_ids=[], split_definition={}, created_by=owner.id)
        db.add(dataset)
        await db.flush()
        db.add(DatasetSplit(dataset_id=dataset.id, participant_id=chain["participant"]["pseudonym_id"], split_type="test", is_locked=True, final_test_flag=True))
        await db.commit()
    payload = {"session_id": chain["session"]["id"], "attempt_id": chain["attempt"]["id"],
               "modality": "EEG", "device_id": "synthetic-fixture", "sample_rate": 256,
               "units": "uV", "channel_names": ["Cz"], "samples": [[0.], [0.]],
               "started_at": "2026-09-08T00:00:00Z", "clock_id": "synthetic", "is_synthetic": True}
    assert client.post("/api/v1/research-signals/biosignals", json=payload, headers=researcher).status_code == 409
    assert list(tmp_path.iterdir()) == []
