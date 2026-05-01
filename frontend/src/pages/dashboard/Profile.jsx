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
    if (!user) { navigate("/login"); return }
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
        <div className="dash-usage-card registered" style={{ marginBottom: 24 }}>
          <div className="dash-usage-big">
            <span className="dash-usage-remaining">{remaining.toLocaleString()}</span>
            <span className="dash-usage-sep">/</span>
            <span className="dash-usage-limit">{limit.toLocaleString()}</span>
          </div>
          <div className="dash-usage-bar">
            <div className="dash-usage-fill registered" style={{ width: `${Math.min(pct, 100)}%` }} />
          </div>
        </div>
        <div className="profile-info-card">
          <h3>Account Info</h3>
          <p>Email: {user?.email}</p>
          <p>Name: {user?.name || "-"}</p>
          <p>User ID: #{user?.id}</p>
        </div>
        <div className="profile-info-card">
          <h3>API Keys</h3>
          <p>Active Keys: {keys.filter(k => k.is_active).length}</p>
          <Link to="/dashboard/api-keys">Manage Keys →</Link>
        </div>
      </div>
    </DashboardLayout>
  )
}
