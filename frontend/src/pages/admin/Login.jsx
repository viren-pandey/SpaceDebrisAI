import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";

const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL;
const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD;
const ADMIN_KEY = import.meta.env.VITE_ADMIN_KEY;

export default function AdminLogin() {
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (sessionStorage.getItem("bypass_authenticated") !== "true") {
      navigate("/admin/bypass");
    }
  }, [navigate]);

  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
      sessionStorage.setItem("admin_authenticated", "true");
      localStorage.setItem("admin_key", ADMIN_KEY);
      navigate("/admin");
    } else {
      setError("Invalid credentials");
      setLoading(false);
    }
  }

  return (
    <div className="login-root">
      <div className="login-ring login-ring-1" />
      <div className="login-ring login-ring-2" />
      <div className="login-ring login-ring-3" />
      <div className="login-grid-line login-grid-line-1" />
      <div className="login-grid-line login-grid-line-2" />

      <div className="login-shell" style={{ display: "flex", justifyContent: "center", alignItems: "center", maxWidth: "100%" }}>
        <div className="login-card" style={{ width: 400, maxWidth: "90vw" }}>
          <p className="login-card-tag">Admin sign-in</p>

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

          <h1 className="login-title">Admin access</h1>
          <p className="login-sub">Enter your administrator credentials to continue.</p>

          {error && <div className="login-error">{error}</div>}

          <form onSubmit={handleLogin} className="login-form">
            <div className="login-field">
              <label className="login-label">Email</label>
              <input
                type="email"
                className="login-input"
                placeholder="admin@example.com"
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
                placeholder="Your admin password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            <button type="submit" className="login-btn" disabled={loading}>
              {loading ? <span className="login-spinner" /> : "Sign in"}
            </button>
          </form>

          <div className="login-back">
            <Link to="/" className="login-back-link">&lt; Back to dashboard</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
