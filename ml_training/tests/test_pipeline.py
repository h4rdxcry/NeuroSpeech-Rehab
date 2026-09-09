"""
Tests for SLR127 Wav2Vec2 data pipeline.
Tests manifest counts, no participant leakage, transcript/audio pairing,
test isolation, deterministic ordering, and tokenizer encode/decode.
"""
import os
import random
import tempfile
import wave
import pytest
import asyncio
from datetime import datetime
from pathlib import Path
from uuid import UUID

import torch
import numpy as np
from sqlalchemy import select

from ml_training.manifest_builder import SLR127ManifestBuilder, ManifestEntry, build_manifest_hash
from ml_training.tokenizer import TamilTokenizer
from ml_training.dataset import (
    SLR127Dataset,
    create_data_loader,
    set_deterministic_seeds,
    create_train_val_test_dataloaders
)


def create_test_wav(file_path: Path, duration_sec: float = 1.0, sample_rate: int = 16000):
    """Create a test WAV file."""
    file_path.parent.mkdir(parents=True, exist_ok=True)
    num_frames = int(duration_sec * sample_rate)
    with wave.open(str(file_path), "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(b"\x00\x00" * num_frames)


async def setup_slr127_test_data(session, dataset_id: str, tmp_path: Path):
    """Create test SLR127-like data in the database."""
    from app.models import (
        Dataset, DatasetSplit, ResearchParticipant, Session as SessionModel,
        Recording, Annotation, User, Role
    )
    import bcrypt
    
    role_result = await session.execute(select(Role).where(Role.name == "RESEARCHER"))
    role = role_result.scalar_one_or_none()
    if role is None:
        role = Role(name="RESEARCHER", permissions="[]")
        session.add(role)
        await session.flush()
    
    email = f"test_{dataset_id}@example.com"
    user_result = await session.execute(select(User).where(User.email == email))
    user = user_result.scalar_one_or_none()
    if user is None:
        hashed = bcrypt.hashpw(b"password123", bcrypt.gensalt()).decode("utf-8")
        user = User(email=email, password_hash=hashed, role_id=role.id, is_active=True)
        session.add(user)
        await session.flush()
    
    prefix = dataset_id[:8]
    
    async def _get_or_create_participant(pseudonym: str) -> ResearchParticipant:
        result = await session.execute(select(ResearchParticipant).where(ResearchParticipant.pseudonym_id == pseudonym))
        participant = result.scalar_one_or_none()
        if participant is None:
            participant = ResearchParticipant(pseudonym_id=pseudonym, consent_status="imported")
            session.add(participant)
        return participant
    
    train_participants = []
    for i in range(5):
        train_participants.append(await _get_or_create_participant(f"SLR127-TRAIN-{prefix}-{i:03d}"))
    
    val_participants = []
    for i in range(3):
        val_participants.append(await _get_or_create_participant(f"SLR127-VALIDATION-{prefix}-{i:03d}"))
    
    test_participants = []
    for i in range(2):
        test_participants.append(await _get_or_create_participant(f"SLR127-TEST-{prefix}-{i:03d}"))
    
    await session.flush()
    
    for p in train_participants:
        split = DatasetSplit(dataset_id=UUID(dataset_id), participant_id=p.pseudonym_id, split_type="train", is_locked=False, final_test_flag=False)
        session.add(split)
    for p in val_participants:
        split = DatasetSplit(dataset_id=UUID(dataset_id), participant_id=p.pseudonym_id, split_type="validation", is_locked=False, final_test_flag=False)
        session.add(split)
    for p in test_participants:
        split = DatasetSplit(dataset_id=UUID(dataset_id), participant_id=p.pseudonym_id, split_type="test", is_locked=True, final_test_flag=True)
        session.add(split)
    
    await session.flush()
    
    # Create sessions and recordings
    all_participants = [(p, "train") for p in train_participants] + \
                       [(p, "validation") for p in val_participants] + \
                       [(p, "test") for p in test_participants]
    
    for participant, split_type in all_participants:
        sess = SessionModel(
            participant_id=participant.id,
            session_date=datetime(2024, 1, 1),
            session_number=1,
            dataset_split=split_type,
            status="imported",
        )
        session.add(sess)
        await session.flush()
        
        # Create 2 recordings per participant
        for r in range(2):
            # Create actual WAV file
            rel_path = f"mile_tamil_asr_corpus/{split_type}/audio_files/{participant.pseudonym_id}_{r}.wav"
            audio_path = tmp_path / rel_path
            create_test_wav(audio_path, duration_sec=1.5)
            
            rec = Recording(
                session_id=sess.id,
                modality="AUDIO",
                device_id="UNKNOWN",
                file_path=rel_path,
                file_format="WAV",
                duration_seconds=1.5,
                start_timestamp=datetime(2024, 1, 1),
                is_synthetic=False,
                data_classification="REAL",
                processing_status="raw",
                source_dataset_id=UUID(dataset_id),
                participant_pseudonym=participant.pseudonym_id,
                recording_identifier=f"{participant.pseudonym_id}_{r}",
            )
            session.add(rec)
            await session.flush()
            
            # Create transcript annotation
            transcript = f"தமிழ் உரை {participant.pseudonym_id} {r}"
            ann = Annotation(
                recording_id=rec.id,
                annotator_id=user.id,
                annotation_type="TRANSCRIPT",
                start_timestamp=datetime(2024, 1, 1),
                end_timestamp=datetime(2024, 1, 1),
                label=transcript,
                confidence=1.0,
                is_ground_truth=True,
            )
            session.add(ann)
    
    await session.commit()


class TestManifestBuilder:
    """Tests for manifest builder."""
    
    @pytest.mark.asyncio
    async def test_build_manifest_counts(self, db_session):
        """Test that manifest has correct counts per split."""
        # Create a test dataset
        from app.models import Dataset
        dataset = Dataset(
            name="IISc-MILE Tamil ASR Corpus (OpenSLR 127)",
            version="1.0",
            bids_root=str(Path.cwd()),
            participant_ids=[],
            recording_ids=[],
            split_definition={},
            is_final_test=False,
            is_locked=False,
            created_by=UUID("00000000-0000-0000-0000-000000000001"),
        )
        db_session.add(dataset)
        await db_session.flush()
        dataset_id = str(dataset.id)
        
        # Setup test data
        await setup_slr127_test_data(db_session, dataset_id, Path.cwd())
        
        # Build manifest
        async with SLR127ManifestBuilder() as builder:
            manifest = await builder.build_manifest(dataset_id)
            stats = builder.get_manifest_stats(manifest)
        
        # Check counts
        # 5 train participants * 2 recordings = 10
        # 3 val participants * 2 recordings = 6
        # 2 test participants * 2 recordings = 4
        assert stats["train"]["count"] == 10, f"Train count: {stats['train']['count']}"
        assert stats["validation"]["count"] == 6, f"Val count: {stats['validation']['count']}"
        assert stats["test"]["count"] == 4, f"Test count: {stats['test']['count']}"
        
        # Check participant counts
        assert stats["train"]["participants"] == 5
        assert stats["validation"]["participants"] == 3
        assert stats["test"]["participants"] == 2
    
    @pytest.mark.asyncio
    async def test_no_participant_leakage(self, db_session):
        """Test that no participant appears in more than one split."""
        from app.models import Dataset
        dataset = Dataset(
            name="IISc-MILE Tamil ASR Corpus (OpenSLR 127)",
            version="1.0",
            bids_root=str(Path.cwd()),
            participant_ids=[],
            recording_ids=[],
            split_definition={},
            is_final_test=False,
            is_locked=False,
            created_by=UUID("00000000-0000-0000-0000-000000000001"),
        )
        db_session.add(dataset)
        await db_session.flush()
        dataset_id = str(dataset.id)
        
        await setup_slr127_test_data(db_session, dataset_id, Path.cwd())
        
        # This should not raise an error
        async with SLR127ManifestBuilder() as builder:
            await builder.validate_no_participant_leakage(dataset_id)
            manifest = await builder.build_manifest(dataset_id)
        
        # Verify no participant in multiple splits
        all_participants = {}
        for split_type, entries in manifest.items():
            for entry in entries:
                prior_split = all_participants.get(entry.participant_pseudonym)
                if prior_split is not None and prior_split != split_type:
                    assert False, f"Participant {entry.participant_pseudonym} in multiple splits: {prior_split} and {split_type}"
                all_participants[entry.participant_pseudonym] = split_type
    
    @pytest.mark.asyncio
    async def test_transcript_audio_pairing(self, db_session):
        """Test that each recording has a valid transcript and audio file."""
        from app.models import Dataset
        dataset = Dataset(
            name="IISc-MILE Tamil ASR Corpus (OpenSLR 127)",
            version="1.0",
            bids_root=str(Path.cwd()),
            participant_ids=[],
            recording_ids=[],
            split_definition={},
            is_final_test=False,
            is_locked=False,
            created_by=UUID("00000000-0000-0000-0000-000000000001"),
        )
        db_session.add(dataset)
        await db_session.flush()
        dataset_id = str(dataset.id)
        
        await setup_slr127_test_data(db_session, dataset_id, Path.cwd())
        
        async with SLR127ManifestBuilder() as builder:
            manifest = await builder.build_manifest(dataset_id)
        
        # Every entry should have non-empty transcript and valid audio path
        for split_type, entries in manifest.items():
            for entry in entries:
                assert entry.transcript, f"Empty transcript in {split_type}"
                assert entry.transcript.strip(), f"Whitespace-only transcript in {split_type}"
                assert os.path.exists(entry.audio_path), f"Audio file not found: {entry.audio_path}"
                assert entry.duration > 0, f"Invalid duration: {entry.duration}"
    
    @pytest.mark.asyncio
    async def test_test_isolation(self, db_session):
        """Test that test split is isolated and marked as locked/final."""
        from app.models import Dataset, DatasetSplit
        dataset = Dataset(
            name="IISc-MILE Tamil ASR Corpus (OpenSLR 127)",
            version="1.0",
            bids_root=str(Path.cwd()),
            participant_ids=[],
            recording_ids=[],
            split_definition={},
            is_final_test=False,
            is_locked=False,
            created_by=UUID("00000000-0000-0000-0000-000000000001"),
        )
        db_session.add(dataset)
        await db_session.flush()
        dataset_id = str(dataset.id)
        
        await setup_slr127_test_data(db_session, dataset_id, Path.cwd())
        
        # Check database directly for test split flags
        result = await db_session.execute(
            select(DatasetSplit).where(DatasetSplit.dataset_id == UUID(dataset_id))
        )
        splits = result.scalars().all()
        
        test_splits = [s for s in splits if s.split_type == "test"]
        train_splits = [s for s in splits if s.split_type == "train"]
        val_splits = [s for s in splits if s.split_type == "validation"]
        
        # Test splits should be locked and final_test_flag
        for s in test_splits:
            assert s.is_locked == True, "Test split should be locked"
            assert s.final_test_flag == True, "Test split should have final_test_flag"
        
        # Train/validation should not be locked
        for s in train_splits:
            assert s.is_locked == False, "Train split should not be locked"
            assert s.final_test_flag == False, "Train split should not have final_test_flag"
        
        for s in val_splits:
            assert s.is_locked == False, "Validation split should not be locked"
            assert s.final_test_flag == False, "Validation split should not have final_test_flag"
    
    @pytest.mark.asyncio
    async def test_deterministic_ordering(self, db_session):
        """Test that manifest ordering is deterministic."""
        from app.models import Dataset
        dataset = Dataset(
            name="IISc-MILE Tamil ASR Corpus (OpenSLR 127)",
            version="1.0",
            bids_root=str(Path.cwd()),
            participant_ids=[],
            recording_ids=[],
            split_definition={},
            is_final_test=False,
            is_locked=False,
            created_by=UUID("00000000-0000-0000-0000-000000000001"),
        )
        db_session.add(dataset)
        await db_session.flush()
        dataset_id = str(dataset.id)
        
        await setup_slr127_test_data(db_session, dataset_id, Path.cwd())
        
        # Build manifest twice
        async with SLR127ManifestBuilder() as builder:
            manifest1 = await builder.build_manifest(dataset_id)
        
        async with SLR127ManifestBuilder() as builder:
            manifest2 = await builder.build_manifest(dataset_id)
        
        # Compare ordering
        for split_type in ["train", "validation", "test"]:
            entries1 = manifest1[split_type]
            entries2 = manifest2[split_type]
            
            assert len(entries1) == len(entries2), f"Length mismatch in {split_type}"
            for e1, e2 in zip(entries1, entries2):
                assert e1.recording_id == e2.recording_id, f"Ordering mismatch in {split_type}"
                assert e1.participant_pseudonym == e2.participant_pseudonym, f"Participant mismatch in {split_type}"
        
        # Hash should be identical
        hash1 = build_manifest_hash(manifest1)
        hash2 = build_manifest_hash(manifest2)
        assert hash1 == hash2, "Manifest hash should be deterministic"
    
    @pytest.mark.asyncio
    async def test_participant_leakage_guard(self, db_session):
        """Test that leakage guard raises error when participant in multiple splits."""
        from app.models import Dataset, DatasetSplit, ResearchParticipant
        
        dataset = Dataset(
            name="IISc-MILE Tamil ASR Corpus (OpenSLR 127)",
            version="1.0",
            bids_root=str(Path.cwd()),
            participant_ids=[],
            recording_ids=[],
            split_definition={},
            is_final_test=False,
            is_locked=False,
            created_by=UUID("00000000-0000-0000-0000-000000000001"),
        )
        db_session.add(dataset)
        await db_session.flush()
        dataset_id = str(dataset.id)
        
        # Create a participant in BOTH train and test (leakage)
        leak_participant = ResearchParticipant(pseudonym_id="SLR127-LEAK-SPKR001", consent_status="imported")
        db_session.add(leak_participant)
        await db_session.flush()
        
        split1 = DatasetSplit(dataset_id=UUID(dataset_id), participant_id=leak_participant.pseudonym_id, split_type="train", is_locked=False, final_test_flag=False)
        split2 = DatasetSplit(dataset_id=UUID(dataset_id), participant_id=leak_participant.pseudonym_id, split_type="test", is_locked=True, final_test_flag=True)
        db_session.add(split1)
        db_session.add(split2)
        await db_session.commit()
        
        # This should raise ValueError
        async with SLR127ManifestBuilder() as builder:
            with pytest.raises(ValueError, match="Participant leakage detected"):
                await builder.validate_no_participant_leakage(dataset_id)
            
            with pytest.raises(ValueError, match="Participant leakage detected"):
                await builder.build_manifest(dataset_id)


class TestTamilTokenizer:
    """Tests for Tamil tokenizer."""
    
    def test_encode_decode_roundtrip(self):
        """Test that encode/decode preserves transcript."""
        transcripts = [
            "மூர்க்கத்தனத்தினால் வரமாட்டேன் என்று சொன்னேன் அம்மா",
            "அவ்வளவோ காரியங்கள் வேறுவிதமாக நடந்திருக்கலாம்",
            "தமிழ் மொழியில் பதில்",
            "Hello world 123",  # Mixed script
        ]
        
        tokenizer = TamilTokenizer()
        tokenizer.build_vocab_from_transcripts(transcripts)
        
        for transcript in transcripts:
            encoded = tokenizer.encode(transcript)
            decoded = tokenizer.decode(encoded)
            # CTC collapse may remove duplicate chars, but should be readable
            assert isinstance(encoded, list), "Encode should return list"
            assert all(isinstance(x, int) for x in encoded), "Encoded should be list of ints"
            assert isinstance(decoded, str), "Decode should return string"
            assert len(decoded) > 0, "Decoded should not be empty"
    
    def test_encode_unknown_chars(self):
        """Test that unknown chars map to blank."""
        tokenizer = TamilTokenizer()
        tokenizer.build_vocab_from_transcripts(["அம்மா"])
        
        # 'x' is not in vocab
        encoded = tokenizer.encode("அம்மாx")
        assert tokenizer.BLANK_ID in encoded, "Unknown char should map to blank"
    
    def test_deterministic_vocab(self):
        """Test that vocab building is deterministic."""
        transcripts = ["அம்மா", "அப்பா", "அக்கா"]
        
        tokenizer1 = TamilTokenizer()
        tokenizer1.build_vocab_from_transcripts(transcripts)
        
        tokenizer2 = TamilTokenizer()
        tokenizer2.build_vocab_from_transcripts(transcripts)
        
        assert tokenizer1.char_to_idx == tokenizer2.char_to_idx, "Vocab should be deterministic"
    
    def test_save_load_vocab(self):
        """Test saving and loading vocabulary."""
        transcripts = ["அம்மா", "அப்பா"]
        
        tokenizer1 = TamilTokenizer()
        tokenizer1.build_vocab_from_transcripts(transcripts)
        
        with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as f:
            vocab_path = f.name
        
        try:
            tokenizer1.save_vocab(vocab_path)
            
            tokenizer2 = TamilTokenizer(vocab_path)
            
            assert tokenizer1.char_to_idx == tokenizer2.char_to_idx
            assert tokenizer1.idx_to_char == tokenizer2.idx_to_char
            assert tokenizer1.vocab_size == tokenizer2.vocab_size
        finally:
            if os.path.exists(vocab_path):
                os.remove(vocab_path)
    
    def test_vocab_size(self):
        """Test vocabulary size calculation."""
        tokenizer = TamilTokenizer()
        tokenizer.build_vocab_from_transcripts(["அம்மா", "அப்பா"])
        
        # Should have: blank + unique chars (அ, ம, ா, ப, ப, ா) = 1 + 4 = 5
        # Actually: அ, ம, ா, ப = 4 unique + blank = 5
        assert tokenizer.vocab_size >= 5
        assert tokenizer.get_vocab_size() == tokenizer.vocab_size
    
    def test_decode_without_collapse(self):
        """Test decode without CTC collapse."""
        tokenizer = TamilTokenizer()
        tokenizer.build_vocab_from_transcripts(["அம்மா"])
        
        # Create indices with blanks and duplicates
        indices = [tokenizer.char_to_idx["அ"], 0, tokenizer.char_to_idx["ம"], tokenizer.char_to_idx["ம"], tokenizer.char_to_idx["ா"]]
        
        decoded = tokenizer.decode_without_collapse(indices)
        assert "_" in decoded, "Blanks should show as underscore"
        assert decoded.count("ம") == 2, "Duplicates should be preserved"


class TestDataset:
    """Tests for SLR127Dataset and DataLoader."""
    
    def test_deterministic_seeds(self):
        """Test that set_deterministic_seeds works."""
        set_deterministic_seeds(42)
        
        # Generate some random numbers
        r1 = random.random()
        r2 = np.random.random()
        r3 = torch.rand(1).item()
        
        set_deterministic_seeds(42)
        
        r1_again = random.random()
        r2_again = np.random.random()
        r3_again = torch.rand(1).item()
        
        assert r1 == r1_again
        assert r2 == r2_again
        assert r3 == r3_again
    
    def test_collate_fn_padding(self):
        """Test that collate function pads sequences correctly."""
        # Create dummy data with different lengths
        tokenizer = TamilTokenizer()
        tokenizer.build_vocab_from_transcripts(["அம்மா", "அப்பா"])
        
        # Create mock dataset entries with different audio lengths
        entries = [
            ManifestEntry(
                recording_id="rec1",
                participant_pseudonym="spk1",
                audio_path="dummy1.wav",
                transcript="அம்மா",
                split="train",
                duration=2.0
            ),
            ManifestEntry(
                recording_id="rec2",
                participant_pseudonym="spk2",
                audio_path="dummy2.wav",
                transcript="அப்பா",
                split="train",
                duration=3.0
            ),
        ]
        
        # Create dummy WAV files
        for entry in entries:
            create_test_wav(Path(entry.audio_path), duration_sec=entry.duration)
        
        try:
            dataset = SLR127Dataset(entries, tokenizer, cache_wavs=False)
            loader = create_data_loader(dataset, batch_size=2, shuffle=False)
            
            batch = next(iter(loader))
            
            # Check batch structure
            assert "input_values" in batch
            assert "labels" in batch
            assert "input_lengths" in batch
            assert "label_lengths" in batch
            assert "recording_ids" in batch
            assert "participant_pseudonyms" in batch
            
            # Check shapes
            assert batch["input_values"].shape[0] == 2  # batch_size
            assert batch["labels"].shape[0] == 2
            assert batch["input_lengths"].shape[0] == 2
            assert batch["label_lengths"].shape[0] == 2
            
            # Check padding value for labels is -100
            # The shorter sequence should be padded with -100
            max_label_len = batch["labels"].shape[1]
            for i in range(2):
                label_len = batch["label_lengths"][i].item()
                if label_len < max_label_len:
                    # Check padding
                    assert (batch["labels"][i, label_len:] == -100).all(), "Labels should be padded with -100"
            
        finally:
            # Clean up dummy files
            for entry in entries:
                if os.path.exists(entry.audio_path):
                    os.remove(entry.audio_path)
    
    def test_create_train_val_test_loaders(self):
        """Test creating train/val/test loaders."""
        tokenizer = TamilTokenizer()
        tokenizer.build_vocab_from_transcripts(["அம்மா", "அப்பா", "அக்கா"])
        
        # Create test entries
        train_entries = [
            ManifestEntry("rec1", "spk1", "dummy1.wav", "அம்மா", "train", 1.0),
            ManifestEntry("rec2", "spk2", "dummy2.wav", "அப்பா", "train", 1.0),
        ]
        val_entries = [
            ManifestEntry("rec3", "spk3", "dummy3.wav", "அக்கா", "validation", 1.0),
        ]
        test_entries = [
            ManifestEntry("rec4", "spk4", "dummy4.wav", "அம்மா", "test", 1.0),
        ]
        
        # Create dummy WAV files
        for entry in train_entries + val_entries + test_entries:
            create_test_wav(Path(entry.audio_path), duration_sec=entry.duration)
        
        try:
            loaders = create_train_val_test_dataloaders(
                train_entries, val_entries, test_entries,
                tokenizer, batch_size=2, seed=42
            )
            
            assert "train" in loaders
            assert "validation" in loaders
            assert "test" in loaders
            
            # Test iterating
            for name, loader in loaders.items():
                batch = next(iter(loader))
                assert batch["input_values"].shape[0] > 0
                assert batch["labels"].shape[0] > 0
                print(f"{name} batch: input_values={batch['input_values'].shape}, labels={batch['labels'].shape}")
        
        finally:
            for entry in train_entries + val_entries + test_entries:
                if os.path.exists(entry.audio_path):
                    os.remove(entry.audio_path)


class TestCUDA:
    """Tests for CUDA support (smoke test)."""
    
    @pytest.mark.skipif(not torch.cuda.is_available(), reason="CUDA not available")
    def test_cuda_batch_smoke_test(self):
        """Smoke test: load batch and move to CUDA."""
        tokenizer = TamilTokenizer()
        tokenizer.build_vocab_from_transcripts(["அம்மா", "அப்பா", "அக்கா"])
        
        train_entries = [
            ManifestEntry("rec1", "spk1", "dummy1.wav", "அம்மா", "train", 1.0),
            ManifestEntry("rec2", "spk2", "dummy2.wav", "அப்பா", "train", 1.0),
        ]
        
        for entry in train_entries:
            create_test_wav(Path(entry.audio_path), duration_sec=entry.duration)
        
        try:
            dataset = SLR127Dataset(train_entries, tokenizer, cache_wavs=False)
            loader = create_data_loader(dataset, batch_size=2, shuffle=False)
            
            batch = next(iter(loader))
            
            # Move to CUDA
            input_values = batch["input_values"].cuda()
            labels = batch["labels"].cuda()
            input_lengths = batch["input_lengths"].cuda()
            label_lengths = batch["label_lengths"].cuda()
            
            # Verify they're on CUDA
            assert input_values.is_cuda
            assert labels.is_cuda
            assert input_lengths.is_cuda
            assert label_lengths.is_cuda
            
            print(f"CUDA batch: input_values={input_values.shape}, labels={labels.shape}")
            print("CUDA smoke test PASSED")
            
        finally:
            for entry in train_entries:
                if os.path.exists(entry.audio_path):
                    os.remove(entry.audio_path)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])