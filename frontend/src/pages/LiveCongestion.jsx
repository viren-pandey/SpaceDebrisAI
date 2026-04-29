import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

const ADMIN_KEY = import.meta.env.VITE_ADMIN_KEY;
const API_BASE = import.meta.env.VITE_API_URL || "https://virenn77-spacedebrisai.hf.space";

export default function LiveCongestion() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [polls, setPolls] = useState([]);
  const [adminKey, setAdminKey] = useState(() => localStorage.getItem("congestion_key") || "");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    localStorage.setItem("congestion_key", adminKey);
  }, [adminKey]);

  useEffect(() => {
    if (adminKey === ADMIN_KEY) {
      setIsAuthenticated(true);
    } else {
      setIsAuthenticated(false);
      setData(null);
      setPolls([]);
    }
  }, [adminKey]);

  const fetchData = async () => {
    if (!adminKey || adminKey !== ADMIN_KEY) {
      setError("Valid API key required");
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const [congRes, pollsRes] = await Promise.all([
        fetch(`${API_BASE}/usage/congestion`, {
          headers: { "X-Admin-Key": adminKey },
        }),
        fetch(`${API_BASE}/usage/polls`, {
          headers: { "X-Admin-Key": adminKey },
        }),
      ]);

      if (!congRes.ok || !pollsRes.ok) {
        const err = await congRes.json().catch(() => ({ detail: "Failed to fetch" }));
        throw new Error(err.detail || "Failed to fetch");
      }

      const congData = await congRes.json();
      const pollsData = await pollsRes.json();

      setData(congData);
      setPolls(pollsData.polls || []);
      setHistory((prev) => {
        const newHistory = [...prev, { ...congData, timestamp: Date.now() }];
        return newHistory.slice(-30);
      });
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
      const interval = setInterval(fetchData, 3000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, adminKey]);

  const maxConnections = Math.max(data?.total_active_connections || 1, 1);

  if (!isAuthenticated) {
    return (
      <div className="congestion-page">
        <div className="congestion-header">
          <h1>Live API Congestion</h1>
        </div>
        <div className="congestion-auth">
          <h2>API Key Required</h2>
          <p>Enter your API key to view live congestion data</p>
          <input
            type="password"
            placeholder="Enter API Key"
            value={adminKey}
            onChange={(e) => setAdminKey(e.target.value)}
            className="admin-key-input"
          />
          {error && <div className="congestion-error">{error}</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="congestion-page">
      <div className="congestion-header">
        <h1>Live API Congestion</h1>
        <div className="congestion-controls">
          <input
            type="password"
            placeholder="API Key"
            value={adminKey}
            onChange={(e) => setAdminKey(e.target.value)}
            className="admin-key-input"
          />
          <button onClick={fetchData} className="refresh-btn">
            Refresh
          </button>
        </div>
      </div>

      {error && <div className="congestion-error">{error}</div>}

      {loading && !data ? (
        <div className="congestion-loading">Loading congestion data...</div>
      ) : (
        <>
          <div className="congestion-metrics">
            <div className="metric-card large">
              <div className="metric-value">{data?.total_active_connections || 0}</div>
              <div className="metric-label">Active Connections</div>
              <div className="metric-bar">
                <div
                  className="metric-bar-fill"
                  style={{ width: `${Math.min((data?.total_active_connections || 0) / 50 * 100, 100)}%` }}
                />
              </div>
            </div>
            <div className="metric-card large">
              <div className="metric-value">{data?.unique_users_polling || 0}</div>
              <div className="metric-label">Unique Users Polling</div>
              <div className="metric-bar">
                <div
                  className="metric-bar-fill users"
                  style={{ width: `${Math.min((data?.unique_users_polling || 0) / 20 * 100, 100)}%` }}
                />
              </div>
            </div>
          </div>

          <div className="congestion-grid">
            <div className="endpoint-stats">
              <h2>Requests by Endpoint</h2>
              <div className="endpoint-list">
                {Object.entries(data?.by_endpoint || {}).length === 0 ? (
                  <p className="empty-state">No active endpoints</p>
                ) : (
                  Object.entries(data?.by_endpoint || {}).map(([endpoint, count]) => (
                    <div key={endpoint} className="endpoint-item">
                      <div className="endpoint-name">
                        <code>{endpoint}</code>
                      </div>
                      <div className="endpoint-bar-container">
                        <div
                          className="endpoint-bar"
                          style={{ width: `${(count / maxConnections) * 100}%` }}
                        />
                      </div>
                      <div className="endpoint-count">{count}</div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="history-chart">
              <h2>Connection History</h2>
              <div className="chart-container">
                <svg viewBox="0 0 300 100" className="history-svg">
                  <polyline
                    fill="none"
                    stroke="var(--accent, #00d4ff)"
                    strokeWidth="2"
                    points={history
                      .map((h, i) => {
                        const x = (i / (history.length - 1 || 1)) * 300;
                        const y = 100 - (h.total_active_connections / (maxConnections * 1.5)) * 100;
                        return `${x},${Math.max(y, 5)}`;
                      })
                      .join(" ")}
                  />
                </svg>
                <div className="chart-labels">
                  <span>{history[0] ? new Date(history[0].timestamp).toLocaleTimeString() : ""}</span>
                  <span>{history[history.length - 1] ? new Date(history[history.length - 1].timestamp).toLocaleTimeString() : ""}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="live-polls">
            <h2>Live Polling Users</h2>
            {polls.length === 0 ? (
              <p className="empty-state">No active polling requests</p>
            ) : (
              <div className="polls-grid">
                {polls.map((poll, idx) => (
                  <div key={idx} className="poll-card">
                    <div className="poll-header">
                      <span className={`poll-indicator ${poll.active_seconds > 60 ? "warning" : "active"}`} />
                      <span className="poll-identifier">{poll.identifier}</span>
                    </div>
                    <div className="poll-details">
                      <div className="poll-row">
                        <span className="poll-label">IP:</span>
                        <span className="poll-value">{poll.ip}</span>
                      </div>
                      <div className="poll-row">
                        <span className="poll-label">Endpoint:</span>
                        <code className="poll-value">{poll.endpoint}</code>
                      </div>
                      <div className="poll-row">
                        <span className="poll-label">Active:</span>
                        <span className="poll-value">{poll.active_seconds}s</span>
                      </div>
                      <div className="poll-row">
                        <span className="poll-label">Polls:</span>
                        <span className="poll-value">{poll.poll_count}</span>
                      </div>
                    </div>
                    <div className="poll-progress">
                      <div
                        className="poll-progress-bar"
                        style={{ width: `${Math.min(poll.active_seconds / 300 * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="congestion-timestamp">
            Last updated: {data?.timestamp ? new Date(data.timestamp).toLocaleString() : "-"}
          </div>
        </>
      )}
    </div>
  );
}
