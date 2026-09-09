import hashlib
import math
import re
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy.future import select

from app.core.audit import AuditService
from app.models import (
    Annotation,
    Dataset,
    DatasetCatalog,
    DatasetImportLog,
    DatasetProvenance,
    DatasetSplit,
    Recording,
    ResearchParticipant,
    Session,
    User,
)
from app.schemas.dataset_import import DatasetImportLogResponse, DatasetManifest
from app.services.datasets.checksum import sha256_file
from app.services.datasets.modality import modality_from_extension
from app.services.datasets.qc import qc_status_from_manifest, run_qc


IMPORTER_VERSION = "0.2.0"
SLR127_ROOT_NAME = "mile_tamil_asr_corpus"
FILENAME_RE = re.compile(r"^(?P<speaker>.+)_(?P<utterance>\d+)\.(?P<ext>[^.]+)$", re.IGNORECASE)


def _split_name(path: Path) -> Tuple[Optional[str], Optional[str]]:
    parts = [p for p in path.parts if p]
    split_name = None
    audio_rel = None
    for i, part in enumerate(parts):
        if part in {"train", "test"}:
            split_name = part
            if i + 3 < len(parts):
                audio_rel = str(Path(*parts[i + 1 :]))
            break
    return split_name, audio_rel


def parse_slr127_parts(path: Path) -> Dict[str, Optional[str]]:
    name = path.name
    match = FILENAME_RE.match(name)
    if not match:
        return {"speaker": None, "utterance": None, "ext": None}
    ext = match.group("ext").lower()
    return {
        "speaker": match.group("speaker"),
        "utterance": match.group("utterance"),
        "ext": "." + ext,
    }


def speaker_id_from_parts(speaker: Optional[str], utterance: Optional[str], split: Optional[str]) -> Optional[str]:
    if not speaker or not utterance or not split:
        return None
    return f"SLR127-{split.upper()}-{speaker}"


def wav_duration_seconds(path: Path) -> Optional[float]:
    try:
        with path.open("rb") as f:
            riff = f.read(12)
            if len(riff) < 12 or riff[:4] != b"RIFF" or riff[8:12] != b"WAVE":
                return None
            sample_rate = 16000
            channels = 1
            bits_per_sample = 16
            frame_rate = sample_rate
            frame_size = channels * (bits_per_sample // 8)
            while True:
                header = f.read(8)
                if len(header) < 8:
                    return None
                chunk_id, chunk_size = header[:4], header[4:8]
                if chunk_id == b"fmt ":
                    f.read(chunk_size)
                    continue
                if chunk_id == b"data":
                    data_bytes = int.from_bytes(chunk_size, "little")
                    if frame_rate <= 0:
                        return None
                    return data_bytes / (frame_rate * frame_size)
                f.read(int.from_bytes(chunk_size, "little"))
    except Exception:
        return None


def load_transcript(path: Path) -> Optional[str]:
    if not path.exists() or not path.is_file():
        return None
    text = path.read_text(encoding="utf-8", errors="strict").strip()
    return text or None


class SLR127Importer:
    def __init__(self, db, current_user=None):
        self.db = db
        self.current_user = current_user

    async def _log(self, dataset_id, status, message=None, metadata=None):
        log_entry = DatasetImportLog(dataset_id=dataset_id, status=status, message=message, import_metadata=metadata)
        self.db.add(log_entry)
        await self.db.flush()
        return log_entry

    async def _audit(self, action, resource_type, result, resource_id=None, metadata=None):
        if self.current_user is None:
            return
        audit = AuditService(self.db)
        await audit.log(
            action=action,
            resource_type=resource_type,
            result=result,
            user=self.current_user,
            resource_id=resource_id,
            metadata=metadata,
        )

    async def _get_or_create_participant(self, pseudonym_id):
        result = await self.db.execute(select(ResearchParticipant).where(ResearchParticipant.pseudonym_id == pseudonym_id))
        participant = result.scalar_one_or_none()
        if participant is None:
            participant = ResearchParticipant(
                pseudonym_id=pseudonym_id,
                consent_status="imported",
            )
            self.db.add(participant)
            await self.db.flush()
        return participant

    async def _get_or_create_session(self, participant, split):
        result = await self.db.execute(
            select(Session).where(
                Session.participant_id == participant.id,
                Session.dataset_split == split,
            )
        )
        session = result.scalar_one_or_none()
        if session is None:
            session = Session(
                participant_id=participant.id,
                session_date=datetime.utcnow().date(),
                session_number=1,
                dataset_split=split,
                status="imported",
            )
            self.db.add(session)
            await self.db.flush()
        return session

    async def _create_recording(self, session, dataset_id, rel_path, modality, file_format, duration_seconds, participant_pseudonym, recording_identifier):
        existing = await self.db.execute(select(Recording).where(Recording.file_path == rel_path))
        if existing.scalar_one_or_none() is not None:
            return None
        recording = Recording(
            session_id=session.id,
            modality=modality or "AUDIO",
            device_id="UNKNOWN",
            file_path=rel_path,
            file_format=file_format,
            duration_seconds=duration_seconds,
            start_timestamp=datetime.utcnow(),
            is_synthetic=False,
            data_classification="REAL",
            processing_status="raw",
            source_dataset_id=dataset_id,
            participant_pseudonym=participant_pseudonym,
            recording_identifier=recording_identifier,
        )
        self.db.add(recording)
        await self.db.flush()
        return recording

    async def _create_annotation(self, recording, transcript_text, annotator_id):
        annotation = Annotation(
            recording_id=recording.id,
            annotator_id=annotator_id,
            annotation_type="TRANSCRIPT",
            start_timestamp=datetime.utcnow(),
            end_timestamp=datetime.utcnow(),
            label=transcript_text,
            is_ground_truth=True,
        )
        self.db.add(annotation)
        await self.db.flush()
        return annotation

    async def _get_default_user_id(self):
        if self.current_user is not None:
            return self.current_user.id
        result = await self.db.execute(select(User).limit(1))
        user = result.scalar_one_or_none()
        if user is not None:
            return user.id
        from app.models import Role
        role_res = await self.db.execute(select(Role).where(Role.name == "SYSTEM"))
        role = role_res.scalar_one_or_none()
        if role is None:
            role = Role(name="SYSTEM", permissions="[]")
            self.db.add(role)
            await self.db.flush()
        sys_user = User(
            email="system@neurospeech.local",
            password_hash="system_managed_hash",
            role_id=role.id,
            is_active=True,
        )
        self.db.add(sys_user)
        await self.db.flush()
        return sys_user.id

    async def register_dataset(self, source_metadata):
        user_id = await self._get_default_user_id()
        dataset = Dataset(
            name=source_metadata.get("name", "Unnamed Dataset"),
            version=source_metadata.get("version", "1.0"),
            description=source_metadata.get("description"),
            bids_root=source_metadata.get("bids_root"),
            participant_ids=[],
            recording_ids=[],
            split_definition={},
            created_by=user_id,
            source_organization=source_metadata.get("source_organization"),
            source_url=source_metadata.get("source_url"),
            citation=source_metadata.get("citation"),
            modality=source_metadata.get("modality"),
            population_description=source_metadata.get("population"),
            participant_count=source_metadata.get("participant_count"),
            recording_count=source_metadata.get("recording_count"),
            total_duration=source_metadata.get("total_duration"),
            sampling_information=source_metadata.get("sampling_information"),
            file_format=source_metadata.get("file_format"),
            license=source_metadata.get("license"),
            access_type=source_metadata.get("access_type"),
            access_requirements=source_metadata.get("access_requirements"),
            consent_ethics=source_metadata.get("consent_ethics"),
            clinical_or_control_population=source_metadata.get("clinical_control"),
            language=source_metadata.get("language"),
            task_description=source_metadata.get("task"),
            acquisition_device=source_metadata.get("acquisition_device"),
            is_public=source_metadata.get("is_public", False),
            is_restricted=source_metadata.get("is_restricted", False),
            is_credentialed=source_metadata.get("is_credentialed", False),
            imported_status="registered",
            data_classification="REAL",
            checksum=source_metadata.get("checksum"),
            notes=source_metadata.get("notes"),
        )
        self.db.add(dataset)
        await self.db.flush()
        await self.db.refresh(dataset)

        provenance = DatasetProvenance(
            dataset_id=dataset.id,
            original_source=source_metadata.get("source_organization", "Unknown"),
            original_dataset_identifier=source_metadata.get("source_dataset_id"),
            version=source_metadata.get("version"),
            source_url=source_metadata.get("source_url"),
            license_access_info=source_metadata.get("license"),
            checksum=source_metadata.get("checksum"),
            responsible_user_id=user_id,
        )
        self.db.add(provenance)

        catalog = DatasetCatalog(
            dataset_id=dataset.id,
            modality=source_metadata.get("modality"),
            source=source_metadata.get("source_organization"),
            version=source_metadata.get("version"),
            participants=source_metadata.get("participant_count"),
            recordings=source_metadata.get("recording_count"),
            duration=source_metadata.get("total_duration"),
            population=source_metadata.get("population"),
            clinical_control=source_metadata.get("clinical_control"),
            license=source_metadata.get("license"),
            access_requirements=source_metadata.get("access_requirements"),
            project_usage="REFERENCE_ONLY",
            citation=source_metadata.get("citation"),
            url=source_metadata.get("source_url"),
            notes="Imported via SLR127 importer",
        )
        self.db.add(catalog)
        await self.db.flush()
        await self.db.commit()
        await self.db.refresh(dataset)
        return dataset

    async def import_dataset(self, dataset_id):
        dataset = await self.db.get(Dataset, dataset_id)
        if dataset is None:
            raise ValueError("Dataset not found")

        await self._log(dataset_id, "import_started", "Import started")
        dataset.imported_status = "importing"
        await self.db.flush()
        await self._audit("import_start", "dataset", "success", str(dataset_id), {"status": "importing"})

        local_path = dataset.bids_root
        if not local_path:
            raise ValueError("Missing local path for SLR127 import")

        root = Path(local_path)
        corpus_root = root / SLR127_ROOT_NAME
        if not corpus_root.exists():
            raise ValueError(f"Expected SLR127 corpus root not found: {corpus_root}")

        discovered_participants = []
        discovered_recordings = []
        discovered_modalities = []
        file_types = []
        warnings = []
        errors = []
        checksum = dataset.checksum

        participant_cache: Dict[str, ResearchParticipant] = {}
        session_cache: Dict[Tuple[str, str], Session] = {}
        annotator_id = await self._get_default_user_id()
        total_duration = 0.0
        recording_count = 0

        for split in ["train", "test"]:
            audio_dir = corpus_root / split / "audio_files"
            trans_dir = corpus_root / split / "trans_files"
            if not audio_dir.exists() or not trans_dir.exists():
                warnings.append(f"Missing split directory: {split}")
                continue

            wav_files = sorted(audio_dir.glob("*.wav"))
            for wav_path in wav_files:
                parts = parse_slr127_parts(wav_path)
                if parts["speaker"] is None:
                    errors.append(f"Cannot parse filename: {wav_path.name}")
                    continue

                speaker = parts["speaker"]
                utterance = parts["utterance"]
                ext = parts["ext"] or ".wav"
                modality = modality_from_extension(str(wav_path)) or "AUDIO"
                if modality not in discovered_modalities:
                    discovered_modalities.append(modality)
                if ext not in file_types:
                    file_types.append(ext)

                participant_pseudonym = speaker_id_from_parts(speaker, utterance, split)
                if participant_pseudonym not in discovered_participants:
                    discovered_participants.append(participant_pseudonym)

                rel_path = str(wav_path.relative_to(root)).replace("\\", "/")
                txt_name = wav_path.stem + ".txt"
                txt_path = trans_dir / txt_name
                transcript = load_transcript(txt_path)
                if transcript is None:
                    warnings.append(f"Missing transcript: {txt_path}")

                duration = wav_duration_seconds(wav_path)
                if duration is not None:
                    total_duration += duration

                participant = participant_cache.setdefault(participant_pseudonym, await self._get_or_create_participant(participant_pseudonym))
                session_key = (participant_pseudonym, split)
                session = session_cache.get(session_key)
                if session is None:
                    session = await self._get_or_create_session(participant, split)
                    session_cache[session_key] = session

                recording = await self._create_recording(
                    session=session,
                    dataset_id=dataset.id,
                    rel_path=rel_path,
                    modality=modality,
                    file_format=ext.lstrip(".").upper(),
                    duration_seconds=duration,
                    participant_pseudonym=participant_pseudonym,
                    recording_identifier=wav_path.stem,
                )
                if recording is None:
                    continue
                recording_count += 1

                discovered_recordings.append({
                    "path": rel_path,
                    "modality": modality,
                    "file": str(wav_path),
                    "participant_pseudonym": participant_pseudonym,
                    "dataset_split": split,
                })

                if transcript:
                    await self._create_annotation(recording, transcript, annotator_id)

        discovered_modalities = list(dict.fromkeys(discovered_modalities))
        file_types = list(dict.fromkeys(file_types))

        if checksum is None:
            h = hashlib.sha256()
            for split in ["train", "test"]:
                audio_dir = corpus_root / split / "audio_files"
                if not audio_dir.is_dir():
                    continue
                for wav_path in sorted(audio_dir.glob("*.wav")):
                    h.update(wav_path.name.encode())
                    h.update(str(wav_path.stat().st_size).encode())
            checksum = f"sha256:{h.hexdigest()}" if h.hexdigest() else None

        split_definition: Dict[str, List[str]] = {"train": [], "test": []}
        for pseudonym in discovered_participants:
            if pseudonym.startswith("SLR127-TRAIN-"):
                split_definition["train"].append(pseudonym)
            elif pseudonym.startswith("SLR127-TEST-"):
                split_definition["test"].append(pseudonym)

        source_metadata = {
            "name": dataset.name,
            "version": dataset.version,
            "source_organization": dataset.source_organization,
            "source_url": dataset.source_url,
            "citation": dataset.citation,
            "modality": dataset.modality,
            "participant_count": dataset.participant_count,
            "recording_count": dataset.recording_count,
            "total_duration": dataset.total_duration,
            "sampling_information": dataset.sampling_information,
            "file_format": dataset.file_format,
            "license": dataset.license,
            "access_type": dataset.access_type,
            "access_requirements": dataset.access_requirements,
            "consent_ethics": dataset.consent_ethics,
            "clinical_control": dataset.clinical_or_control_population,
            "language": dataset.language,
            "task": dataset.task_description,
            "acquisition_device": dataset.acquisition_device,
            "population": dataset.population_description,
            "is_public": dataset.is_public,
            "is_restricted": dataset.is_restricted,
            "is_credentialed": dataset.is_credentialed,
            "bids_compatible": bool(dataset.bids_root),
        }
        manifest = DatasetManifest(
            dataset_id=dataset.id,
            dataset_name=dataset.name,
            version=dataset.version,
            source_organization=dataset.source_organization,
            source_url=dataset.source_url,
            citation=dataset.citation,
            license=dataset.license,
            access_type=dataset.access_type,
            access_requirements=dataset.access_requirements,
            modality=dataset.modality,
            participant_count=dataset.participant_count or len(discovered_participants),
            recording_count=dataset.recording_count or recording_count,
            total_duration=dataset.total_duration or total_duration,
            sampling_information=dataset.sampling_information,
            file_format=dataset.file_format,
            population=dataset.population_description,
            clinical_control=dataset.clinical_or_control_population,
            language=dataset.language,
            task=dataset.task_description,
            acquisition_device=dataset.acquisition_device,
            checksum=checksum,
            import_timestamp=datetime.utcnow(),
            local_path=local_path,
            discovered_participants=discovered_participants,
            discovered_recordings=discovered_recordings,
            discovered_modalities=discovered_modalities,
            file_types=file_types,
            warnings=warnings,
            errors=errors,
            preprocessing_status="RAW",
            bid_status=str(source_metadata.get("bids_compatible")) if source_metadata.get("bids_compatible") is not None else None,
            importer_version=IMPORTER_VERSION,
        )
        qc_manifest = run_qc(manifest)
        dataset.manifest = qc_manifest.model_dump(mode="json")
        dataset.checksum = checksum or qc_manifest.checksum
        dataset.participant_count = len(discovered_participants)
        dataset.recording_count = recording_count
        dataset.total_duration = total_duration
        dataset.split_definition = split_definition
        dataset.participant_ids = discovered_participants
        dataset.recording_ids = []
        dataset.qc_status = qc_status_from_manifest(qc_manifest)

        if qc_manifest.errors:
            dataset.imported_status = "qc_failed"
            dataset.import_error = "; ".join(qc_manifest.errors)
        else:
            dataset.imported_status = "imported"
            dataset.import_date = datetime.utcnow()
            dataset.data_classification = "REAL"

        await self.db.flush()
        await self._log(dataset_id, "import_completed", "Import completed", {"qc_status": dataset.qc_status})
        await self._audit("import_complete", "dataset", "success", str(dataset_id), {"status": dataset.imported_status, "qc_status": dataset.qc_status})

        await self.db.commit()
        logs = await self.db.execute(select(DatasetImportLog).where(DatasetImportLog.dataset_id == dataset_id).order_by(DatasetImportLog.created_at.desc()))
        from app.schemas.dataset_import import DatasetImportResponse
        return DatasetImportResponse(
            dataset_id=dataset.id,
            imported_status=dataset.imported_status,
            qc_status=dataset.qc_status,
            manifest=DatasetManifest.model_validate(dataset.manifest) if dataset.manifest else None,
            logs=[DatasetImportLogResponse.model_validate(l) for l in logs.scalars().all()],
        )


async def register_slr127_dataset(db, current_user=None, local_path=None):
    importer = SLR127Importer(db, current_user)
    source_metadata = {
        "name": "IISc-MILE Tamil ASR Corpus (OpenSLR 127)",
        "version": "1.0",
        "description": "Tamil speech corpus with train/test WAV/TXT pairs for automatic speech recognition.",
        "source_organization": "Indian Institute of Science (IISc) Bangalore + MILE Lab",
        "source_url": "http://www.openslr.org/127/",
        "modality": "AUDIO",
        "language": "Tamil",
        "population": "Tamil speakers",
        "file_format": "WAV",
        "license": "CC BY 2.0",
        "access_type": "PUBLIC",
        "access_requirements": "Publicly available",
        "is_public": True,
        "is_restricted": False,
        "is_credentialed": False,
        "bids_root": local_path,
        "source_dataset_id": "OpenSLR127",
        "participant_count": 0,
        "recording_count": 0,
        "notes": "Imported via SLR127 importer",
    }
    return await importer.register_dataset(source_metadata)
