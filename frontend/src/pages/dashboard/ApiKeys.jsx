import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { fetchApiKeys, createApiKey, revokeApiKey } from "../../api/dashboard";
import DashboardLayout from "../../components/dashboard/DashboardLayout";

export default function ApiKeys() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [label, setLabel] = useState("");
  const [newKey, setNewKey] = useState(null);
  const [revokeId, setRevokeId] = useState(null);
  const [copied, setCopied] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);

  useEffect(() => {
    if (!user) { navigate("/login"); return; }
    fetchApiKeys().then(setKeys).catch(() => setKeys([])).finally(() => setLoading(false));
  }, [user, navigate]);

  async function handleCreate(e) {
    e.preventDefault();
    setCreateLoading(true);
    try {
      const key = await createApiKey(label || "Unnamed");
      setNewKey(key);
      setKeys(prev => [...prev, key]);
      setShowCreate(false);
      setLabel("");
    } catch {} finally { setCreateLoading(false); }
  }

  async function handleRevoke() {
    await revokeApiKey(revokeId);
    setKeys(prev => prev.filter(k => k.id !== revokeId));
    setRevokeId(null);
  }

  function copyKey(key) {
    navigator.clipboard.writeText(key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) return <DashboardLayout><div className="dash-loading"><div className="spinner" /></div></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="dash-page">
        <div className="dash-welcome">
          <h1>API Keys</h1>
          <button className="btn-primary" onClick={() => setShowCreate(true)}>Create New Key</button>
        </div>

        {newKey && (
          <div className="dash-key-reveal">
            <div className="key-reveal-header">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="9" stroke="var(--accent)" strokeWidth="1.5"/><path d="M7 10l2 2 4-4" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              <h3>Key created — copy it now</h3>
            </div>
            <p className="key-reveal-warning">This key will not be shown again.</p>
            <div className="key-reveal-value">
              <code>{newKey.key}</code>
              <button onClick={() => copyKey(newKey.key)} className={`btn-copy ${copied ? "copied" : ""}`}>
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <button className="key-reveal-dismiss" onClick={() => setNewKey(null)}>Dismiss</button>
          </div>
        )}

        {showCreate && (
          <div className="dash-create-overlay" onClick={() => setShowCreate(false)}>
            <div className="dash-create-modal" onClick={e => e.stopPropagation()}>
              <h3>Create API Key</h3>
              <form onSubmit={handleCreate}>
                <label>Key label</label>
                <input type="text" placeholder="e.g., Production, Testing" value={label} onChange={e => setLabel(e.target.value)} autoFocus />
                <div className="dash-create-actions">
                  <button type="button" className="btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button>
                  <button type="submit" className="btn-primary" disabled={createLoading}>{createLoading ? "Creating..." : "Create"}</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {keys.length === 0 ? (
          <div className="dash-no-key">
            <h3>No API keys yet</h3>
            <p>Create your first key to access the API.</p>
            <button onClick={() => setShowCreate(true)} className="btn-primary">Create Key</button>
          </div>
        ) : (
          <div className="keys-list">
            {keys.map(key => (
              <div key={key.id} className="key-row">
                <div className="key-row-info">
                  <span className="key-row-label">{key.label || "Unnamed"}</span>
                  <span className="key-row-prefix"><code>{key.key_prefix}••••••••{key.key_suffix || ""}</code></span>
                  <span className="key-row-date">{new Date(key.created_at).toLocaleDateString()}</span>
                </div>
                <div className="key-row-actions">
                  <span className={`key-row-badge ${key.is_active ? "active" : "inactive"}`}>{key.is_active ? "Active" : "Revoked"}</span>
                  {key.is_active && <button className="btn-revoke" onClick={() => setRevokeId(key.id)}>Revoke</button>}
                </div>
              </div>
            ))}
          </div>
        )}

        {revokeId && (
          <div className="dash-create-overlay" onClick={() => setRevokeId(null)}>
            <div className="dash-create-modal" onClick={e => e.stopPropagation()}>
              <h3>Revoke API Key?</h3>
              <p className="revoke-text">This action cannot be undone. Any service using this key will lose access immediately.</p>
              <div className="dash-create-actions">
                <button className="btn-ghost" onClick={() => setRevokeId(null)}>Cancel</button>
                <button className="btn-revoke-confirm" onClick={handleRevoke}>Revoke Key</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
