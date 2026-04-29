import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { fetchPollUsage, fetchApiKeys, createApiKey } from "../../api/dashboard";
import DashboardLayout from "../../components/dashboard/DashboardLayout";

export default function Dashboard() {
  const { user, isOwner } = useAuth();
  const navigate = useNavigate();
  const [usage, setUsage] = useState(null);
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newKey, setNewKey] = useState(null);
  const [createLoading, setCreateLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [createLabel, setCreateLabel] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [hasDismissedKey, setHasDismissedKey] = useState(false);
  const hasDismissedKeyRef = useRef(false);

  useEffect(() => {
    if (!user) { navigate("/login", { state: { from: "/dashboard" } }); return; }
    try {
      setHasDismissedKey(JSON.parse(localStorage.getItem("sdai_key_dismissed") || "false"));
      hasDismissedKeyRef.current = true;
    } catch {}
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [user, navigate]);

  async function loadData() {
    try {
      const u = await fetchPollUsage();
      setUsage(u);
    } catch {}
    try {
      const k = await fetchApiKeys();
      setKeys(k);
    } catch {}
    setLoading(false);
  }

  async function handleCreateKey(e) {
    e?.preventDefault();
    setCreateLoading(true);
    try {
      const key = await createApiKey(createLabel || "Primary");
      setNewKey(key.key);
      setKeys(prev => [...prev, key]);
      setShowCreate(false);
      setCreateLabel("");
      setHasDismissedKey(false);
      hasDismissedKeyRef.current = false;
      localStorage.removeItem("sdai_key_dismissed");
    } catch {
    } finally {
      setCreateLoading(false);
    }
  }

  function copyKey() {
    navigator.clipboard.writeText(newKey || "");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function dismissKey() {
    setNewKey(null);
    setHasDismissedKey(true);
    hasDismissedKeyRef.current = true;
    try { localStorage.setItem("sdai_key_dismissed", "true"); } catch {}
  }

  if (loading) return <DashboardLayout><div className="dash-loading"><div className="spinner" /></div></DashboardLayout>;

  const used = usage?.polls_used_today ?? 0;
  const limit = usage?.daily_poll_limit ?? 10000;
  const remaining = Math.max(0, limit - used);
  const pct = limit > 0 ? (used / limit) * 100 : 0;
  const resetIn = usage?.reset_in_seconds ?? 86400;
  const hours = Math.floor(resetIn / 3600);
  const mins = Math.floor((resetIn % 3600) / 60);
  const hasActiveKey = keys.some(k => k.is_active);
  const memberSince = user?.email ? new Date(user?.created_at || Date.now()).toLocaleDateString() : "";

  return (
    <DashboardLayout>
      <div className="dash-page">
        <div className="dash-welcome">
          <div className="dash-welcome-text">
            <h1>Welcome, {user?.email?.split("@")[0]}</h1>
            <p>Your API access and usage overview</p>
            {isOwner && <span className="owner-badge">Owner</span>}
          </div>
          <div className="dash-welcome-meta">
            <span className="dash-meta-item">{user?.email}</span>
            <span className="dash-meta-item">Since {memberSince}</span>
          </div>
        </div>

        {newKey && (
          <div className="dash-key-reveal">
            <div className="key-reveal-header">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="9" stroke="var(--accent)" strokeWidth="1.5"/><path d="M7 10l2 2 4-4" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              <h3>Key created successfully</h3>
            </div>
            <p className="key-reveal-warning">This is the only time your full API key will be shown. Copy it now — it will never be visible again.</p>
            <div className="key-reveal-value">
              <code>{newKey}</code>
              <button onClick={copyKey} className={`btn-copy ${copied ? "copied" : ""}`}>
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <button className="key-reveal-dismiss" onClick={dismissKey}>I&apos;ve copied my key, hide it</button>
          </div>
        )}

        {!hasActiveKey && !newKey && (
          <div className="dash-no-key">
            <div className="no-key-icon">
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none"><rect x="8" y="18" width="24" height="14" rx="3" stroke="var(--accent)" strokeWidth="2"/><circle cx="38" cy="25" r="6" stroke="var(--accent)" strokeWidth="2"/><circle cx="38" cy="25" r="2" fill="var(--accent)"/></svg>
            </div>
            <h3>No API key yet</h3>
            <p>Create your first API key to start using the SpaceDebrisAI API. You will only see your key once after creation — make sure to copy it.</p>
            <button onClick={() => setShowCreate(true)} className="btn-primary">Create API Key</button>
          </div>
        )}

        {hasActiveKey && hasDismissedKey && !newKey && (
          <div className="dash-key-status">
            <div className="key-status-row">
              <div className="key-status-icon">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="9" stroke="var(--accent)" strokeWidth="1.5"/><path d="M6 10l3 3 5-6" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <span>Your API key is active and ready to use</span>
            </div>
            <Link to="/dashboard/api-keys" className="btn-ghost-sm">Manage Keys</Link>
          </div>
        )}

        <div className="dash-usage-section">
          <div className="dash-usage-card">
            <div className="dash-usage-label">
              <h2>Daily Poll Usage</h2>
              <span className="dash-usage-reset">Resets in {hours}h {mins}m</span>
            </div>
            <div className="dash-usage-big">
              <span className="dash-usage-used">{used.toLocaleString()}</span>
              <span className="dash-usage-sep">/</span>
              <span className="dash-usage-limit">{limit.toLocaleString()}</span>
            </div>
            <div className="dash-usage-bar">
              <div className={`dash-usage-fill ${pct > 95 ? "critical" : pct > 80 ? "warning" : ""}`} style={{ width: `${Math.min(pct, 100)}%` }} />
            </div>
            <div className="dash-usage-stats">
              <div className="dash-stat">
                <span className="dash-stat-value">{remaining.toLocaleString()}</span>
                <span className="dash-stat-label">Remaining</span>
              </div>
              <div className="dash-stat">
                <span className="dash-stat-value">{Math.round(pct)}%</span>
                <span className="dash-stat-label">Used</span>
              </div>
            </div>
          </div>
        </div>

        {pct > 80 && (
          <div className="dash-limit-warning">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M9 1v8M9 13v1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><circle cx="9" cy="9" r="8" stroke="currentColor" strokeWidth="1.5"/></svg>
            <p>You&apos;ve used most of your daily limit. <Link to="/dashboard/contact">Request a higher limit</Link></p>
          </div>
        )}

        {showCreate && (
          <div className="dash-create-overlay" onClick={() => setShowCreate(false)}>
            <div className="dash-create-modal" onClick={e => e.stopPropagation()}>
              <h3>Create New API Key</h3>
              <form onSubmit={handleCreateKey}>
                <label>Key label</label>
                <input type="text" placeholder="e.g., Production, Testing" value={createLabel} onChange={e => setCreateLabel(e.target.value)} autoFocus />
                <div className="dash-create-actions">
                  <button type="button" className="btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button>
                  <button type="submit" className="btn-primary" disabled={createLoading}>{createLoading ? "Creating..." : "Create Key"}</button>
                </div>
              </form>
            </div>
          </div>
        )}

        <div className="dash-quick-actions">
          <Link to="/dashboard/api-keys" className="dash-action-card">
            <div className="dash-action-icon"><svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M9 2H5a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V8l-6-6z" stroke="currentColor" strokeWidth="1.5"/><path d="M9 2v6h6M12 11v4M10 13h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg></div>
            <div className="dash-action-info"><h4>API Keys</h4><p>{keys.length} key{keys.length !== 1 ? "s" : ""} · {keys.filter(k => k.is_active).length} active</p></div>
          </Link>
          <Link to="/dashboard/usage" className="dash-action-card">
            <div className="dash-action-icon"><svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="2" y="10" width="4" height="8" rx="1" stroke="currentColor" strokeWidth="1.5"/><rect x="8" y="6" width="4" height="12" rx="1" stroke="currentColor" strokeWidth="1.5"/><rect x="14" y="2" width="4" height="16" rx="1" stroke="currentColor" strokeWidth="1.5"/></svg></div>
            <div className="dash-action-info"><h4>Usage History</h4><p>View your 30-day poll history</p></div>
          </Link>
          <Link to="/dashboard/contact" className="dash-action-card">
            <div className="dash-action-icon"><svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="2" y="4" width="16" height="12" rx="2" stroke="currentColor" strokeWidth="1.5"/><path d="M2 6l8 5 8-5" stroke="currentColor" strokeWidth="1.5"/></svg></div>
            <div className="dash-action-info"><h4>Contact</h4><p>Request a poll limit increase</p></div>
          </Link>
        </div>
      </div>
    </DashboardLayout>
  );
}
