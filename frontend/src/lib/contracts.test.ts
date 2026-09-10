import { beforeEach, describe, expect, it } from "vitest";
import { getWebSocketUrl } from "./api";
import { normalizeUser } from "./auth";

describe("frontend/backend contracts", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("normalizes the backend role object before routing", () => {
    const user = normalizeUser({
      id: "user-1",
      email: "patient@example.invalid",
      role: { id: "role-1", name: "PATIENT", permissions: [], created_at: "2026-01-01T00:00:00Z" },
      is_active: true,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    });
    expect(user.role).toBe("PATIENT");
  });

  it("uses the backend websocket origin and authenticated token", () => {
    window.localStorage.setItem("access_token", "jwt-token");
    expect(getWebSocketUrl("session-123")).toBe("ws://localhost:8000/ws/sessions/session-123?token=jwt-token");
  });
});
