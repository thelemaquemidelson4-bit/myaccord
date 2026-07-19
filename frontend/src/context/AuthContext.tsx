import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { Platform } from "react-native";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { storage } from "@/src/utils/storage";
import { api, TOKEN_KEY, User } from "@/src/api/client";

type AuthState = {
  user: User | null;
  loading: boolean;
  register: (email: string, password: string, name: string, role: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: (role?: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  setUser: (u: User) => void;
};

const AuthContext = createContext<AuthState>({} as AuthState);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const persist = useCallback(async (token: string, u: User) => {
    await storage.secureSet(TOKEN_KEY, token);
    setUserState(u);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const token = await storage.secureGet<string>(TOKEN_KEY, "");
      if (!token) {
        setUserState(null);
        return;
      }
      const data = await api.get("/auth/me");
      setUserState(data.user);
    } catch {
      await storage.secureRemove(TOKEN_KEY);
      setUserState(null);
    }
  }, []);

  useEffect(() => {
    (async () => {
      await refresh();
      setLoading(false);
    })();
  }, [refresh]);

  // Presence heartbeat: mark the user online while the app is open.
  useEffect(() => {
    if (!user) return;
    let active = true;
    const beat = () => { api.post("/presence").catch(() => {}); };
    beat();
    const t = setInterval(() => { if (active) beat(); }, 20000);
    return () => { active = false; clearInterval(t); };
  }, [user]);

  const register = useCallback(async (email: string, password: string, name: string, role: string) => {
    const data = await api.post("/auth/register", { email, password, name, role }, false);
    await persist(data.token, data.user);
  }, [persist]);

  const login = useCallback(async (email: string, password: string) => {
    const data = await api.post("/auth/login", { email, password }, false);
    await persist(data.token, data.user);
  }, [persist]);

  const processSessionId = useCallback(async (sessionId: string, role?: string) => {
    const res = await fetch(
      "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
      { headers: { "X-Session-ID": sessionId } }
    );
    if (!res.ok) throw new Error("Échec de la connexion Google");
    const sd = await res.json();
    const data = await api.post("/auth/google/session", { session_token: sd.session_token, role }, false);
    await persist(data.token, data.user);
  }, [persist]);

  const loginWithGoogle = useCallback(async (role?: string) => {
    const redirectUrl =
      Platform.OS === "web" ? window.location.origin + "/" : Linking.createURL("");
    const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
    if (Platform.OS === "web") {
      window.location.href = authUrl;
      return;
    }
    const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
    if (result.type !== "success" || !result.url) return;
    const url = result.url;
    let sessionId: string | null = null;
    const hashMatch = url.match(/[#&]session_id=([^&]+)/);
    const queryMatch = url.match(/[?&]session_id=([^&]+)/);
    if (hashMatch) sessionId = decodeURIComponent(hashMatch[1]);
    else if (queryMatch) sessionId = decodeURIComponent(queryMatch[1]);
    if (!sessionId) throw new Error("Session Google introuvable");
    await processSessionId(sessionId, role);
  }, [processSessionId]);

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } catch {}
    await storage.secureRemove(TOKEN_KEY);
    setUserState(null);
  }, []);

  const setUser = useCallback((u: User) => setUserState(u), []);

  return (
    <AuthContext.Provider
      value={{ user, loading, register, login, loginWithGoogle, logout, refresh, setUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}
