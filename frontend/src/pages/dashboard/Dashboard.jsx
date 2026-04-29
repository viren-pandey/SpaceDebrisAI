import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { fetchPollUsage } from "../../api/dashboard";
import DashboardLayout from "../../components/dashboard/DashboardLayout";

export default function Dashboard() {
  const { user, isOwner } = useAuth();
  const navigate = useNavigate();
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { navigate("/login", { state: { from: "/dashboard" } }); return; }
    fetchPollUsage().then(setUsage).catch(() => setUsage({ polls_used_today: 0, daily_poll_limit: 10000 })).finally(() => setLoading(false));
  }, [user, navigate]);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="spinner" /></div>;

  const used = usage?.polls_used_today ?? 0;
  const limit = usage?.daily_poll_limit ?? 10000;
  const pct = (used / limit) * 100;
  const resetIn = usage?.reset_in_seconds ?? 86400;
  const hours = Math.floor(resetIn / 3600);
  const mins = Math.floor((resetIn % 3600) / 60);
  const secs = resetIn % 60;

  return (
    <DashboardLayout>
      <div className="welcome-banner">
        <h1>Welcome back, {user?.email?.split("@")[0]}</h1>
        {isOwner && <span className="owner-badge">Owner</span>}
      </div>
      <div className="poll-usage-card">
        <div className="poll-usage-header">
          <h2>{used.toLocaleString()} / {limit.toLocaleString()}</h2>
          <p>polls today</p>
        </div>
        <div className="poll-bar">
          <div className={`poll-bar-fill ${pct > 95 ? "red" : pct > 80 ? "orange" : ""}`} style={{ width: `${Math.min(pct, 100)}%` }} />
        </div>
        <p className="poll-reset">Resets in {hours}h {mins}m {secs}s</p>
      </div>
      <div className="dashboard-stats">
        <div className="stat-card"><h3>Daily Limit</h3><p>{limit.toLocaleString()}</p></div>
        <div className="stat-card"><h3>Used Today</h3><p>{used.toLocaleString()}</p></div>
        <div className="stat-card"><h3>Remaining</h3><p>{Math.max(0, limit - used).toLocaleString()}</p></div>
      </div>
      {pct > 80 && <div className="limit-warning"><p>Need more polls? <Link to="/dashboard/contact">Contact the author</Link></p></div>}
      <div className="quick-links">
        <Link to="/dashboard/api-keys" className="quick-link">Manage API Keys</Link>
        <Link to="/dashboard/usage" className="quick-link">View Usage</Link>
        <Link to="/dashboard/settings" className="quick-link">Settings</Link>
      </div>
    </DashboardLayout>
  );
}
