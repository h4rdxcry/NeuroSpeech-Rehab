import os
import uuid
import time
import asyncio
import math
import tempfile
import wave
from pathlib import Path
from datetime import datetime
from typing import Optional, Dict, Any
from dataclasses import dataclass

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.services.audio_stream import (
    StreamSession,
    SignalQualityResult,
    SimpleVAD,
    check_signal_quality,
    pcm16le_to_float32,
)
from app.services.audio_protocol import (
    StreamStartMessage,
    StreamStopMessage,
    ServerMessageType,
    StreamStatus,
    StatusMessage,
    ErrorMessage,
    PredictionMessage,
    StreamStoppedMessage,
    StreamStartedMessage,
    validate_pcm_chunk,
)
from app.services.asr import TamilASRInference, ASRInferenceError
from app.models import (
    Session,
    SessionExercise,
    Attempt,
    Recording,
    SignalQuality,
    Prediction,
    ModelVersion,
)


@dataclass
class AudioStreamContext:
    session_id: str
    attempt_id: str
    modality: str
    sample_rate: int
    channels: int
    sample_width_bytes: int
    encoding: str
    recording_id: str
    stream_session: StreamSession


class AudioPipelineError(Exception):
    pass


class AudioPipeline:
    def __init__(self, db: AsyncSession):
        self._db = db
        self._active_streams: Dict[str, AudioStreamContext] = {}
        self._asr = TamilASRInference.get_instance()

    async def initialize(self) -> None:
        pass  # Load only when usable audio actually needs inference.

    async def handle_stream_start(
        self, client_session_id: str, msg: StreamStartMessage, websocket: Any
    ) -> Optional[AudioStreamContext]:
        if client_session_id in self._active_streams:
            await websocket.send_json(ErrorMessage(message="Stream already active", code="stream_active").model_dump())
            return None
        session_uuid = uuid.UUID(msg.session_id)
        attempt_uuid = uuid.UUID(msg.attempt_id)

        session = await self._db.get(Session, session_uuid)
        if not session:
            error_msg = ErrorMessage(message=f"Session not found: {msg.session_id}", code="session_not_found")
            await websocket.send_json(error_msg.model_dump())
            return None

        attempt = await self._db.get(Attempt, attempt_uuid)
        if not attempt:
            error_msg = ErrorMessage(message=f"Attempt not found: {msg.attempt_id}", code="attempt_not_found")
            await websocket.send_json(error_msg.model_dump())
            return None

        session_exercise = await self._db.get(SessionExercise, attempt.session_exercise_id)
        if not session_exercise or session_exercise.session_id != session_uuid:
            error_msg = ErrorMessage(
                message="Attempt does not belong to the requested session",
                code="session_mismatch",
            )
            await websocket.send_json(error_msg.model_dump())
            return None

        recording_id = str(uuid.uuid4())
        recording = Recording(
            id=uuid.UUID(recording_id),
            session_id=session_uuid,
            attempt_id=attempt_uuid,
            session_exercise_id=session_exercise.id,
            modality=msg.modality,
            device_id="websocket-stream",
            device_name=f"WebSocket {msg.modality} stream",
            file_path="",
            file_format="pcm_stream",
            sampling_rate_hz=float(msg.sample_rate),
            channel_count=msg.channels,
            duration_seconds=0.0,
            start_timestamp=datetime.utcnow(),
            processing_status="streaming",
        )
        self._db.add(recording)
        signal_quality = SignalQuality(
            recording_id=uuid.UUID(recording_id),
            quality_state="UNKNOWN",
        )
        self._db.add(signal_quality)
        await self._db.flush()

        vad_rms_threshold = self._compute_vad_threshold()
        max_silence_samples = int(msg.sample_rate * 0.5)

        stream_session = StreamSession(
            session_id=msg.session_id,
            attempt_id=msg.attempt_id,
            modality=msg.modality,
            sample_rate=msg.sample_rate,
            channels=msg.channels,
            sample_width_bytes=msg.sample_width_bytes,
            encoding=msg.encoding,
            recording_id=recording_id,
            websocket=websocket,
            _vad_rms_threshold=vad_rms_threshold,
            _max_silence_frames=max_silence_samples,
            _min_speech_duration_samples=int(msg.sample_rate * 0.25),
        )

        ctx = AudioStreamContext(
            session_id=msg.session_id,
            attempt_id=msg.attempt_id,
            modality=msg.modality,
            sample_rate=msg.sample_rate,
            channels=msg.channels,
            sample_width_bytes=msg.sample_width_bytes,
            encoding=msg.encoding,
            recording_id=recording_id,
            stream_session=stream_session,
        )
        self._active_streams[client_session_id] = ctx

        started_msg = StreamStartedMessage(recording_id=recording_id, message="Audio streaming started")
        await websocket.send_json(started_msg.model_dump())

        return ctx

    async def handle_audio_chunk(
        self, client_session_id: str, data: bytes
    ) -> Optional[AudioStreamContext]:
        ctx = self._active_streams.get(client_session_id)
        if not ctx:
            return None
        ss = ctx.stream_session

        try:
            validate_pcm_chunk(data, ss.channels, ss.sample_width_bytes)
        except ValueError as exc:
            error_msg = ErrorMessage(message=str(exc), code="invalid_chunk")
            await ss.websocket.send_json(error_msg.model_dump())
            ss.close()
            return None

        ok, err = ss.append(data)
        if not ok:
            error_msg = ErrorMessage(message=err or "Buffer overflow", code="buffer_overflow")
            await ss.websocket.send_json(error_msg.model_dump())
            ss.close()
            return None

        # Accumulate sample counts across transport chunks; boundaries are not VAD frames.
        samples = pcm16le_to_float32(data)
        if not hasattr(ss, "_vad"):
            ss._vad = SimpleVAD(ss.sample_rate, rms_threshold=ss._vad_rms_threshold)
        speech_detected, _ = ss._vad.process(samples)
        if speech_detected:
            ss.mark_speech()
        elif ss._speech_detected:
            ss._frames_since_last_speech += len(samples)
        if ss.is_speech_complete():
            segment = ss.get_segment()
            if segment:
                await self._process_segment(ctx, segment)

        status_msg = StatusMessage(
            status=StreamStatus.STREAMING,
            message=f"Buffered {ss.buffer_size} bytes",
            recording_id=ss.recording_id,
            details={"buffer_bytes": ss.buffer_size},
        )
        await ss.websocket.send_json(status_msg.model_dump())
        return ctx

    async def handle_stream_stop(self, client_session_id: str) -> Optional[AudioStreamContext]:
        ctx = self._active_streams.get(client_session_id)
        if not ctx:
            return None
        ss = ctx.stream_session
        await self._save_recording(ctx, "completed")

        segment = ss.get_segment()
        if segment and len(segment) > 0:
            await self._process_segment(ctx, segment)

        recording = await self._db.get(Recording, uuid.UUID(ss.recording_id))
        if recording:
            recording.processing_status = "completed"
            recording.end_timestamp = datetime.utcnow()
            recording.duration_seconds = ss.buffer_size / float(ss.channels * ss.sample_width_bytes * ss.sample_rate)
            await self._db.flush()

        ss.close()
        stopped_msg = StreamStoppedMessage(
            recording_id=ss.recording_id,
            message="Stream stopped successfully",
        )
        await ss.websocket.send_json(stopped_msg.model_dump())
        return ctx

    async def cleanup(self, client_session_id: str) -> None:
        ctx = self._active_streams.pop(client_session_id, None)
        if ctx:
            recording = await self._db.get(Recording, uuid.UUID(ctx.recording_id))
            if recording and recording.processing_status == "streaming":
                await self._save_recording(ctx, "interrupted")
            ctx.stream_session.close()

    async def _save_recording(self, ctx, status):
        ss = ctx.stream_session
        directory = Path(os.environ.get("NEUROSPEECH_RECORDING_ROOT", str(Path(__file__).resolve().parents[2] / "recordings")))
        path = directory / (ss.recording_id + ".wav")
        def save():
            directory.mkdir(parents=True, exist_ok=True)
            with wave.open(str(path), "wb") as wav:
                wav.setnchannels(ss.channels)
                wav.setsampwidth(ss.sample_width_bytes)
                wav.setframerate(ss.sample_rate)
                wav.writeframes(bytes(ss._buffer))
        await asyncio.to_thread(save)
        recording = await self._db.get(Recording, uuid.UUID(ss.recording_id))
        if recording:
            recording.file_path = str(path)
            recording.file_format = "wav"
            recording.processing_status = status
            recording.duration_seconds = ss.buffer_size / (ss.sample_rate * ss.channels * ss.sample_width_bytes)
            recording.end_timestamp = datetime.utcnow()
            await self._db.flush()

    async def _process_segment(self, ctx: AudioStreamContext, pcm_data: bytes) -> None:
        ss = ctx.stream_session
        quality = await asyncio.to_thread(check_signal_quality,
            pcm_data=pcm_data,
            sample_rate=ctx.sample_rate,
            channels=ctx.channels,
            sample_width_bytes=ctx.sample_width_bytes,
        )

        sq = (await self._db.execute(select(SignalQuality).where(SignalQuality.recording_id == uuid.UUID(ss.recording_id)))).scalar_one_or_none()
        if sq:
            sq.quality_state = quality.state
            sq.rejection_reason = quality.reason
            sq.artifact_indicators = quality.details
            sq.qc_timestamp = datetime.utcnow()
            await self._db.flush()

        if not quality.is_usable():
            error_msg = ErrorMessage(
                message=f"Signal quality rejected: {quality.reason}",
                code="poor_signal_quality",
            )
            await ss.websocket.send_json(error_msg.model_dump())
            ss.reset_segment()
            return

        await self._run_asr_inference(ctx, pcm_data, quality)
        ss.reset_segment()

    async def _run_asr_inference(
        self, ctx: AudioStreamContext, pcm_data: bytes, quality: SignalQualityResult
    ) -> None:
        ss = ctx.stream_session
        loop = asyncio.get_event_loop()

        def _write_wav_and_infer(data: bytes, sample_rate: int, channels: int, sample_width: int) -> Dict[str, Any]:
            tmp_path = None
            try:
                fd, tmp_path = tempfile.mkstemp(suffix=".wav")
                os.close(fd)
                with wave.open(tmp_path, "wb") as wf:
                    wf.setnchannels(channels)
                    wf.setsampwidth(sample_width)
                    wf.setframerate(sample_rate)
                    wf.writeframes(data)
                asr = TamilASRInference.get_instance()
                result = asr.run_inference(tmp_path)
                return {
                    "success": True,
                    "transcript": result.transcript,
                    "model_name": result.model_name,
                    "model_version": result.model_version,
                    "model_scope": result.model_scope,
                    "notes": result.notes,
                    "prediction_json": result.prediction_json,
                    "confidence": result.confidence,
                }
            except Exception as exc:
                return {"success": False, "error": str(exc)}
            finally:
                if tmp_path and os.path.exists(tmp_path):
                    try:
                        os.unlink(tmp_path)
                    except OSError:
                        pass

        result = await loop.run_in_executor(None, _write_wav_and_infer, pcm_data, ctx.sample_rate, ctx.channels, ctx.sample_width_bytes)

        if not result.get("success"):
            error_msg = ErrorMessage(
                message=f"ASR inference failed: {result.get('error', 'unknown')}",
                code="asr_error",
            )
            await ss.websocket.send_json(error_msg.model_dump())
            # An inference failure is not a transcript prediction.
            return

        prediction = await self._persist_success_prediction(ctx, result, quality)
        pred_msg = PredictionMessage(
            prediction_id=str(prediction.id),
            attempt_id=ctx.attempt_id,
            recording_id=ss.recording_id,
            predicted_label=result["transcript"],
            model_name=result["model_name"],
            model_version=result["model_version"],
            model_scope=result["model_scope"],
            notes=result["notes"],
            prediction_json=result["prediction_json"],
            signal_quality_state=quality.state,
        )
        await self._db.commit()
        await ss.websocket.send_json(pred_msg.model_dump())

    async def _persist_success_prediction(
        self, ctx: AudioStreamContext, result: Dict[str, Any], quality: SignalQualityResult
    ) -> Prediction:
        production_model = await self._db.execute(
            select(ModelVersion).where(ModelVersion.is_production.is_(True), ModelVersion.model_type == "asr").limit(1)
        )
        prod = production_model.scalar_one_or_none()
        if not prod:
            raise AudioPipelineError("No production ASR model registered")

        pred = Prediction(
            attempt_id=uuid.UUID(ctx.attempt_id),
            recording_id=uuid.UUID(ctx.stream_session.recording_id),
            model_id=prod.id,
            model_version=result.get("model_version", prod.version),
            feature_pipeline_version=prod.feature_pipeline_version,
            training_dataset_version=prod.training_dataset_version,
            prediction_type="asr_transcript",
            predicted_label=result["transcript"],
            confidence=result.get("confidence"),
            prediction_json=result.get("prediction_json"),
            signal_quality_state=quality.state,
            signal_quality_details=quality.details,
            timestamp=datetime.utcnow(),
        )
        self._db.add(pred)
        await self._db.flush()
        await self._db.refresh(pred)
        return pred

    def _compute_vad_threshold(self) -> float:
        return 0.01
