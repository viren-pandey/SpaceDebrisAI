import { useState, useEffect } from "react";
import { fetchShellInstability } from "../api/backend";

export default function ShellInstability() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedShell, setSelectedShell] = useState(null);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 600000); // Refresh every 10 minutes
    return () => clearInterval(interval);
  }, []);

  async function loadData() {
    try {
      const result = await fetchShellInstability(null, 50);
      setData(result);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function getOiiColor(score) {
    if (score >= 75) return "#ff4444";
    if (score >= 50) return "#ff8800";
    if (score >= 30) return "#ffcc00";
    return "#00cc66";
  }

  function getRiskBadgeClass(level) {
    switch (level) {
      case "CRITICAL": return "risk-badge critical";
      case "HIGH": return "risk-badge high";
      case "MEDIUM": return "risk-badge medium";
      case "LOW": return "risk-badge low";
      default: return "risk-badge nominal";
    }
  }

  if (loading) {
    return (
      <div className="page-container">
        <div className="loading-state">
          <div className="spinner" />
          <p>Analyzing orbital shells...</p>
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

  const shells = data?.shells || [];

  return (
    <div className="page-container">
      {/* Hero */}
      <section className="db-hero">
        <div className="db-status-row">
          <div className="db-status-badge">
            <span className="live-dot" />
            Shell Intelligence Active
          </div>
        </div>
        <p className="db-hero-eyebrow">Orbital Instability Index</p>
        <h1 className="db-hero-h1">
          <span>SHELL</span>
          <span className="accent-line">INSTABILITY</span>
          <span className="ghost-line">ANALYZER</span>
        </h1>
        <p className="db-hero-sub">
          Shell-level risk metrics including object density, constellation diversity,
          maneuver cluster probability, and the Orbital Instability Index (OII).
        </p>
      </section>

      {/* Stats band */}
      <div className="db-stats-band">
        <div className="db-stats-inner">
          <StatCard value={data?.shell_count || 0} label="Active Shells" sub="75km bands" />
          <StatCard value={data?.total_objects_analyzed?.toLocaleString() || "—"} label="Objects Analyzed" sub="TLE catalog" />
          <StatCard value={`${data?.processing_ms || "—"}ms`} label="Processing Time" sub="analysis speed" />
        </div>
      </div>

      {/* Shell table */}
      <div className="section-card">
        <h2 className="section-title">Shell Risk Ranking</h2>
        <p className="section-desc">
          Shells sorted by Orbital Instability Index (OII). Higher OII indicates
          greater risk of cascading events and maneuver conflicts.
        </p>

        <div className="shell-table-wrapper">
          <table className="shell-table">
            <thead>
              <tr>
                <th>Altitude Band</th>
                <th>OII Score</th>
                <th>Risk Level</th>
                <th>Objects</th>
                <th>Active</th>
                <th>Debris</th>
                <th>Density</th>
                <th>Congestion</th>
                <th>Maneuver Prob</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {shells.map((shell, idx) => (
                <tr
                  key={idx}
                  className={selectedShell === idx ? "selected" : ""}
                  onClick={() => setSelectedShell(selectedShell === idx ? null : idx)}
                >
                  <td>
                    <div className="altitude-cell">
                      <span className="alt-value">{shell.shell_altitude_km} km</span>
                      <span className="alt-range">
                        {shell.shell_altitude_km}–{shell.shell_ceil_km} km
                      </span>
                    </div>
                  </td>
                  <td>
                    <div className="oii-cell">
                      <div
                        className="oii-bar"
                        style={{
                          width: `${shell.oii_score}%`,
                          backgroundColor: getOiiColor(shell.oii_score),
                        }}
                      />
                      <span className="oii-value" style={{ color: getOiiColor(shell.oii_score) }}>
                        {shell.oii_score.toFixed(1)}
                      </span>
                    </div>
                  </td>
                  <td>
                    <span className={getRiskBadgeClass(shell.risk_level)}>
                      {shell.risk_level}
                    </span>
                  </td>
                  <td className="num-cell">{shell.object_count?.toLocaleString()}</td>
                  <td className="num-cell active-cell">{shell.active_satellites?.toLocaleString()}</td>
                  <td className="num-cell debris-cell">{shell.debris_count?.toLocaleString()}</td>
                  <td className="num-cell">{shell.density_per_million_km3?.toFixed(2)}</td>
                  <td className="num-cell">{(shell.congestion_index * 100).toFixed(0)}%</td>
                  <td className="num-cell">{(shell.maneuver_cluster_probability * 100).toFixed(0)}%</td>
                  <td>
                    <button className="expand-btn">
                      {selectedShell === idx ? "−" : "+"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Selected shell detail */}
      {selectedShell !== null && shells[selectedShell] && (
        <div className="section-card shell-detail">
          <h2 className="section-title">
            Shell Detail: {shells[selectedShell].shell_altitude_km} km
          </h2>

          <div className="shell-detail-grid">
            <div className="detail-section">
              <h3>Risk Assessment</h3>
              <div className="detail-item">
                <span className="detail-label">OII Score</span>
                <span
                  className="detail-value oii-large"
                  style={{ color: getOiiColor(shells[selectedShell].oii_score) }}
                >
                  {shells[selectedShell].oii_score.toFixed(1)}
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Risk Level</span>
                <span className={getRiskBadgeClass(shells[selectedShell].risk_level)}>
                  {shells[selectedShell].risk_level}
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Recommendation</span>
                <span className="detail-value">
                  {shells[selectedShell].recommendation}
                </span>
              </div>
            </div>

            <div className="detail-section">
              <h3>Composition</h3>
              <div className="composition-chart">
                <div className="comp-bar">
                  <div
                    className="comp-segment active"
                    style={{
                      width: `${(shells[selectedShell].active_satellites / shells[selectedShell].object_count) * 100}%`,
                    }}
                  />
                  <div
                    className="comp-segment debris"
                    style={{
                      width: `${(shells[selectedShell].debris_count / shells[selectedShell].object_count) * 100}%`,
                    }}
                  />
                </div>
                <div className="comp-legend">
                  <span className="comp-item">
                    <span className="comp-dot active" />
                    Active ({shells[selectedShell].active_satellites})
                  </span>
                  <span className="comp-item">
                    <span className="comp-dot debris" />
                    Debris ({shells[selectedShell].debris_count})
                  </span>
                </div>
              </div>
            </div>

            <div className="detail-section">
              <h3>Constellations</h3>
              <div className="constellation-list">
                {shells[selectedShell].constellations &&
                  Object.entries(shells[selectedShell].constellations)
                    .sort((a, b) => b[1] - a[1])
                    .map(([name, count]) => (
                      <div key={name} className="constellation-item">
                        <span className="const-name">{name}</span>
                        <span className="const-count">{count}</span>
                      </div>
                    ))}
              </div>
            </div>

            <div className="detail-section">
              <h3>Key Metrics</h3>
              <div className="detail-item">
                <span className="detail-label">Density</span>
                <span className="detail-value">
                  {shells[selectedShell].density_per_million_km3?.toFixed(4)} /M km³
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Congestion Index</span>
                <span className="detail-value">
                  {(shells[selectedShell].congestion_index * 100).toFixed(1)}%
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Constellation Diversity</span>
                <span className="detail-value">
                  {shells[selectedShell].constellation_diversity?.toFixed(3)}
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Maneuver Cluster Prob</span>
                <span className="detail-value">
                  {(shells[selectedShell].maneuver_cluster_probability * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* OII Explanation */}
      <div className="section-card">
        <h2 className="section-title">Understanding OII</h2>
        <div className="oii-explanation">
          <div className="oii-component">
            <h4>Density Factor (0-30)</h4>
            <p>Objects per million cubic km. Higher density increases collision probability.</p>
          </div>
          <div className="oii-component">
            <h4>Congestion Index (0-25)</h4>
            <p>Measures clustering of objects at similar altitudes. High congestion means more objects in close proximity.</p>
          </div>
          <div className="oii-component">
            <h4>Maneuver Cluster Probability (0-25)</h4>
            <p>Likelihood of coordinated maneuvers by large constellations. Mega-constellations maneuver together, creating geometry changes.</p>
          </div>
          <div className="oii-component">
            <h4>Diversity Factor (0-10)</h4>
            <p>Shannon entropy of constellation mix. More operators = more complex interaction patterns.</p>
          </div>
        </div>
      </div>

      <div className="data-timestamp">
        Last updated: {data?.timestamp_utc ? new Date(data.timestamp_utc).toLocaleString() : "-"}
      </div>
    </div>
  );
}

function StatCard({ value, label, sub }) {
  return (
    <div className="db-stat-card">
      <span className="db-stat-value">{value}</span>
      <span className="db-stat-label">{label}</span>
      {sub && <span className="db-stat-sub">{sub}</span>}
    </div>
  );
}
