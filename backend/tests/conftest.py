"""Bind each legacy test module to its own database and dependency overrides."""
import os
os.environ["ENVIRONMENT"] = "test"
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///:memory:"
import pytest
os.environ["HF_HUB_OFFLINE"] = "1"

async def seed_test_admin(factory, namespace):
    """Explicit test administrator provisions test staff through the real RBAC route."""
    from app.models import Role, User
    from app.core.auth import create_access_token, hash_password
    from sqlalchemy import select
    async with factory() as session:
        role = (await session.execute(select(Role).where(Role.name == "ADMIN"))).scalar_one_or_none()
        if role is None:
            role = Role(name="ADMIN", permissions="[]")
            session.add(role)
            await session.flush()
        user = User(email="fixture-admin@example.invalid", password_hash=hash_password("test-fixture-only"), role_id=role.id)
        session.add(user)
        await session.commit()
        namespace["TEST_ADMIN_HEADERS"] = {"Authorization": "Bearer " + create_access_token({"sub": str(user.id), "email": user.email, "role": "ADMIN"})}

@pytest.fixture(autouse=True)
async def isolate_module_database(request):
    from app.main import app
    from app.core import db
    module = request.module
    old_overrides = app.dependency_overrides.copy()
    old_engine, old_maker = db._engine, db._async_session_maker
    app.dependency_overrides.clear()
    if hasattr(module, "override_get_db"):
        app.dependency_overrides[db.get_db] = module.override_get_db
    if hasattr(module, "engine"):
        db._engine = module.engine
    if hasattr(module, "async_session_factory"):
        db._async_session_maker = module.async_session_factory
    client = getattr(module, "client", None)
    if client is not None:
        client.headers.pop("Authorization", None)
    yield
    if hasattr(module, "engine"):
        await module.engine.dispose()
    app.dependency_overrides.clear()
    app.dependency_overrides.update(old_overrides)
    db._engine, db._async_session_maker = old_engine, old_maker
