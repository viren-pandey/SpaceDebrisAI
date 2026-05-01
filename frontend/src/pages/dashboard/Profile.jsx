import { useState, useEffect } from "react"
import { useNavigate, Link } from "react-router-dom"
import { useAuth } from "../../contexts/AuthContext"
import { fetchPollUsage, fetchApiKeys, createApiKey, revokeApiKey, submitContact } from "../../api/dashboard"
import DashboardLayout from "../../components/dashboard/DashboardLayout"

export default function Profile() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [usage, setUsage] = useState(null)
  const [keys, setKeys] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("overview")

  useEffect(() => {
    if (!user) { navigate("/login"); return; }
    Promise.all([
      fetchPollUsage().catch(() => null),
      fetchApiKeys().catch(() => [])
    ]).then(([u, k]) => {
      if (u) setUsage(u)
      setKeys(k || [])
      setLoading(false)
    })
  }, [user, navigate])

  if (loading) return <DashboardLayout><div className="dash-loading"><div className="spinner" /></div></DashboardLayout>

  const used = usage?.polls_used_today ?? 0
  const limit = usage?.daily_poll_limit ?? 10000
  const remaining = Math.max(0, limit - used)
  const pct = limit > 0 ? (used / limit) * 100 : 0

  return (
    <DashboardLayout>
      <div className="dash-page">
        <div className="dash-welcome">
          <h1>Profile</h1>
          <p className="dash-subtitle">{user?.email}</p>
        </div>

        <div className="profile-tabs" style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
          {["overview", "api-keys", "contact"].map(tab => (
            <button key={tab} className={`tab-btn ${activeTab === tab ? "active" : ""}`} onClick={() => setActiveTab(tab)}>
              {tab === "api-keys" ? "API Keys" : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {activeTab === "overview" && (
          <div>
            <div className="dash-usage-card registered" style={{ marginBottom: 24 }}>
              <div className="dash-usage-label"><h2>Today's API Credits</h2></div>
              <div className="dash-usage-big">
                <span className="dash-usage-remaining">{remaining.toLocaleString()}</span>
                <span className="dash-usage-sep">/</span>
                <span className="dash-usage-limit">{limit.toLocaleString()}</span>
                <span className="dash-usage-label-sm">remaining</span>
              </div>
              <div className="dash-usage-bar">
                <div className="dash-usage-fill registered" style={{ width: `${Math.min(pct, 100)}%` }} />
              </div>
              <div className="dash-usage-detail">
                <span>{used.toLocaleString()} used</span>
                <span>{remaining.toLocaleString()} left</span>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
              <div className="profile-info-card">
                <h3>Account Info</h3>
                <p><strong>Email:</strong> {user?.email}</p>
                <p><strong>Name:</strong> {user?.name || "-"}</p>
                <p><strong>User ID:</strong> #{user?.id}</p>
              </div>
              <div className="profile-info-card">
                <h3>API Keys</h3>
                <p><strong>Active Keys:</strong> {keys.filter(k => k.is_active).length}</p>
                <Link to="/dashboard/api-keys" style={{ color: "var(--accent)", fontSize: 13 }}>Manage Keys →</Link>
              </div>
            </div>
          </div>
        )}

        {activeTab === "api-keys" && (
          <div>
            <h1>API Keys</h1>
            {keys.length === 0 ? (
              <div className="dash-no-key">
                <h3>No API keys yet</h3>
                <p>Create your first key to access the API.</p>
              </div>
            ) : (
              <div className="keys-list">
                {keys.map(key => (
                  <div key={key.id} className="key-row">
                    <div className="key-row-info">
                      <span className="key-row-label">{key.label || "Unnamed"}</span>
                      <span className="key-row-prefix"><code>{key.key_prefix}••••••{key.key_suffix || ""}</code></span>
                    </div>
                    <div className="key-row-actions">
                      <span className={`key-row-badge ${key.is_active ? "active" : "inactive"}`}>{key.is_active ? "Active" : "Revoked"}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "contact" && (
          <div className="profile-form-card">
            <h2>Contact Admin</h2>
            <p style={{ color: "var(--text-dim)", fontSize: 13, marginBottom: 16 }}>Request more API credits or report an issue.</p>
            <Link to="/dashboard/contact" className="dash-btn dash-btn-primary">Go to Contact Page</Link>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
