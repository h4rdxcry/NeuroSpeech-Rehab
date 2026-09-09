from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query, Depends
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Any, Optional
import anyio
import asyncio
from uuid import UUID
from sqlalchemy.orm import selectinload
from app.core.config import get_settings
from app.core.db import get_engine, get_session_maker
from app.core.auth import decode_access_token, hash_password
from app.models import Base, Role, User, Session, Patient, ResearchParticipant
from app.api.v1 import auth, participants, sessions, exercises, recordings, datasets, signal_quality, annotations, model_versions, evaluation_runs, audit_logs, dataset_provenance, dataset_splits, dataset_catalog, dataset_imports, dataset_splitting, session_exercises, attempts, predictions
from app.core.audit import AuditService
from app.core.dependencies import require_roles
from app.core.request_limits import RequestSizeLimit
from app.services.test_isolation import is_final_test_session
from app.services.audio_pipeline import AudioPipeline
from app.services.audio_protocol import (
    StreamStartMessage,
    StreamStopMessage,
    ErrorMessage,
    MessageType,
)

settings = get_settings()


async def _get_ws_user(token: str, db: AsyncSession) -> Optional[User]:
    payload = decode_access_token(token)
    if payload is None:
        return None
    user_id = payload.get("sub")
    if not user_id:
        return None
    try:
        user_uuid = UUID(user_id)
    except Exception:
        return None
    result = await db.execute(select(User).where(User.id == user_uuid).options(selectinload(User.role)))
    return result.scalar_one_or_none()


async def seed_development_data() -> None:
    if settings.ENVIRONMENT != "development":
        return
    async with get_session_maker()() as session:
        result = await session.execute(select(Role).where(Role.name == "PATIENT"))
        patient_role = result.scalar_one_or_none()
        if not patient_role:
            patient_role = Role(name="PATIENT", permissions="[]")
            session.add(patient_role)
            await session.flush()
        result = await session.execute(select(User).where(User.email == "patient@neurospeech.dev"))
        demo_user = result.scalar_one_or_none()
        if not demo_user:
            demo_user = User(
                email="patient@neurospeech.dev",
                password_hash=hash_password("NeuroSpeechDemo123!"),
                role_id=patient_role.id,
                is_active=True,
            )
            session.add(demo_user)
            await session.flush()
        await session.commit()

@asynccontextmanager
async def lifespan(app: FastAPI):
    if settings.ENVIRONMENT == "development":
        async with get_engine().begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
    if settings.ENVIRONMENT == "development":
        await seed_development_data()
    yield

app = FastAPI(
    title="NeuroSpeech Rehab API",
    description="Research-grade multimodal speech rehabilitation platform",
    version="0.2.0",
    lifespan=lifespan,
)
app.add_middleware(RequestSizeLimit)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS.split(",") if settings.ENVIRONMENT == "production" else ["*"],
    allow_origin_regex=None if settings.ENVIRONMENT == "production" else r"^https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(participants.router, prefix="/api/v1/participants", tags=["participants"], dependencies=[Depends(require_roles("PATIENT", "RESEARCHER", "CLINICIAN", "ADMIN"))])
app.include_router(sessions.router, prefix="/api/v1/sessions", tags=["sessions"], dependencies=[Depends(require_roles("PATIENT", "RESEARCHER", "CLINICIAN", "ADMIN"))])
app.include_router(exercises.router, prefix="/api/v1/exercises", tags=["exercises"], dependencies=[Depends(require_roles("PATIENT", "RESEARCHER", "CLINICIAN", "ADMIN"))])
app.include_router(recordings.router, prefix="/api/v1/recordings", tags=["recordings"], dependencies=[Depends(require_roles("PATIENT", "RESEARCHER", "CLINICIAN", "ADMIN"))])
app.include_router(datasets.router, prefix="/api/v1/datasets", tags=["datasets"], dependencies=[Depends(require_roles("RESEARCHER", "CLINICIAN", "ADMIN"))])
app.include_router(dataset_provenance.router, prefix="/api/v1/datasets", tags=["dataset-provenance"], dependencies=[Depends(require_roles("RESEARCHER", "CLINICIAN", "ADMIN"))])
app.include_router(dataset_splits.router, prefix="/api/v1/datasets", tags=["dataset-splits"], dependencies=[Depends(require_roles("RESEARCHER", "CLINICIAN", "ADMIN"))])
app.include_router(dataset_catalog.router, prefix="/api/v1", tags=["dataset-catalog"], dependencies=[Depends(require_roles("RESEARCHER", "CLINICIAN", "ADMIN"))])
app.include_router(dataset_imports.router, prefix="/api/v1/datasets", tags=["dataset-imports"], dependencies=[Depends(require_roles("RESEARCHER", "CLINICIAN", "ADMIN"))])
app.include_router(dataset_splitting.router, prefix="/api/v1/datasets", tags=["dataset-splitting"], dependencies=[Depends(require_roles("RESEARCHER", "CLINICIAN", "ADMIN"))])
app.include_router(signal_quality.router, prefix="/api/v1/signal-quality", tags=["signal-quality"], dependencies=[Depends(require_roles("PATIENT", "RESEARCHER", "CLINICIAN", "ADMIN"))])
app.include_router(annotations.router, prefix="/api/v1/annotations", tags=["annotations"], dependencies=[Depends(require_roles("RESEARCHER", "CLINICIAN", "ADMIN"))])
app.include_router(model_versions.router, prefix="/api/v1/model-versions", tags=["model-versions"], dependencies=[Depends(require_roles("RESEARCHER", "CLINICIAN", "ADMIN"))])
app.include_router(evaluation_runs.router, prefix="/api/v1/evaluation-runs", tags=["evaluation-runs"], dependencies=[Depends(require_roles("RESEARCHER", "CLINICIAN", "ADMIN"))])
app.include_router(audit_logs.router, prefix="/api/v1/audit-logs", tags=["audit-logs"], dependencies=[Depends(require_roles("RESEARCHER", "CLINICIAN", "ADMIN"))])
app.include_router(session_exercises.router, prefix="/api/v1/session-exercises", tags=["session-exercises"], dependencies=[Depends(require_roles("PATIENT", "RESEARCHER", "CLINICIAN", "ADMIN"))])
app.include_router(attempts.router, prefix="/api/v1/attempts", tags=["attempts"], dependencies=[Depends(require_roles("PATIENT", "RESEARCHER", "CLINICIAN", "ADMIN"))])
app.include_router(predictions.router, prefix="/api/v1/predictions", tags=["predictions"], dependencies=[Depends(require_roles("PATIENT", "RESEARCHER", "CLINICIAN", "ADMIN"))])
from app.api.v1 import research_signals
app.include_router(research_signals.router, prefix="/api/v1/research-signals", tags=["research-signals"], dependencies=[Depends(require_roles("RESEARCHER", "CLINICIAN", "ADMIN"))])


@app.websocket("/ws/sessions/{session_id}")
async def websocket_session(websocket: WebSocket, session_id: str, token: Any = Query(default=None)):
    await websocket.accept()

    async with get_session_maker()() as db:
        user = await _get_ws_user(token, db)
        if user is None or not user.is_active:
            await websocket.send_json(ErrorMessage(message="Unauthorized: valid JWT token required", code="unauthorized").model_dump())
            await websocket.close(code=4001)
            return

        try:
            session_uuid = UUID(session_id)
        except ValueError:
            await websocket.send_json(ErrorMessage(message="Invalid session ID", code="invalid_session").model_dump())
            await websocket.close(code=4004)
            return
        session = await db.get(Session, session_uuid)
        if session is None:
            await websocket.send_json(ErrorMessage(message="Session not found", code="session_not_found").model_dump())
            await websocket.close(code=4004)
            return
        authorized = user.role.name in ("RESEARCHER", "ADMIN")
        if user.role.name == "CLINICIAN":
            participant = await db.get(ResearchParticipant, session.participant_id)
            authorized = session.clinician_id == user.id or (participant and participant.assigned_clinician_id == user.id)
        if user.role.name == "PATIENT" and session.patient_id:
            patient = await db.get(Patient, session.patient_id)
            authorized = patient is not None and patient.user_id == user.id
        if not authorized or await is_final_test_session(db, session):
            await websocket.send_json(ErrorMessage(message="Session access denied", code="forbidden").model_dump())
            await websocket.close(code=4003)
            return

        client_conn_id = f"{session_id}:{id(websocket)}"
        pipeline = AudioPipeline(db)
        try:
            await pipeline.initialize()
        except Exception as exc:
            await websocket.send_json(ErrorMessage(message=f"Pipeline initialization failed: {exc}", code="init_error").model_dump())
            await websocket.close(code=1011)
            return

        try:
            while True:
                msg = await asyncio.wait_for(websocket.receive(), timeout=30)
                if msg.get("type") == "websocket.disconnect":
                    break

                if msg.get("type") == "websocket.receive":
                    text_data = msg.get("text")
                    bytes_data = msg.get("bytes")

                    if text_data is not None:
                        try:
                            import json
                            data = json.loads(text_data)
                        except Exception as exc:
                            await websocket.send_json(ErrorMessage(message=f"Malformed JSON: {exc}", code="malformed_json").model_dump())
                            continue

                        if not isinstance(data, dict):
                            await websocket.send_json(ErrorMessage(message="JSON object required", code="invalid_metadata").model_dump())
                            continue
                        data.setdefault("session_id", session_id)
                        msg_type = data.get("type")
                        if msg_type == MessageType.STREAM_START.value:
                            try:
                                start_msg = StreamStartMessage(**data)
                            except Exception as exc:
                                await websocket.send_json(ErrorMessage(message=f"Invalid stream_start: {exc}", code="invalid_metadata").model_dump())
                                continue
                            if start_msg.session_id != session_id:
                                await websocket.send_json(ErrorMessage(message=f"Session mismatch: WebSocket is for session {session_id}, but stream_start requests session {start_msg.session_id}", code="session_mismatch").model_dump())
                                continue
                            await pipeline.handle_stream_start(client_conn_id, start_msg, websocket)

                        elif msg_type == MessageType.STREAM_STOP.value:
                            await pipeline.handle_stream_stop(client_conn_id)
                            break

                        else:
                            await websocket.send_json(ErrorMessage(message=f"Unknown message type: {msg_type}", code="unknown_message").model_dump())

                    elif bytes_data is not None:
                        ctx = await pipeline.handle_audio_chunk(client_conn_id, bytes_data)
                        if ctx is None:
                            await websocket.send_json(ErrorMessage(message="No active stream. Send stream_start first.", code="no_active_stream").model_dump())
                            break
                    else:
                        await websocket.send_json(ErrorMessage(message="Empty message received", code="empty_message").model_dump())

        except WebSocketDisconnect:
            pass
        except Exception as exc:
            try:
                await websocket.send_json(ErrorMessage(message="Stream processing failed or timed out", code="server_error").model_dump())
            except Exception:
                pass
        finally:
            # Finish or roll back the transaction even if the peer cancels the request.
            with anyio.CancelScope(shield=True):
                try:
                    await pipeline.cleanup(client_conn_id)
                    await db.commit()
                except Exception:
                    await db.rollback()
                try:
                    await websocket.close()
                except Exception:
                    pass


@app.get("/health")
async def health():
    return {"status": "ok", "version": "0.2.0"}
