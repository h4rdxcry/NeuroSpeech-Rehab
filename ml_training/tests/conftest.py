import os
import sys
from pathlib import Path

# Add backend to path so we can import app.models
backend_path = Path(__file__).parent.parent.parent / "backend"
sys.path.insert(0, str(backend_path))

# Add ml_training src to path
ml_training_src = Path(__file__).parent.parent / "src"
sys.path.insert(0, str(ml_training_src))

import pytest
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

# Ensure asyncio mode is set
pytest_plugins = ("pytest_asyncio",)

# Pre-import models so SQLAlchemy metadata is populated before create_all
from app.core.db import Base  # noqa: E402
from app.models import (  # noqa: E402
    Dataset,
    DatasetSplit,
    DatasetProvenance,
    DatasetCatalog,
    DatasetImportLog,
    Annotation,
    ResearchParticipant,
    Session as SessionModel,
    Recording,
    SignalQuality,
    User,
    Role,
)

# Set test database URL before importing modules
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///./test_ml.db"

TEST_DATABASE_URL = "sqlite+aiosqlite:///./test_ml.db"
engine = create_async_engine(TEST_DATABASE_URL, echo=False)
async_session_factory = async_sessionmaker(engine, expire_on_commit=False)


@pytest.fixture(autouse=True)
def enforce_ml_test_database():
    """Ensure ML training tests always point to the initialized test_ml.db SQLite database."""
    from ml_training.config import get_settings
    old_env = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = TEST_DATABASE_URL
    get_settings.cache_clear()
    yield
    if old_env is not None:
        os.environ["DATABASE_URL"] = old_env
    get_settings.cache_clear()


@pytest.fixture(scope="session", autouse=True)
async def setup_test_db():
    """Create test database schema."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()
    db_path = Path("./test_ml.db")
    if db_path.exists():
        try:
            db_path.unlink()
        except PermissionError:
            pass


@pytest.fixture
async def db_session():
    """Provide a test database session."""
    async with async_session_factory() as session:
        yield session