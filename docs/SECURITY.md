# NeuroSpeech Rehab — Security Model

## 1. Threat Model

- Unauthorized access to patient physiological data
- Unauthorized model manipulation or prediction tampering
- Data leakage across research partitions (train/validation/test)
- Audit trail tampering
- Authentication bypass
- Injection attacks via sensor data or API inputs
- PII exposure alongside research data

## 2. Authentication

### 2.1 Password Handling
- **Never store plaintext passwords.**
- Use `bcrypt` (cost factor 12+) or `argon2id` for password hashing.
- Password reset via time-limited, single-use tokens sent to verified contact.
- Enforce minimum password complexity.

### 2.2 Session Management
- JWT access tokens (short-lived, 15-30 minutes) + refresh tokens (longer-lived, rotated).
- Tokens stored securely (HttpOnly, Secure, SameSite cookies in web clients).
- Server-side token revocation list for logout and compromised tokens.
- Session binding to IP/user-agent where appropriate for research environments.

### 2.3 Multi-Factor Authentication
- Required for RESEARCHER and ADMIN roles in production.
- Optional but recommended for CLINICIAN role.
- Not required for PATIENT role in prototype (considering motor impairment ease-of-use).

## 3. Authorization (RBAC)

### 3.1 Roles

| Role | Description | Key Permissions |
|------|-------------|-----------------|
| PATIENT | End user of rehabilitation system | View own sessions, play game, see own progress |
| CLINICIAN | Healthcare provider | Manage assigned patients, view sessions, configure exercises, annotate |
| RESEARCHER | Research scientist | Manage datasets, view signals, train models, run evaluations, export data |
| ADMIN | System administrator | User management, system config, audit log access, all roles |

### 3.2 Permission Enforcement
- Every API endpoint checks permissions.
- Resource-level authorization: clinicians can only access assigned patients.
- Patient REST and WebSocket access is restricted to sessions whose `patient_id` resolves to the authenticated user's Patient row. Patient session creation requires the clinician-managed `patients.participant_id` enrollment link.
- Researchers can only access datasets they created or are collaborators on.
- Audit log records authorization failures.

### 3.3 Permission Matrix (Summary)

| Action | Patient | Clinician | Researcher | Admin |
|--------|---------|-----------|------------|-------|
| Own session data | Read | Read (assigned) | Read (dataset) | Read |
| Create session | Create | Create | Create | Create |
| View signal quality | Own only | Assigned | Dataset | All |
| Manage exercises | None | Assigned | Read | All |
| Train models | None | None | Create | Create |
| Run evaluation | None | None | Create | Create |
| Manage users | None | None | None | Create/Update/Delete |
| View audit logs | None | Own actions | Dataset actions | All |

## 4. Data Protection

### 4.1 Pseudonymization
- Research participants assigned stable pseudonymous IDs (`SUBJ-001`).
- PII (name, DOB, contact) stored in `users` and `patients` tables, **separate** from physiological research data.
- Exportable research datasets contain **only** pseudonymous IDs.
- Linkage between pseudonymous IDs and PII requires admin-level access and is audit logged.

### 4.2 Encryption
- **At rest**: PostgreSQL disk encryption (platform-managed or LUKS). Sensitive JSONB fields may use application-level encryption for highly regulated deployments.
- **In transit**: TLS 1.3 for all HTTP/WebSocket connections. No plaintext HTTP in production.
- **Backups**: Encrypted backups with access control.

### 4.3 Data Retention
- Raw recordings: per IRB policy.
- Predictions and audit logs: retained indefinitely for reproducibility.
- Right-to-erasure: participants may request removal; deletion pipeline respects referential integrity and audit requirements.

## 5. Input Validation & Injection Prevention

### 5.1 API Layer
- Pydantic schema validation on all inputs.
- Type enforcement: timestamps, UUIDs, enums, numeric ranges.
- Query parameter limits and pagination to prevent resource exhaustion.

### 5.2 Sensor Data
- Validate file formats, headers, and channel counts on ingestion.
- Reject malformed files with structured error responses.
- Size limits on uploads.
- Timeout and circuit breaker for external sensor connections.

### 5.3 SQL Injection
- Use ORM (SQLAlchemy) with parameterized queries exclusively.
- No raw SQL with user input.

### 5.4 XSS/CSRF
- React handles XSS by default (JSX escaping).
- CSRF tokens for state-changing operations in production.
- Content-Security-Policy headers.

## 6. Audit Logging

### 6.1 Logged Events
- Authentication: login, logout, failed login, password reset.
- Authorization failures.
- Data access: read, create, update, delete on all tables.
- Model operations: training started/completed, evaluation runs, predictions.
- Configuration changes: exercise updates, dataset splits, model promotion.
- System events: backup, migration, deployment.

### 6.2 Log Integrity
- Append-only audit table.
- No update or delete operations on `audit_logs`.
- Optional write-only database user for audit inserts.
- Periodic export to immutable storage (WORM or signed logs).

### 6.3 Log Content
- `user_id` (or system)
- `action`
- `resource_type`
- `resource_id`
- `metadata` (JSONB for flexibility)
- `timestamp`
- `ip_address`
- `user_agent`

## 7. Infrastructure Security

### 7.1 Container Security
- Minimal base images (e.g., `python:3.11-slim`).
- Non-root user in containers.
- No secrets in Docker images or environment variables in plaintext (use Docker secrets or vault).
- Regular image scanning for CVEs.

### 7.2 Network
- Internal services communicate via Docker network; not exposed to public internet except gateway.
- Rate limiting on public API endpoints.
- WebSocket connection limits and authentication.

### 7.3 Secrets Management
- API keys, database passwords, JWT secrets stored in environment variables injected at runtime.
- For production, use a secrets manager (e.g., HashiCorp Vault, AWS Secrets Manager).
- Never commit secrets to version control.

## 8. Compliance & Research Ethics

### 8.1 IRB / Ethics Board
- System designed to support IRB requirements.
- Audit trail for all data access.
- Consent tracking (`research_participants.consent_status`).
- Right-to-erasure workflow.

### 8.2 Data Minimization
- Only collect data necessary for research protocol.
- Separate PII from research data.
- Pseudonymous IDs used in all research exports.

### 8.3 Incident Response
- Security incident response plan documented.
- Breach notification procedures aligned with institutional policy.
- Regular security reviews.

## 9. Security Checklist for Phase 2

- [x] Password hashing strategy implemented
- [x] RBAC roles implemented
- [x] Audit log schema implemented
- [x] Pseudonymization strategy implemented
- [x] Input validation implemented
- [x] CORS configuration implemented
- [x] JWT authentication implemented
- [x] Authorization middleware implemented
- [x] Audit logging service implemented
- [x] Final test set locking implemented
- [x] Synthetic data labeling implemented
- [ ] HTTPS/WSS in production (documented, not enforced in dev)
- [ ] Rate limiting on public endpoints (architecture defined)
- [ ] Penetration testing (Phase 3+)
- [ ] Formal security audit (Phase 3+)

## Implemented hardening details

Privileged registration requires an administrator. Refresh tokens cannot authenticate as access tokens. WebSocket and research routes check session relationships and locked final-test status. Request bodies are bounded at 16 MiB and audio streams at 60 seconds of PCM16. Sensor sources use exclusive creation and are committed with their digest and audit record; failed commits roll back metadata and remove the new source. Production settings require a non-development JWT secret and `postgresql+asyncpg`. TLS/WSS termination, edge rate limiting, secret rotation, penetration testing, and institutional privacy review remain deployment responsibilities.
