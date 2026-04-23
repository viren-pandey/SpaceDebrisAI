import { useState } from "react";
import BackendOfflineNotice from "../components/BackendOfflineNotice";
import { SAT_DB, PURPOSE_COLOR, RISK_ORDER } from "../data/satellites";

const RISK_COLOR = {
  CRITICAL: "#f87171",
  HIGH:     "#fb923c",
  MEDIUM:   "#fcd34d",
  LOW:      "#4ade80",
};

function buildSatRiskMap(pairs) {
  const map = {};
  if (!pairs) return map;
  for (const pair of pairs) {
    for (let i = 0; i < 2; i++) {
      const name    = pair.satellites[i];
      const partner = pair.satellites[1 - i];
      const level   = pair.before.risk?.level ?? "LOW";
      if (!map[name] || (RISK_ORDER[level] ?? 0) > (RISK_ORDER[map[name].level] ?? 0)) {
        map[name] = {
          level,
          partner,
          distance:  pair.before.distance_km,
          afterDist: pair.after.distance_km,
          maneuver:  pair.maneuver,
          score:     pair.before.risk?.score,
        };
      }
    }
  }
  return map;
}

export default function Satellites({ data, loading, error, backendStatus }) {
  const [selected, setSelected] = useState(null);
  const satRiskMap = buildSatRiskMap(data?.closest_pairs);

  const SAT_NAMES  = Object.keys(SAT_DB);
  const critical   = Object.values(satRiskMap).filter(r => r.level === "CRITICAL").length;
  const high       = Object.values(satRiskMap).filter(r => r.level === "HIGH").length;
  const pairsCount = data?.meta?.pairs_checked ?? "—";
  const liveCount  = data?.meta?.satellites ?? SAT_NAMES.length;

  return (
    <>
      {/* Hero */}
      <div className="sph-hero">
        <div className="sph-ring sph-ring-1" />
        <div className="sph-ring sph-ring-2" />
        <div className="sph-ring sph-ring-3" />
        <div className="sph-globe" />

        <div className="sph-pill">
          <span className={"live-dot" + (loading || error ? " offline" : "")} />
          {loading ? "Connecting..." : error ? "Offline" : "Live tracking active"}
        </div>

        <p className="sph-pre">TRACKING</p>
        <h1 className="sph-big-num">{liveCount}</h1>
        <h2 className="sph-label">ACTIVE SATELLITES</h2>
        <p className="sph-tagline">
          SGP4 orbital mechanics · AI conjunction screening · Maneuver planning
        </p>

        <div className="sph-stats-row">
          <div className="sph-stat">
            <span className="sph-sv">{pairsCount}</span>
            <span className="sph-sl">pairs screened</span>
          </div>
          <div className="sph-sdiv" />
          <div className="sph-stat">
            <span className="sph-sv" style={{ color: "#f87171" }}>{critical}</span>
            <span className="sph-sl">critical</span>
          </div>
          <div className="sph-sdiv" />
          <div className="sph-stat">
            <span className="sph-sv" style={{ color: "#fb923c" }}>{high}</span>
            <span className="sph-sl">high risk</span>
          </div>
          <div className="sph-sdiv" />
          <div className="sph-stat">
            <span className="sph-sv" style={{ color: "#4ade80" }}>{SAT_NAMES.length - critical - high}</span>
            <span className="sph-sl">nominal</span>
          </div>
        </div>
      </div>

      {loading && <div className="loading-state"><div className="spinner" /><p>Fetching orbital data...</p></div>}
      {error   && <div className="error-state"><p>{error}</p></div>}
      {!loading && error && !data && (
        <BackendOfflineNotice
          compact
          title="Satellite feed offline"
          detail={`Health route is ${backendStatus?.status ?? "unavailable"}, but the simulation feed did not recover.`}
        />
      )}

      {/* Satellite cards */}
      <div className="spc-grid-section">
        <div className="spc-grid-header">
          <div>
            <h2 className="spc-grid-title">Satellite Registry</h2>
            <p className="spc-grid-sub">{SAT_NAMES.length} spacecraft tracked — click a card to expand</p>
          </div>
          <span className="spc-india-note">Includes 5 ISRO missions</span>
        </div>

        <div className="spc-grid">
          {SAT_NAMES.map((name, i) => {
            const info  = SAT_DB[name];
            const risk  = satRiskMap[name];
            const level = risk?.level;
            const rc    = RISK_COLOR[level] ?? "transparent";
            const pc    = PURPOSE_COLOR[info.purpose] ?? "#38bdf8";
            const open  = selected === name;

            return (
              <div
                key={name}
                className={"spc-card" + (risk ? " spc-card--risk" : "") + (open ? " spc-card--open" : "")}
                style={{ "--rc": rc, "--pc": pc, "--card-delay": i * 0.05 + "s" }}
                onClick={() => setSelected(open ? null : name)}
                role="button"
                tabIndex={0}
                onKeyDown={e => e.key === "Enter" && setSelected(open ? null : name)}
                aria-expanded={open}
              >
                {/* Top row */}
                <div className="spc-top">
                  <span className="spc-country-chip">{info.countryCode}</span>
                  <div className="spc-badges">
                    <span className="spc-badge spc-badge--purpose" style={{ color: pc, borderColor: pc + "55", background: pc + "12" }}>
                      {info.purpose}
                    </span>
                    <span className="spc-badge spc-badge--orbit">{info.orbit}</span>
                  </div>
                </div>

                {/* Name */}
                <h3 className="spc-name">{name}</h3>

                {/* Country + year */}
                <div className="spc-meta">
                  <span className="spc-country-name">{info.country}</span>
                  <span className="spc-meta-sep">·</span>
                  <span className="spc-launch">Launched {info.launched}</span>
                  {info.noradId && (
                    <>
                      <span className="spc-meta-sep">·</span>
                      <span className="spc-norad">NORAD {info.noradId}</span>
                    </>
                  )}
                </div>

                {/* Description */}
                <p className={"spc-desc" + (open ? " spc-desc--open" : "")}>{info.description}</p>

                {/* Expanded details */}
                {open && (
                  <div className="spc-details">
                    <div className="spc-detail-row">
                      <span className="spc-dk">Operator</span>
                      <span className="spc-dv">{info.operator}</span>
                    </div>
                    <div className="spc-detail-row">
                      <span className="spc-dk">Altitude</span>
                      <span className="spc-dv">{info.altitude}</span>
                    </div>
                    <div className="spc-detail-row">
                      <span className="spc-dk">Orbit</span>
                      <span className="spc-dv">{info.orbit}</span>
                    </div>
                    {info.noradId && (
                      <div className="spc-detail-row">
                        <span className="spc-dk">NORAD ID</span>
                        <span className="spc-dv">{info.noradId}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Risk footer */}
                <div className="spc-risk-section" style={{ borderColor: rc + "30", background: level ? rc + "09" : "transparent" }}>
                  {risk ? (
                    <>
                      <div className="spc-risk-top">
                        <span className="spc-risk-pill" style={{ color: rc, background: rc + "18", borderColor: rc + "44" }}>
                          {level}
                        </span>
                        <span className="spc-risk-partner">vs {risk.partner}</span>
                        <span className="spc-risk-score">{risk.score?.toFixed ? risk.score.toFixed(0) : risk.score}/100</span>
                      </div>
                      <div className="spc-risk-dists">
                        <span className="spc-rd-current">{risk.distance.toFixed(1)} km</span>
                        <span className="spc-rd-arrow">→</span>
                        <span className="spc-rd-after">{risk.afterDist.toFixed(1)} km</span>
                      </div>
                      <div className="spc-maneuver">{risk.maneuver}</div>
                    </>
                  ) : (
                    <div className="spc-clear">
                      <span className="spc-clear-dot" />
                      No active conjunctions — Nominal orbit
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
