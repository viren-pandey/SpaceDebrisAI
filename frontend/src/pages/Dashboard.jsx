import { Link } from "react-router-dom";
import RiskPanel from "../components/RiskPanel";
import SimulationContext from "../components/SimulationContext";
import SatelliteTable from "../components/SatelliteTable";

export default function Dashboard({ data, loading, error }) {
  const tickerItems = data?.closest_pairs ?? [];
  const publicObjectCount = data?.meta?.satellites ?? "—";
  const publicSliceLabel =
    publicObjectCount === "—"
      ? "the current public object slice"
      : `the current public ${publicObjectCount}-object slice`;

  return (
    <>
      {/* Hero */}
      <section className="db-hero">
        <div className="db-status-row">
          <div className={`db-status-badge${error ? " offline" : ""}`}>
            <span className={`live-dot${error ? " offline" : ""}`} />
            {loading ? "Connecting..." : error ? "Backend offline" : "Screening active"}
          </div>
        </div>
        <p className="db-hero-eyebrow">Real-time orbital conjunction monitoring</p>
        <h1 className="db-hero-h1">
          <span>ORBITAL</span>
          <span className="accent-line">COLLISION</span>
          <span className="ghost-line">MONITOR</span>
        </h1>
        <p className="db-hero-sub">
          Continuous SGP4 conjunction screening across {publicSliceLabel}, backed by a larger
          debris TLE cache and AI-powered avoidance maneuver
          recommendations.
        </p>
      </section>

      {/* Live ticker */}
      {tickerItems.length > 0 && (
        <div className="db-ticker">
          <div className="db-ticker-track">
            {[...tickerItems, ...tickerItems].map((pair, i) => (
              <span key={i} className="db-ticker-item">
                <span>{pair.satellites[0]} vs {pair.satellites[1]}</span>
                <span className={`ti-risk ${pair.before.risk?.level ?? "LOW"}`}>
                  {pair.before.risk?.level ?? "LOW"}
                </span>
                <span style={{ color: "var(--text-faint)" }}>
                  {pair.before.distance_km.toFixed(1)} km
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Stats band */}
      {data && (
        <div className="db-stats-band">
          <div className="db-stats-inner">
            <StatCard value={publicObjectCount} label="Public objects" sub="live count" />
            <StatCard value={data.meta?.pairs_checked ?? "—"} label="Pairs screened" sub="conjunctions" />
            <StatCard value={`${data.meta?.processing_ms ?? "—"}`} label="Processing time" sub="milliseconds" />
            <StatCard value={data.mode ?? "—"} label="Data mode" sub="source" />
          </div>
        </div>
      )}

      {loading && (
        <div className="loading-state">
          <div className="spinner" />
          <p>Fetching live orbital data...</p>
        </div>
      )}

      {error && (
        <div className="error-state">
          <p>{error}</p>
        </div>
      )}

      {/* Main panels */}
      {data && (
        <div className="db-main">
          <RiskPanel data={data} />
          <SimulationContext data={data} />
        </div>
      )}

      {/* Conjunction table */}
      {data && <SatelliteTable data={data} />}

      {/* Tracker teaser — links to dedicated page */}
      <section className="db-tracker-teaser">
        <div className="dtt-inner">
          <div className="dtt-text">
            <h2 className="dtt-title">Live Orbital Tracker</h2>
            <p className="dtt-sub">Real-time satellite positions for the current public tracked set, alongside the broader debris-monitoring updates across the API.</p>
          </div>
          <Link to="/tracker" className="dtt-cta">Open Tracker</Link>
        </div>
      </section>
    </>
  );
}

function StatCard({ value, label, sub }) {
  return (
    <div className="db-stat">
      <div className="db-stat-value">{value}</div>
      <div className="db-stat-label">{label}</div>
      <div className="db-stat-sub">{sub}</div>
    </div>
  );
}
