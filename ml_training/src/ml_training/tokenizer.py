"""
Tamil character-level tokenizer for Wav2Vec2 CTC.
Implements a character-level vocabulary suitable for CTC loss.
"""
import os
import json
from typing import List, Dict, Optional


class TamilTokenizer:
    """
    Tamil character-level tokenizer for Wav2Vec2 CTC.
    
    Uses <blank> token (index 0) for CTC blank, and maps each unique character
    to a unique integer index. Supports encode/decode with CTC collapse.
    """
    
    BLANK_TOKEN = "<blank>"
    BLANK_ID = 0
    
    def __init__(self, vocab_path: Optional[str] = None):
        self.char_to_idx: Dict[str, int] = {}
        self.idx_to_char: Dict[int, str] = {}
        self.vocab_size: int = 0
        
        if vocab_path and os.path.exists(vocab_path):
            self.load_vocab(vocab_path)
        else:
            # Initialize with blank token
            self.char_to_idx = {self.BLANK_TOKEN: self.BLANK_ID}
            self.idx_to_char = {self.BLANK_ID: self.BLANK_TOKEN}
            self.vocab_size = 1
    
    def build_vocab_from_transcripts(self, transcripts: List[str]) -> None:
        """
        Build vocabulary from a list of transcripts.
        
        Args:
            transcripts: List of transcript strings
        """
        # Collect all unique characters
        chars = set()
        for transcript in transcripts:
            for char in transcript:
                chars.add(char)
        
        # Sort for deterministic ordering
        sorted_chars = sorted(chars)
        
        # Assign indices starting from 1 (0 is reserved for blank)
        for i, char in enumerate(sorted_chars, start=1):
            self.char_to_idx[char] = i
            self.idx_to_char[i] = char
        
        self.vocab_size = len(self.char_to_idx)
    
    def encode(self, transcript: str) -> List[int]:
        """
        Convert transcript to list of integer indices.
        
        Args:
            transcript: Input transcript string
            
        Returns:
            List of token indices (unknown chars mapped to blank)
        """
        return [self.char_to_idx.get(c, self.BLANK_ID) for c in transcript]
    
    def decode(self, indices: List[int]) -> str:
        """
        Convert list of indices to transcript, removing blanks and duplicates (CTC collapse).
        
        Args:
            indices: List of token indices
            
        Returns:
            Decoded transcript string
        """
        # CTC collapse: remove consecutive duplicates and blanks
        collapsed = []
        prev = None
        for idx in indices:
            if idx != self.BLANK_ID and idx != prev:
                collapsed.append(idx)
                prev = idx
            elif idx == self.BLANK_ID:
                prev = None  # reset prev when blank
        
        # Convert to characters
        return ''.join(self.idx_to_char.get(idx, '') for idx in collapsed)
    
    def decode_without_collapse(self, indices: List[int]) -> str:
        """
        Convert list of indices to transcript without CTC collapse.
        Useful for debugging.
        
        Args:
            indices: List of token indices
            
        Returns:
            Decoded transcript string with blanks shown as '_'
        """
        return ''.join(
            self.idx_to_char.get(idx, '_') if idx != self.BLANK_ID else '_'
            for idx in indices
        )
    
    def save_vocab(self, path: str) -> None:
        """
        Save vocabulary to JSON file.
        
        Args:
            path: Path to save vocabulary
        """
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(self.char_to_idx, f, ensure_ascii=False, indent=2)
    
    def load_vocab(self, path: str) -> None:
        """
        Load vocabulary from JSON file.
        
        Args:
            path: Path to vocabulary file
        """
        with open(path, 'r', encoding='utf-8') as f:
            self.char_to_idx = json.load(f)
        
        # Convert keys to int (JSON keys are strings)
        new_char_to_idx = {}
        for k, v in self.char_to_idx.items():
            try:
                new_char_to_idx[int(k)] = v
            except ValueError:
                new_char_to_idx[k] = v
        self.char_to_idx = new_char_to_idx
        
        # Rebuild idx_to_char
        self.idx_to_char = {v: k for k, v in self.char_to_idx.items()}
        self.vocab_size = len(self.char_to_idx)
    
    def get_vocab_size(self) -> int:
        """Return vocabulary size."""
        return self.vocab_size
    
    def get_vocab(self) -> Dict[str, int]:
        """Return vocabulary mapping."""
        return self.char_to_idx.copy()
    
    def __len__(self) -> int:
        return self.vocab_size
    
    def __contains__(self, char: str) -> bool:
        return char in self.char_to_idx


def create_tokenizer_from_manifest(manifest: Dict[str, List]) -> TamilTokenizer:
    """
    Create tokenizer from manifest entries.
    
    Args:
        manifest: Dict with split names as keys and lists of ManifestEntry as values
        
    Returns:
        Fitted TamilTokenizer
    """
    tokenizer = TamilTokenizer()
    
    # Collect all transcripts from all splits
    all_transcripts = []
    for split_entries in manifest.values():
        for entry in split_entries:
            all_transcripts.append(entry.transcript)
    
    tokenizer.build_vocab_from_transcripts(all_transcripts)
    return tokenizer


if __name__ == "__main__":
    # Test the tokenizer
    test_transcripts = [
        "மூர்க்கத்தனத்தினால் வரமாட்டேன் என்று சொன்னேன் அம்மா",
        "அவ்வளவோ காரியங்கள் வேறுவிதமாக நடந்திருக்கலாம்",
        "தமிழ் மொழியில் பதில்",
    ]
    
    tokenizer = TamilTokenizer()
    tokenizer.build_vocab_from_transcripts(test_transcripts)
    
    print(f"Vocab size: {tokenizer.get_vocab_size()}")
    print(f"Vocab: {tokenizer.get_vocab()}")
    
    for transcript in test_transcripts:
        encoded = tokenizer.encode(transcript)
        decoded = tokenizer.decode(encoded)
        print(f"Original: {transcript}")
        print(f"Encoded:  {encoded}")
        print(f"Decoded:  {decoded}")
        print(f"Match:    {transcript == decoded}")
        print()