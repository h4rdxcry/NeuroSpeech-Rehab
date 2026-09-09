"""
Tamil character-level tokenizer for Wav2Vec2 CTC.
"""
from typing import List, Dict
import json


class TamilTokenizer:
    def __init__(self, vocab_path: str = None):
        if vocab_path and os.path.exists(vocab_path):
            self.load_vocab(vocab_path)
        else:
            # Initialize with blank token
            self.char_to_idx = {"<blank>": 0}
            self.idx_to_char = {0: "<blank>"}
            self.vocab_size = 1

    def fit_from_transcripts(self, transcripts: List[str]) -> None:
        """Build vocabulary from a list of transcripts."""
        # Collect all unique characters
        chars = set()
        for transcript in transcripts:
            for char in transcript:
                chars.add(char)
        # Sort for deterministic ordering
        sorted_chars = sorted(chars)
        # Assign indices starting from 1
        for i, char in enumerate(sorted_chars, start=1):
            self.char_to_idx[char] = i
            self.idx_to_char[i] = char
        self.vocab_size = len(self.char_to_idx)

    def encode(self, transcript: str) -> List[int]:
        """Convert transcript to list of integer indices."""
        return [self.char_to_idx.get(c, 0) for c in transcript]  # 0 for unknown (blank)

    def decode(self, indices: List[int]) -> str:
        """Convert list of indices to transcript, removing blanks and duplicates (for CTC)."""
        # First, remove consecutive duplicates and blanks (CTC collapse)
        collapsed = []
        prev = None
        for idx in indices:
            if idx != 0 and idx != prev:  # not blank and not same as previous
                collapsed.append(idx)
                prev = idx
            elif idx == 0:
                prev = None  # reset prev when blank
        # Convert to characters
        return ''.join(self.idx_to_char.get(idx, '') for idx in collapsed)

    def save_vocab(self, path: str) -> None:
        """Save vocabulary to JSON file."""
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(self.char_to_idx, f, ensure_ascii=False, indent=2)

    def load_vocab(self, path: str) -> None:
        """Load vocabulary from JSON file."""
        with open(path, 'r', encoding='utf-8') as f:
            self.char_to_idx = json.load(f)
        # Convert keys to int (JSON keys are strings)
        self.char_to_idx = {int(k) if k.isdigit() else k: v for k, v in self.char_to_idx.items()}
        # Rebuild idx_to_char
        self.idx_to_char = {v: k for k, v in self.char_to_idx.items()}
        self.vocab_size = len(self.char_to_idx)