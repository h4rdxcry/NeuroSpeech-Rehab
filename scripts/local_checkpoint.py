"""Register the existing, hash-verified ASR artifact; never manufacture a model or score."""
import hashlib
import json
from pathlib import Path
from sqlalchemy import select
from app.models import ModelVersion

ROOT = Path(__file__).resolve().parents[1]
EXPECTED_SHA256 = '17e15394ae0e58a95664b40f6ff606d5de44674c791114005af36271f4afb991'

async def ensure_asr_model(db, registered_by):
    checkpoint = ROOT/'ml_training/outputs/baseline/best-checkpoint.pt'
    config = json.loads((checkpoint.parent/'training_config.json').read_text(encoding='utf-8'))
    with checkpoint.open('rb') as source:
        digest = hashlib.file_digest(source, 'sha256').hexdigest()
    if digest != EXPECTED_SHA256:
        raise RuntimeError('ASR checkpoint has changed. Review its metadata before registration.')
    existing = (await db.execute(select(ModelVersion).where(ModelVersion.model_type == 'asr', ModelVersion.is_production.is_(True)))).scalars().all()
    if existing:
        if len(existing) != 1 or existing[0].architecture_json.get('checkpoint_sha256') != digest:
            raise RuntimeError('A different active ASR model is registered. No model was replaced.')
        return existing[0]
    model = ModelVersion(
        model_name=config['model_name'], version=checkpoint.name, model_type='asr',
        architecture_json={'checkpoint_path': str(checkpoint), 'checkpoint_sha256': digest,
                           'vocab_size': config['vocab_size'], 'framework': 'transformers',
                           'scope': 'General Tamil speech research baseline; not dysarthria validated'},
        training_dataset_version='IISc-MILE Tamil ASR Corpus (OpenSLR 127)',
        feature_pipeline_version='wav2vec2-feat-v1',
        training_params={key: config[key] for key in ['seed','learning_rate','final_global_step','train_recordings','val_recordings','manifest_hash','completed_at']},
        # Historical evaluator scores must not be presented as current performance.
        performance_metrics=None, is_production=True, registered_by=registered_by,
    )
    db.add(model)
    await db.flush()
    return model
