import pytest
from pydantic import ValidationError
from app.schemas.session import PredictionCreate

def test_prediction_schema_valid():
    pred = PredictionCreate(
        attempt_id="00000000-0000-0000-0000-000000000000",
        recording_id="00000000-0000-0000-0000-000000000000",
        model_id="00000000-0000-0000-0000-000000000000",
        model_version="v1",
        feature_pipeline_version="fp1",
        training_dataset_version="ds1",
        prediction_type="movement_quality",
        predicted_label="good",
        confidence=0.9,
        uncertainty=0.1,
        signal_quality_state="sufficient",
        signal_quality_details={},
        timestamp="2026-09-04T00:00:00Z",
    )
    assert pred.predicted_label == "good"

def test_prediction_schema_requires_attempt_id():
    with pytest.raises(ValidationError):
        PredictionCreate(
            recording_id="00000000-0000-0000-0000-000000000000",
            model_id="00000000-0000-0000-0000-000000000000",
            model_version="v1",
            feature_pipeline_version="fp1",
            training_dataset_version="ds1",
            prediction_type="movement_quality",
            predicted_label="good",
            signal_quality_state="sufficient",
            timestamp="2026-09-04T00:00:00Z",
        )
