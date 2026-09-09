"""
PyTorch Dataset for SLR127 Wav2Vec2 CTC training.
Handles loading audio files, extracting features, and tokenizing transcripts.
"""
import torch
import numpy as np
import random
import os
import soundfile as sf
from typing import List, Dict, Optional
from dataclasses import dataclass

from .manifest_builder import ManifestEntry
from .tokenizer import TamilTokenizer


@dataclass
class AudioFeatures:
    """Container for audio features and metadata."""
    waveform: torch.Tensor  # Shape: (1, num_samples) - mono audio
    sample_rate: int
    duration: float
    transcript_ids: List[int]
    transcript_text: str
    recording_id: str
    participant_pseudonym: str


class SLR127Dataset(torch.utils.data.Dataset):
    """PyTorch Dataset for SLR127 Wav2Vec2 CTC training."""
    
    def __init__(
        self,
        manifest_entries: List[ManifestEntry],
        tokenizer: TamilTokenizer,
        sample_rate: int = 16000,
        max_duration: float = 20.0,
        min_duration: float = 0.1,
        cache_wavs: bool = False,
        augment: bool = False,
        seed: int = 42
    ):
        """
        Initialize dataset.
        
        Args:
            manifest_entries: List of manifest entries for this split
            tokenizer: TamilTokenizer instance
            sample_rate: Target sample rate (Hz)
            max_duration: Maximum audio duration to include (seconds)
            min_duration: Minimum audio duration to include (seconds)
            cache_wavs: Whether to cache loaded waveforms in memory
            augment: Whether to apply data augmentation
            seed: Random seed for reproducibility
        """
        self.tokenizer = tokenizer
        self.target_sample_rate = sample_rate
        self.max_duration = max_duration
        self.min_duration = min_duration
        self.cache_wavs = cache_wavs
        self.augment = augment
        self.training = augment
        
        # Filter entries by duration and validate
        self.entries = []
        self.wav_cache = {} if cache_wavs else None
        
        for entry in manifest_entries:
            # Check duration constraints
            if entry.duration < self.min_duration or entry.duration > self.max_duration:
                continue
            
            # Validate file exists
            if not os.path.exists(entry.audio_path):
                continue
            
            self.entries.append(entry)
        
        print(f"Filtered {len(manifest_entries)} entries to {len(self.entries)} valid entries")
        
        # Set random seed for reproducibility
        self.rng = random.Random(seed)
        self._seed = seed
    
    def __len__(self) -> int:
        return len(self.entries)
    
    def __getitem__(self, idx: int) -> Dict[str, torch.Tensor]:
        """
        Get a single item from the dataset.
        
        Returns:
            Dict containing:
                - input_values: waveform tensor (num_samples,)
                - labels: transcript token IDs tensor (num_chars,)
                - input_lengths: length of audio tensor
                - label_lengths: length of transcript tensor
                - recording_id: string
                - participant_pseudonym: string
        """
        entry = self.entries[idx]
        
        if self.cache_wavs and entry.audio_path in self.wav_cache:
            waveform, sample_rate = self.wav_cache[entry.audio_path]
        else:
            waveform_np, sample_rate = sf.read(entry.audio_path, dtype="float32")
            waveform = torch.from_numpy(waveform_np)
            if waveform.ndim == 1:
                waveform = waveform.unsqueeze(0)
            else:
                waveform = waveform.t()
            if self.cache_wavs:
                self.wav_cache[entry.audio_path] = (waveform, sample_rate)
        
        # Ensure mono audio
        if waveform.shape[0] > 1:
            waveform = torch.mean(waveform, dim=0, keepdim=True)
        
        # Resample if necessary
        if sample_rate != self.target_sample_rate:
            resampler = torchaudio.transforms.Resample(sample_rate, self.target_sample_rate)
            waveform = resampler(waveform)
        
        # Apply augmentation if enabled
        if self.augment and self.training:
            waveform = self._apply_augmentation(waveform)
        
        # Normalize to [-1, 1] if not already
        if waveform.abs().max() > 1.0:
            waveform = waveform / waveform.abs().max()
        
        # Tokenize transcript
        transcript_ids = self.tokenizer.encode(entry.transcript)
        
        # Create return dict
        return {
            "input_values": waveform.squeeze(0),  # (num_samples,)
            "labels": torch.tensor(transcript_ids, dtype=torch.long),
            "input_lengths": torch.tensor(waveform.shape[1], dtype=torch.long),
            "label_lengths": torch.tensor(len(transcript_ids), dtype=torch.long),
            "transcript": entry.transcript,
            "recording_id": entry.recording_id,
            "participant_pseudonym": entry.participant_pseudonym,
        }
    
    def _apply_augmentation(self, waveform: torch.Tensor) -> torch.Tensor:
        """Apply data augmentation to waveform."""
        # Simple augmentation: add noise, time shift
        if self.rng.random() < 0.3:  # 30% chance of noise
            noise = torch.randn_like(waveform) * 0.005
            waveform = waveform + noise
        
        if self.rng.random() < 0.2:  # 20% chance of time shift
            shift_samples = self.rng.randint(-int(0.1 * waveform.shape[1]), int(0.1 * waveform.shape[1]))
            if shift_samples > 0:
                waveform = torch.cat([torch.zeros_like(waveform[:, :shift_samples]), waveform[:, :-shift_samples]], dim=1)
            elif shift_samples < 0:
                waveform = torch.cat([waveform[:, -shift_samples:], torch.zeros_like(waveform[:, :-shift_samples])], dim=1)
        
        return waveform
    
    def get_audio_features(self, idx: int) -> AudioFeatures:
        """
        Get full audio features for analysis (not for training).
        
        Returns:
            AudioFeatures object
        """
        entry = self.entries[idx]
        
        if self.cache_wavs and entry.audio_path in self.wav_cache:
            waveform, sample_rate = self.wav_cache[entry.audio_path]
        else:
            waveform_np, sample_rate = sf.read(entry.audio_path, dtype="float32")
            waveform = torch.from_numpy(waveform_np)
            if waveform.ndim == 1:
                waveform = waveform.unsqueeze(0)
            else:
                waveform = waveform.t()
            if self.cache_wavs:
                self.wav_cache[entry.audio_path] = (waveform, sample_rate)
        
        # Ensure mono
        if waveform.shape[0] > 1:
            waveform = torch.mean(waveform, dim=0, keepdim=True)
        
        # Resample if needed
        if sample_rate != self.target_sample_rate:
            resampler = torchaudio.transforms.Resample(sample_rate, self.target_sample_rate)
            waveform = resampler(waveform)
        
        # Normalize
        if waveform.abs().max() > 1.0:
            waveform = waveform / waveform.abs().max()
        
        # Tokenize transcript
        transcript_ids = self.tokenizer.encode(entry.transcript)
        
        return AudioFeatures(
            waveform=waveform,
            sample_rate=self.target_sample_rate,
            duration=entry.duration,
            transcript_ids=transcript_ids,
            transcript_text=entry.transcript,
            recording_id=entry.recording_id,
            participant_pseudonym=entry.participant_pseudonym
        )


def create_data_loader(
    dataset: SLR127Dataset,
    batch_size: int = 8,
    shuffle: bool = True,
    num_workers: int = 0,
    pin_memory: bool = False,
    persistent_workers: bool = False
) -> torch.utils.data.DataLoader:
    """
    Create DataLoader for SLR127 dataset with custom collate function.
    
    Args:
        dataset: SLR127Dataset instance
        batch_size: Batch size
        shuffle: Whether to shuffle data
        num_workers: Number of worker processes
        pin_memory: Whether to pin memory for GPU transfer
        persistent_workers: Whether to keep workers alive between epochs
        
    Returns:
        Configured DataLoader
    """
    def collate_fn(batch):
        """Custom collate function to handle variable length sequences."""
        # Separate batch components
        input_values = [item["input_values"] for item in batch]
        labels = [item["labels"] for item in batch]
        input_lengths = [item["input_lengths"] for item in batch]
        label_lengths = [item["label_lengths"] for item in batch]
        recording_ids = [item["recording_id"] for item in batch]
        participant_pseudonyms = [item["participant_pseudonym"] for item in batch]
        
        # Pad input_values to same length
        input_values_padded = torch.nn.utils.rnn.pad_sequence(
            input_values, batch_first=True, padding_value=0.0
        )  # Shape: (batch_size, max_seq_len)
        
        # Pad labels to same length
        labels_padded = torch.nn.utils.rnn.pad_sequence(
            labels, batch_first=True, padding_value=-100  # CTC loss ignores -100
        )  # Shape: (batch_size, max_label_len)
        
        # Stack lengths
        input_lengths = torch.stack(input_lengths)
        label_lengths = torch.stack(label_lengths)
        
        return {
            "input_values": input_values_padded,
            "labels": labels_padded,
            "input_lengths": input_lengths,
            "label_lengths": label_lengths,
            "recording_ids": recording_ids,
            "participant_pseudonyms": participant_pseudonyms,
        }
    
    return torch.utils.data.DataLoader(
        dataset,
        batch_size=batch_size,
        shuffle=shuffle,
        num_workers=num_workers,
        pin_memory=pin_memory,
        persistent_workers=persistent_workers and num_workers > 0,
        collate_fn=collate_fn
    )


def set_deterministic_seeds(seed: int = 42) -> None:
    """
    Set random seeds for reproducibility.
    
    Args:
        seed: Random seed value
    """
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    torch.cuda.manual_seed_all(seed)
    
    # Ensure deterministic behavior in cuDNN
    torch.backends.cudnn.deterministic = True
    torch.backends.cudnn.benchmark = False


def create_train_val_test_dataloaders(
    train_entries: List[ManifestEntry],
    val_entries: List[ManifestEntry],
    test_entries: List[ManifestEntry],
    tokenizer: TamilTokenizer,
    batch_size: int = 8,
    num_workers: int = 0,
    pin_memory: bool = False,
    seed: int = 42
) -> Dict[str, torch.utils.data.DataLoader]:
    """
    Create train, validation, and test DataLoaders.
    
    Args:
        train_entries: Training manifest entries
        val_entries: Validation manifest entries
        test_entries: Test manifest entries
        tokenizer: TamilTokenizer instance
        batch_size: Batch size
        num_workers: Number of worker processes
        pin_memory: Whether to pin memory for GPU transfer
        seed: Random seed for reproducibility
        
    Returns:
        Dict with 'train', 'validation', 'test' DataLoaders
    """
    set_deterministic_seeds(seed)
    
    train_dataset = SLR127Dataset(
        manifest_entries=train_entries,
        tokenizer=tokenizer,
        cache_wavs=False,
        augment=True,
        seed=seed
    )
    
    val_dataset = SLR127Dataset(
        manifest_entries=val_entries,
        tokenizer=tokenizer,
        cache_wavs=False,
        augment=False,
        seed=seed
    )
    
    test_dataset = SLR127Dataset(
        manifest_entries=test_entries,
        tokenizer=tokenizer,
        cache_wavs=False,
        augment=False,
        seed=seed
    )
    
    return {
        "train": create_data_loader(
            train_dataset, batch_size=batch_size, shuffle=True,
            num_workers=num_workers, pin_memory=pin_memory
        ),
        "validation": create_data_loader(
            val_dataset, batch_size=batch_size, shuffle=False,
            num_workers=num_workers, pin_memory=pin_memory
        ),
        "test": create_data_loader(
            test_dataset, batch_size=batch_size, shuffle=False,
            num_workers=num_workers, pin_memory=pin_memory
        ),
    }


if __name__ == "__main__":
    # Test the dataset with dummy data
    from .manifest_builder import ManifestEntry
    
    # Create dummy manifest entries
    dummy_entries = [
        ManifestEntry(
            recording_id="test1",
            participant_pseudonym="SLR127-TRAIN-TEST001",
            audio_path="dummy.wav",
            transcript="Namaste",
            split="train",
            duration=5.0
        ),
        ManifestEntry(
            recording_id="test2",
            participant_pseudonym="SLR127-TRAIN-TEST002",
            audio_path="dummy2.wav",
            transcript="Hello world",
            split="train",
            duration=3.0
        )
    ]
    
    # Create tokenizer
    tokenizer = TamilTokenizer()
    tokenizer.build_vocab_from_transcripts(["Namaste", "Hello world"])
    
    # Create dataset
    dataset = SLR127Dataset(
        manifest_entries=dummy_entries,
        tokenizer=tokenizer,
        cache_wavs=False,
        augment=False
    )
    
    print(f"Dataset length: {len(dataset)}")
    
    # Test data loader
    loader = create_data_loader(dataset, batch_size=2, shuffle=False)
    
    print("Dataset and DataLoader created successfully!")
    print(f"Tokenizer vocab size: {tokenizer.get_vocab_size()}")