import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";

const BYPASS_CODE = "bypass2026";

export default function Bypass() {
  const navigate = useNavigate();
  const [value, setValue] = useState("");
  const [shake, setShake] = useState(false);
  const inputRef = useRef(null);

  function handleSubmit(e) {
    e.preventDefault();
    if (value === BYPASS_CODE) {
      sessionStorage.setItem("bypass_authenticated", "true");
      navigate("/admin/login");
    } else {
      setShake(true);
      setTimeout(() => {
        setShake(false);
        setValue("");
        inputRef.current?.focus();
      }, 800);
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
          <p className="login-card-tag">Restricted area</p>

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

          <h1 className="login-title">Bypass required</h1>
          <p className="login-sub">Enter the bypass phrase to proceed to admin sign-in.</p>

          <form onSubmit={handleSubmit} className="login-form">
            <div className="login-field">
              <label className="login-label">Bypass phrase</label>
              <input
                ref={inputRef}
                type="password"
                className={`login-input${shake ? " login-input--shake" : ""}`}
                placeholder="Enter bypass code"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                autoComplete="off"
                spellCheck={false}
              />
            </div>
            <button type="submit" className="login-btn">
              Proceed
            </button>
          </form>

          <div className="login-back">
            <a href="/" className="login-back-link">&lt; Back to dashboard</a>
          </div>
        </div>
      </div>
    </div>
  );
}
