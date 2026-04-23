import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { fetchPollUsage, fetchUsageHistory } from "../../api/dashboard";
import DashboardLayout from "../../components/dashboard/DashboardLayout";

export default function Usage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [history, setHistory] = useState([]);
  const [current, setCurrent] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { navigate("/login"); return; }
    Promise.all([
      fetchPollUsage().catch(() => ({ polls_used_today: 0, daily_poll_limit: 10000 })),
      fetchUsageHistory().catch(() => []),
    ]).then(([u, h]) => {
      setCurrent(u);
      setHistory(h);
      setLoading(false);
    });
  }, [user, navigate]);

  if (loading) return <DashboardLayout><div className="dash-loading"><div className="spinner" /></div></DashboardLayout>;

  const used = current?.polls_used_today ?? 0;
  const limit = current?.daily_poll_limit ?? 10000;
  const pct = limit > 0 ? (used / limit) * 100 : 0;

  return (
    <DashboardLayout>
      <div className="dash-page">
        <div className="dash-welcome">
          <h1>Usage History</h1>
        </div>

        <div className="dash-usage-section">
          <div className="dash-usage-card">
            <div className="dash-usage-label">
              <h2>Today&apos;s Usage</h2>
            </div>
            <div className="dash-usage-big">
              <span className="dash-usage-used">{used.toLocaleString()}</span>
              <span className="dash-usage-sep">/</span>
              <span className="dash-usage-limit">{limit.toLocaleString()}</span>
            </div>
            <div className="dash-usage-bar">
              <div className={`dash-usage-fill ${pct > 95 ? "critical" : pct > 80 ? "warning" : ""}`} style={{ width: `${Math.min(pct, 100)}%` }} />
            </div>
          </div>
        </div>

        {history.length > 0 ? (
          <div className="usage-history-list">
            {history.map(row => (
              <div key={row.date} className="usage-row">
                <span className="usage-row-date">{row.date}</span>
                <span className="usage-row-polls">{row.polls.toLocaleString()} polls</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="dash-no-key">
            <h3>No usage data yet</h3>
            <p>Start making API calls to see your usage history here.</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
