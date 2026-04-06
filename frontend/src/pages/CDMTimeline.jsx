import { useState, useEffect } from "react";
import { fetchCDMTimeline, fetchHighRiskCDMs } from "../api/backend";

export default function CDMTimeline() {
  const [timelines, setTimelines] = useState([]);
  const [highRisk, setHighRisk] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedTimeline, setSelectedTimeline] = useState(null);
  const [filterSat, setFilterSat] = useState("");
  const [activeTab, setActiveTab] = useState("timelines");

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 300000); // Refresh every 5 minutes
    return () => clearInterval(interval);
  }, []);

  async function loadData() {
    try {
      const [timelineData, highRiskData] = await Promise.all([
        fetchCDMTimeline({ min_pc: 1e-6, limit: 30 }),
        fetchHighRiskCDMs(1e-4, 10),
      ]);
      setTimelines(timelineData.timelines || []);
      setHighRisk(highRiskData.conjunctions || []);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function getTrendIcon(trend) {
    switch (trend) {
      case "decreasing": return "↓";
      case "increasing": return "↑";
      default: return "→";
    }
  }

  function getTrendColor(trend) {
    switch (trend) {
      case "decreasing": return "#00cc66"; // Miss distance decreasing = bad, but we show the trend
      case "increasing": return "#ff8800";
      default: return "#888";
    }
  }

  function formatPc(pc) {
    if (pc >= 1e-3) return pc.toExponential(2);
    if (pc >= 1e-6) return pc.toExponential(2);
    return "< 1e-6";
  }

  function formatDistance(km) {
    if (km < 1) return `${(km * 1000).toFixed(0)} m`;
    return `${km.toFixed(2)} km`;
  }

  function isHighRisk(pc) {
    return pc > 1e-4;
  }

  const filteredTimelines = filterSat
    ? timelines.filter(
        (t) =>
          t.sat1.toUpperCase().includes(filterSat.toUpperCase()) ||
          t.sat2.toUpperCase().includes(filterSat.toUpperCase())
      )
    : timelines;

  if (loading) {
    return (
      <div className="page-container">
        <div className="loading-state">
          <div className="spinner" />
          <p>Loading CDM timelines...</p>
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

  return (
    <div className="page-container">
      {/* Hero */}
      <section className="db-hero">
        <div className="db-status-row">
          <div className="db-status-badge">
            <span className="live-dot" />
            Real CDM Data
          </div>
        </div>
        <p className="db-hero-eyebrow">Conjunction Data Message Evolution</p>
        <h1 className="db-hero-h1">
          <span>CDM</span>
          <span className="accent-line">TIMELINE</span>
          <span className="ghost-line">TRACKER</span>
        </h1>
        <p className="db-hero-sub">
          Track how conjunction risk evolves over time. Watch miss distances narrow or widen
          across consecutive CDMs from the 18th Space Defense Squadron.
        </p>
      </section>

      {/* Stats band */}
      <div className="db-stats-band">
        <div className="db-stats-inner">
          <StatCard value={timelines.length} label="Object Pairs" sub="tracked" />
          <StatCard value={highRisk.length} label="High Risk" sub="Pc > 1e-4" />
          <StatCard
            value={timelines.reduce((sum, t) => sum + t.cdm_count, 0)}
            label="Total CDMs"
            sub="7-day window"
          />
        </div>
      </div>

      {/* Tab navigation */}
      <div className="tab-nav">
        <button
          className={`tab-btn ${activeTab === "timelines" ? "active" : ""}`}
          onClick={() => setActiveTab("timelines")}
        >
          CDM Timelines
        </button>
        <button
          className={`tab-btn ${activeTab === "highrisk" ? "active" : ""}`}
          onClick={() => setActiveTab("highrisk")}
        >
          High Risk Pairs
        </button>
      </div>

      {activeTab === "timelines" && (
        <>
          {/* Filter */}
          <div className="filter-bar">
            <input
              type="text"
              placeholder="Filter by satellite name..."
              value={filterSat}
              onChange={(e) => setFilterSat(e.target.value)}
              className="filter-input"
            />
          </div>

          {/* Timelines list */}
          <div className="section-card">
            <h2 className="section-title">Conjunction Evolution</h2>
            <p className="section-desc">
              Each row shows a satellite pair with multiple CDMs over time.
              Click to expand and see the full timeline.
            </p>

            <div className="timeline-list">
              {filteredTimelines.map((timeline, idx) => (
                <div key={idx} className="timeline-card">
                  <div
                    className="timeline-header"
                    onClick={() => setSelectedTimeline(selectedTimeline === idx ? null : idx)}
                  >
                    <div className="timeline-pair">
                      <span className="sat-name">{timeline.sat1}</span>
                      <span className="vs">vs</span>
                      <span className="sat-name">{timeline.sat2}</span>
                    </div>
                    <div className="timeline-metrics">
                      <div className="metric">
                        <span className="metric-label">Miss Dist</span>
                        <span className="metric-value" style={{ color: getTrendColor(timeline.miss_distance_trend) }}>
                          {formatDistance(timeline.min_miss_distance_km)}
                          <span className="trend-icon">{getTrendIcon(timeline.miss_distance_trend)}</span>
                        </span>
                      </div>
                      <div className="metric">
                        <span className="metric-label">Max Pc</span>
                        <span className={`metric-value ${isHighRisk(timeline.max_pc) ? "high-risk" : ""}`}>
                          {formatPc(timeline.max_pc)}
                        </span>
                      </div>
                      <div className="metric">
                        <span className="metric-label">CDMs</span>
                        <span className="metric-value">{timeline.cdm_count}</span>
                      </div>
                    </div>
                    <div className="timeline-expand">
                      {selectedTimeline === idx ? "−" : "+"}
                    </div>
                  </div>

                  {selectedTimeline === idx && (
                    <div className="timeline-detail">
                      <div className="timeline-chart">
                        <svg viewBox="0 0 400 100" className="cdm-chart">
                          {/* Miss distance line */}
                          <polyline
                            fill="none"
                            stroke="#00d4ff"
                            strokeWidth="2"
                            points={timeline.cdms
                              .map((cdm, i) => {
                                const x = (i / (timeline.cdms.length - 1 || 1)) * 380 + 10;
                                const maxDist = Math.max(...timeline.cdms.map((c) => c.miss_distance_km));
                                const y = 90 - (cdm.miss_distance_km / (maxDist || 1)) * 70;
                                return `${x},${Math.max(y, 10)}`;
                              })
                              .join(" ")}
                          />
                          {/* Data points */}
                          {timeline.cdms.map((cdm, i) => {
                            const x = (i / (timeline.cdms.length - 1 || 1)) * 380 + 10;
                            const maxDist = Math.max(...timeline.cdms.map((c) => c.miss_distance_km));
                            const y = 90 - (cdm.miss_distance_km / (maxDist || 1)) * 70;
                            return (
                              <circle
                                key={i}
                                cx={x}
                                cy={Math.max(y, 10)}
                                r={4}
                                fill={isHighRisk(cdm.probability_of_collision) ? "#ff4444" : "#00d4ff"}
                              />
                            );
                          })}
                        </svg>
                        <div className="chart-labels">
                          <span>Miss Distance (km)</span>
                          <span className="chart-legend">
                            <span className="legend-dot high" />
                            Pc > 1e-4
                            <span className="legend-dot low" />
                            Below threshold
                          </span>
                        </div>
                      </div>

                      <div className="timeline-table">
                        <table>
                          <thead>
                            <tr>
                              <th>TCA</th>
                              <th>Miss Distance</th>
                              <th>Pc</th>
                              <th>Relative Velocity</th>
                              <th>Risk</th>
                            </tr>
                          </thead>
                          <tbody>
                            {timeline.cdms.map((cdm, i) => (
                              <tr key={i} className={isHighRisk(cdm.probability_of_collision) ? "high-risk-row" : ""}>
                                <td>
                                  {cdm.tca
                                    ? new Date(cdm.tca).toLocaleString()
                                    : "-"}
                                </td>
                                <td>{formatDistance(cdm.miss_distance_km)}</td>
                                <td className={isHighRisk(cdm.probability_of_collision) ? "high-risk-text" : ""}>
                                  {formatPc(cdm.probability_of_collision)}
                                </td>
                                <td>{cdm.relative_velocity_km_s?.toFixed(2) || "-"} km/s</td>
                                <td>
                                  {isHighRisk(cdm.probability_of_collision) ? (
                                    <span className="risk-badge critical">HIGH</span>
                                  ) : (
                                    <span className="risk-badge low">LOW</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {activeTab === "highrisk" && (
        <div className="section-card">
          <h2 className="section-title">High Risk Conjunctions</h2>
          <p className="section-desc">
            Conjunction events with Pc > 1e-4 (maneuver threshold).
            These pairs may require operator action.
          </p>

          {highRisk.length === 0 ? (
            <div className="empty-state">
              <p>No high-risk conjunctions currently tracked.</p>
            </div>
          ) : (
            <div className="highrisk-table">
              <table>
                <thead>
                  <tr>
                    <th>Satellite 1</th>
                    <th>Satellite 2</th>
                    <th>TCA</th>
                    <th>Miss Distance</th>
                    <th>Pc</th>
                    <th>Relative Velocity</th>
                  </tr>
                </thead>
                <tbody>
                  {highRisk.map((cdm, i) => (
                    <tr key={i} className="high-risk-row">
                      <td className="sat-cell">{cdm.sat1_name}</td>
                      <td className="sat-cell">{cdm.sat2_name}</td>
                      <td>{cdm.tca ? new Date(cdm.tca).toLocaleString() : "-"}</td>
                      <td>{formatDistance(cdm.miss_distance_km)}</td>
                      <td className="high-risk-text">{formatPc(cdm.probability_of_collision)}</td>
                      <td>{cdm.relative_velocity_km_s?.toFixed(2) || "-"} km/s</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* CDM Explanation */}
      <div className="section-card">
        <h2 className="section-title">Understanding CDMs</h2>
        <div className="cdm-explanation">
          <div className="explanation-item">
            <h4>What is a CDM?</h4>
            <p>
              Conjunction Data Messages are produced by the 18th Space Defense Squadron when
              two tracked objects are predicted to pass dangerously close. Each CDM contains
              miss distance, probability of collision (Pc), and relative velocity estimates.
            </p>
          </div>
          <div className="explanation-item">
            <h4>Why Track Evolution?</h4>
            <p>
              As new observations refine orbit estimates, consecutive CDMs often show miss
              distances narrowing or widening. The SCOUT X-1 R/B vs FENGYUN 1C DEB case saw
              miss distance drop from 484m to 21m across 7 CDMs, with Pc climbing above
              the maneuver threshold.
            </p>
          </div>
          <div className="explanation-item">
            <h4>Maneuver Threshold</h4>
            <p>
              Pc > 1e-4 (1 in 10,000) is the typical threshold for satellite operators to
              consider avoidance maneuvers. Above 1e-3, immediate action is usually required.
            </p>
          </div>
        </div>
      </div>

      <div className="data-timestamp">
        Source: Space-Track.org — 18th Space Defense Squadron
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
