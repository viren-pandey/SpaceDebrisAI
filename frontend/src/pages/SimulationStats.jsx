import { useState, useEffect } from "react";
import { fetchSimStats } from "../api/backend";

const RISK_COLORS = {
  CRITICAL: "#ff4444",
  HIGH: "#ff8800",
  MEDIUM: "#ffcc00",
  LOW: "#00cc66",
};

export default function SimulationStats() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 60000);
    return () => clearInterval(interval);
  }, []);

  async function loadData() {
    try {
      const result = await fetchSimStats();
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
          <p>Loading simulation statistics...</p>
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

  const riskDist = data?.risk_distribution || {};
  const catalogChanges = data?.catalog_changes || {};

  return (
    <div className="page-container">
      {/* Hero */}
      <section className="db-hero">
        <div className="db-status-row">
          <div className="db-status-badge">
            <span className="live-dot" />
            Live Statistics
          </div>
        </div>
        <p className="db-hero-eyebrow">Real-time Orbital Screening</p>
        <h1 className="db-hero-h1">
          <span>SIMULATION</span>
          <span className="accent-line">STATISTICS</span>
          <span className="ghost-line">DASHBOARD</span>
        </h1>
        <p className="db-hero-sub">
          Real-time monitoring of orbital screening performance, catalog changes, 
          and risk distribution across the debris and satellite population.
        </p>
      </section>

      {/* Refresh Control */}
      <div className="hr-filter-bar">
        <span className="hr-filter-label">Auto-refresh: Every 60 seconds</span>
        <button className="hr-refresh-btn" onClick={handleRefresh} disabled={refreshing}>
          {refreshing ? "Refreshing..." : "Refresh Now"}
        </button>
      </div>

      {/* Main Stats Grid */}
      <div className="db-stats-band">
        <div className="db-stats-inner">
          <StatCard
            value={data?.satellites_screened?.toLocaleString() || "—"}
            label="Satellites Screened"
            sub="in current cycle"
            color="#00ccff"
          />
          <StatCard
            value={data?.total_catalog_records?.toLocaleString() || "—"}
            label="Total Catalog"
            sub="debris + satellites"
            color="#7c3aed"
          />
          <StatCard
            value={data?.pairs_checked?.toLocaleString() || "—"}
            label="Pairs Checked"
            sub="conjunctions analyzed"
            color="#ff8800"
          />
          <StatCard
            value={data?.processing_ms || "—"}
            label="Processing Time"
            sub="milliseconds"
            color="#00cc66"
          />
        </div>
      </div>

      {/* Catalog Changes */}
      {(catalogChanges.added > 0 || catalogChanges.removed > 0) && (
        <div className="section-card">
          <h2 className="section-title">Catalog Changes</h2>
          <div className="ss-changes-grid">
            <div className="ss-change-item ss-change-added">
              <div className="ss-change-icon">+</div>
              <div className="ss-change-value">{catalogChanges.added}</div>
              <div className="ss-change-label">New Objects Added</div>
            </div>
            <div className="ss-change-item ss-change-removed">
              <div className="ss-change-icon">-</div>
              <div className="ss-change-value">{catalogChanges.removed}</div>
              <div className="ss-change-label">Objects Removed</div>
            </div>
          </div>
        </div>
      )}

      {/* Risk Distribution */}
      <div className="section-card">
        <h2 className="section-title">Risk Distribution</h2>
        <div className="ss-risk-grid">
          {["CRITICAL", "HIGH", "MEDIUM", "LOW"].map((level) => {
            const count = riskDist[level] || 0;
            const total = Object.values(riskDist).reduce((a, b) => a + b, 0);
            const pct = total > 0 ? (count / total) * 100 : 0;
            return (
              <div
                key={level}
                className="ss-risk-card"
                style={{ borderColor: getRiskColor(level) + "40" }}
              >
                <div className="ss-risk-header">
                  <span
                    className="ss-risk-badge"
                    style={{
                      backgroundColor: getRiskColor(level) + "20",
                      color: getRiskColor(level),
                    }}
                  >
                    {level}
                  </span>
                  <span className="ss-risk-count" style={{ color: getRiskColor(level) }}>
                    {count}
                  </span>
                </div>
                <div className="ss-risk-bar-bg">
                  <div
                    className="ss-risk-bar"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: getRiskColor(level),
                    }}
                  />
                </div>
                <div className="ss-risk-pct">{pct.toFixed(1)}%</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="section-card">
        <h2 className="section-title">Performance Metrics</h2>
        <div className="ss-perf-grid">
          <div className="ss-perf-item">
            <div className="ss-perf-icon">🚀</div>
            <div className="ss-perf-label">Processing Speed</div>
            <div className="ss-perf-value">
              {data?.pairs_checked && data?.processing_ms
                ? `${(data.pairs_checked / data.processing_ms * 1000).toFixed(0)}`
                : "—"} pairs/sec
            </div>
          </div>
          <div className="ss-perf-item">
            <div className="ss-perf-icon">📡</div>
            <div className="ss-perf-label">Data Source</div>
            <div className="ss-perf-value">{data?.tle_source?.toUpperCase() || "—"}</div>
          </div>
          <div className="ss-perf-item">
            <div className="ss-perf-icon">🛰️</div>
            <div className="ss-perf-label">Coverage</div>
            <div className="ss-perf-value">
              {data?.satellites_screened && data?.total_catalog_records
                ? `${((data.satellites_screened / data.total_catalog_records) * 100).toFixed(1)}%`
                : "—"} of catalog
            </div>
          </div>
          <div className="ss-perf-item">
            <div className="ss-perf-icon">⚠️</div>
            <div className="ss-perf-label">High-Risk Rate</div>
            <div className="ss-perf-value">
              {riskDist.CRITICAL + riskDist.HIGH > 0
                ? `${((riskDist.CRITICAL + riskDist.HIGH) / Object.values(riskDist).reduce((a, b) => a + b, 0) * 100).toFixed(1)}%`
                : "0.0%"}
            </div>
          </div>
        </div>
      </div>

      {/* Screening Details */}
      <div className="section-card">
        <h2 className="section-title">Screening Details</h2>
        <div className="ss-details-grid">
          <div className="ss-detail-row">
            <span className="ss-detail-label">Screening Mode</span>
            <span className="ss-detail-value">Nearest-20 Conjunction Analysis</span>
          </div>
          <div className="ss-detail-row">
            <span className="ss-detail-label">Algorithm</span>
            <span className="ss-detail-value">SGP4 + Relative Motion Model</span>
          </div>
          <div className="ss-detail-row">
            <span className="ss-detail-label">Risk Classification</span>
            <span className="ss-detail-value">Multi-factor: distance, altitude, velocity</span>
          </div>
          <div className="ss-detail-row">
            <span className="ss-detail-label">Maneuver Recommendations</span>
            <span className="ss-detail-value">Altitude-based avoidance maneuvers</span>
          </div>
        </div>
      </div>

      {/* Catalog Info */}
      <div className="section-card">
        <h2 className="section-title">Data Sources</h2>
        <div className="ss-source-grid">
          <div className="ss-source-item">
            <div className="ss-source-name">Primary</div>
            <div className="ss-source-value">KeepTrack Space API</div>
            <div className="ss-source-desc">Real-time TLE catalog updates</div>
          </div>
          <div className="ss-source-item">
            <div className="ss-source-name">Fallback</div>
            <div className="ss-source-value">CelesTrak</div>
            <div className="ss-source-desc">NORAD element sets</div>
          </div>
          <div className="ss-source-item">
            <div className="ss-source-name">Cache TTL</div>
            <div className="ss-source-value">1 Hour</div>
            <div className="ss-source-desc">Auto-refresh enabled</div>
          </div>
        </div>
      </div>

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
