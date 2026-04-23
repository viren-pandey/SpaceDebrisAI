import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const OWNER_EMAIL = "pandeyviren68@gmail.com";
const OWNER_MODE_KEY = "sdai_is_owner";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null;
      setUser(u);
      const owner = Boolean(u?.email?.toLowerCase() === OWNER_EMAIL.toLowerCase());
      setIsOwner(owner);
      try { localStorage.setItem(OWNER_MODE_KEY, owner ? "1" : "0"); } catch {}
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      const owner = Boolean(u?.email?.toLowerCase() === OWNER_EMAIL.toLowerCase());
      setIsOwner(owner);
      try { localStorage.setItem(OWNER_MODE_KEY, owner ? "1" : "0"); } catch {}
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    try {
      if (user?.email) {
        localStorage.setItem("sdai_user_email", user.email);
      } else {
        localStorage.removeItem("sdai_user_email");
      }
    } catch {
      // localStorage may be unavailable in some environments
    }
  }, [user]);

  const signUp = (email, password) =>
    supabase ? supabase.auth.signUp({ email, password }) : Promise.reject(new Error("Supabase not configured"));

  const signIn = (email, password) =>
    supabase ? supabase.auth.signInWithPassword({ email, password }) : Promise.reject(new Error("Supabase not configured"));

  const signOut = () =>
    supabase ? supabase.auth.signOut() : Promise.resolve();

  return (
    <AuthContext.Provider value={{ user, loading, isOwner, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
