"""Configuration for ML training pipeline."""
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://neurospeech:neurospeech_dev@localhost:5432/neurospeech"
    
    # Data paths
    SLR127_DATA_ROOT: str = "D:/NeuroSpeech-Rehab/data/raw/openslr127_tamil/mile_tamil_asr_corpus"
    
    # Training settings
    TARGET_SAMPLE_RATE: int = 16000
    MAX_DURATION: float = 20.0
    MIN_DURATION: float = 0.1
    
    # Tokenizer settings
    VOCAB_PATH: str = "D:/NeuroSpeech-Rehab/ml_training/tokenizer/vocab.json"
    
    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache
def get_settings() -> Settings:
    return Settings()