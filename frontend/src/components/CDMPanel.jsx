import { useState, useEffect } from "react";
import { fetchCDM, refreshCDM } from "../api/backend";

export default function CDMPanel() {
  const [cdmData, setCdmData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

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

  if (loading) {
    return (
      <div className="cdm-panel">
        <div className="cdm-loading">
          <div className="spinner" />
          <p>Loading real conjunction data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="cdm-panel">
        <div className="cdm-error">
          <p>Error loading CDM: {error}</p>
          <button onClick={loadCDM}>Retry</button>
        </div>
      </div>
    );
  }

  const conjunctions = cdmData?.conjunctions ?? [];

  return (
    <div className="cdm-panel">
      <div className="cdm-header">
        <div className="cdm-title-row">
          <div className="cdm-badge">LIVE</div>
          <h2 className="cdm-title">Real Conjunction Data (US Space Force)</h2>
        </div>
        <p className="cdm-subtitle">
          {cdmData?.description} — {cdmData?.count} unique events (deduplicated from {cdmData?.original_count} raw records)
        </p>
        <div className="cdm-actions">
          <button className="cdm-refresh-btn" onClick={handleRefresh} disabled={refreshing}>
            {refreshing ? "Refreshing..." : "Refresh from Space-Track"}
          </button>
        </div>
      </div>

      {conjunctions.length > 0 && (
        <div className="cdm-list">
          {conjunctions.slice(0, 10).map((conj, idx) => (
            <div key={conj.CDM_ID || idx} className="cdm-item">
              <div className="cdm-sat-names">
                <span className="cdm-sat">{conj.SAT_1_NAME}</span>
                <span className="cdm-vs">✕</span>
                <span className="cdm-sat">{conj.SAT_2_NAME}</span>
              </div>
              <div className="cdm-details">
                <div className="cdm-detail">
                  <span className="cdm-label">TCA</span>
                  <span className="cdm-value cdm-tca">{new Date(conj.TCA).toLocaleDateString()} {new Date(conj.TCA).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                </div>
                <div className="cdm-detail">
                  <span className="cdm-label">Miss Distance</span>
                  <span className="cdm-value">{conj.MIN_RNG} km</span>
                </div>
                <div className="cdm-detail">
                  <span className="cdm-label">Pc</span>
                  <span className="cdm-value pc">{parseFloat(conj.PC).toExponential(2)}</span>
                </div>
                <div className="cdm-detail">
                  <span className="cdm-label">Objects</span>
                  <span className="cdm-value">{conj.SAT1_OBJECT_TYPE} / {conj.SAT2_OBJECT_TYPE}</span>
                </div>
              </div>
              {conj.EMERGENCY_REPORTABLE === "Y" && (
                <div className="cdm-emergency">⚠️ Emergency Reportable</div>
              )}
            </div>
          ))}
        </div>
      )}

      {conjunctions.length === 0 && (
        <div className="cdm-empty">
          No conjunction data available. Try refreshing.
        </div>
      )}
    </div>
  );
}
