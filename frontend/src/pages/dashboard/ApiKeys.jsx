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

  useEffect(() => {
    if (!user) { navigate("/login"); return; }
    fetchApiKeys().then(setKeys).catch(() => setKeys([])).finally(() => setLoading(false));
  }, [user, navigate]);

  async function handleCreate(e) {
    e.preventDefault();
    try {
      const key = await createApiKey(label);
      setNewKey(key);
      setKeys(prev => [...prev, key]);
      setShowCreate(false);
      setLabel("");
    } catch {}
  }

  async function handleRevoke() {
    await revokeApiKey(revokeId);
    setKeys(prev => prev.filter(k => k.id !== revokeId));
    setRevokeId(null);
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="spinner" /></div>;

  return (
    <DashboardLayout>
      <div className="page-container">
        <div className="page-header">
          <h1>API Keys</h1>
          <button className="btn-primary" onClick={() => setShowCreate(true)}>Create New Key</button>
        </div>
        {newKey && (
          <div className="key-reveal">
            <p className="key-warning">This key will not be shown again. Copy it now.</p>
            <div className="key-display"><code>{newKey.key}</code><button onClick={() => navigator.clipboard.writeText(newKey.key)} className="btn-copy">Copy</button></div>
            <button onClick={() => setNewKey(null)} className="btn-dismiss">Dismiss</button>
          </div>
        )}
        {showCreate && (
          <form className="modal-form" onSubmit={handleCreate}>
            <h2>Create API Key</h2>
            <input type="text" placeholder="Key label (e.g., Production)" value={label} onChange={e => setLabel(e.target.value)} required />
            <div className="form-actions"><button type="submit" className="btn-primary">Create</button><button type="button" className="btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button></div>
          </form>
        )}
        <table className="data-table">
          <thead><tr><th>Label</th><th>Key</th><th>Created</th><th>Last Used</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {keys.map(key => (
              <tr key={key.id}>
                <td>{key.label || "Unnamed"}</td>
                <td><code>{key.key_prefix}****{key.key_suffix}</code></td>
                <td>{new Date(key.created_at).toLocaleDateString()}</td>
                <td>{key.last_used ? new Date(key.last_used).toLocaleDateString() : "Never"}</td>
                <td><span className={`badge ${key.is_active ? "active" : "inactive"}`}>{key.is_active ? "Active" : "Revoked"}</span></td>
                <td>{key.is_active && <button className="btn-danger-sm" onClick={() => setRevokeId(key.id)}>Revoke</button>}</td>
              </tr>
            ))}
            {keys.length === 0 && <tr><td colSpan={6} className="empty-cell">No API keys yet. Create one to get started.</td></tr>}
          </tbody>
        </table>
        {revokeId && (
          <div className="modal-overlay"><div className="modal">
            <h3>Revoke API Key?</h3><p>This action cannot be undone.</p>
            <div className="form-actions"><button className="btn-danger" onClick={handleRevoke}>Revoke</button><button className="btn-ghost" onClick={() => setRevokeId(null)}>Cancel</button></div>
          </div></div>
        )}
      </div>
    </DashboardLayout>
  );
}
