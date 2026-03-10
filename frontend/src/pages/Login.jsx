import { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function Login() {
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || "/api";

  const [mode, setMode]       = useState("signin"); // "signin" | "signup"
  const [email, setEmail]     = useState("");
  const [password, setPass]   = useState("");
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      if (mode === "signup") {
        const { error: err } = await signUp(email, password);
        if (err) { setError(err.message); setLoading(false); return; }
        setSuccess("Account created! Check your email to confirm, then sign in.");
        setMode("signin");
        setLoading(false);
        return;
      }

      const { error: err } = await signIn(email, password);
      if (err) { setError(err.message); setLoading(false); return; }
      navigate(from, { replace: true });
    } catch (e) {
      setError(e.message || "Unexpected error");
      setLoading(false);
    }
  }

  return (
    <div className="login-root">
      {/* Background rings */}
      <div className="login-ring login-ring-1" />
      <div className="login-ring login-ring-2" />
      <div className="login-ring login-ring-3" />

      <div className="login-card">
        {/* Logo */}
        <div className="login-logo">
          <div className="login-logo-icon">
            <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
              <circle cx="18" cy="18" r="17" stroke="var(--accent)" strokeWidth="1.5" />
              <ellipse cx="18" cy="18" rx="17" ry="7" stroke="var(--accent)" strokeWidth="1.5" opacity="0.4" />
              <circle cx="18" cy="18" r="3" fill="var(--accent)" />
              <circle cx="29" cy="13" r="1.5" fill="#f87171" />
            </svg>
          </div>
          <span className="login-logo-text">SpaceDebrisAI</span>
        </div>

        <h1 className="login-title">
          {mode === "signin" ? "Welcome back" : "Create account"}
        </h1>
        <p className="login-sub">
          {mode === "signin"
            ? "Sign in to access your API key and dashboard."
            : "Sign up to generate your free API key."}
        </p>

        {success && <div className="login-success">{success}</div>}
        {error   && <div className="login-error">{error}</div>}

        <form onSubmit={handleSubmit} className="login-form">
          <div className="login-field">
            <label className="login-label">Email</label>
            <input
              type="email"
              className="login-input"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div className="login-field">
            <label className="login-label">Password</label>
            <input
              type="password"
              className="login-input"
              placeholder={mode === "signup" ? "Min. 6 characters" : "Your password"}
              value={password}
              onChange={(e) => setPass(e.target.value)}
              required
              minLength={6}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
            />
          </div>
          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? (
              <span className="login-spinner" />
            ) : mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>

        <div className="login-switch">
          {mode === "signin" ? (
            <>Don&apos;t have an account?{" "}
              <button className="login-link-btn" onClick={() => { setMode("signup"); setError(""); }}>Sign up free</button>
            </>
          ) : (
            <>Already have an account?{" "}
              <button className="login-link-btn" onClick={() => { setMode("signin"); setError(""); }}>Sign in</button>
            </>
          )}
        </div>

        <div className="login-back">
          <Link to="/" className="login-back-link">← Back to dashboard</Link>
        </div>
      </div>
    </div>
  );
}
