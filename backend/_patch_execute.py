filepath = "app/services/datasets/acquire_dataset.py"

with open(filepath, "r") as f:
    content = f.read()

new_method = """
    async def execute_acquisition(self, dataset_key):
        spec = self.resolve_spec(dataset_key)
        dry_run_info = self.dry_run(dataset_key)

        if not dry_run_info["storage_guard"]["allowed"]:
            raise StorageLimitExceededError(dry_run_info["storage_guard"]["message"])

        target_dir = self.data_root / "raw" / spec.raw_subfolder
        target_dir.mkdir(parents=True, exist_ok=True)

        download_logs = []
        files = dry_run_info.get("files", [])

        for file_info in files:
            key = file_info["key"]
            expected_size = file_info["size"]
            dest_file = target_dir / key

            if spec.source_type == "zenodo":
                download_url = "https://zenodo.org/api/records/" + spec.zenodo_record_id + "/files/" + key + "/content"
            elif spec.source_type == "openslr":
                record_data = self.openslr_fetcher.fetch_record(spec.slr_id)
                file_entry = next((f for f in record_data.get("files", []) if f.get("key") == key), None)
                if not file_entry:
                    raise RuntimeError("File " + key + " not found in OpenSLR record")
                download_url = file_entry["download_url"]
            else:
                raise NotImplementedError("Unsupported source type: " + spec.source_type)

            req = urllib.request.Request(download_url, headers={"User-Agent": "NeuroSpeech-Rehab-Acquisition-Engine/1.0"})
            with urllib.request.urlopen(req, timeout=300) as resp:
                body = resp.read()
                if len(body) != expected_size:
                    raise RuntimeError("Size mismatch for " + key + ": expected " + str(expected_size) + ", got " + str(len(body)))
                dest_file.write_bytes(body)
                download_logs.append({"file": key, "size": len(body), "status": "VERIFIED_OK"})

        async with get_session_maker()() as session:
            importer = DatasetImporter(session)
            src_org = "OpenSLR" if spec.source_type == "openslr" else "Chitkara University"
            imp_req = DatasetImportRequest(
                local_path=str(target_dir).replace(chr(92), "/"),
                source_url=spec.source_url or "",
                access_type="PUBLIC",
                is_restricted=False,
                is_credentialed=False,
                metadata_override={
                    "name": dry_run_info["title"] or spec.name,
                    "version": "1.0",
                    "source_organization": src_org,
                    "source_dataset_id": spec.slr_id or spec.zenodo_record_id,
                    "modality": spec.modality,
                    "participant_count": dry_run_info.get("speaker_status", "SPEAKER_COUNT_UNVERIFIED"),
                    "recording_count": len([f for f in files if f["key"].endswith((".wav", ".flac", ".zip"))]),
                    "license": dry_run_info["license"],
                    "population": spec.clinical_control,
                    "language": spec.language,
                    "bids_compatible": False,
                }
            )
            dataset = await importer.register_real_dataset(imp_req, imp_req.metadata_override)
            import_resp = await importer.import_dataset(dataset.id, imp_req)

        final_usage = self.guard.get_current_data_usage()

        return {
            "dataset_id": str(dataset.id),
            "dataset_name": dataset.name,
            "status": import_resp.imported_status,
            "qc_status": import_resp.qc_status,
            "download_logs": download_logs,
            "final_storage": final_usage,
        }

"""

marker = '            "is_synthetic": False,\n        }\n'

if marker in content:
    content = content.replace(marker, marker + new_method, 1)
    with open(filepath, "w") as f:
        f.write(content)
    print("SUCCESS")
else:
    print("ERROR: marker not found")

</ARG>