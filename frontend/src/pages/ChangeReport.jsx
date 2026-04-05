import { useState, useEffect } from "react";
import { fetchSimChanges, fetchSimAudit, fetchSimExplain } from "../api/backend";

export default function ChangeReport() {
  const [changes, setChanges] = useState(null);
  const [audit, setAudit] = useState(null);
  const [explain, setExplain] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("changes");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const [changesData, auditData, explainData] = await Promise.all([
        fetchSimChanges(),
        fetchSimAudit(),
        fetchSimExplain(),
      ]);
      setChanges(changesData);
      setAudit(auditData);
      setExplain(explainData);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="page-container">
        <div className="loading-state">
          <div className="spinner" />
          <p>Loading change report...</p>
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

  const report = changes?.report || {};
  const summary = changes?.summary || {};

  return (
    <div className="page-container">
      {/* Hero */}
      <section className="db-hero">
        <div className="db-status-row">
          <div className="db-status-badge">
            <span className="live-dot" />
            Explainable AI
          </div>
        </div>
        <p className="db-hero-eyebrow">Transparency & Auditability</p>
        <h1 className="db-hero-h1">
          <span>CHANGE</span>
          <span className="accent-line">REPORT</span>
          <span className="ghost-line">& AUDIT</span>
        </h1>
        <p className="db-hero-sub">
          Every change is detected, explained, and logged. No silent updates.
          Full traceability for the orbital collision monitoring system.
        </p>
      </section>

      {/* Tab Navigation */}
      <div className="hr-filter-bar">
        <div className="hr-threshold-selector">
          {["changes", "explain", "audit"].map((tab) => (
            <button
              key={tab}
              className={`hr-threshold-btn ${activeTab === tab ? "active" : ""}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
        <button className="hr-refresh-btn" onClick={loadData}>
          Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div className="db-stats-band">
        <div className="db-stats-inner">
          <StatCard
            value={report.satellites?.current_count || "—"}
            label="Satellites"
            sub={`${report.satellites?.change_pct || "0%"} change`}
            color="#00ccff"
          />
          <StatCard
            value={report.pairs?.current_count || "—"}
            label="Tracked Pairs"
            sub="closest approaches"
            color="#7c3aed"
          />
          <StatCard
            value={summary?.pair_stability || "—"}
            label="Pair Stability"
            sub="unchanged pairs"
            color="#00cc66"
          />
          <StatCard
            value={summary?.total_changes || 0}
            label="Total Changes"
            sub="this cycle"
            color="#ff8800"
          />
        </div>
      </div>

      {/* Changes Tab */}
      {activeTab === "changes" && (
        <div className="section-card">
          <h2 className="section-title">Satellite Catalog Changes</h2>
          <div className="cr-change-section">
            <div className="cr-change-grid">
              <div className="cr-change-item cr-added">
                <div className="cr-change-header">
                  <span className="cr-change-icon">+</span>
                  <span className="cr-change-label">Added</span>
                </div>
                <div className="cr-change-count">
                  {report.satellites?.added?.length || 0}
                </div>
                <div className="cr-change-list">
                  {report.satellites?.added?.slice(0, 10).map((sat, i) => (
                    <div key={i} className="cr-sat-item">
                      <span className="cr-sat-name">{sat.name}</span>
                      <span className="cr-sat-id">#{sat.norad_id}</span>
                    </div>
                  ))}
                  {(report.satellites?.added?.length || 0) > 10 && (
                    <div className="cr-more">
                      +{report.satellites.added.length - 10} more...
                    </div>
                  )}
                  {(report.satellites?.added?.length || 0) === 0 && (
                    <div className="cr-empty">No new satellites</div>
                  )}
                </div>
              </div>
              <div className="cr-change-item cr-removed">
                <div className="cr-change-header">
                  <span className="cr-change-icon">-</span>
                  <span className="cr-change-label">Removed</span>
                </div>
                <div className="cr-change-count">
                  {report.satellites?.removed?.length || 0}
                </div>
                <div className="cr-change-list">
                  {report.satellites?.removed?.slice(0, 10).map((sat, i) => (
                    <div key={i} className="cr-sat-item">
                      <span className="cr-sat-name">NORAD #{sat.norad_id}</span>
                    </div>
                  ))}
                  {(report.satellites?.removed?.length || 0) > 10 && (
                    <div className="cr-more">
                      +{report.satellites.removed.length - 10} more...
                    </div>
                  )}
                  {(report.satellites?.removed?.length || 0) === 0 && (
                    <div className="cr-empty">No removed satellites</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "changes" && (
        <div className="section-card">
          <h2 className="section-title">Pair Analysis</h2>
          <div className="cr-pairs-grid">
            <div className="cr-pair-stat">
              <span className="cr-pair-label">Preserved</span>
              <span className="cr-pair-value" style={{ color: "#00cc66" }}>
                {report.pairs?.preserved_pairs || 0}
              </span>
            </div>
            <div className="cr-pair-stat">
              <span className="cr-pair-label">New</span>
              <span className="cr-pair-value" style={{ color: "#00ccff" }}>
                {report.pairs?.new_pairs || 0}
              </span>
            </div>
            <div className="cr-pair-stat">
              <span className="cr-pair-label">Removed</span>
              <span className="cr-pair-value" style={{ color: "#ff8800" }}>
                {report.pairs?.removed_pairs || 0}
              </span>
            </div>
            <div className="cr-pair-stat">
              <span className="cr-pair-label">Changed</span>
              <span className="cr-pair-value" style={{ color: "#ffcc00" }}>
                {report.pairs?.changed_pairs || 0}
              </span>
            </div>
          </div>
          <div className="cr-explanation">
            <h4>Why fewer pairs?</h4>
            <p>
              {summary?.optimization_explanation || 
               "Using spatial binning: only adjacent altitude shells are checked."}
            </p>
          </div>
        </div>
      )}

      {/* Explain Tab */}
      {activeTab === "explain" && explain && (
        <>
          <div className="section-card">
            <h2 className="section-title">Methodology</h2>
            <div className="cr-method-grid">
              <div className="cr-method-item">
                <span className="cr-method-label">TLE Sources</span>
                <span className="cr-method-value">
                  {explain.methodology?.tle_sources?.join(", ")}
                </span>
              </div>
              <div className="cr-method-item">
                <span className="cr-method-label">Propagation Model</span>
                <span className="cr-method-value">
                  {explain.methodology?.propagation}
                </span>
              </div>
              <div className="cr-method-item">
                <span className="cr-method-label">Position Calculation</span>
                <span className="cr-method-value">
                  {explain.methodology?.position_calculation}
                </span>
              </div>
              <div className="cr-method-item">
                <span className="cr-method-label">Detection Algorithm</span>
                <span className="cr-method-value">
                  {explain.methodology?.conjunction_detection}
                </span>
              </div>
            </div>
          </div>

          <div className="section-card">
            <h2 className="section-title">Performance vs Accuracy</h2>
            <div className="cr-tradeoff">
              <div className="cr-tradeoff-item">
                <h4>Algorithm</h4>
                <p>{explain.performance?.algorithm}</p>
              </div>
              <div className="cr-tradeoff-item">
                <h4>Shell Size</h4>
                <p>{explain.performance?.shell_size_km} km altitude bins</p>
              </div>
              <div className="cr-tradeoff-item cr-tradeoff-full">
                <h4>Why Pairs Reduced?</h4>
                <p>{explain.performance?.why_pairs_reduced}</p>
              </div>
              <div className="cr-tradeoff-item cr-tradeoff-full">
                <h4>Accuracy Tradeoff</h4>
                <p>{explain.performance?.accuracy_tradeoff}</p>
              </div>
            </div>
          </div>

          <div className="section-card">
            <h2 className="section-title">Change Detection</h2>
            <div className="cr-method-grid">
              <div className="cr-method-item">
                <span className="cr-method-label">Tracked Fields</span>
                <span className="cr-method-value">
                  {explain.change_detection?.tracked_fields?.join(", ")}
                </span>
              </div>
              <div className="cr-method-item">
                <span className="cr-method-label">Deduplication</span>
                <span className="cr-method-value">
                  {explain.change_detection?.deduplication}
                </span>
              </div>
              <div className="cr-method-item">
                <span className="cr-method-label">Validation</span>
                <span className="cr-method-value">
                  {explain.change_detection?.validation}
                </span>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Audit Tab */}
      {activeTab === "audit" && audit && (
        <div className="section-card">
          <h2 className="section-title">Audit Trail</h2>
          <p className="section-desc">
            Recent change log entries ({audit.total_entries} total entries)
          </p>
          <div className="cr-audit-list">
            {audit.entries?.map((entry, i) => (
              <div key={i} className="cr-audit-entry">
                <div className="cr-audit-header">
                  <span className="cr-audit-action">{entry.action}</span>
                  <span className="cr-audit-time">
                    {new Date(entry.timestamp).toLocaleString()}
                  </span>
                </div>
                {entry.reason && (
                  <div className="cr-audit-reason">{entry.reason}</div>
                )}
                <div className="cr-audit-details">
                  {JSON.stringify(entry.details, null, 2)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Data timestamp */}
      <div className="data-timestamp">
        Last updated: {changes?.timestamp_utc ? new Date(changes.timestamp_utc).toLocaleString() : "-"}
        <br />
        Source: Explainable Satellite Collision System
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
