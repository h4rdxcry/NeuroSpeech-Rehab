"""CER and WER computation for ASR evaluation."""
from __future__ import annotations

from typing import List


def _levenshtein_distance(s1: str, s2: str) -> int:
    """Compute Levenshtein distance between two strings."""
    if len(s1) < len(s2):
        return _levenshtein_distance(s2, s1)

    if len(s2) == 0:
        return len(s1)

    previous_row = list(range(len(s2) + 1))
    for i, c1 in enumerate(s1):
        current_row = [i + 1]
        for j, c2 in enumerate(s2):
            insertions = previous_row[j + 1] + 1
            deletions = current_row[j] + 1
            substitutions = previous_row[j] + (c1 != c2)
            current_row.append(min(insertions, deletions, substitutions))
        previous_row = current_row

    return previous_row[-1]


def compute_cer(predictions: List[str], references: List[str]) -> float:
    """Compute Character Error Rate."""
    if len(predictions) != len(references):
        raise ValueError("Predictions and references must have the same length")

    total_distance = 0
    total_length = 0

    for pred, ref in zip(predictions, references):
        total_distance += _levenshtein_distance(pred, ref)
        total_length += len(ref)

    if total_length == 0:
        return 0.0

    return total_distance / total_length


def compute_wer(predictions: List[str], references: List[str]) -> float:
    """Compute Word Error Rate."""
    if len(predictions) != len(references):
        raise ValueError("Predictions and references must have the same length")

    total_distance = 0
    total_length = 0

    for pred, ref in zip(predictions, references):
        pred_words = pred.split()
        ref_words = ref.split()
        total_distance += _levenshtein_distance(pred_words, ref_words)
        total_length += len(ref_words)

    if total_length == 0:
        return 0.0

    return total_distance / total_length
