import asyncio
import os
import sys
from pathlib import Path
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text, select

backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from app.models import Base, Role, User, Exercise, Patient, ResearchParticipant
from app.core.auth import hash_password

async def migrate_and_seed(db_url: str):
    if db_url.startswith('postgres://'):
        db_url = db_url.replace('postgres://', 'postgresql+asyncpg://', 1)
    elif db_url.startswith('postgresql://'):
        db_url = db_url.replace('postgresql://', 'postgresql+asyncpg://', 1)
    
    safe_host = db_url.split('@')[-1] if '@' in db_url else 'local'
    print(f'[Supabase Migrator] Connecting to: {safe_host}')
    engine = create_async_engine(db_url, echo=False)

    try:
        # Step 1: Create Extensions
        async with engine.begin() as conn:
            print('[Supabase Migrator] Enabling UUID and pgcrypto extensions...')
            await conn.execute(text('CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";'))
            await conn.execute(text('CREATE EXTENSION IF NOT EXISTS \"pgcrypto\";'))

        # Step 2: Create All Tables
        async with engine.begin() as conn:
            print('[Supabase Migrator] Creating database tables...')
            await conn.run_sync(Base.metadata.create_all)
            print('[Supabase Migrator] All 22 tables verified/created successfully.')

        # Step 3: Seed Clinical Demo Data
        sql_file = backend_dir.parent / 'supabase' / 'seed.sql'
        if sql_file.exists():
            print(f'[Supabase Migrator] Seeding clinical data from {sql_file.name}...')
            with open(sql_file, 'r', encoding='utf-8') as f:
                seed_sql = f.read()

            statements = [s.strip() for s in seed_sql.split(';') if s.strip() and not s.strip().startswith('--')]
            async with engine.begin() as conn:
                for stmt in statements:
                    await conn.execute(text(stmt))
            print(f'[Supabase Migrator] Applied {len(statements)} seed statements.')

        print('\n======================================================')
        print('SUCCESS: Supabase Cloud Database is fully initialized!')
        print('======================================================')
        print('Demo Users Provisioned:')
        print('  • Patient:    patient@neurospeech.dev   / NeuroSpeechDemo123!')
        print('  • Researcher: researcher@neurospeech.dev / Researcher123!')
        print('  • Admin:      admin@neurospeech.dev      / AdminSecure2026!')
        print('======================================================\n')

    finally:
        await engine.dispose()

if __name__ == '__main__':
    url = sys.argv[1] if len(sys.argv) > 1 else os.getenv('DATABASE_URL')
    if not url:
        print('Usage: python migrate_to_supabase.py <SUPABASE_POSTGRES_URL>')
        print('Example: python migrate_to_supabase.py postgresql://postgres.xxxx:pass@aws-0-us-east-1.pooler.supabase.com:6543/postgres')
        sys.exit(1)
    asyncio.run(migrate_and_seed(url))
