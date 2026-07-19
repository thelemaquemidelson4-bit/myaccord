import { storage } from "@/src/utils/storage";

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;
export const TOKEN_KEY = "scoutmoi_session_token";

type Options = {
  method?: string;
  body?: any;
  auth?: boolean;
};

async function request<T = any>(path: string, opts: Options = {}): Promise<T> {
  const { method = "GET", body, auth = true } = opts;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (auth) {
    const token = await storage.secureGet<string>(TOKEN_KEY, "");
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    const message = data?.detail || "Une erreur est survenue";
    throw new Error(typeof message === "string" ? message : "Une erreur est survenue");
  }
  return data as T;
}

export const api = {
  get: <T = any>(path: string) => request<T>(path),
  post: <T = any>(path: string, body?: any, auth = true) =>
    request<T>(path, { method: "POST", body, auth }),
  put: <T = any>(path: string, body?: any) => request<T>(path, { method: "PUT", body }),
  del: <T = any>(path: string) => request<T>(path, { method: "DELETE" }),
};

export type User = {
  user_id: string;
  email: string;
  name: string;
  role: "player" | "recruiter" | null;
  photo?: string | null;
  bio?: string | null;
  location?: string | null;
  sport?: string | null;
  position?: string | null;
  level?: string | null;
  age?: number | null;
  gender?: string | null;
  height?: number | null;
  weight?: number | null;
  stats?: Record<string, any>;
  videos?: string[];
  club_name?: string | null;
  ai_summary?: string | null;
};
