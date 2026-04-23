import { createContext, useContext, useEffect, useState } from "react";

const OWNER_EMAIL = "pandeyviren68@gmail.com";
const OWNER_MODE_KEY = "sdai_is_owner";
const TOKEN_KEY = "sdai_token";
const API_BASE = import.meta.env.VITE_API_URL || "https://virenn77-spacedebrisai.hf.space";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/auth/me`, { credentials: "include" })
      .then((res) => {
        if (!res.ok) return null;
        return res.json();
      })
      .then((data) => {
        if (data) {
          const u = { id: data.id, email: data.email, name: data.name };
          setUser(u);
          const owner = Boolean(data.email?.toLowerCase() === OWNER_EMAIL.toLowerCase());
          setIsOwner(owner);
          try { localStorage.setItem(OWNER_MODE_KEY, owner ? "1" : "0"); } catch {}
        }
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    try {
      if (user?.email) {
        localStorage.setItem("sdai_user_email", user.email);
      } else {
        localStorage.removeItem("sdai_user_email");
      }
    } catch {}
  }, [user]);

  const saveToken = (token) => {
    try { localStorage.setItem(TOKEN_KEY, token); } catch {}
  };

  const clearToken = () => {
    try { localStorage.removeItem(TOKEN_KEY); } catch {}
  };

  const signUp = async (email, password) => {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password, name: email.split("@")[0] }),
    });
    const data = await res.json();
    if (!res.ok) {
      const msg = data.error || data.detail || "Registration failed";
      return { error: { message: typeof msg === "string" ? msg : JSON.stringify(msg) } };
    }
    const u = { id: data.user.id, email: data.user.email, name: data.user.name };
    setUser(u);
    if (data.token) saveToken(data.token);
    const owner = Boolean(data.user.email?.toLowerCase() === OWNER_EMAIL.toLowerCase());
    setIsOwner(owner);
    try { localStorage.setItem(OWNER_MODE_KEY, owner ? "1" : "0"); } catch {}
    return { error: null, data };
  };

  const signIn = async (email, password) => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      const msg = data.error || data.detail || "Login failed";
      return { error: { message: typeof msg === "string" ? msg : JSON.stringify(msg) } };
    }
    const u = { id: data.user.id, email: data.user.email, name: data.user.name };
    setUser(u);
    if (data.token) saveToken(data.token);
    const owner = Boolean(data.user.email?.toLowerCase() === OWNER_EMAIL.toLowerCase());
    setIsOwner(owner);
    try { localStorage.setItem(OWNER_MODE_KEY, owner ? "1" : "0"); } catch {}
    return { error: null, data };
  };

  const signOut = async () => {
    await fetch(`${API_BASE}/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
    setUser(null);
    setIsOwner(false);
    clearToken();
    try { localStorage.removeItem(OWNER_MODE_KEY); } catch {}
  };

  return (
    <AuthContext.Provider value={{ user, loading, isOwner, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export function getAuthToken() {
  try { return localStorage.getItem(TOKEN_KEY) || ""; } catch { return ""; }
}
