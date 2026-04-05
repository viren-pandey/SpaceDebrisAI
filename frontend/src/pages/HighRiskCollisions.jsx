import { useState, useEffect } from "react";
import { fetchSimHighRisk } from "../api/backend";

const RISK_COLORS = {
  CRITICAL: "#ff4444",
  HIGH: "#ff8800",
  MEDIUM: "#ffcc00",
  LOW: "#00cc66",
};

export default function HighRiskCollisions() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [threshold, setThreshold] = useState("HIGH");
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadData();
  }, [threshold]);

  async function loadData() {
    try {
      setLoading(true);
      const result = await fetchSimHighRisk(threshold);
      setData(result);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }

  function getRiskColor(level) {
    return RISK_COLORS[level] || RISK_COLORS.LOW;
  }

  if (loading) {
    return (
      <div className="page-container">
        <div className="loading-state">
          <div className="spinner" />
          <p>Loading high-risk collision data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-container">
        <div className="error-state">
          <p>{error}</p>
          <button onClick={loadData}>Retry</button>
        </div>
      </div>
    );
  }

  const collisions = data?.high_risk_collisions || [];

  return (
    <div className="page-container">
      {/* Hero */}
      <section className="db-hero">
        <div className="db-status-row">
          <div className="db-status-badge" style={{ borderColor: getRiskColor(threshold), backgroundColor: getRiskColor(threshold) + "15" }}>
            <span className="live-dot" style={{ backgroundColor: getRiskColor(threshold), boxShadow: `0 0 8px ${getRiskColor(threshold)}` }} />
            {threshold} RISK
          </div>
        </div>
        <p className="db-hero-eyebrow">Conjunction Screening Results</p>
        <h1 className="db-hero-h1">
          <span>HIGH-RISK</span>
          <span className="accent-line">COLLISIONS</span>
          <span className="ghost-line">MONITOR</span>
        </h1>
        <p className="db-hero-sub">
          Real-time screening of satellite conjunctions with risk assessment based on miss distance, 
          relative velocity, and probability of collision.
        </p>
      </section>

      {/* Filter Controls */}
      <div className="hr-filter-bar">
        <div className="hr-threshold-selector">
          <span className="hr-filter-label">Risk Threshold:</span>
          {["CRITICAL", "HIGH", "MEDIUM"].map((level) => (
            <button
              key={level}
              className={`hr-threshold-btn ${threshold === level ? "active" : ""}`}
              style={{
                borderColor: threshold === level ? getRiskColor(level) : "transparent",
                backgroundColor: threshold === level ? getRiskColor(level) + "20" : "transparent",
                color: threshold === level ? getRiskColor(level) : undefined,
              }}
              onClick={() => setThreshold(level)}
            >
              {level}
            </button>
          ))}
        </div>
        <button className="hr-refresh-btn" onClick={handleRefresh} disabled={refreshing}>
          {refreshing ? "Refreshing..." : "Refresh Data"}
        </button>
      </div>

      {/* Stats Summary */}
      <div className="db-stats-band">
        <div className="db-stats-inner">
          <StatCard
            value={data?.count || 0}
            label="High-Risk Events"
            sub={`threshold: ${threshold}`}
            color="#ff4444"
          />
          <StatCard
            value={collisions.filter(c => c.risk_level === "CRITICAL").length}
            label="Critical"
            sub="immediate action"
            color="#ff4444"
          />
          <StatCard
            value={collisions.filter(c => c.risk_level === "HIGH").length}
            label="High"
            sub="maneuver recommended"
            color="#ff8800"
          />
          <StatCard
            value={collisions.filter(c => c.risk_level === "MEDIUM").length}
            label="Medium"
            sub="monitor closely"
            color="#ffcc00"
          />
        </div>
      </div>

      {/* Risk Distribution */}
      {data?.count > 0 && (
        <div className="section-card">
          <h2 className="section-title">Risk Distribution</h2>
          <div className="hr-risk-dist">
            {["CRITICAL", "HIGH", "MEDIUM"].map((level) => {
              const count = collisions.filter(c => c.risk_level === level).length;
              const pct = data.count > 0 ? (count / data.count) * 100 : 0;
              return (
                <div key={level} className="hr-dist-item">
                  <div className="hr-dist-header">
                    <span className="hr-dist-label" style={{ color: getRiskColor(level) }}>{level}</span>
                    <span className="hr-dist-count">{count}</span>
                  </div>
                  <div className="hr-dist-bar-bg">
                    <div
                      className="hr-dist-bar"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: getRiskColor(level),
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Collision Cards */}
      {collisions.length > 0 ? (
        <div className="hr-collisions-list">
          {collisions.map((collision, idx) => (
            <div
              key={idx}
              className="hr-collision-card"
              style={{ borderLeftColor: getRiskColor(collision.risk_level) }}
            >
              <div className="hr-collision-header">
                <div className="hr-collision-names">
                  <span className="hr-sat-name">{collision.satellites[0]}</span>
                  <span className="hr-vs">vs</span>
                  <span className="hr-sat-name">{collision.satellites[1]}</span>
                </div>
                <span
                  className="hr-risk-badge"
                  style={{
                    backgroundColor: getRiskColor(collision.risk_level) + "20",
                    borderColor: getRiskColor(collision.risk_level),
                    color: getRiskColor(collision.risk_level),
                  }}
                >
                  {collision.risk_level}
                </span>
              </div>

              <div className="hr-collision-grid">
                <div className="hr-metric">
                  <span className="hr-metric-label">Miss Distance</span>
                  <span className="hr-metric-value" style={{ color: "#00ccff" }}>
                    {collision.miss_distance_km?.toFixed(2) || "—"} km
                  </span>
                </div>
                <div className="hr-metric">
                  <span className="hr-metric-label">Relative Velocity</span>
                  <span className="hr-metric-value">
                    {collision.relative_velocity_km_s?.toFixed(3) || "—"} km/s
                  </span>
                </div>
                <div className="hr-metric">
                  <span className="hr-metric-label">Probability</span>
                  <span className="hr-metric-value pc">
                    {collision.probability_of_collision?.toExponential(2) || "—"}
                  </span>
                </div>
                <div className="hr-metric">
                  <span className="hr-metric-label">Risk Score</span>
                  <span className="hr-metric-value" style={{ color: getRiskColor(collision.risk_level) }}>
                    {collision.risk_score || "—"}
                  </span>
                </div>
              </div>

              {collision.tca_time && (
                <div className="hr-tca">
                  Time of Closest Approach: {new Date(collision.tca_time).toLocaleString()}
                </div>
              )}

              <div className="hr-maneuver">
                <strong>Recommended Action:</strong> {collision.maneuver}
              </div>

              {collision.norad_ids && collision.norad_ids[0] && (
                <div className="hr-norad">
                  NORAD IDs: {collision.norad_ids.filter(Boolean).join(", ") || "—"}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="section-card">
          <div className="hr-empty">
            <div className="hr-empty-icon">✓</div>
            <h3>No High-Risk Events</h3>
            <p>No collisions found above the {threshold} risk threshold.</p>
          </div>
        </div>
      )}

      {/* Data timestamp */}
      <div className="data-timestamp">
        Last updated: {data?.timestamp_utc ? new Date(data.timestamp_utc).toLocaleString() : "-"}
        <br />
        Source: Real-time orbital screening simulation
      </div>
    </div>
  );
}

function StatCard({ value, label, sub, color }) {
  return (
    <div className="db-stat-card">
      <span className="db-stat-value" style={{ color: color || "inherit" }}>{value}</span>
      <span className="db-stat-label">{label}</span>
      {sub && <span className="db-stat-sub">{sub}</span>}
    </div>
  );
}
