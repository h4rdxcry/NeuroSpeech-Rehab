from typing import Any, Dict, List, Optional
from app.schemas.dataset_import import DatasetManifest


def run_qc(manifest: DatasetManifest) -> DatasetManifest:
    warnings: List[str] = list(manifest.warnings)
    errors: List[str] = list(manifest.errors)

    if not manifest.discovered_participants and manifest.participant_count is None:
        errors.append("participant count not documented and no participants discovered")

    if not manifest.discovered_recordings and manifest.recording_count is None:
        warnings.append("recording count not documented and no recordings discovered")

    if not manifest.discovered_modalities and manifest.modality is None:
        warnings.append("modality not documented and no modalities discovered")

    if manifest.local_path and not manifest.checksum:
        warnings.append("local path present but checksum not computed")

    for err in errors:
        manifest.warnings = warnings
        manifest.errors = errors
        return manifest

    for w in warnings:
        manifest.warnings = warnings
        manifest.errors = errors
        return manifest

    manifest.warnings = warnings
    manifest.errors = errors
    return manifest


def qc_status_from_manifest(manifest: DatasetManifest) -> str:
    if manifest.errors:
        return "FAIL"
    if manifest.warnings:
        return "WARNING"
    return "PASS"
