import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { fetchPollUsage, fetchUsageHistory, submitContact } from "../../api/dashboard";
import DashboardLayout from "../../components/dashboard/DashboardLayout";

export default function Usage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [history, setHistory] = useState([]);
  const [current, setCurrent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showContact, setShowContact] = useState(false);
  const [contactMsg, setContactMsg] = useState("");
  const [contactStatus, setContactStatus] = useState(null);

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

  const handleContactAdmin = async (e) => {
    e.preventDefault();
    if (!contactMsg.trim()) return;
    setContactStatus("sending");
    try {
      await submitContact({
        name: user?.name || user?.email || "User",
        email: user?.email || "",
        subject: "Request more API credits",
        message: `User ${user?.email} is requesting more API credits. Current limit: ${limit}. Used: ${used}. Request: ${contactMsg}`
      });
      setContactStatus("sent");
      setContactMsg("");
      setTimeout(() => setContactStatus(null), 3000);
    } catch {
      setContactStatus("error");
    }
  };

  if (loading) return <DashboardLayout><div className="dash-loading"><div className="spinner" /></div></DashboardLayout>;

  const used = current?.polls_used_today ?? 0;
  const limit = current?.daily_poll_limit ?? 10000;
  const remaining = Math.max(0, limit - used);
  const pct = limit > 0 ? (used / limit) * 100 : 0;
  const isLow = remaining < limit * 0.2;

  return (
    <DashboardLayout>
      <div className="dash-page">
        <div className="dash-welcome">
          <h1>API Usage</h1>
          <p className="dash-subtitle">Registered account • {user?.email}</p>
        </div>

        <div className="dash-usage-section">
          <div className="dash-usage-card registered">
            <div className="dash-usage-label">
              <h2>Today&apos;s API Credits</h2>
              {isLow && <span className="dash-badge warning">Low Credits</span>}
            </div>
            <div className="dash-usage-big">
              <span className="dash-usage-remaining">{remaining.toLocaleString()}</span>
              <span className="dash-usage-sep">/</span>
              <span className="dash-usage-limit">{limit.toLocaleString()}</span>
              <span className="dash-usage-label-sm">remaining</span>
            </div>
            <div className="dash-usage-bar">
              <div className={`dash-usage-fill ${pct > 95 ? "critical" : pct > 80 ? "warning" : "registered"}`} style={{ width: `${Math.min(pct, 100)}%` }} />
            </div>
            <div className="dash-usage-detail">
              <span>{used.toLocaleString()} used</span>
              <span>{remaining.toLocaleString()} left</span>
            </div>
          </div>

          {remaining < 100 && (
            <div className="dash-usage-card contact-card">
              <h3>Need more credits?</h3>
              <p>Your API credits are running low. Contact the admin to request a limit increase.</p>
              <button className="dash-btn dash-btn-primary" onClick={() => setShowContact(true)}>
                Contact Admin
              </button>
            </div>
          )}
        </div>

        {showContact && (
          <div className="dash-modal-overlay" onClick={() => setShowContact(false)}>
            <div className="dash-modal" onClick={e => e.stopPropagation()}>
              <h3>Request More API Credits</h3>
              <form onSubmit={handleContactAdmin}>
                <textarea
                  className="dash-textarea"
                  rows={4}
                  placeholder="Explain why you need more credits..."
                  value={contactMsg}
                  onChange={e => setContactMsg(e.target.value)}
                />
                <div className="dash-modal-actions">
                  <button type="button" className="dash-btn" onClick={() => setShowContact(false)}>Cancel</button>
                  <button type="submit" className="dash-btn dash-btn-primary" disabled={contactStatus === "sending"}>
                    {contactStatus === "sending" ? "Sending..." : "Send Request"}
                  </button>
                </div>
                {contactStatus === "sent" && <p className="dash-success">Request sent!</p>}
                {contactStatus === "error" && <p className="dash-error">Failed to send. Try again.</p>}
              </form>
            </div>
          </div>
        )}

        <div className="dash-usage-section">
          <h2>Usage History</h2>
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
      </div>
    </DashboardLayout>
  );
}
