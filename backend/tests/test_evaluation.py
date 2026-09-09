"""Synthetic labels exclusively for verification."""
import pytest
from app.services.evaluation import evaluate


def test_known_confusion_and_participant_bootstrap():
    rows = [{"participant_id": "synthetic-a", "truth": "a", "prediction": "a", "split": "validation"},
            {"participant_id": "synthetic-b", "truth": "b", "prediction": "a", "split": "validation"}]
    r = evaluate(rows, bootstrap_samples=50)
    assert r["accuracy"] == .5
    assert r["confusion_matrix"] == [[1, 0], [1, 0]]
    assert r == evaluate(rows, bootstrap_samples=50)


def test_final_test_is_explicit():
    rows = [{"participant_id": "synthetic-a", "truth": "a", "prediction": "a", "split": "test"}]
    with pytest.raises(ValueError, match="explicit"):
        evaluate(rows)
    assert evaluate(rows, final_test=True)["accuracy_ci95"] is None
