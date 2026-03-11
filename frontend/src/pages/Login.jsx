import { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function Login() {
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || "/api";

  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPass] = useState("");
  const [error, setError] = useState("");
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
        if (err) {
          setError(err.message);
          setLoading(false);
          return;
        }
        // Try to sign in immediately (works when email confirmation is disabled)
        const { error: signInErr } = await signIn(email, password);
        if (!signInErr) {
          navigate(from, { replace: true });
          return;
        }
        setSuccess("Account created! Check your email to confirm, then sign in.");
        setMode("signin");
        setLoading(false);
        return;
      }

      const { error: err } = await signIn(email, password);
      if (err) {
        setError(err.message);
        setLoading(false);
        return;
      }
      navigate(from, { replace: true });
    } catch (e) {
      setError(e.message || "Unexpected error");
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

      <div className="login-shell">
        <section className="login-showcase">
          <p className="login-eyebrow">Developer access</p>
          <h1 className="login-display-title">Access the debris monitoring API with free and paid tiers.</h1>
          <p className="login-copy">
            Create a free account to keep your API key attached to your profile and access the public
            500-object tier. The backend now keeps a 34k+ local debris TLE catalog from Space-Track,
            and the announced paid tier expands access to 10k+ objects with 5-second polling.
          </p>

          <div className="login-stat-row">
            <div className="login-stat-card">
              <strong>500</strong>
              <span>Public objects</span>
            </div>
            <div className="login-stat-card">
              <strong>34k+</strong>
              <span>Cached TLE records</span>
            </div>
            <div className="login-stat-card">
              <strong>$10</strong>
              <span>Paid tier</span>
            </div>
          </div>

          <div className="login-feature-list">
            <div className="login-feature-item">
              <span className="login-feature-mark">01</span>
              <div>
                <h2>Saved keys</h2>
                <p>Signed-in users can regenerate or revoke keys without losing access on another device.</p>
              </div>
            </div>
            <div className="login-feature-item">
              <span className="login-feature-mark">02</span>
              <div>
                <h2>Debris cache</h2>
                <p>Public API responses are backed by a 34k+ cached TLE catalog refreshed from Space-Track.</p>
              </div>
            </div>
            <div className="login-feature-item">
              <span className="login-feature-mark">03</span>
              <div>
                <h2>Paid scale</h2>
                <p>The announced paid tier targets 10k+ objects for $10 per month with a 5-second polling cadence.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="login-card-wrap">
          <div className="login-card">
            <p className="login-card-tag">{mode === "signin" ? "Account access" : "Free API onboarding"}</p>

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
                ? "Sign in to manage your public-tier API key and dashboard access."
                : "Sign up to generate your free public-tier API key."}
            </p>

            {success && <div className="login-success">{success}</div>}
            {error && <div className="login-error">{error}</div>}

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
                <>
                  Don&apos;t have an account?{" "}
                  <button className="login-link-btn" onClick={() => { setMode("signup"); setError(""); }}>
                    Sign up free
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{" "}
                  <button className="login-link-btn" onClick={() => { setMode("signin"); setError(""); }}>
                    Sign in
                  </button>
                </>
              )}
            </div>

            <div className="login-back">
              <Link to="/" className="login-back-link">&lt; Back to dashboard</Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
