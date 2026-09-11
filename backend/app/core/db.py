from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.core.config import get_settings

settings = get_settings()

class Base(DeclarativeBase):
    pass

_engine = None
_async_session_maker = None

def get_engine():
    global _engine
    if _engine is None:
        engine_kwargs = {"echo": False}
        if "sqlite" not in settings.DATABASE_URL:
            # Production PostgreSQL & Supabase Connection Pooler optimizations
            engine_kwargs.update({
                "pool_pre_ping": True,
                "pool_recycle": 300,
                "connect_args": {
                    # Crucial for Supabase Transaction Pooler (Supavisor / pgbouncer)
                    "statement_cache_size": 0,
                },
            })
        _engine = create_async_engine(settings.DATABASE_URL, **engine_kwargs)
    return _engine

def get_session_maker():
    global _async_session_maker
    if _async_session_maker is None:
        _async_session_maker = async_sessionmaker(get_engine(), expire_on_commit=False)
    return _async_session_maker

async def get_db():
    async with get_session_maker()() as session:
        yield session
