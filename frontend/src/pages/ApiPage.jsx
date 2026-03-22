import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import ProTierBanner from "../components/ProTierBanner";
import {
  ACTIVE_API_KEY_STORAGE_KEY,
  API_TERMS_STORAGE_KEY,
  GUEST_API_KEY_STORAGE_KEY,
  GUEST_EMAIL_STORAGE_KEY,
  fetchApiKeyPolicy,
  issueApiKey,
  revokeApiKey,
} from "../api/backend";

const BASE = (import.meta.env.VITE_API_URL ?? "https://virenn77-spacedebrisai.hf.space").replace(/\/+$/, "");
const LEGACY_CUTOFF = "March 22, 2026";
const PUBLIC_OBJECT_COUNT = 500;
const CACHED_DEBRIS_COUNT = "33k+";

const ENDPOINTS = [
  { method: "GET", path: "/health", auth: false, desc: "Check whether the backend is online.", response: { status: "ok", version: "2.0.0" } },
  { method: "GET", path: "/satellites", auth: true, desc: "Geodetic positions for the current public slice.", response: { count: 414, errors: 0, satellites: [{ name: "THOR ABLESTAR DEB", lat: 24.18, lon: 109.33, alt_km: 455.8 }] } },
  { method: "GET", path: "/simulate", auth: true, desc: "Cached proximity simulation across the current public slice.", response: { mode: "local", meta: { public_objects: 500, tle_records: 33338 }, closest_pairs: [{ satellites: ["A", "B"], before: { distance_km: 3.12, risk: { level: "CRITICAL" } } }] } },
  { method: "GET", path: "/tracker/positions", auth: true, desc: "Tracker positions computed from the backend TLE cache.", response: { source: "cache", satellites: [{ noradId: 25544, name: "ISS (ZARYA)", lat: 51.62, lon: -12.4, alt: 408.5 }] } },
  { method: "GET", path: "/docs", auth: false, isLink: true, desc: "Swagger and OpenAPI documentation.", response: null },
];

const METHOD_COLOR = { GET: "#22c55e", POST: "#38bdf8" };

function storeVerifiedKey(key, email, termsVersion) {
  localStorage.setItem(ACTIVE_API_KEY_STORAGE_KEY, key);
  localStorage.setItem(API_TERMS_STORAGE_KEY, termsVersion);
  localStorage.setItem(GUEST_API_KEY_STORAGE_KEY, key);
  localStorage.setItem(GUEST_EMAIL_STORAGE_KEY, email);
}

function clearStoredKey() {
  localStorage.removeItem(ACTIVE_API_KEY_STORAGE_KEY);
  localStorage.removeItem(API_TERMS_STORAGE_KEY);
  localStorage.removeItem(GUEST_API_KEY_STORAGE_KEY);
  localStorage.removeItem(GUEST_EMAIL_STORAGE_KEY);
}

export default function ApiPage() {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();

  const [apiKey, setApiKey] = useState("");
  const [keyId, setKeyId] = useState(null);
  const [guestKey, setGuestKey] = useState(() => localStorage.getItem(GUEST_API_KEY_STORAGE_KEY) || "");
  const [guestEmail, setGuestEmail] = useState(() => localStorage.getItem(GUEST_EMAIL_STORAGE_KEY) || "");
  const [keyLoading, setKeyLoading] = useState(false);
  const [keyError, setKeyError] = useState("");
  const [copied, setCopied] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [expanded, setExpanded] = useState({});
  const [codeLang, setCodeLang] = useState("python");
  const [showWarnModal, setShowWarnModal] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [emailError, setEmailError] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsVersion, setTermsVersion] = useState("");

  const activeKey = user ? apiKey : guestKey;
  const activeEmail = user?.email ?? guestEmail;
  const hasAccess = Boolean(activeKey);
  const verifiedKey =
    Boolean(activeKey) &&
    localStorage.getItem(ACTIVE_API_KEY_STORAGE_KEY) === activeKey &&
    localStorage.getItem(API_TERMS_STORAGE_KEY) === termsVersion;

  useEffect(() => {
    fetchApiKeyPolicy()
      .then((policy) => {
        setTermsVersion(policy.terms_version);
        setTermsAccepted(localStorage.getItem(API_TERMS_STORAGE_KEY) === policy.terms_version);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!user || !supabase) return;
    supabase
      .from("api_keys")
      .select("id, key")
      .eq("user_id", user.id)
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setApiKey(data.key);
          setKeyId(data.id);
        }
      });
  }, [user]);

  async function persistAccountKey(key) {
    if (!user || !supabase) return;
    if (keyId) {
      await supabase.from("api_keys").update({ active: false }).eq("id", keyId);
    }
    const { data } = await supabase
      .from("api_keys")
      .insert({ user_id: user.id, key, active: true })
      .select("id, key")
      .single();
    if (data) {
      setApiKey(data.key);
      setKeyId(data.id);
    }
  }

  async function createKey(email, ownerId = null) {
    if (!termsAccepted || !termsVersion) {
      setKeyError("Read and accept the polling terms before generating a key.");
      return null;
    }
    const issued = await issueApiKey({
      email,
      owner_id: ownerId,
      accepted_terms: true,
      label: ownerId ? "account" : "guest",
    });
    storeVerifiedKey(issued.key, email, issued.terms_version);
    setGuestKey(issued.key);
    setGuestEmail(email);
    return issued;
  }

  async function handleGenerateKey() {
    if (!user?.email) return;
    setKeyLoading(true);
    setKeyError("");
    try {
      const issued = await createKey(user.email, user.id);
      if (!issued) return;
      await persistAccountKey(issued.key);
      setApiKey(issued.key);
    } catch (error) {
      setKeyError(error.message);
    } finally {
      setKeyLoading(false);
    }
  }

  async function handleGuestGenerate() {
    const trimmed = emailInput.trim().toLowerCase();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setEmailError("Please enter a valid email address.");
      return;
    }
    setKeyLoading(true);
    setKeyError("");
    try {
      const issued = await createKey(trimmed);
      if (!issued) return;
      setGuestKey(issued.key);
      setGuestEmail(trimmed);
      setShowWarnModal(false);
      setEmailInput("");
      setEmailError("");
    } catch (error) {
      setKeyError(error.message);
    } finally {
      setKeyLoading(false);
    }
  }

  async function handleRevoke() {
    if (!activeKey) return;
    setKeyLoading(true);
    setKeyError("");
    try {
      await revokeApiKey(activeKey);
      if (user && supabase && keyId) {
        await supabase.from("api_keys").update({ active: false }).eq("id", keyId);
      }
      setApiKey("");
      setKeyId(null);
      setGuestKey("");
      setGuestEmail("");
      clearStoredKey();
    } catch (error) {
      setKeyError(error.message);
    } finally {
      setKeyLoading(false);
    }
  }

  function copy(text, setter) {
    navigator.clipboard.writeText(text).then(() => {
      setter(true);
      setTimeout(() => setter(false), 2000);
    });
  }

  const displayKey = activeKey || "sdai_xxxxxxxxxxxxxxxxxxxxxxxx_live";
  const LANG_CODE = {
    python: `import requests

API_KEY = "${displayKey}"
BASE = "${BASE}"
headers = {"X-API-Key": API_KEY}

print(requests.get(f"{BASE}/satellites", headers=headers).json()["satellites"][:3])`,
    javascript: `const BASE = "${BASE}";
const headers = { "X-API-Key": "${displayKey}" };

const data = await fetch(\`\${BASE}/tracker/positions\`, { headers }).then((r) => r.json());
console.log(data.satellites.slice(0, 3));`,
    curl: `curl -H "X-API-Key: ${displayKey}" ${BASE}/simulate | jq '{mode,meta}'`,
  };

  if (authLoading) {
    return <div className="ap-loading-gate"><div className="spinner" /><p>Loading...</p></div>;
  }

  return (
    <div className="ap-root">
      {showWarnModal && (
        <div className="ap-modal-overlay" onClick={() => setShowWarnModal(false)}>
          <div className="ap-modal" onClick={(event) => event.stopPropagation()}>
            <div className="ap-modal-icon">!</div>
            <h3 className="ap-modal-title">Issue a monitored API key</h3>
            <p className="ap-modal-body">Guest keys stay in this browser only. Read the polling terms before you generate one.</p>
            <input
              className={`ap-modal-input${emailError ? " ap-input-error" : ""}`}
              type="email"
              placeholder="you@example.com"
              value={emailInput}
              onChange={(event) => {
                setEmailInput(event.target.value);
                setEmailError("");
              }}
            />
            {emailError && <p className="ap-modal-error">{emailError}</p>}
            <label className="ap-modal-body" style={{ display: "block", marginTop: 12 }}>
              <input type="checkbox" checked={termsAccepted} onChange={(event) => setTermsAccepted(event.target.checked)} />{" "}
              I accepted the <Link to="/api/terms" className="docs-link">polling terms</Link>.
            </label>
            <div className="ap-modal-actions">
              <button className="ap-btn-primary" onClick={handleGuestGenerate} disabled={keyLoading}>Generate my API key</button>
              <button className="ap-btn-text" onClick={() => setShowWarnModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <div className="ap-hero">
        <div className="ap-hero-glow ap-glow-1" />
        <div className="ap-hero-glow ap-glow-2" />
        <div className="ap-hero-inner">
          <div className="ap-hero-grid">
            <div className="ap-hero-copy">
              <p className="ap-eyebrow">Developer Access</p>
              <h1 className="ap-h1">SpaceDebrisAI<br /><span className="ap-h1-accent">Public API</span></h1>
              <p className="ap-sub">
                Real-time orbital positions, conjunction screening, and tracker data from a backend-managed cache.
                Every issued key is tied to the published fair-use terms and monitored for abusive polling.
              </p>
              <div className="ap-badges">
                <span className="ap-badge">REST</span>
                <span className="ap-badge">JSON</span>
                <span className="ap-badge">Backend-issued keys</span>
                <span className="ap-badge ap-badge-live">Auto-ban enabled</span>
              </div>
              <div className="ap-hero-actions">
                <a className="ap-btn-primary ap-hero-btn" href="#api-key-section">{hasAccess ? "View your API key" : "Get API key"}</a>
                <Link className="ap-btn-outline ap-hero-btn" to="/api/terms">Read terms</Link>
              </div>
              {activeEmail && (
                <div className="ap-user-pill">
                  <span className="ap-user-pill-email">{activeEmail}</span>
                  {user ? <button className="ap-signout-btn" onClick={signOut}>Sign out</button> : <button className="ap-signout-btn" onClick={handleRevoke}>Clear key</button>}
                  {!user && <span className="ap-guest-badge">Guest</span>}
                </div>
              )}
            </div>

            <div className="ap-hero-panel">
              <div className="ap-hero-kpis">
                <div className="ap-hero-kpi"><span className="ap-hero-kpi-value">{PUBLIC_OBJECT_COUNT}</span><span className="ap-hero-kpi-label">public objects</span></div>
                <div className="ap-hero-kpi"><span className="ap-hero-kpi-value">{CACHED_DEBRIS_COUNT}</span><span className="ap-hero-kpi-label">cached TLE records</span></div>
                <div className="ap-hero-kpi"><span className="ap-hero-kpi-value">10s</span><span className="ap-hero-kpi-label">min poll interval</span></div>
                <div className="ap-hero-kpi"><span className="ap-hero-kpi-value">60</span><span className="ap-hero-kpi-label">req / min</span></div>
              </div>
              <div className="ap-hero-request">
                <p className="ap-label">Quick request</p>
                <pre className="ap-pre ap-hero-pre">{`curl -H "X-API-Key: ${displayKey}" \\\n  ${BASE}/tracker/positions`}</pre>
              </div>
              <div className="ap-hero-list">
                <div className="ap-hero-list-item">Keys are generated by the backend, not the browser.</div>
                <div className="ap-hero-list-item">Polling terms must be accepted before key issuance.</div>
                <div className="ap-hero-list-item">Repeated over-polling triggers automatic bans.</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="ap-body">
        <section className="ap-section" id="api-key-section">
          <div className="ap-section-label-row">
            <span className="ap-section-num">01</span>
            <div className="ap-section-heading">
              <h2 className="ap-section-title">Your API key</h2>
              <p className="ap-section-copy">Accept the polling terms, then issue a monitored key for account or guest use.</p>
            </div>
          </div>

          <div className="ap-key-card">
            <ProTierBanner />
            {keyError && <p className="ap-key-error">{keyError}</p>}
            <label className="ap-key-intro">
              <input type="checkbox" checked={termsAccepted} onChange={(event) => setTermsAccepted(event.target.checked)} />{" "}
              I have read and accept the <Link to="/api/terms" className="docs-link">polling terms</Link>.
            </label>
            {!verifiedKey && activeKey && (
              <p className="ap-key-error">Legacy key detected. Keys created before {LEGACY_CUTOFF} should be regenerated so backend enforcement can verify them.</p>
            )}
            {!hasAccess ? (
              <div className="ap-choice-gate">
                <div className="ap-cg-option ap-cg-primary">
                  <h3 className="ap-cg-title">Sign in free</h3>
                  <p className="ap-cg-body">Keep the key attached to your account and regenerate or revoke it later.</p>
                  <button className="ap-btn-primary ap-cg-btn" onClick={() => navigate("/login", { state: { from: "/api" } })}>Sign in / Create free account</button>
                </div>
                <div className="ap-cg-option ap-cg-guest">
                  <h3 className="ap-cg-title">Quick guest key</h3>
                  <p className="ap-cg-body">Stored in this browser only. Clear site data and it is gone.</p>
                  <button className="ap-btn-outline ap-cg-btn" onClick={() => setShowWarnModal(true)}>Continue without account</button>
                </div>
              </div>
            ) : (
              <>
                <p className="ap-key-intro">Include this value as the <code className="ap-inline-code">X-API-Key</code> header.</p>
                <div className="ap-key-display">
                  <div className="ap-key-active-dot" />
                  <span className="ap-key-value">{activeKey}</span>
                  <button className={`ap-btn-copy${copied ? " copied" : ""}`} onClick={() => copy(activeKey, setCopied)}>{copied ? "Copied" : "Copy"}</button>
                </div>
                <div className="ap-key-meta">
                  <span className="ap-key-meta-item">{verifiedKey ? "Verified" : "Needs regeneration"}</span>
                  <span className="ap-key-meta-sep">·</span>
                  <span className="ap-key-meta-item ap-key-meta-email">{activeEmail}</span>
                </div>
                <div className="ap-key-actions">
                  {user ? (
                    <button className="ap-btn-regen" onClick={handleGenerateKey} disabled={keyLoading}>{keyLoading ? "Working..." : "Regenerate"}</button>
                  ) : (
                    <button className="ap-btn-regen" onClick={() => setShowWarnModal(true)} disabled={keyLoading}>{keyLoading ? "Working..." : "Regenerate"}</button>
                  )}
                  <button className="ap-btn-revoke" onClick={handleRevoke} disabled={keyLoading}>Revoke key</button>
                </div>
              </>
            )}
            {user && !hasAccess && (
              <button className="ap-btn-primary ap-key-gen-btn" onClick={handleGenerateKey} disabled={keyLoading || !termsAccepted}>
                {keyLoading ? "Working..." : "Generate API key"}
              </button>
            )}
          </div>
        </section>

        <section className="ap-section">
          <div className="ap-section-label-row">
            <span className="ap-section-num">02</span>
            <div className="ap-section-heading">
              <h2 className="ap-section-title">Base URL</h2>
              <p className="ap-section-copy">All requests use the same production base URL and header convention.</p>
            </div>
          </div>
          <div className="ap-base-url-card">
            <span className="ap-env-pill">PRODUCTION</span>
            <code className="ap-base-code">{BASE}</code>
            <p className="ap-base-note">Authenticated requests should pass <code className="ap-inline-code">X-API-Key</code>.</p>
          </div>
        </section>

        <section className="ap-section">
          <div className="ap-section-label-row">
            <span className="ap-section-num">03</span>
            <div className="ap-section-heading">
              <h2 className="ap-section-title">Endpoints</h2>
              <p className="ap-section-copy">Current public API surface and sample payloads.</p>
            </div>
          </div>
          <div className="ap-endpoints">
            {ENDPOINTS.map((ep) => (
              <div key={ep.path} className={`ap-endpoint${expanded[ep.path] ? " ap-endpoint--open" : ""}`}>
                <button className="ap-endpoint-header" onClick={() => setExpanded((prev) => ({ ...prev, [ep.path]: !prev[ep.path] }))}>
                  <span className="ap-method" style={{ color: METHOD_COLOR[ep.method] }}>{ep.method}</span>
                  <span className="ap-path">{ep.path}</span>
                  <span className="ap-endpoint-desc-short">{ep.desc}</span>
                  <span className="ap-expand-icon">{expanded[ep.path] ? "-" : "+"}</span>
                </button>
                {expanded[ep.path] && (
                  <div className="ap-endpoint-body">
                    <p className="ap-endpoint-full-desc">{ep.desc}</p>
                    {ep.auth && <div className="ap-endpoint-auth-note">Header: <code className="ap-inline-code">X-API-Key: {displayKey}</code></div>}
                    {ep.isLink ? (
                      <a href={`${BASE}${ep.path}`} target="_blank" rel="noopener noreferrer" className="ap-btn-primary ap-docs-btn">Open Swagger UI</a>
                    ) : (
                      <>
                        <p className="ap-label">Example response</p>
                        <pre className="ap-pre">{JSON.stringify(ep.response, null, 2)}</pre>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="ap-section">
          <div className="ap-section-label-row">
            <span className="ap-section-num">04</span>
            <div className="ap-section-heading">
              <h2 className="ap-section-title">Code examples</h2>
              <p className="ap-section-copy">Starter requests for the monitored public tier.</p>
            </div>
          </div>
          <div className="ap-code-card">
            <div className="ap-code-tabs">
              {["python", "javascript", "curl"].map((lang) => (
                <button key={lang} className={`ap-code-tab${codeLang === lang ? " active" : ""}`} onClick={() => setCodeLang(lang)}>{lang}</button>
              ))}
              <button className="ap-btn-copy ap-code-copy" onClick={() => copy(LANG_CODE[codeLang], setCodeCopied)}>{codeCopied ? "Copied" : "Copy"}</button>
            </div>
            <pre className="ap-pre ap-code-body">{LANG_CODE[codeLang]}</pre>
          </div>
        </section>

        <section className="ap-section">
          <div className="ap-section-label-row">
            <span className="ap-section-num">05</span>
            <div className="ap-section-heading">
              <h2 className="ap-section-title">Fair use</h2>
              <p className="ap-section-copy">Public automation has explicit limits and server-side enforcement.</p>
            </div>
          </div>
          <div className="ap-limits-card">
            <div className="ap-limits-grid">
              <div className="ap-limit-item"><span className="ap-limit-val">60</span><span className="ap-limit-label">req / min</span></div>
              <div className="ap-limit-item"><span className="ap-limit-val">10s</span><span className="ap-limit-label">min polling interval</span></div>
              <div className="ap-limit-item"><span className="ap-limit-val">{PUBLIC_OBJECT_COUNT}</span><span className="ap-limit-label">public objects</span></div>
              <div className="ap-limit-item"><span className="ap-limit-val">3</span><span className="ap-limit-label">violations to auto-ban</span></div>
            </div>
            <p className="ap-limits-note">Read the <Link to="/api/terms" className="docs-link">polling terms</Link> before running scheduled jobs or external clients.</p>
          </div>
        </section>
      </div>
    </div>
  );
}
