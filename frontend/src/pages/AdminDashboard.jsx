import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

const ADMIN_KEY = import.meta.env.VITE_ADMIN_KEY || "admin_secret_key_12345";
const API_BASE = (import.meta.env.VITE_API_URL || "https://virenn77-spacedebrisai.hf.space").replace(/\/+$/, "");

const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL || "pandeyviren68@gmail.com";
const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD || "asdf1234@99";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [activeTab, setActiveTab] = useState("users");
  const [adminKey, setAdminKey] = useState(() => {
    const stored = localStorage.getItem("admin_key");
    return stored === ADMIN_KEY ? stored : "";
  });
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    const stored = localStorage.getItem("admin_key");
    return stored === ADMIN_KEY;
  });
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [loginError, setLoginError] = useState("");
  const [banForm, setBanForm] = useState({ identifier: "", ip: "", email: "", reason: "" });
  const [unbanForm, setUnbanForm] = useState({ identifier: "", ip: "" });
  const [actionStatus, setActionStatus] = useState(null);

  useEffect(() => {
    const storedKey = localStorage.getItem("admin_key");
    if (storedKey === ADMIN_KEY) {
      setIsAuthenticated(true);
      setAdminKey(storedKey);
    }
  }, []);

  useEffect(() => {
    if (adminKey) {
      localStorage.setItem("admin_key", adminKey);
    }
  }, [adminKey]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError("");
    
    if (loginForm.email !== ADMIN_EMAIL || loginForm.password !== ADMIN_PASSWORD) {
      setLoginError("Invalid credentials");
      return;
    }
    
    setIsAuthenticated(true);
    setAdminKey(ADMIN_KEY);
    localStorage.setItem("admin_key", ADMIN_KEY);
    
    // Fetch immediately after login
    setTimeout(() => fetchData(ADMIN_KEY), 100);
  };

  const fetchData = async (keyOverride = null) => {
    const key = keyOverride || adminKey;
    if (!key) {
      setError("Admin key required");
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/usage`, {
        headers: { "X-Admin-Key": key },
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to fetch");
      }
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated && adminKey) {
      fetchData();
      const interval = setInterval(() => fetchData(), 10000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, adminKey]);

  const handleBan = async (e) => {
    e.preventDefault();
    try {
      setActionStatus("banning");
      const res = await fetch(`${API_BASE}/usage/revoke`, {
        method: "POST",
        headers: {
          "X-Admin-Key": adminKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          identifier: banForm.identifier || null,
          ip: banForm.ip || null,
          email: banForm.email || null,
          reason: banForm.reason || null,
        }),
      });
      if (!res.ok) throw new Error("Ban failed");
      setBanForm({ identifier: "", ip: "", email: "", reason: "" });
      setActionStatus("success");
      fetchData();
      setTimeout(() => setActionStatus(null), 2000);
    } catch (err) {
      setActionStatus("error");
    }
  };

  const handleUnban = async (type, value) => {
    try {
      setActionStatus("unbanning");
      const res = await fetch(`${API_BASE}/usage/unban`, {
        method: "POST",
        headers: {
          "X-Admin-Key": adminKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          [type]: value,
        }),
      });
      if (!res.ok) throw new Error("Unban failed");
      setUnbanForm({ identifier: "", ip: "" });
      setActionStatus("success");
      fetchData();
      setTimeout(() => setActionStatus(null), 2000);
    } catch (err) {
      setActionStatus("error");
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setLoginForm({ email: "", password: "" });
    localStorage.removeItem("admin_key");
    navigate("/");
  };

  if (!isAuthenticated) {
    return (
      <div className="admin-page">
        <div className="admin-login">
          <h2>Admin Login</h2>
          <p>Please enter your credentials to access the admin dashboard</p>
          <form className="login-form" onSubmit={handleLogin}>
            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                value={loginForm.email}
                onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                placeholder="Enter admin email"
              />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                value={loginForm.password}
                onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                placeholder="Enter password"
              />
            </div>
            {loginError && <div className="login-error">{loginError}</div>}
            <button type="submit" className="login-btn">
              Login
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <div className="admin-header">
        <h1>Admin Dashboard</h1>
        <div className="admin-controls">
          <button onClick={fetchData} className="refresh-btn">
            Refresh
          </button>
          <button onClick={handleLogout} className="logout-btn">
            Logout
          </button>
        </div>
      </div>

      {error && <div className="admin-error">{error}</div>}

      {loading && !data ? (
        <div className="admin-loading">Loading...</div>
      ) : (
        <>
          <div className="admin-tabs">
            <button
              className={`tab-btn ${activeTab === "users" ? "active" : ""}`}
              onClick={() => setActiveTab("users")}
            >
              Users & Requests
            </button>
            <button
              className={`tab-btn ${activeTab === "banned" ? "active" : ""}`}
              onClick={() => setActiveTab("banned")}
            >
              Ban List
            </button>
            <button
              className={`tab-btn ${activeTab === "polls" ? "active" : ""}`}
              onClick={() => setActiveTab("polls")}
            >
              Active Polls
            </button>
            <button
              className={`tab-btn ${activeTab === "actions" ? "active" : ""}`}
              onClick={() => setActiveTab("actions")}
            >
              Actions
            </button>
          </div>

          <div className="admin-stats">
            <div className="stat-card">
              <span className="stat-value">{data?.total_requests || 0}</span>
              <span className="stat-label">Total Requests</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{data?.buckets?.length || 0}</span>
              <span className="stat-label">Unique Users</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{data?.active_polls?.length || 0}</span>
              <span className="stat-label">Active Polls</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">
                {Object.keys(data?.banlist?.identifiers || {}).length + Object.keys(data?.banlist?.ips || {}).length}
              </span>
              <span className="stat-label">Banned</span>
            </div>
          </div>

          {activeTab === "users" && (
            <div className="admin-section">
              <h2>User Requests</h2>
              <div className="users-table-wrapper">
                <table className="users-table">
                  <thead>
                    <tr>
                      <th>Identifier</th>
                      <th>Email</th>
                      <th>IP</th>
                      <th>Requests</th>
                      <th>Req/min</th>
                      <th>Last Endpoint</th>
                      <th>First Seen</th>
                      <th>Last Seen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data?.buckets?.slice(0, 50).map((bucket, idx) => (
                      <tr key={idx}>
                        <td className="identifier-cell">{bucket.identifier}</td>
                        <td>{bucket.email || "-"}</td>
                        <td>{bucket.last_ip || "-"}</td>
                        <td>{bucket.total_requests}</td>
                        <td>{bucket.requests_per_minute}</td>
                        <td><code>{bucket.last_endpoint}</code></td>
                        <td>{new Date(bucket.first_seen).toLocaleString()}</td>
                        <td>{new Date(bucket.last_seen).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === "banned" && (
            <div className="admin-section">
              <h2>Ban List</h2>
              <div className="ban-section">
                <h3>Banned Identifiers</h3>
                {Object.keys(data?.banlist?.identifiers || {}).length === 0 ? (
                  <p className="empty-state">No banned identifiers</p>
                ) : (
                  <div className="ban-list">
                    {Object.entries(data?.banlist?.identifiers || {}).map(([ident, info]) => (
                      <div key={ident} className="ban-item">
                        <div className="ban-info">
                          <span className="ban-value">{ident}</span>
                          <span className="ban-reason">{info.reason || "No reason"}</span>
                          <span className="ban-time">Banned: {new Date(info.at).toLocaleString()}</span>
                        </div>
                        <button className="unban-btn" onClick={() => handleUnban("identifier", ident)}>
                          Unban
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="ban-section">
                <h3>Banned IPs</h3>
                {Object.keys(data?.banlist?.ips || {}).length === 0 ? (
                  <p className="empty-state">No banned IPs</p>
                ) : (
                  <div className="ban-list">
                    {Object.entries(data?.banlist?.ips || {}).map(([ip, info]) => (
                      <div key={ip} className="ban-item">
                        <div className="ban-info">
                          <span className="ban-value">{ip}</span>
                          <span className="ban-reason">{info.reason || "No reason"}</span>
                          <span className="ban-time">Banned: {new Date(info.at).toLocaleString()}</span>
                        </div>
                        <button className="unban-btn" onClick={() => handleUnban("ip", ip)}>
                          Unban
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "polls" && (
            <div className="admin-section">
              <h2>Active Polling Requests</h2>
              {data?.active_polls?.length === 0 ? (
                <p className="empty-state">No active polling requests</p>
              ) : (
                <div className="polls-table-wrapper">
                  <table className="polls-table">
                    <thead>
                      <tr>
                        <th>Identifier</th>
                        <th>Email</th>
                        <th>IP</th>
                        <th>Endpoint</th>
                        <th>Started</th>
                        <th>Last Poll</th>
                        <th>Poll Count</th>
                        <th>Active (s)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data?.active_polls?.map((poll, idx) => (
                        <tr key={idx}>
                          <td>{poll.identifier}</td>
                          <td>{poll.email || "-"}</td>
                          <td>{poll.ip}</td>
                          <td><code>{poll.endpoint}</code></td>
                          <td>{new Date(poll.started_at).toLocaleTimeString()}</td>
                          <td>{new Date(poll.last_poll).toLocaleTimeString()}</td>
                          <td>{poll.poll_count}</td>
                          <td>{poll.active_seconds}s</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === "actions" && (
            <div className="admin-section">
              <h2>Ban User</h2>
              <form className="ban-form" onSubmit={handleBan}>
                <div className="form-group">
                  <label>Identifier</label>
                  <input
                    type="text"
                    value={banForm.identifier}
                    onChange={(e) => setBanForm({ ...banForm, identifier: e.target.value })}
                    placeholder="e.g., user:email@example.com"
                  />
                </div>
                <div className="form-group">
                  <label>IP Address</label>
                  <input
                    type="text"
                    value={banForm.ip}
                    onChange={(e) => setBanForm({ ...banForm, ip: e.target.value })}
                    placeholder="e.g., 192.168.1.1"
                  />
                </div>
                <div className="form-group">
                  <label>Email</label>
                  <input
                    type="email"
                    value={banForm.email}
                    onChange={(e) => setBanForm({ ...banForm, email: e.target.value })}
                    placeholder="e.g., user@example.com"
                  />
                </div>
                <div className="form-group">
                  <label>Reason</label>
                  <input
                    type="text"
                    value={banForm.reason}
                    onChange={(e) => setBanForm({ ...banForm, reason: e.target.value })}
                    placeholder="Reason for ban"
                  />
                </div>
                <button type="submit" className="ban-btn" disabled={actionStatus === "banning"}>
                  {actionStatus === "banning" ? "Banning..." : "Ban User"}
                </button>
                {actionStatus === "success" && <span className="action-success">Action completed!</span>}
                {actionStatus === "error" && <span className="action-error">Action failed</span>}
              </form>
            </div>
          )}
        </>
      )}
    </div>
  );
}
