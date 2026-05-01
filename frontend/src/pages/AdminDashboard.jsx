import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

const ADMIN_KEY = import.meta.env.VITE_ADMIN_KEY;
const API_BASE = (import.meta.env.VITE_API_URL || "https://virenn77-spacedebrisai.hf.space").replace(/\/+$/, "");

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [adminKey, setAdminKey] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [redirecting, setRedirecting] = useState(true);
  const [banForm, setBanForm] = useState({ identifier: "", ip: "", email: "", reason: "" });
  const [, setUnbanForm] = useState({ identifier: "", ip: "" });
  const [actionStatus, setActionStatus] = useState(null);
  const [loginLogs, setLoginLogs] = useState([]);
  const [loginLogsLoading, setLoginLogsLoading] = useState(false);
  const [pollLimitForm, setPollLimitForm] = useState({});
  const [contacts, setContacts] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);

  useEffect(() => {
    const adminOk = sessionStorage.getItem("admin_authenticated") === "true";
    const bypassOk = sessionStorage.getItem("bypass_authenticated") === "true";
    const storedKey = localStorage.getItem("admin_key");
    if (storedKey && adminOk) {
      setAdminKey(storedKey);
      setIsAuthenticated(true);
      setRedirecting(false);
    } else if (bypassOk && !adminOk) {
      navigate("/admin/login");
    } else if (!bypassOk) {
      navigate("/admin/bypass");
    }
  }, [navigate]);

  useEffect(() => {
    if (adminKey) {
      localStorage.setItem("admin_key", adminKey);
    }
  }, [adminKey]);

  const fetchData = async (keyOverride = null) => {
    const key = keyOverride || adminKey;
    if (!key) return;
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${API_BASE}/usage`, { headers: { "X-Admin-Key": key } });
      if (!res.ok) throw new Error("Failed to fetch");
      const json = await res.json();
      setData(json);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchContacts = async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/contact-requests`, { headers: { "X-Admin-Key": adminKey } });
      if (res.ok) {
        const json = await res.json();
        setContacts(json);
      }
    } catch {}
  };

  useEffect(() => {
    if (isAuthenticated && adminKey) {
      fetchData();
      const interval = setInterval(() => {
        fetchData();
      }, 15000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, adminKey]);

  const handleBan = async (e) => {
    e.preventDefault();
    try {
      setActionStatus("banning");
      const res = await fetch(`${API_BASE}/usage/revoke`, {
        method: "POST",
        headers: { "X-Admin-Key": adminKey, "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: banForm.identifier || null, ip: banForm.ip || null, email: banForm.email || null, reason: banForm.reason || null }),
      });
      if (!res.ok) throw new Error("Ban failed");
      setBanForm({ identifier: "", ip: "", email: "", reason: "" });
      setActionStatus("success");
      fetchData();
      setTimeout(() => setActionStatus(null), 2000);
    } catch { setActionStatus("error"); }
  };

  const handleUnban = async (type, value) => {
    try {
      setActionStatus("unbanning");
      const res = await fetch(`${API_BASE}/usage/unban`, {
        method: "POST",
        headers: { "X-Admin-Key": adminKey, "Content-Type": "application/json" },
        body: JSON.stringify({ [type]: value }),
      });
      if (!res.ok) throw new Error("Unban failed");
      setUnbanForm({ identifier: "", ip: "" });
      setActionStatus("success");
      fetchData();
      setTimeout(() => setActionStatus(null), 2000);
    } catch { setActionStatus("error"); }
  };

  const handlePollLimitUpdate = async (emailOrIdentifier) => {
    const newLimit = pollLimitForm[emailOrIdentifier];
    if (!newLimit) return;
    try {
      const res = await fetch(`${API_BASE}/admin/users/poll-limit`, {
        method: "PUT",
        headers: { "X-Admin-Key": adminKey, "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailOrIdentifier, daily_poll_limit: parseInt(newLimit) }),
      });
      if (!res.ok) throw new Error("Update failed");
      setPollLimitForm(prev => ({ ...prev, [emailOrIdentifier]: null }));
      await fetchData();
    } catch {}
  };

  const showUserCard = (bucket) => {
    setSelectedUser(bucket);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem("admin_authenticated");
    localStorage.removeItem("admin_key");
    navigate("/admin/bypass");
  };

  if (redirecting) {
    return (
      <div className="login-root">
        <div className="login-ring login-ring-1" />
        <div className="login-ring login-ring-2" />
        <div className="login-ring login-ring-3" />
        <div className="login-grid-line login-grid-line-1" />
        <div className="login-grid-line login-grid-line-2" />
        <div className="login-shell" style={{ justifyContent: "center", alignItems: "center" }}>
          <div className="login-card" style={{ width: 400, maxWidth: "90vw", textAlign: "center" }}>
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
            <h1 className="login-title">Redirecting...</h1>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="admin-page" style={{ maxWidth: 1200, margin: "0 auto", padding: "40px 20px" }}>
      <div className="admin-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>Admin Dashboard</h1>
        <div style={{ display: "flex", gap: 12 }}>
          <button onClick={fetchData} className="refresh-btn">Refresh</button>
          <button onClick={handleLogout} className="logout-btn">Logout</button>
        </div>
      </div>

      {error && (
        <div className="admin-error" style={{ background: "rgba(239,68,68,.1)", border: "1px solid rgba(239,68,68,.3)", color: "#ef4444", padding: "10px 16px", borderRadius: 8, marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>{error}</span>
          <button onClick={() => setError(null)} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 18 }}>&times;</button>
        </div>
      )}

      <div className="admin-tabs" style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
        {["overview", "users", "banned", "poll-limits", "contacts", "actions", "logs"].map(tab => (
          <button key={tab} className={`tab-btn ${activeTab === tab ? "active" : ""}`} onClick={() => { setActiveTab(tab); if (tab === "contacts") fetchContacts(); }}>
            {tab === "overview" ? "Overview" : tab === "poll-limits" ? "Poll Limits" : tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {loading && !data ? <div className="admin-loading" style={{ textAlign: "center", padding: 40 }}>Loading...</div> : (
        <>
          {activeTab === "overview" && (
            <div className="admin-section">
              <div className="admin-stats" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 24 }}>
                <div className="stat-card"><span className="stat-value">{data?.total_requests || 0}</span><span className="stat-label">Total Requests</span></div>
                <div className="stat-card"><span className="stat-value">{data?.buckets?.length || 0}</span><span className="stat-label">Unique Users</span></div>
                <div className="stat-card"><span className="stat-value">{data?.active_polls?.length || 0}</span><span className="stat-label">Active Polls</span></div>
                <div className="stat-card"><span className="stat-value">{Object.keys(data?.banlist?.identifiers || {}).length + Object.keys(data?.banlist?.ips || {}).length}</span><span className="stat-label">Banned</span></div>
              </div>
              <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Recent Users</h2>
              <div className="users-table-wrapper">
                <table className="users-table">
                  <thead><tr><th>Identifier</th><th>Email</th><th>Requests</th><th>Req/min</th><th>Last Endpoint</th></tr></thead>
                  <tbody>
                    {data?.buckets?.slice(0, 10).map((b, i) => (
                      <tr key={i}><td className="identifier-cell">{b.identifier}</td><td>{b.email || "-"}</td><td>{b.total_requests}</td><td>{b.requests_per_minute}</td><td><code>{b.last_endpoint}</code></td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === "users" && (
            <div className="admin-section">
              <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>All Users</h2>
              <div className="users-table-wrapper">
                <table className="users-table">
                  <thead><tr><th>IP Address</th><th>Email</th><th>Date/Time</th><th>Requests</th><th>Limits</th><th>Actions</th></tr></thead>
                  <tbody>
                    {data?.buckets?.slice(0, 50).map((b, i) => (
                      <tr key={i} onClick={() => showUserCard(b)} style={{ cursor: "pointer" }}>
                        <td className="identifier-cell clickable" onClick={(e) => { e.stopPropagation(); showUserCard(b); }}>{b.last_ip || b.identifier}</td>
                        <td>{b.email || "-"}</td>
                        <td>{b.last_seen ? new Date(b.last_seen).toLocaleString() : "-"}</td>
                        <td>{b.total_requests}</td>
                        <td>{data?.user_data?.[b.identifier]?.daily_poll_limit || 10000}</td>
                        <td><button className="btn-sm" onClick={(e) => { e.stopPropagation(); setBanForm(prev => ({ ...prev, identifier: b.identifier, ip: b.last_ip || "" })); }}>Ban</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === "banned" && (
            <div className="admin-section">
              <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Ban List</h2>
              <div className="ban-section">
                <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Banned Identifiers</h3>
                {Object.keys(data?.banlist?.identifiers || {}).length === 0 ? <p className="empty-state">No banned identifiers</p> : (
                  <div className="ban-list">
                    {Object.entries(data?.banlist?.identifiers || {}).map(([ident, info]) => (
                      <div key={ident} className="ban-item">
                        <div className="ban-info"><span className="ban-value">{ident}</span><span className="ban-reason">{info.reason || "No reason"}</span></div>
                        <button className="unban-btn" onClick={() => handleUnban("identifier", ident)}>Unban</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="ban-section" style={{ marginTop: 24 }}>
                <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Banned IPs</h3>
                {Object.keys(data?.banlist?.ips || {}).length === 0 ? <p className="empty-state">No banned IPs</p> : (
                  <div className="ban-list">
                    {Object.entries(data?.banlist?.ips || {}).map(([ip, info]) => (
                      <div key={ip} className="ban-item">
                        <div className="ban-info"><span className="ban-value">{ip}</span><span className="ban-reason">{info.reason || "No reason"}</span></div>
                        <button className="unban-btn" onClick={() => handleUnban("ip", ip)}>Unban</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "poll-limits" && (
            <div className="admin-section">
              <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Manage Poll Limits</h2>
              <div className="users-table-wrapper">
                <table className="users-table">
                  <thead><tr><th>IP Address</th><th>Email</th><th>Date/Time</th><th>Current Limit</th><th>Today's Usage</th><th>New Limit</th><th>Actions</th></tr></thead>
                  <tbody>
                    {data?.buckets?.map((b, i) => {
                      const userData = data?.user_data?.[b.identifier] || {};
                      const currentLimit = userData.daily_poll_limit || 10000;
                      const todayUsage = userData.polls_today || 0;
                      return (
                        <tr key={i} onClick={() => showUserCard(b)} style={{ cursor: "pointer" }}>
                          <td className="identifier-cell">{b.last_ip || b.identifier}</td>
                          <td>{b.email || "-"}</td>
                          <td>{b.last_seen ? new Date(b.last_seen).toLocaleString() : "-"}</td>
                          <td>{currentLimit.toLocaleString()}</td>
                          <td>{todayUsage.toLocaleString()}</td>
                          <td>
                            <input type="number" className="limit-input" placeholder={currentLimit} value={pollLimitForm[b.email || b.identifier] || ""} onChange={e => setPollLimitForm(prev => ({ ...prev, [b.email || b.identifier]: e.target.value }))} />
                          </td>
                          <td>
                            <button className="btn-primary btn-sm" onClick={(e) => { e.stopPropagation(); handlePollLimitUpdate(b.email || b.identifier); }}>Save</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="bulk-actions" style={{ marginTop: 16 }}>
                <button className="btn-secondary" onClick={async () => {
                  for (const b of (data?.buckets || [])) {
                    const email = b.email || b.identifier;
                    await fetch(`${API_BASE}/admin/users/poll-limit`, { method: "PUT", headers: { "X-Admin-Key": adminKey, "Content-Type": "application/json" }, body: JSON.stringify({ email, daily_poll_limit: 10000 }) });
                  }
                  await fetchData();
                }}>Reset All to 10,000</button>
              </div>
            </div>
          )}

          {activeTab === "contacts" && (
            <div className="admin-section">
              <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Contact Requests</h2>
              <div className="users-table-wrapper">
                <table className="users-table">
                  <thead><tr><th>Name</th><th>Email</th><th>Subject</th><th>Message</th><th>Status</th><th>Date</th></tr></thead>
                  <tbody>
                    {contacts.map((c, i) => (
                      <tr key={i}>
                        <td>{c.name}</td>
                        <td>{c.email}</td>
                        <td>{c.subject}</td>
                        <td>{c.message?.substring(0, 50)}...</td>
                        <td><span className={`badge ${c.status}`}>{c.status}</span></td>
                        <td>{new Date(c.submitted_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                    {contacts.length === 0 && <tr><td colSpan={6} className="empty-cell">No contact requests</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === "actions" && (
            <div className="admin-section">
              <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Ban User</h2>
              <form className="ban-form" onSubmit={handleBan} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div className="form-group"><label>Identifier</label><input type="text" value={banForm.identifier} onChange={e => setBanForm({ ...banForm, identifier: e.target.value })} placeholder="e.g., user:email@example.com" /></div>
                <div className="form-group"><label>IP Address</label><input type="text" value={banForm.ip} onChange={e => setBanForm({ ...banForm, ip: e.target.value })} placeholder="e.g., 192.168.1.1" /></div>
                <div className="form-group"><label>Email</label><input type="email" value={banForm.email} onChange={e => setBanForm({ ...banForm, email: e.target.value })} placeholder="e.g., user@example.com" /></div>
                <div className="form-group"><label>Reason</label><input type="text" value={banForm.reason} onChange={e => setBanForm({ ...banForm, reason: e.target.value })} placeholder="Reason for ban" /></div>
                <button type="submit" className="ban-btn" disabled={actionStatus === "banning"}>{actionStatus === "banning" ? "Banning..." : "Ban User"}</button>
                {actionStatus === "success" && <span className="action-success">Action completed!</span>}
                {actionStatus === "error" && <span className="action-error">Action failed</span>}
              </form>
            </div>
          )}

          {activeTab === "logs" && (
            <div className="admin-section">
              <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Login Attempt Logs</h2>
              <div className="admin-controls" style={{ marginBottom: "1rem" }}>
                <button onClick={async () => { setLoginLogsLoading(true); const res = await fetch(`${API_BASE}/admin/login-logs?limit=100`, { headers: { "X-Admin-Key": adminKey } }); if (res.ok) { const json = await res.json(); setLoginLogs(json.logs || []); } setLoginLogsLoading(false); }} className="refresh-btn">Refresh</button>
              </div>
              {loginLogsLoading ? <div className="admin-loading">Loading...</div> : loginLogs.length === 0 ? <p className="empty-state">No login attempts recorded</p> : (
                <div className="logs-table-wrapper">
                  <table className="logs-table">
                    <thead><tr><th>Time</th><th>Email</th><th>IP</th><th>Status</th><th>Failure Reason</th></tr></thead>
                    <tbody>
                      {loginLogs.map((log, i) => (
                        <tr key={i} className={log.success ? "log-success" : "log-failed"}>
                          <td>{new Date(log.timestamp).toLocaleString()}</td>
                          <td>{log.email}</td>
                          <td><code>{log.ip}</code></td>
                          <td><span className={`status-badge ${log.success ? "success" : "failed"}`}>{log.success ? "Success" : "Failed"}</span></td>
                          <td>{log.failure_reason || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
       )}

       {selectedUser && (
         <div className="user-card-overlay" onClick={() => setSelectedUser(null)}>
           <div className="user-card" onClick={e => e.stopPropagation()}>
             <div className="user-card-header">
               <h3>User Details</h3>
               <button className="close-btn" onClick={() => setSelectedUser(null)}>&times;</button>
             </div>
             <div className="user-card-body">
               <div className="user-info-row"><span className="info-label">IP Address</span><span className="info-value">{selectedUser.last_ip || selectedUser.identifier}</span></div>
               <div className="user-info-row"><span className="info-label">Email</span><span className="info-value">{selectedUser.email || "-"}</span></div>
               <div className="user-info-row"><span className="info-label">Date/Time</span><span className="info-value">{selectedUser.last_seen ? new Date(selectedUser.last_seen).toLocaleString() : "-"}</span></div>
               <div className="user-info-row"><span className="info-label">Total Requests</span><span className="info-value">{selectedUser.total_requests || 0}</span></div>
               <div className="user-info-row"><span className="info-label">Req/min</span><span className="info-value">{selectedUser.requests_per_minute || 0}</span></div>
               <div className="user-info-row"><span className="info-label">Last Endpoint</span><span className="info-value"><code>{selectedUser.last_endpoint || "-"}</code></span></div>
               <div className="user-info-row"><span className="info-label">Daily Limit</span><span className="info-value">{data?.user_data?.[selectedUser.identifier]?.daily_poll_limit || 10000}</span></div>
               <div className="user-info-row"><span className="info-label">Used Today</span><span className="info-value">{data?.user_data?.[selectedUser.identifier]?.polls_today || 0}</span></div>
             </div>
             <div className="user-card-actions">
               <button className="btn-sm" onClick={() => { setBanForm(prev => ({ ...prev, identifier: selectedUser.identifier, ip: selectedUser.last_ip || "" })); setSelectedUser(null); }}>Ban User</button>
               <button className="btn-sm btn-secondary" onClick={() => setSelectedUser(null)}>Close</button>
             </div>
           </div>
         </div>
       )}
     </div>
   );
}
