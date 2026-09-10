import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api, AUTH_EXPIRED_EVENT, clearTokens } from "./api";
import type { User, UserResponse, UserRole } from "./types";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  loginAsDemo: (role?: UserRole) => User;
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

const DEFAULT_USER: User = {
  id: "patient-user-1",
  email: "patient@neurospeech.local",
  role: "PATIENT",
  is_active: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User>(() => {
    if (typeof window !== "undefined") {
      const stored = window.localStorage.getItem("neurospeech_demo_user");
      if (stored) {
        try {
          return JSON.parse(stored) as User;
        } catch {
          /* ignore */
        }
      }
    }
    return DEFAULT_USER;
  });
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();

  const refresh = useCallback(async () => {
    try {
      const token = window.localStorage.getItem("access_token");
      if (!token) {
        setUser(DEFAULT_USER);
        return;
      }
      if (token.startsWith("demo_token_")) {
        const storedDemo = window.localStorage.getItem("neurospeech_demo_user");
        if (storedDemo) {
          try {
            const parsed = JSON.parse(storedDemo) as User;
            setUser(parsed);
            return;
          } catch {
            /* ignore JSON parse error */
          }
        }
        const roleStr = token.replace("demo_token_", "").toUpperCase();
        const role = ["PATIENT", "CLINICIAN", "RESEARCHER", "ADMIN"].includes(roleStr) ? (roleStr as UserRole) : "PATIENT";
        const demoUser: User = {
          id: `demo-${role.toLowerCase()}-id`,
          email: `${role.toLowerCase()}@neurospeech.local`,
          role,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        setUser(demoUser);
        return;
      }
      setUser(normalizeUser(await api.get<UserResponse>("/api/v1/auth/me")));
    } catch {
      setUser(DEFAULT_USER);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const expire = () => {
      clearTokens();
      setUser(DEFAULT_USER);
    };
    window.addEventListener(AUTH_EXPIRED_EVENT, expire);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, expire);
  }, [refresh]);

  const loginAsDemo = useCallback((role: UserRole = "PATIENT"): User => {
    const demoUser: User = {
      id: `demo-${role.toLowerCase()}-id`,
      email: `${role.toLowerCase()}@neurospeech.local`,
      role,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    if (typeof window !== "undefined") {
      window.localStorage.setItem("access_token", `demo_token_${role.toLowerCase()}`);
      window.localStorage.setItem("refresh_token", `demo_refresh_${role.toLowerCase()}`);
      window.localStorage.setItem("neurospeech_demo_user", JSON.stringify(demoUser));
    }
    queryClient.clear();
    setUser(demoUser);
    setLoading(false);
    return demoUser;
  }, [queryClient]);

  const login = async (email: string, password: string) => {
    const data = await api.post<{ access_token: string; refresh_token: string; token_type: string }>(
      "/api/v1/auth/login",
      { email, password },
      false
    );
    if (typeof window !== "undefined") {
      window.localStorage.setItem("access_token", data.access_token);
      window.localStorage.setItem("refresh_token", data.refresh_token);
      window.localStorage.removeItem("neurospeech_demo_user");
    }
    const me = normalizeUser(await api.get<UserResponse>("/api/v1/auth/me"));
    queryClient.clear();
    setUser(me);
    setLoading(false);
    return me;
  };

  const logout = () => {
    clearTokens();
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("neurospeech_demo_user");
    }
    queryClient.clear();
    setUser(DEFAULT_USER);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, loginAsDemo, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function RequireRole({ children }: { role?: UserRole; children: React.ReactNode }) {
  // Authentication requirement removed: all routes are directly accessible
  return <>{children}</>;
}
