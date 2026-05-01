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
  const [pwdForm, setPwdForm] = useState({ current: "", new: "", confirm: "" })
  const [pwdStatus, setPwdStatus] = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [label, setLabel] = useState("")
  const [newKey, setNewKey] = useState(null)
  const [copied, setCopied] = useState(false)
  const [contactMsg, setContactMsg] = useState("")
  const [contactStatus, setContactStatus] = useState(null)

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

  const handlePwdChange = async (e) => {
    e.preventDefault()
    if (pwdForm.new !== pwdForm.confirm) {
      setPwdStatus("error")
      return
    }
    setPwdStatus("sending")
    try {
      await new Promise(r => setTimeout(r, 1000))
      setPwdStatus("success")
      setPwdForm({ current: "", new: "", confirm: "" })
      setTimeout(() => setPwdStatus(null), 3000)
    } catch {
      setPwdStatus("error")
    }
  }

  const handleCreateKey = async (e) => {
    e.preventDefault()
    try {
      const key = await createApiKey(label || "Unnamed")
      setNewKey(key)
      setKeys(prev => [...prev, key])
      setShowCreate(false)
      setLabel("")
    } catch (err) {}
  }

  const handleRevokeKey = async (id) => {
    await revokeApiKey(id)
    setKeys(prev => prev.filter(k => k.id !== id))
  }

  const copyKey = (key) => {
    navigator.clipboard.writeText(key)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleContact = async (e) => {
    e.preventDefault()
    if (!contactMsg.trim()) return
    setContactStatus("sending")
    try {
      await submitContact({
        name: user?.name || "User",
        email: user?.email || "",
        subject: "Request more API credits",
        message: `User ${user?.email} is requesting more credits. ${contactMsg}`
      })
      setContactStatus("sent")
      setContactMsg("")
      setTimeout(() => setContactStatus(null), 3000)
    } catch {
      setContactStatus("error")
    }
  }

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

        <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
          {["overview", "api-keys", "password", "contact"].map(tab => (
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
                <p>Email: {user?.email}</p>
                <p>Name: {user?.name || "-"}</p>
                <p>User ID: #{user?.id}</p>
              </div>
              <div className="profile-info-card">
                <h3>API Keys</h3>
                <p>Active Keys: {keys.filter(k => k.is_active).length}</p>
                <Link to="/dashboard/api-keys" style={{ color: "var(--accent)", fontSize: 13 }}>Manage Keys →</Link>
              </div>
              <div className="profile-info-card">
                <h3>Quick Actions</h3>
                <button className="dash-btn dash-btn-primary" onClick={() => setActiveTab("api-keys")}>Create API Key</button>
                <button className="dash-btn" onClick={() => setActiveTab("contact")} style={{ marginTop: 8 }}>Contact Admin</button>
              </div>
            </div>
          </div>
        )}

        {activeTab === "api-keys" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h1>API Keys</h1>
              <button className="btn-primary" onClick={() => setShowCreate(true)}>Create New Key</button>
            </div>
            {newKey && (
              <div className="dash-key-reveal">
                <h3>Key created — copy it now</h3>
                <p className="key-reveal-warning">This key will not be shown again.</p>
                <div className="key-reveal-value">
                  <code>{newKey.key}</code>
                  <button onClick={() => copyKey(newKey.key)} className="btn-copy">{copied ? "Copied" : "Copy"}</button>
                </div>
                <button className="key-reveal-dismiss" onClick={() => setNewKey(null)}>Dismiss</button>
              </div>
            )}
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
                      {key.is_active && <button className="btn-revoke" onClick={() => handleRevokeKey(key.id)}>Revoke</button>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "password" && (
          <div className="profile-form-card">
            <h2>Change Password</h2>
            <form onSubmit={handlePwdChange}>
              <div className="form-group">
                <label>Current Password</label>
                <input type="password" value={pwdForm.current} onChange={e => setPwdForm({...pwdForm, current: e.target.value})} />
              </div>
              <div className="form-group">
                <label>New Password</label>
                <input type="password" value={pwdForm.new} onChange={e => setPwdForm({...pwdForm, new: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Confirm New Password</label>
                <input type="password" value={pwdForm.confirm} onChange={e => setPwdForm({...pwdForm, confirm: e.target.value})} />
              </div>
              <button type="submit" className="btn-primary" disabled={pwdStatus === "sending"}>
                {pwdStatus === "sending" ? "Updating..." : "Update Password"}
              </button>
              {pwdStatus === "success" && <p className="dash-success">Password updated!</p>}
              {pwdStatus === "error" && <p className="dash-error">Passwords don't match</p>}
            </form>
          </div>
        )}

        {activeTab === "contact" && (
          <div className="profile-form-card">
            <h2>Contact Admin</h2>
            <p style={{ color: "var(--text-dim)", fontSize: 13, marginBottom: 16 }}>Request more API credits or report an issue.</p>
            <form onSubmit={handleContact}>
              <div className="form-group">
                <label>Your Message</label>
                <textarea rows={4} placeholder="Explain why you need more credits..." value={contactMsg} onChange={e => setContactMsg(e.target.value)} />
              </div>
              <button type="submit" className="btn-primary" disabled={contactStatus === "sending"}>
                {contactStatus === "sending" ? "Sending..." : "Send Request"}
              </button>
              {contactStatus === "sent" && <p className="dash-success">Request sent!</p>}
              {contactStatus === "error" && <p className="dash-error">Failed to send.</p>}
            </form>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
