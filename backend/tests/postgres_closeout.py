"""Online PostgreSQL migration/constraint verification against isolated databases.

Set ENVIRONMENT=test and DATABASE_URL to a local disposable database named
verification. This script creates two uniquely named test databases on that
server, applies real migrations, and removes only those databases afterwards.
It never accesses production or locked final-test datasets.
"""
from __future__ import annotations

import json
import os
from pathlib import Path
import subprocess
import sys
import uuid

from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import make_url
from sqlalchemy.exc import IntegrityError

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from app.core.db import Base
from app import models  # noqa: F401 -- register the complete SQLAlchemy metadata

HEAD = "007_patient_participant_link"
PREVIOUS = "006_computed_features"


def main():
    target = make_url(os.environ["DATABASE_URL"])
    if (os.environ.get("ENVIRONMENT") != "test" or target.database != "verification"
            or target.host not in {"localhost", "127.0.0.1"}
            or not target.drivername.startswith("postgresql")):
        raise RuntimeError("Requires a local disposable PostgreSQL verification database and ENVIRONMENT=test")
    admin = create_engine(target.set(drivername="postgresql+psycopg2"), isolation_level="AUTOCOMMIT")
    checks = []
    databases = []

    def check(name, condition):
        if not condition:
            raise AssertionError(name)
        checks.append(name)

    def migrate(url, *args):
        env = {**os.environ, "DATABASE_URL": url.render_as_string(hide_password=False)}
        result = subprocess.run([sys.executable, "-m", "alembic", *args], cwd=ROOT,
                                env=env, capture_output=True, text=True)
        if result.returncode:
            raise RuntimeError(result.stdout + result.stderr)
        print(result.stdout + result.stderr, file=sys.stderr, end="", flush=True)

    def database(stage):
        name = f"verification_{stage}_{uuid.uuid4().hex[:12]}"
        with admin.connect() as connection:
            connection.execute(text(f'CREATE DATABASE "{name}"'))
        databases.append(name)
        return target.set(database=name)

    try:
        fresh = database("fresh")
        migrate(fresh, "upgrade", "head")
        fresh_engine = create_engine(fresh.set(drivername="postgresql+psycopg2"))
        with fresh_engine.connect() as connection:
            check("fresh database upgrade reaches 007", connection.scalar(text("SELECT version_num FROM alembic_version")) == HEAD)
            drift = compare_metadata(MigrationContext.configure(connection), Base.metadata)
            check("SQLAlchemy metadata has zero drift", drift == [])
        fresh_engine.dispose()
        migrate(fresh, "check")
        check("alembic check passes at current head", True)

        upgrade = database("upgrade")
        migrate(upgrade, "upgrade", PREVIOUS)
        engine = create_engine(upgrade.set(drivername="postgresql+psycopg2"))
        old_patient, old_user, role_id = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
        with engine.begin() as connection:
            check("previous head has no participant link", "participant_id" not in {c["name"] for c in inspect(connection).get_columns("patients")})
            connection.execute(text("INSERT INTO roles (id,name,permissions) VALUES (:id,'PATIENT','[]')"), {"id": role_id})
            connection.execute(text("INSERT INTO users (id,email,password_hash,role_id,is_active) VALUES (:id,'synthetic-existing@example.invalid','test-only',:role,true)"), {"id": old_user, "role": role_id})
            connection.execute(text("INSERT INTO patients (id,user_id,is_active) VALUES (:id,:user,true)"), {"id": old_patient, "user": old_user})
        migrate(upgrade, "upgrade", "head")
        with engine.begin() as connection:
            check("existing previous head upgrades to 007", connection.scalar(text("SELECT version_num FROM alembic_version")) == HEAD)
            row = connection.execute(text("SELECT user_id,participant_id FROM patients WHERE id=:id"), {"id": old_patient}).one()
            check("existing patient preserved without invented enrollment", row.user_id == old_user and row.participant_id is None)
            inspector = inspect(connection)
            foreign_keys = inspector.get_foreign_keys("patients")
            check("patient participant foreign key exists", any(fk["constrained_columns"] == ["participant_id"] and fk["referred_table"] == "research_participants" and fk["referred_columns"] == ["id"] for fk in foreign_keys))
            check("patient user foreign key preserved", any(fk["constrained_columns"] == ["user_id"] and fk["referred_table"] == "users" for fk in foreign_keys))
            check("participant uniqueness constraint exists", any(c["column_names"] == ["participant_id"] for c in inspector.get_unique_constraints("patients")))
            check("participant unique index exists", any(i["column_names"] == ["participant_id"] and i["unique"] for i in inspector.get_indexes("patients")))
            participant, second_user, second_patient = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
            connection.execute(text("INSERT INTO research_participants (id,pseudonym_id,consent_status) VALUES (:id,'SYNTHETIC-CONSTRAINT-FIXTURE','approved')"), {"id": participant})
            connection.execute(text("UPDATE patients SET participant_id=:p WHERE id=:id"), {"p": participant, "id": old_patient})
            connection.execute(text("INSERT INTO users (id,email,password_hash,role_id,is_active) VALUES (:id,'synthetic-second@example.invalid','test-only',:role,true)"), {"id": second_user, "role": role_id})
            connection.execute(text("INSERT INTO patients (id,user_id,is_active) VALUES (:id,:user,true)"), {"id": second_patient, "user": second_user})

            def rejected(name, statement, params, code):
                try:
                    with connection.begin_nested():
                        connection.execute(text(statement), params)
                except IntegrityError as exc:
                    check(name, exc.orig.pgcode == code)
                else:
                    raise AssertionError(name + " was not rejected")

            rejected("duplicate participant enrollment rejected", "UPDATE patients SET participant_id=:p WHERE id=:id", {"p": participant, "id": second_patient}, "23505")
            rejected("unknown participant rejected by FK", "UPDATE patients SET participant_id=:p WHERE id=:id", {"p": uuid.uuid4(), "id": second_patient}, "23503")
            rejected("enrolled participant deletion protected", "DELETE FROM research_participants WHERE id=:id", {"id": participant}, "23503")
            check("nullable unenrolled patient remains supported", connection.scalar(text("SELECT participant_id IS NULL FROM patients WHERE id=:id"), {"id": second_patient}) is True)
        migrate(upgrade, "downgrade", "-1")
        with engine.connect() as connection:
            check("downgrade one revision reaches 006", connection.scalar(text("SELECT version_num FROM alembic_version")) == PREVIOUS)
            check("downgrade removes link column only", "participant_id" not in {c["name"] for c in inspect(connection).get_columns("patients")} and connection.scalar(text("SELECT count(*) FROM patients")) == 2)
        migrate(upgrade, "upgrade", "head")
        migrate(upgrade, "check")
        with engine.connect() as connection:
            check("upgrade back reaches 007", connection.scalar(text("SELECT version_num FROM alembic_version")) == HEAD)
            check("roundtrip metadata has zero drift", compare_metadata(MigrationContext.configure(connection), Base.metadata) == [])
        engine.dispose()
        env = {**os.environ, "DATABASE_URL": fresh.render_as_string(hide_password=False)}
        result = subprocess.run([sys.executable, "tests/postgres_verification.py"], cwd=ROOT, env=env, capture_output=True, text=True)
        if result.returncode:
            raise RuntimeError(result.stdout + result.stderr)
        workflow = json.loads(result.stdout)
        check("real PostgreSQL patient and research workflow", workflow["status"] == "passed")
        report = {"status": "passed", "migration_head": HEAD, "postgresql_version": None,
                  "migration_schema_checks": len(checks), "checks": checks,
                  "workflow": workflow, "failed": 0, "skipped": 0}
        with admin.connect() as connection:
            report["postgresql_version"] = connection.scalar(text("SHOW server_version"))
        print(json.dumps(report, indent=2))
    finally:
        with admin.connect() as connection:
            for name in databases:
                connection.execute(text(f'DROP DATABASE "{name}" WITH (FORCE)'))
        admin.dispose()


if __name__ == "__main__":
    main()
