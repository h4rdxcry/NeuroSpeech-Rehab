import hashlib
import os
import re
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.audit import AuditService
from app.models import Dataset, DatasetImportLog, DatasetProvenance, DatasetCatalog, Recording, SignalQuality, ResearchParticipant, Session, User, Role
from app.schemas.dataset_import import DatasetImportRequest, DatasetImportResponse, DatasetManifest, DatasetImportLogResponse
from app.services.datasets.checksum import sha256_file
from app.services.datasets.manifest import build_manifest
from app.services.datasets.modality import normalize_modality, modality_from_extension
from app.services.datasets.qc import run_qc, qc_status_from_manifest


IMPORTER_VERSION = "0.1.0"


def _parse_bids_parts(path: str) -> Dict[str, Optional[str]]:
    entities: Dict[str, Optional[str]] = {
        "participant": None,
        "session": None,
        "task": None,
        "acquisition": None,
        "run": None,
        "recording": None,
    }
    for part in path.replace("\\", "/").split("/"):
        if part.startswith("sub-"):
            entities["participant"] = part.replace("sub-", "").split("_")[0]
        elif part.startswith("ses-"):
            entities["session"] = part.replace("ses-", "").split("_")[0]
        elif part.startswith("task-"):
            entities["task"] = part.split("_")[0].replace("task-", "")
        elif part.startswith("acq-"):
            entities["acquisition"] = part.split("_")[0].replace("acq-", "")
        elif part.startswith("run-"):
            entities["run"] = part.split("_")[0].replace("run-", "")
        elif part.startswith("recording-"):
            entities["recording"] = part.split("_")[0].replace("recording-", "")
    return entities


def _parse_session_date(session_label: Optional[str]) -> Optional[datetime]:
    if not session_label:
        return None
    match = re.match(r"(\d{4})(\d{2})(\d{2})", session_label)
    if not match:
        return None
    year, month, day = match.groups()
    try:
        return datetime(int(year), int(month), int(day)).date()
    except ValueError:
        return None


class DatasetImporter:
    def __init__(self, db: AsyncSession, current_user: Optional[Any] = None):
        self.db = db
        self.current_user = current_user

    async def _log(self, dataset_id: UUID, status: str, message: Optional[str] = None, metadata: Optional[Dict[str, Any]] = None) -> DatasetImportLog:
        log_entry = DatasetImportLog(dataset_id=dataset_id, status=status, message=message, import_metadata=metadata)
        self.db.add(log_entry)
        await self.db.flush()
        return log_entry

    async def _audit(self, action: str, resource_type: str, result: str, resource_id: Optional[str] = None, metadata: Optional[Dict[str, Any]] = None) -> None:
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

    async def _get_or_create_participant(self, pseudonym_id: str) -> ResearchParticipant:
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

    async def _get_or_create_session(self, participant: ResearchParticipant, session_label: Optional[str], session_number: int) -> Session:
        session_date = _parse_session_date(session_label)
        result = await self.db.execute(
            select(Session).where(
                Session.participant_id == participant.id,
                Session.session_date == session_date,
            )
        )
        session = result.scalar_one_or_none()
        if session is None:
            session = Session(
                participant_id=participant.id,
                session_date=session_date or datetime.utcnow().date(),
                session_number=session_number,
                status="imported",
            )
            self.db.add(session)
            await self.db.flush()
        return session

    async def _create_recording(self, session: Session, dataset_id: UUID, file_path: str, modality: Optional[str], device_id: Optional[str], file_format: str, participant_pseudonym: str) -> None:
        existing = await self.db.execute(select(Recording).where(Recording.file_path == file_path))
        if existing.scalar_one_or_none() is not None:
            return
        recording = Recording(
            session_id=session.id,
            modality=modality or "UNKNOWN",
            device_id=device_id or "UNKNOWN",
            file_path=file_path,
            file_format=file_format,
            start_timestamp=datetime.utcnow(),
            is_synthetic=False,
            data_classification="REAL",
            processing_status="raw",
            source_dataset_id=dataset_id,
            participant_pseudonym=participant_pseudonym,
        )
        self.db.add(recording)
        await self.db.flush()

    async def _get_default_user_id(self) -> Optional[UUID]:
        if self.current_user is not None:
            return self.current_user.id
        result = await self.db.execute(select(User).limit(1))
        user = result.scalar_one_or_none()
        if user is not None:
            return user.id
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

    async def register_dataset(self, payload: DatasetImportRequest, source_metadata: Dict[str, Any]) -> Dataset:
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
            access_type=source_metadata.get("access_type", payload.access_type),
            access_requirements=source_metadata.get("access_requirements", payload.access_requirements),
            consent_ethics=source_metadata.get("consent_ethics"),
            clinical_or_control_population=source_metadata.get("clinical_control"),
            language=source_metadata.get("language"),
            task_description=source_metadata.get("task"),
            acquisition_device=source_metadata.get("acquisition_device"),
            is_public=source_metadata.get("is_public", False),
            is_restricted=source_metadata.get("is_restricted", payload.is_restricted),
            is_credentialed=source_metadata.get("is_credentialed", payload.is_credentialed),
            imported_status="registered",
            data_classification="REAL",
            checksum=source_metadata.get("checksum"),
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
            notes="Imported via dataset importer",
        )
        self.db.add(catalog)
        await self.db.flush()
        await self.db.commit()
        await self.db.refresh(dataset)
        return dataset

    async def import_dataset(self, dataset_id: UUID, payload: DatasetImportRequest) -> DatasetImportResponse:
        dataset = await self.db.get(Dataset, dataset_id)
        if dataset is None:
            raise ValueError("Dataset not found")

        await self._log(dataset_id, "import_started", "Import started")
        dataset.imported_status = "importing"
        await self.db.flush()
        await self._audit("import_start", "dataset", "success", str(dataset_id), {"status": "importing"})

        source_metadata: Dict[str, Any] = {
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
            "checksum": dataset.checksum,
            "bids_compatible": bool(dataset.bids_root),
        }

        local_path = payload.local_path or dataset.bids_root
        discovered_participants: List[str] = []
        discovered_recordings: List[Dict[str, Any]] = []
        discovered_modalities: List[str] = []
        file_types: List[str] = []
        warnings: List[str] = []
        errors: List[str] = []
        checksum = dataset.checksum

        if dataset.is_restricted or dataset.is_credentialed:
            warnings.append("Restricted/credentialed dataset: local authorized acquisition required")
            await self._log(dataset_id, "import_restricted", "Restricted dataset metadata-only import")
            manifest = build_manifest(
                dataset_id=dataset.id,
                dataset_name=dataset.name,
                version=dataset.version,
                source_metadata=source_metadata,
                warnings=warnings,
                errors=errors,
                local_path=local_path,
                checksum=checksum,
            )
            qc_manifest = run_qc(manifest)
            dataset.manifest = qc_manifest.model_dump(mode="json")
            dataset.qc_status = qc_status_from_manifest(qc_manifest)
            dataset.imported_status = "metadata_only"
            await self.db.flush()
            await self._audit("import_complete", "dataset", "success", str(dataset_id), {"status": "metadata_only"})
            logs = await self.db.execute(select(DatasetImportLog).where(DatasetImportLog.dataset_id == dataset_id).order_by(DatasetImportLog.created_at.desc()))
            return DatasetImportResponse(
                dataset_id=dataset.id,
                imported_status=dataset.imported_status,
                qc_status=dataset.qc_status,
                manifest=qc_manifest,
                logs=[DatasetImportLogResponse.model_validate(l) for l in logs.scalars().all()],
            )

        if not local_path:
            errors.append("No local path provided and no bids_root configured")
            await self._log(dataset_id, "import_failed", "No local path available")
            dataset.import_error = "; ".join(errors)
            dataset.imported_status = "failed"
            await self.db.flush()
            await self._audit("import_failed", "dataset", "failure", str(dataset_id), {"errors": errors})
            logs = await self.db.execute(select(DatasetImportLog).where(DatasetImportLog.dataset_id == dataset_id).order_by(DatasetImportLog.created_at.desc()))
            return DatasetImportResponse(
                dataset_id=dataset.id,
                imported_status=dataset.imported_status,
                qc_status="FAIL",
                logs=[DatasetImportLogResponse.model_validate(l) for l in logs.scalars().all()],
            )

        root = Path(local_path)
        if not root.exists():
            errors.append(f"Local path does not exist: {local_path}")
            await self._log(dataset_id, "import_failed", f"Path missing: {local_path}")
            dataset.import_error = "; ".join(errors)
            dataset.imported_status = "failed"
            await self.db.flush()
            await self._audit("import_failed", "dataset", "failure", str(dataset_id), {"errors": errors})
            logs = await self.db.execute(select(DatasetImportLog).where(DatasetImportLog.dataset_id == dataset_id).order_by(DatasetImportLog.created_at.desc()))
            return DatasetImportResponse(
                dataset_id=dataset.id,
                imported_status=dataset.imported_status,
                qc_status="FAIL",
                logs=[DatasetImportLogResponse.model_validate(l) for l in logs.scalars().all()],
            )

        slr127_root = root / "mile_tamil_asr_corpus"
        if slr127_root.exists() and slr127_root.is_dir():
            from app.services.datasets.importers.slr127_importer import SLR127Importer
            slr127_importer = SLR127Importer(self.db, self.current_user)
            return await slr127_importer.import_dataset(dataset.id)

        try:
            participant_session_map: Dict[str, ResearchParticipant] = {}
            session_map: Dict[Tuple[str, str], Session] = {}
            data_extensions = {".edf", ".bdf", ".fif", ".set", ".vhdr", ".eeg", ".cnt", ".wav", ".flac", ".mp3", ".ogg", ".m4a", ".aiff", ".mp4", ".avi", ".mov", ".webm", ".mkv", ".csv", ".mat"}

            for file_path in sorted(root.rglob("*")):
                if file_path.is_file():
                    rel = str(file_path.relative_to(root)).replace("\\", "/")
                    ext = file_path.suffix.lower()
                    file_types.append(ext)
                    modality = modality_from_extension(str(file_path)) or dataset.modality
                    if modality and ext in data_extensions:
                        discovered_modalities.append(modality)
                    if checksum is None:
                        checksum = sha256_file(file_path)
                    parts = rel.split("/")
                    participant_id = None
                    session_label = None
                    for part in parts:
                        if part.startswith("sub-"):
                            participant_id = part.replace("sub-", "").split("_")[0]
                            if participant_id not in discovered_participants:
                                discovered_participants.append(participant_id)
                        elif part.startswith(("subject_", "subject-", "sub_")):
                            participant_id = part.split(".")[0]
                            if participant_id not in discovered_participants:
                                discovered_participants.append(participant_id)
                        elif part.startswith("ses-"):
                            session_label = part.replace("ses-", "").split("_")[0]
                    if participant_id and not session_label:
                        session_label = "ses-01"
                    if participant_id and session_label:
                        if ext in data_extensions:
                            discovered_recordings.append({"path": rel, "modality": modality, "file": str(file_path)})
                            participant = participant_session_map.setdefault(participant_id, await self._get_or_create_participant(participant_id))
                            session_key = (participant_id, session_label)
                            if session_key not in session_map:
                                session_number = len([k for k in session_map if k[0] == participant_id]) + 1
                                session_map[session_key] = await self._get_or_create_session(participant, session_label, session_number)
                            session = session_map[session_key]
                            bids_parts = _parse_bids_parts(rel)
                            device_id = bids_parts.get("acquisition") or "UNKNOWN"
                            await self._create_recording(session, dataset.id, rel, modality, device_id, ext.lstrip("."), participant.pseudonym_id)

            discovered_modalities = list(dict.fromkeys(discovered_modalities))
            file_types = list(dict.fromkeys(file_types))

            file_checksums = []
            for file_path in sorted(root.rglob("*")):
                if file_path.is_file():
                    file_checksums.append(sha256_file(file_path))
            file_checksums = [c for c in file_checksums if c]
            if file_checksums and not checksum:
                combined = "|".join(file_checksums)
                checksum = f"sha256:{hashlib.sha256(combined.encode()).hexdigest()}"

            for pid in discovered_participants:
                await self._get_or_create_participant(pid)

            if not discovered_participants:
                warnings.append("No BIDS-style participants discovered; dataset may not be BIDS-compliant")

            manifest = build_manifest(
                dataset_id=dataset.id,
                dataset_name=dataset.name,
                version=dataset.version,
                source_metadata=source_metadata,
                discovered_participants=discovered_participants,
                discovered_recordings=discovered_recordings,
                discovered_modalities=discovered_modalities,
                file_types=file_types,
                warnings=warnings,
                errors=errors,
                local_path=local_path,
                checksum=checksum,
            )
            qc_manifest = run_qc(manifest)
            dataset.manifest = qc_manifest.model_dump(mode="json")
            dataset.checksum = checksum or qc_manifest.checksum
            dataset.participant_count = dataset.participant_count or len(discovered_participants)
            dataset.recording_count = dataset.recording_count or len(discovered_recordings)
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

        except Exception as exc:  # pragma: no cover - defensive logging
            await self._log(dataset_id, "import_error", str(exc))
            dataset.import_error = str(exc)
            dataset.imported_status = "failed"
            dataset.qc_status = "FAIL"
            await self.db.flush()
            await self._audit("import_failed", "dataset", "failure", str(dataset_id), {"error": str(exc)})

        logs = await self.db.execute(select(DatasetImportLog).where(DatasetImportLog.dataset_id == dataset_id).order_by(DatasetImportLog.created_at.desc()))
        await self.db.commit()
        return DatasetImportResponse(
            dataset_id=dataset.id,
            imported_status=dataset.imported_status,
            qc_status=dataset.qc_status,
            manifest=DatasetManifest.model_validate(dataset.manifest) if dataset.manifest else None,
            logs=[DatasetImportLogResponse.model_validate(l) for l in logs.scalars().all()],
        )

    async def register_real_dataset(self, payload: DatasetImportRequest, source_metadata: Dict[str, Any]) -> Dataset:
        source_metadata["data_classification"] = "REAL"
        if payload.local_path and not source_metadata.get("bids_root"):
            source_metadata["bids_root"] = payload.local_path
        if payload.access_type and not source_metadata.get("access_type"):
            source_metadata["access_type"] = payload.access_type
        if payload.access_requirements and not source_metadata.get("access_requirements"):
            source_metadata["access_requirements"] = payload.access_requirements
        if payload.source_url and not source_metadata.get("source_url"):
            source_metadata["source_url"] = payload.source_url
        source_metadata.setdefault("is_restricted", payload.is_restricted)
        source_metadata.setdefault("is_credentialed", payload.is_credentialed)
        return await self.register_dataset(payload, source_metadata)
