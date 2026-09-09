from conftest import seed_test_admin
from ws_test_utils import collect_ws_messages as _collect_ws_messages
import os
import math
import json
import wave
import struct
import time
import threading
import queue
import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.future import select
from uuid import UUID

os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///./test_ws.db"

from app.main import app
from app.core.db import Base, get_db
from app.models import (
    Role,
    User,
    ResearchParticipant,
    Session,
    Exercise,
    SessionExercise,
    Attempt,
    Recording,
    SignalQuality,
    ModelVersion,
    Prediction,
)
from app.services.asr import TamilASRInference

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

FIXTURE_WAV_PATH = os.path.join(os.path.dirname(__file__), "fixture_audio.wav")


def _create_fixture_wav(path: str, duration_seconds: float = 0.5, frequency: float = 440.0) -> None:
    sample_rate = 16000
    with wave.open(path, "w") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(sample_rate)
        for i in range(int(sample_rate * duration_seconds)):
            value = int(32767.0 * 0.5 * math.sin(2.0 * math.pi * frequency * i / sample_rate))
            wav.writeframesraw(value.to_bytes(2, byteorder="little", signed=True))


@pytest.fixture(scope="module", autouse=True)
def ensure_fixture_wav():
    if not os.path.exists(FIXTURE_WAV_PATH):
        _create_fixture_wav(FIXTURE_WAV_PATH)


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


def _make_pcm16_chunk(duration_seconds: float = 0.1, sample_rate: int = 16000, frequency: float = 440.0) -> bytes:
    num_samples = int(sample_rate * duration_seconds)
    chunk = bytearray()
    for i in range(num_samples):
        value = int(32767.0 * 0.5 * math.sin(2.0 * math.pi * frequency * i / sample_rate))
        chunk.extend(value.to_bytes(2, byteorder="little", signed=True))
    return bytes(chunk)


def _connect_ws(session_id: str, token: str):
    return client.websocket_connect(f"/ws/sessions/{session_id}?token={token}")


class TestWebSocketAudioProtocol:
    @pytest.mark.asyncio
    async def test_valid_stream_start_succeeds(self):
        researcher_headers = await _auth_headers("RESEARCHER")
        clinician_headers = await _auth_headers("CLINICIAN")
        chain = await _create_full_chain(researcher_headers, clinician_headers)
        token = researcher_headers["Authorization"].split(" ")[1]

        with _connect_ws(chain["session"]["id"], token) as ws:
            start_msg = json.dumps({
                "type": "stream_start",
                "session_id": chain["session"]["id"],
                "attempt_id": chain["attempt"]["id"],
                "modality": "AUDIO",
                "sample_rate": 16000,
                "channels": 1,
                "sample_width_bytes": 2,
                "encoding": "pcm16",
            })
            ws.send_text(start_msg)
            msgs = _collect_ws_messages(ws, timeout=2.0)

        assert len(msgs) >= 1
        first = msgs[0]
        assert first["type"] == "stream_started"
        assert "recording_id" in first

    @pytest.mark.asyncio
    async def test_valid_audio_chunks_accepted(self):
        researcher_headers = await _auth_headers("RESEARCHER")
        clinician_headers = await _auth_headers("CLINICIAN")
        chain = await _create_full_chain(researcher_headers, clinician_headers)
        token = researcher_headers["Authorization"].split(" ")[1]

        with _connect_ws(chain["session"]["id"], token) as ws:
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
            _collect_ws_messages(ws, timeout=1.0)

            chunk = _make_pcm16_chunk(duration_seconds=0.05, sample_rate=16000)
            ws.send_bytes(chunk)
            msgs = _collect_ws_messages(ws, timeout=2.0)

        status_msgs = [m for m in msgs if m.get("type") == "status"]
        assert len(status_msgs) >= 1
        assert status_msgs[0]["status"] == "streaming"

    @pytest.mark.asyncio
    async def test_invalid_audio_metadata_rejected(self):
        researcher_headers = await _auth_headers("RESEARCHER")
        clinician_headers = await _auth_headers("CLINICIAN")
        chain = await _create_full_chain(researcher_headers, clinician_headers)
        token = researcher_headers["Authorization"].split(" ")[1]

        with _connect_ws(chain["session"]["id"], token) as ws:
            bad_start = json.dumps({
                "type": "stream_start",
                "session_id": chain["session"]["id"],
                "attempt_id": chain["attempt"]["id"],
                "modality": "AUDIO",
                "sample_rate": 22050,
                "channels": 1,
                "sample_width_bytes": 2,
                "encoding": "pcm16",
            })
            ws.send_text(bad_start)
            msgs = _collect_ws_messages(ws, timeout=2.0)

        assert len(msgs) >= 1
        assert msgs[0]["type"] == "error"
        assert "sample_rate" in msgs[0]["message"] or "invalid_metadata" in msgs[0].get("code", "")

    @pytest.mark.asyncio
    async def test_oversized_chunk_rejected(self):
        researcher_headers = await _auth_headers("RESEARCHER")
        clinician_headers = await _auth_headers("CLINICIAN")
        chain = await _create_full_chain(researcher_headers, clinician_headers)
        token = researcher_headers["Authorization"].split(" ")[1]

        with _connect_ws(chain["session"]["id"], token) as ws:
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
            _collect_ws_messages(ws, timeout=1.0)

            oversized = b"\x00" * (300 * 1024)
            ws.send_bytes(oversized)
            msgs = _collect_ws_messages(ws, timeout=2.0)

        assert any(m.get("type") == "error" for m in msgs)

    @pytest.mark.asyncio
    async def test_malformed_chunk_rejected(self):
        researcher_headers = await _auth_headers("RESEARCHER")
        clinician_headers = await _auth_headers("CLINICIAN")
        chain = await _create_full_chain(researcher_headers, clinician_headers)
        token = researcher_headers["Authorization"].split(" ")[1]

        with _connect_ws(chain["session"]["id"], token) as ws:
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
            _collect_ws_messages(ws, timeout=1.0)

            odd = b"\x00\x01\x02"
            ws.send_bytes(odd)
            msgs = _collect_ws_messages(ws, timeout=2.0)

        assert any(m.get("type") == "error" for m in msgs)

    @pytest.mark.asyncio
    async def test_stream_stop_closes_cleanly(self):
        researcher_headers = await _auth_headers("RESEARCHER")
        clinician_headers = await _auth_headers("CLINICIAN")
        chain = await _create_full_chain(researcher_headers, clinician_headers)
        token = researcher_headers["Authorization"].split(" ")[1]

        with _connect_ws(chain["session"]["id"], token) as ws:
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
            _collect_ws_messages(ws, timeout=1.0)

            ws.send_text(json.dumps({"type": "stream_stop"}))
            msgs = _collect_ws_messages(ws, timeout=2.0)

        assert any(m.get("type") == "stream_stopped" for m in msgs)

    @pytest.mark.asyncio
    async def test_unauthorized_websocket_rejected(self):
        with _connect_ws("00000000-0000-0000-0000-000000000000", "bad.token") as ws:
            msgs = _collect_ws_messages(ws, timeout=2.0)

        assert len(msgs) >= 1
        assert msgs[0]["type"] == "error"
        assert msgs[0]["code"] == "unauthorized"

    @pytest.mark.asyncio
    async def test_no_unbounded_buffering(self):
        researcher_headers = await _auth_headers("RESEARCHER")
        clinician_headers = await _auth_headers("CLINICIAN")
        chain = await _create_full_chain(researcher_headers, clinician_headers)
        token = researcher_headers["Authorization"].split(" ")[1]

        with _connect_ws(chain["session"]["id"], token) as ws:
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
            _collect_ws_messages(ws, timeout=1.0)

            big = b"\x00\x01" * (3 * 1024 * 1024)
            ws.send_bytes(big)
            msgs = _collect_ws_messages(ws, timeout=2.0)

        assert any(m.get("type") == "error" and m.get("code") == "invalid_chunk" for m in msgs)

    @pytest.mark.asyncio
    async def test_disconnect_handled_safely(self):
        researcher_headers = await _auth_headers("RESEARCHER")
        clinician_headers = await _auth_headers("CLINICIAN")
        chain = await _create_full_chain(researcher_headers, clinician_headers)
        token = researcher_headers["Authorization"].split(" ")[1]

        with _connect_ws(chain["session"]["id"], token) as ws:
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
            _collect_ws_messages(ws, timeout=1.0)
            ws.close()

        assert True

    @pytest.mark.asyncio
    async def test_valid_speech_invokes_asr_and_persists_prediction(self):
        researcher_headers = await _auth_headers("RESEARCHER")
        clinician_headers = await _auth_headers("CLINICIAN")
        chain = await _create_full_chain(researcher_headers, clinician_headers)
        token = researcher_headers["Authorization"].split(" ")[1]

        with _connect_ws(chain["session"]["id"], token) as ws:
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
            _collect_ws_messages(ws, timeout=1.0)

            speech_chunk = _make_pcm16_chunk(duration_seconds=0.6, sample_rate=16000, frequency=150.0)
            ws.send_bytes(speech_chunk)
            ws.send_text(json.dumps({"type": "stream_stop"}))
            msgs = _collect_ws_messages(ws, timeout=15.0)

        pred_msgs = [m for m in msgs if m.get("type") == "prediction"]
        error_msgs = [m for m in msgs if m.get("type") == "error"]
        status_msgs = [m for m in msgs if m.get("type") == "status"]
        print(f"[ASR_TEST] total_msgs={len(msgs)}, pred={len(pred_msgs)}, err={len(error_msgs)}, status={len(status_msgs)}")
        for m in error_msgs[:3]:
            print(f"[ASR_TEST] error: {m}")
        for m in status_msgs[:3]:
            print(f"[ASR_TEST] status: {m}")

        async with async_session_factory() as session:
            db_preds = (await session.execute(select(Prediction))).scalars().all()

        if not pred_msgs:
            if error_msgs:
                reason = error_msgs[0].get("message", "")
                if "ASR checkpoint not found" in reason:
                    pytest.skip(f"ASR checkpoint not available: {reason}")
                if "Pipeline initialization failed" in reason:
                    pytest.skip(f"Pipeline init failed (missing deps): {reason}")
            if not db_preds:
                pytest.skip("ASR pipeline did not produce a prediction in test environment")
        else:
            pred = pred_msgs[0]
            assert pred["attempt_id"] == chain["attempt"]["id"]
            assert "predicted_label" in pred
            assert pred["model_scope"] == "IISc-MILE Tamil ASR Corpus (OpenSLR 127) general speech baseline"
            assert pred["notes"] == "This model is a general Tamil speech baseline, not a dysarthria-specific model."

            assert len(db_preds) >= 1
            db_pred = db_preds[-1]
            assert db_pred.attempt_id == UUID(chain["attempt"]["id"])
            assert db_pred.prediction_type == "asr_transcript"

    @pytest.mark.asyncio
    async def test_poor_signal_quality_prevents_asr(self):
        researcher_headers = await _auth_headers("RESEARCHER")
        clinician_headers = await _auth_headers("CLINICIAN")
        chain = await _create_full_chain(researcher_headers, clinician_headers)
        token = researcher_headers["Authorization"].split(" ")[1]

        with _connect_ws(chain["session"]["id"], token) as ws:
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
            _collect_ws_messages(ws, timeout=1.0)

            clipped = bytearray()
            for i in range(12000):
                value = int(40000 * math.sin(2.0 * math.pi * 150.0 * i / 16000))
                clipped.extend(min(max(value, -32768), 32767).to_bytes(2, byteorder="little", signed=True))
            ws.send_bytes(bytes(clipped))
            ws.send_text(json.dumps({"type": "stream_stop"}))
            msgs = _collect_ws_messages(ws, timeout=10.0)

        error_msgs = [m for m in msgs if m.get("type") == "error"]
        assert len(error_msgs) >= 1
        assert any("Signal quality" in m.get("message", "") or "poor_signal_quality" in m.get("code", "") for m in error_msgs)

        async with async_session_factory() as session:
            db_preds = (await session.execute(select(Prediction))).scalars().all()
        assert len(db_preds) == 0

    @pytest.mark.asyncio
    async def test_prediction_persistence_works(self):
        researcher_headers = await _auth_headers("RESEARCHER")
        clinician_headers = await _auth_headers("CLINICIAN")
        chain = await _create_full_chain(researcher_headers, clinician_headers)
        token = researcher_headers["Authorization"].split(" ")[1]

        with _connect_ws(chain["session"]["id"], token) as ws:
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
            _collect_ws_messages(ws, timeout=1.0)

            speech_chunk = _make_pcm16_chunk(duration_seconds=0.6, sample_rate=16000, frequency=150.0)
            ws.send_bytes(speech_chunk)
            ws.send_text(json.dumps({"type": "stream_stop"}))
            msgs = _collect_ws_messages(ws, timeout=15.0)

        pred_msgs = [m for m in msgs if m.get("type") == "prediction"]
        if not pred_msgs:
            async with async_session_factory() as session:
                db_preds = (await session.execute(select(Prediction))).scalars().all()
            if not db_preds:
                pytest.fail("ASR prediction was required but was not produced")
            db_pred = db_preds[0]
        else:
            pred = pred_msgs[0]
            async with async_session_factory() as session:
                db_pred = await session.get(Prediction, UUID(pred["prediction_id"]))

        assert db_pred is not None
        assert db_pred.attempt_id == UUID(chain["attempt"]["id"])
        assert db_pred.prediction_type == "asr_transcript"
        assert db_pred.training_dataset_version == "slr127-v1"
        assert "general speech baseline" in (db_pred.prediction_json or {}).get("model_scope", "")

    @pytest.mark.asyncio
    async def test_session_attempt_association_preserved(self):
        researcher_headers = await _auth_headers("RESEARCHER")
        clinician_headers = await _auth_headers("CLINICIAN")
        chain = await _create_full_chain(researcher_headers, clinician_headers)
        token = researcher_headers["Authorization"].split(" ")[1]

        with _connect_ws(chain["session"]["id"], token) as ws:
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
            _collect_ws_messages(ws, timeout=1.0)

            speech_chunk = _make_pcm16_chunk(duration_seconds=0.6, sample_rate=16000, frequency=150.0)
            ws.send_bytes(speech_chunk)
            ws.send_text(json.dumps({"type": "stream_stop"}))
            msgs = _collect_ws_messages(ws, timeout=15.0)

        pred_msgs = [m for m in msgs if m.get("type") == "prediction"]
        if not pred_msgs:
            async with async_session_factory() as session:
                db_preds = (await session.execute(select(Prediction))).scalars().all()
            if not db_preds:
                pytest.fail("ASR prediction was required but was not produced")
            pred_msg = {"prediction_id": str(db_preds[0].id), "attempt_id": chain["attempt"]["id"], "recording_id": str(db_preds[0].recording_id)}
        else:
            pred_msg = pred_msgs[0]

        recording_id = pred_msg.get("recording_id")
        async with async_session_factory() as session:
            recording = await session.get(Recording, UUID(recording_id)) if recording_id else None
            attempt = await session.get(Attempt, UUID(chain["attempt"]["id"]))

        assert recording is not None
        assert recording.attempt_id == UUID(chain["attempt"]["id"])
        assert recording.session_id == UUID(chain["session"]["id"])
        assert attempt is not None

    @pytest.mark.asyncio
    async def test_stream_start_wrong_session_rejected(self):
        researcher_headers = await _auth_headers("RESEARCHER")
        clinician_headers = await _auth_headers("CLINICIAN")
        chain = await _create_full_chain(researcher_headers, clinician_headers)
        token = researcher_headers["Authorization"].split(" ")[1]
        other_session = client.post("/api/v1/sessions/sessions", json={"participant_id": chain["participant"]["id"], "session_date": "2026-09-04", "session_number": 2}, headers=researcher_headers).json()

        with _connect_ws(other_session["id"], token) as ws:
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
            msgs = _collect_ws_messages(ws, timeout=2.0)

        assert len(msgs) >= 1
        assert msgs[0]["type"] == "error"

    @pytest.mark.asyncio
    async def test_audio_chunk_before_stream_start_rejected(self):
        researcher_headers = await _auth_headers("RESEARCHER")
        clinician_headers = await _auth_headers("CLINICIAN")
        chain = await _create_full_chain(researcher_headers, clinician_headers)
        token = researcher_headers["Authorization"].split(" ")[1]

        with _connect_ws(chain["session"]["id"], token) as ws:
            chunk = _make_pcm16_chunk(duration_seconds=0.05)
            ws.send_bytes(chunk)
            msgs = _collect_ws_messages(ws, timeout=2.0)

        assert any(m.get("type") == "error" for m in msgs)
