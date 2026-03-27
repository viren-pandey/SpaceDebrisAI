import { useState, useEffect } from "react";
import { fetchSpaceWeather, fetchDragEstimate } from "../api/backend";

export default function SpaceWeather() {
  const [data, setData] = useState(null);
  const [drag, setDrag] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [altitude, setAltitude] = useState(400);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 300000); // Refresh every 5 minutes
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    loadDrag();
  }, [altitude]);

  async function loadData() {
    try {
      const [weather, dragData] = await Promise.all([
        fetchSpaceWeather(),
        fetchDragEstimate(altitude),
      ]);
      setData(weather);
      setDrag(dragData);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadDrag() {
    try {
      const dragData = await fetchDragEstimate(altitude);
      setDrag(dragData);
    } catch (err) {
      console.error("Drag fetch failed:", err);
    }
  }

  function getKpColor(kp) {
    if (kp >= 7) return "#ff4444";
    if (kp >= 5) return "#ff8800";
    if (kp >= 4) return "#ffcc00";
    return "#00cc66";
  }

  function getKpLabel(kp) {
    if (kp >= 8) return "Severe Storm";
    if (kp >= 7) return "Major Storm";
    if (kp >= 6) return "Minor Storm";
    if (kp >= 5) return "Unsettled";
    if (kp >= 4) return "Active";
    return "Quiet";
  }

  function getUrgencyColor(urgency) {
    switch (urgency) {
      case "CRITICAL": return "#ff4444";
      case "HIGH": return "#ff8800";
      case "MEDIUM": return "#ffcc00";
      default: return "#00cc66";
    }
  }

  if (loading) {
    return (
      <div className="page-container">
        <div className="loading-state">
          <div className="spinner" />
          <p>Loading space weather data...</p>
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

  const geomag = data?.geomag || {};
  const solar = data?.solar || {};
  const xray = data?.xray || {};
  const atmospheric = data?.atmospheric || {};

  return (
    <div className="page-container">
      {/* Hero */}
      <section className="db-hero">
        <div className="db-status-row">
          <div className="db-status-badge">
            <span className="live-dot" />
            Live Space Weather
          </div>
        </div>
        <p className="db-hero-eyebrow">NOAA Space Weather Prediction Center</p>
        <h1 className="db-hero-h1">
          <span>SPACE</span>
          <span className="accent-line">WEATHER</span>
          <span className="ghost-line">MONITOR</span>
        </h1>
        <p className="db-hero-sub">
          Real-time geomagnetic activity, solar flux, and atmospheric drag conditions.
          Space weather directly affects orbital decay rates and conjunction prediction accuracy.
        </p>
      </section>

      {/* Kp Index Hero Card */}
      <div className="weather-hero-card" style={{ borderColor: getKpColor(geomag.kp_index || 0) }}>
        <div className="weather-hero-content">
          <div className="weather-hero-value" style={{ color: getKpColor(geomag.kp_index || 0) }}>
            {geomag.kp_index?.toFixed(1) || "0.0"}
          </div>
          <div className="weather-hero-label">Kp Index</div>
          <div className="weather-hero-status" style={{ backgroundColor: getKpColor(geomag.kp_index || 0) }}>
            {getKpLabel(geomag.kp_index || 0)}
          </div>
          <div className="weather-hero-trend">
            Trend: <strong>{geomag.kp_trend || "unknown"}</strong>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="db-stats-band">
        <div className="db-stats-inner">
          <StatCard
            value={solar.f107_flux?.toFixed(0) || "—"}
            label="F10.7 Solar Flux"
            sub="sfu (10^-22 W/m²/Hz)"
            color="#ffaa00"
          />
          <StatCard
            value={solar.sunspot_number?.toFixed(0) || "—"}
            label="Sunspot Number"
            sub="solar cycle indicator"
            color="#ff8800"
          />
          <StatCard
            value={xray.flare_class || "A"}
            label="X-ray Class"
            sub={xray.flare_active ? "FLARE ACTIVE" : "no flares"}
            color={xray.flare_active ? "#ff4444" : "#00cc66"}
          />
          <StatCard
            value={atmospheric.density_multiplier_400km?.toFixed(2) || "1.0"}
            label="Density Multiplier"
            sub="at 400km altitude"
            color="#00aaff"
          />
        </div>
      </div>

      {/* Altitude Drag Calculator */}
      <div className="section-card">
        <h2 className="section-title">Atmospheric Drag Calculator</h2>
        <p className="section-desc">
          Adjust altitude to see estimated drag conditions based on current space weather.
        </p>
        <div className="drag-calculator">
          <div className="drag-input-group">
            <label>Altitude: {altitude} km</label>
            <input
              type="range"
              min="200"
              max="1000"
              value={altitude}
              onChange={(e) => setAltitude(Number(e.target.value))}
              className="drag-slider"
            />
          </div>
          {drag && (
            <div className="drag-results">
              <div className="drag-result-item">
                <span className="drag-label">Estimated Decay</span>
                <span className="drag-value">
                  {(drag.estimated_decay_km_per_day * 1000).toFixed(1)} m/day
                </span>
              </div>
              <div className="drag-result-item">
                <span className="drag-label">Urgency</span>
                <span
                  className="drag-value urgency-badge"
                  style={{ backgroundColor: getUrgencyColor(drag.urgency) }}
                >
                  {drag.urgency}
                </span>
              </div>
              <div className="drag-message">{drag.message}</div>
            </div>
          )}
        </div>
      </div>

      {/* Kp 3-hour History */}
      {geomag.kp_3hr && geomag.kp_3hr.length > 0 && (
        <div className="section-card">
          <h2 className="section-title">Kp Index - Last 12 Hours</h2>
          <div className="kp-history">
            {geomag.kp_3hr.map((entry, i) => (
              <div key={i} className="kp-bar-container">
                <div
                  className="kp-bar"
                  style={{
                    height: `${(entry.kp / 9) * 100}%`,
                    backgroundColor: getKpColor(entry.kp),
                  }}
                />
                <span className="kp-bar-value">{entry.kp.toFixed(1)}</span>
                <span className="kp-bar-time">
                  {new Date(entry.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Geomagnetic Storm Scale */}
      {geomag.storm_scale && (
        <div className="section-card">
          <h2 className="section-title">NOAA Geomagnetic Storm Scale</h2>
          <div className="storm-scale">
            {["G0", "G1", "G2", "G3", "G4", "G5"].map((level) => {
              const isActive = geomag.storm_scale.storm_level === level;
              const descriptions = {
                G0: "Quiet conditions",
                G1: "Minor: Weak power grid fluctuations",
                G2: "Moderate: High-latitude power systems affected",
                G3: "Strong: Corrective satellite actions required",
                G4: "Severe: Widespread voltage control problems",
                G5: "Extreme:变压器 damage possible",
              };
              return (
                <div
                  key={level}
                  className={`storm-level ${isActive ? "active" : ""}`}
                >
                  <span className="storm-level-name">{level}</span>
                  <span className="storm-level-desc">{descriptions[level]}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Impact on Operations */}
      <div className="section-card">
        <h2 className="section-title">Impact on Space Operations</h2>
        <div className="impact-grid">
          <div className="impact-item">
            <div className="impact-icon">🛰️</div>
            <div className="impact-title">Orbital Decay</div>
            <div className="impact-desc">
              During geomagnetic storms, atmospheric density at LEO altitudes can increase
              5-10x, causing unexpected orbital decay. Starlink lost 40 satellites in Feb 2022
              due to a geomagnetic storm.
            </div>
          </div>
          <div className="impact-item">
            <div className="impact-icon">📡</div>
            <div className="impact-title">GNSS Degradation</div>
            <div className="impact-desc">
              Solar flares and ionospheric disturbances affect GPS accuracy.
              High Kp conditions can reduce positioning accuracy from meters to tens of meters.
            </div>
          </div>
          <div className="impact-item">
            <div className="impact-icon">⚡</div>
            <div className="impact-title">Communications</div>
            <div className="impact-desc">
              HF radio blackouts during X-class flares. Satellite communications may experience
              increased error rates during solar energetic particle events.
            </div>
          </div>
        </div>
      </div>

      {/* Data timestamp */}
      <div className="data-timestamp">
        Last updated: {data?.timestamp_utc ? new Date(data.timestamp_utc).toLocaleString() : "-"}
        <br />
        Source: NOAA Space Weather Prediction Center
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
