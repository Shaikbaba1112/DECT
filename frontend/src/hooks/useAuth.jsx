import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import api from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true);

  // ── On mount — check if tokens exist ────────────────────────────────────
  useEffect(() => {
    const access = localStorage.getItem("access_token");
    if (access) {
      // Parse user from stored data
      const stored = localStorage.getItem("dect_user");
      if (stored) {
        try {
          setUser(JSON.parse(stored));
        } catch {
          localStorage.clear();
        }
      }
      // Verify token is still valid
      api.get("/auth/me/")
        .then(res => {
          setUser(prev => ({ ...prev, ...res.data }));
          localStorage.setItem("dect_user", JSON.stringify(res.data));
        })
        .catch(() => {
          // Token invalid — clear
          localStorage.removeItem("access_token");
          localStorage.removeItem("refresh_token");
          localStorage.removeItem("dect_user");
          setUser(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  // ── Login ────────────────────────────────────────────────────────────────
  const login = useCallback(async (username, password) => {
    const res = await api.post("/auth/login/", { username, password });
    const { tokens, user: userData } = res.data;

    localStorage.setItem("access_token",  tokens.access);
    localStorage.setItem("refresh_token", tokens.refresh);
    localStorage.setItem("dect_user",     JSON.stringify(userData));

    setUser(userData);
    return userData.role;
  }, []);

  // ── Register ─────────────────────────────────────────────────────────────
  const register = useCallback(async (formData) => {
    try {
      const res = await api.post("/auth/register/", formData);
      const { tokens, user: userData } = res.data;

      localStorage.setItem("access_token",  tokens.access);
      localStorage.setItem("refresh_token", tokens.refresh);
      localStorage.setItem("dect_user",     JSON.stringify(userData));

      setUser(userData);
      return userData.role;
    } catch (err) {
      // Parse field errors from DRF
      if (err.response?.data) {
        const data = err.response.data;
        const fieldErrors = {};
        Object.keys(data).forEach(key => {
          fieldErrors[key] = Array.isArray(data[key])
            ? data[key][0]
            : data[key];
        });
        const error     = new Error("Validation failed.");
        error.fieldErrors = fieldErrors;
        throw error;
      }
      throw new Error("Registration failed.");
    }
  }, []);

  // ── Logout ───────────────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    const refresh = localStorage.getItem("refresh_token");
    try {
      if (refresh) {
        await api.post("/auth/logout/", { refresh });
      }
    } catch { /* ignore */ }
    finally {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      localStorage.removeItem("dect_user");
      setUser(null);
    }
  }, []);

  // ── Update user in context ────────────────────────────────────────────────
  const updateUser = useCallback((data) => {
    setUser(prev => {
      const updated = { ...prev, ...data };
      localStorage.setItem("dect_user", JSON.stringify(updated));
      return updated;
    });
  }, []);

  // ── Refresh profile from server ───────────────────────────────────────────
  const refreshProfile = useCallback(async () => {
    const res = await api.get("/auth/profile/");
    updateUser(res.data);
    return res.data;
  }, [updateUser]);

  const value = {
    user,
    loading,
    login,
    register,
    logout,
    updateUser,
    refreshProfile,
    isAuthenticated: !!user,
    isAdmin:    user?.role === "admin" || user?.is_staff,
    isProducer: user?.role === "producer" || user?.role === "both",
    isConsumer: user?.role === "consumer" || user?.role === "both",
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
