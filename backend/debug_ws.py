import os
os.environ['DATABASE_URL'] = 'sqlite+aiosqlite:///./test_ws.db'
import asyncio
import json
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy.future import select

from app.main import app
from app.core.db import Base, get_db
from app.models import Role, User

TEST_DATABASE_URL = 'sqlite+aiosqlite:///./test_ws.db'
engine = create_async_engine(TEST_DATABASE_URL, echo=False)
async_session_factory = async_sessionmaker(engine, expire_on_commit=False)


async def setup():
    print('setup start')
    if os.path.exists('test_ws.db'):
        os.remove('test_ws.db')
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print('setup done')


async def override_get_db():
    async with async_session_factory() as session:
        yield session


app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)


async def main():
    print('main start')
    await setup()

    async with async_session_factory() as session:
        result = await session.execute(select(Role).where(Role.name == 'RESEARCHER'))
        role = result.scalar_one_or_none()
        if not role:
            role = Role(name='RESEARCHER', permissions='[]')
            session.add(role)
            await session.commit()

    email = 'researcher@example.com'
    client.post('/api/v1/auth/register', json={'email': email, 'password': 'password123', 'role_id': str(role.id)})
    r = client.post('/api/v1/auth/login', json={'email': email, 'password': 'password123'})
    token = r.json()['access_token']
    print('got token')

    r = client.post('/api/v1/participants/research-participants', json={'pseudonym_id': 'SUBJ-001', 'consent_status': 'approved'}, headers={'Authorization': f'Bearer {token}'})
    participant = r.json()
    r = client.post('/api/v1/sessions/sessions', json={'participant_id': participant['id'], 'session_date': '2026-09-04', 'session_number': 1}, headers={'Authorization': f'Bearer {token}'})
    session = r.json()
    print('created session')

    try:
        print('connecting ws')
        with client.websocket_connect(f"/ws/sessions/{session['id']}?token={token}") as ws:
            print('ws connected')
            ws.send_text(json.dumps({
                'type': 'stream_start',
                'session_id': session['id'],
                'attempt_id': '00000000-0000-0000-0000-000000000000',
                'modality': 'AUDIO',
                'sample_rate': 16000,
                'channels': 1,
                'sample_width_bytes': 2,
                'encoding': 'pcm16',
            }))
            msgs = []
            print('waiting for messages')
            while True:
                try:
                    msg = ws.receive()
                    if 'text' in msg:
                        msgs.append(json.loads(msg['text']))
                        print('got message:', msgs[-1])
                        break
                except Exception as e:
                    print('recv error:', e)
                    break
            print('Messages:', msgs)
    except Exception as e:
        print('WS failed:', type(e).__name__, str(e)[:500])


asyncio.run(main())
