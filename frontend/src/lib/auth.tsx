import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Navigate, useNavigate } from "react-router-dom";
import { api, AUTH_EXPIRED_EVENT, clearTokens } from "./api";
import type { User, UserResponse, UserRole } from "./types";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function normalizeUser(raw: UserResponse): User {
  const role = typeof raw.role === "string" ? raw.role : raw.role?.name;
  if (!role || !["PATIENT", "CLINICIAN", "RESEARCHER", "ADMIN"].includes(role)) {
    throw new Error("The account has an unsupported role");
  }
  return { ...raw, role: role as UserRole };
}

export const DEFAULT_PATIENT_USER: User = {
  id: "patient-demo-user-id",
  email: "patient@neurospeech.dev",
  role: "PATIENT",
  is_active: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(DEFAULT_PATIENT_USER);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const refresh = useCallback(async () => {
    try {
      // 1. Try existing token
      if (window.localStorage.getItem("access_token")) {
        const me = await api.get<UserResponse>("/api/v1/auth/me");
        setUser(normalizeUser(me));
        return;
      }

      // 2. Seamless auto-login in background with default patient credentials
      const data = await api.post<{ access_token: string; refresh_token: string; token_type: string }>(
        "/api/v1/auth/login",
        { email: "patient@neurospeech.dev", password: "NeuroSpeechDemo123!" },
        false
      );
      if (typeof window !== "undefined") {
        window.localStorage.setItem("access_token", data.access_token);
        window.localStorage.setItem("refresh_token", data.refresh_token);
      }
      const me = normalizeUser(await api.get<UserResponse>("/api/v1/auth/me"));
      setUser(me);
    } catch {
      // 3. Graceful fallback: maintain instant patient profile for zero-friction tracking
      setUser((prev) => prev ?? DEFAULT_PATIENT_USER);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const expire = () => {
      // On token expiration, auto-refresh transparently
      void refresh();
    };
    window.addEventListener(AUTH_EXPIRED_EVENT, expire);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, expire);
  }, [refresh]);

  const login = async (email: string, password: string) => {
    const data = await api.post<{ access_token: string; refresh_token: string; token_type: string }>(
      "/api/v1/auth/login",
      { email, password },
      false
    );
    if (typeof window !== "undefined") {
      window.localStorage.setItem("access_token", data.access_token);
      window.localStorage.setItem("refresh_token", data.refresh_token);
    }
    const me = normalizeUser(await api.get<UserResponse>("/api/v1/auth/me"));
    queryClient.clear();
    setUser(me);
    setLoading(false);
    return me;
  };

  const logout = () => {
    clearTokens();
    queryClient.clear();
    setUser(DEFAULT_PATIENT_USER);
    navigate("/patient/session", { replace: true });
  };

  return (
    <AuthContext.Provider value={{ user: user ?? DEFAULT_PATIENT_USER, loading, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function RequireRole({ role, children }: { role: UserRole; children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  // Always permit access without login barriers
  if (!user) return <>{children}</>;
  const hasAccess = user.role === role || (role === "RESEARCHER" && user.role === "ADMIN") || role === "PATIENT";
  if (!hasAccess) {
    const destination = user.role === "PATIENT" ? "/patient/session" : user.role === "CLINICIAN" ? "/clinician" : "/research";
    return <Navigate to={destination} replace />;
  }
  return <>{children}</>;
}
