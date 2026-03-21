import { useState, useEffect } from "react";
import { fetchCDM, refreshCDM } from "../api/backend";

export default function RealConjunctions() {
  const [cdmData, setCdmData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(null);

  const loadCDM = async () => {
    setLoading(true);
    try {
      const data = await fetchCDM();
      setCdmData(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshCDM();
      await loadCDM();
    } catch (err) {
      setError(err.message);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadCDM();
  }, []);

  const toggleExpand = (id) => {
    setExpanded(expanded === id ? null : id);
  };

  if (loading) {
    return (
      <>
        <div className="sph-hero">
          <div className="sph-ring sph-ring-1" />
          <div className="sph-ring sph-ring-2" />
          <div className="sph-ring sph-ring-3" />
          <div className="sph-globe" />
          <div className="sph-pill">
            <span className="live-dot offline" />
            Loading...
          </div>
          <p className="sph-pre">REAL-TIME</p>
          <h1 className="sph-big-num">—</h1>
          <h2 className="sph-label">REAL CONJUNCTION DATA</h2>
          <p className="sph-tagline">
            Fetching live data from US Space Force / Space-Track
          </p>
        </div>
        <div className="loading-state">
          <div className="spinner" />
          <p>Loading real conjunction data...</p>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <div className="sph-hero">
          <div className="sph-ring sph-ring-1" />
          <div className="sph-ring sph-ring-2" />
          <div className="sph-ring sph-ring-3" />
          <div className="sph-globe" />
          <div className="sph-pill">
            <span className="live-dot offline" />
            Error
          </div>
          <p className="sph-pre">REAL-TIME</p>
          <h1 className="sph-big-num">—</h1>
          <h2 className="sph-label">REAL CONJUNCTION DATA</h2>
          <p className="sph-tagline">
            Fetching live data from US Space Force / Space-Track
          </p>
        </div>
        <div className="error-state">
          <p>{error}</p>
          <button className="trk-refresh" onClick={loadCDM}>Retry</button>
        </div>
      </>
    );
  }

  const conjunctions = cdmData?.conjunctions ?? [];
  const count = cdmData?.count ?? 0;
  const originalCount = cdmData?.original_count ?? 0;

  return (
    <>
      <div className="sph-hero">
        <div className="sph-ring sph-ring-1" />
        <div className="sph-ring sph-ring-2" />
        <div className="sph-ring sph-ring-3" />
        <div className="sph-globe" />

        <div className="sph-pill">
          <span className="live-dot" />
          Live
        </div>

        <p className="sph-pre">REAL-TIME</p>
        <h1 className="sph-big-num">{count.toLocaleString()}</h1>
        <h2 className="sph-label">REAL CONJUNCTION DATA</h2>
        <p className="sph-tagline">
          {cdmData?.description} — deduplicated from {originalCount.toLocaleString()} raw records
        </p>

        <div className="sph-stats-row">
          <div className="sph-stat">
            <span className="sph-sv">{count.toLocaleString()}</span>
            <span className="sph-sl">Unique Events</span>
          </div>
          <div className="sph-sdiv" />
          <div className="sph-stat">
            <span className="sph-sv">{originalCount.toLocaleString()}</span>
            <span className="sph-sl">Raw Records</span>
          </div>
          <div className="sph-sdiv" />
          <div className="sph-stat">
            <span className="sph-sv" style={{ color: "#fb923c" }}>
              {conjunctions.filter(c => c.EMERGENCY_REPORTABLE === "Y").length}
            </span>
            <span className="sph-sl">Emergency</span>
          </div>
        </div>
      </div>

      <div className="spc-grid-section">
        <div className="spc-grid-header">
          <div>
            <h2 className="spc-grid-title">Conjunction Events</h2>
            <p className="spc-grid-sub">
              {count.toLocaleString()} active conjunction events — click a row to expand
            </p>
          </div>
          <div className="debris-header-right">
            <span className="spc-india-note">
              Source: Space-Track.org (18th SDS)
            </span>
            <button className="trk-refresh" onClick={handleRefresh} disabled={refreshing}>
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        <div className="debris-table-wrap">
          <table className="debris-table">
            <thead>
              <tr>
                <th></th>
                <th>Object 1</th>
                <th>Object 2</th>
                <th>TCA</th>
                <th>Miss Distance</th>
                <th>Probability</th>
              </tr>
            </thead>
            <tbody>
              {conjunctions.map((conj, idx) => {
                const isExpanded = expanded === (conj.CDM_ID || idx);
                const isEmergency = conj.EMERGENCY_REPORTABLE === "Y";
                return (
                  <>
                    <tr 
                      key={conj.CDM_ID || idx} 
                      className="debris-row"
                      style={isEmergency ? { background: "rgba(251,146,60,0.08)" } : {}}
                      onClick={() => toggleExpand(conj.CDM_ID || idx)}
                    >
                      <td className="debris-expand">{isExpanded ? "▼" : "▶"}</td>
                      <td className="debris-name">
                        {conj.SAT_1_NAME}
                        {isEmergency && <span className="emergency-badge">⚠️</span>}
                      </td>
                      <td className="debris-name">{conj.SAT_2_NAME}</td>
                      <td className="debris-num">
                        {new Date(conj.TCA).toLocaleDateString()} {new Date(conj.TCA).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </td>
                      <td className="debris-num">{conj.MIN_RNG} km</td>
                      <td className="debris-num">{parseFloat(conj.PC).toExponential(2)}</td>
                    </tr>
                    {isExpanded && (
                      <tr key={`${conj.CDM_ID || idx}-detail`} className="debris-detail-row">
                        <td colSpan={6}>
                          <div className="debris-detail">
                            <div className="debris-detail-grid">
                              <div className="debris-detail-item">
                                <span className="debris-detail-label">Object 1 Type</span>
                                <span className="debris-detail-value">{conj.SAT1_OBJECT_TYPE || "Unknown"}</span>
                              </div>
                              <div className="debris-detail-item">
                                <span className="debris-detail-label">Object 2 Type</span>
                                <span className="debris-detail-value">{conj.SAT2_OBJECT_TYPE || "Unknown"}</span>
                              </div>
                              <div className="debris-detail-item">
                                <span className="debris-detail-label">Start Propagation</span>
                                <span className="debris-detail-value">{new Date(conj.START_PROP).toLocaleString()}</span>
                              </div>
                              <div className="debris-detail-item">
                                <span className="debris-detail-label">End Propagation</span>
                                <span className="debris-detail-value">{new Date(conj.END_PROP).toLocaleString()}</span>
                              </div>
                              <div className="debris-detail-item">
                                <span className="debris-detail-label">Relative Velocity</span>
                                <span className="debris-detail-value">{conj.RELATIVE_VELOCITY} km/s</span>
                              </div>
                              <div className="debris-detail-item">
                                <span className="debris-detail-label">Collision Probability</span>
                                <span className="debris-detail-value">{parseFloat(conj.PC).toExponential(4)}</span>
                              </div>
                              {isEmergency && (
                                <div className="debris-emergency">
                                  ⚠️ Emergency Reportable Event
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
