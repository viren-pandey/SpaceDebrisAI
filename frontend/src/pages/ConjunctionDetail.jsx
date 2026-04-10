import { useLocation, useNavigate, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { SAT_DB } from "../data/satellites";
import { fetchSimulation } from "../api/backend";

const LC_MAP = { CRITICAL: "crit", HIGH: "high", MEDIUM: "med", LOW: "low" };

/** Try exact, then first-word prefix match against SAT_DB keys */
function findInDB(name) {
  if (!name) return null;
  if (SAT_DB[name]) return SAT_DB[name];
  const lname = name.toLowerCase();
  const firstWord = lname.split(/[\s(]/)[0];
  const key = Object.keys(SAT_DB).find((k) => {
    const lk = k.toLowerCase();
    return lk === lname || lk.startsWith(firstWord) || lname.startsWith(lk.split(/[\s(]/)[0]);
  });
  return key ? SAT_DB[key] : null;
}

export default function ConjunctionDetail() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const [fallback, setFallback] = useState(null);
  const [loading, setLoading] = useState(false);

  // If navigated directly (no router state) — refetch
  useEffect(() => {
    if (!state?.pair) {
      setLoading(true);
      fetchSimulation()
        .then((d) => { setFallback(d); setLoading(false); })
        .catch(() => setLoading(false));
    }
  }, [state]);

  if (!state?.pair && loading) {
    return (
      <div className="loading-state">
        <div className="spinner" />
        <p>Loading conjunction data…</p>
      </div>
    );
  }

  // Resolve data: prefer router state, fall back to fresh fetch
  const pair       = state?.pair ?? fallback?.closest_pairs?.[0];
  const satellites = state?.satellites ?? fallback?.satellites ?? [];
  const timestamp  = state?.timestamp  ?? fallback?.timestamp_utc;

  if (!pair) {
    return (
      <div className="cd-empty">
        <p>No conjunction data found.</p>
        <button className="cd-back-btn" onClick={() => navigate("/")}>
          ← Return to Dashboard
        </button>
      </div>
    );
  }

  const [satName1, satName2] = pair.satellites;
  const pos1  = satellites.find((s) => s.name === satName1);
  const pos2  = satellites.find((s) => s.name === satName2);
  const db1   = findInDB(satName1);
  const db2   = findInDB(satName2);

  const lvl     = pair.before.risk?.level ?? "LOW";
  const lc      = LC_MAP[lvl] || "low";
  const afterLvl = pair.after.risk?.level ?? "LOW";
  const afterLc  = LC_MAP[afterLvl] || "low";

  return (
    <div className="cd-root">
      {/* ── Back bar ── */}
      <div className="cd-back-bar">
        <button className="cd-back-btn" onClick={() => navigate(-1)}>
          ← Back
        </button>
        <span className="cd-breadcrumb">Dashboard → Conjunction Detail</span>
      </div>

      {/* ── Risk hero ── */}
      <div className={`cd-hero cd-hero-${lc}`}>
        <div className="cd-hero-inner">
          <span className={`cd-risk-badge cd-badge-${lc}`}>{lvl} RISK</span>
          <h1 className="cd-title">
            {satName1}
            <span className="cd-x"> × </span>
            {satName2}
          </h1>
          <div className={`cd-big-dist cd-bigdist-${lc}`}>
            {pair.before.distance_km.toFixed(2)}
            <span className="cd-dist-unit">km separation</span>
          </div>
          {timestamp && (
            <p className="cd-ts">
              Computed {new Date(timestamp).toUTCString().replace("GMT", "UTC")}
            </p>
          )}
        </div>
      </div>

      <div className="cd-body">
        {/* ── Risk assessment ── */}
        <section className="cd-section">
          <h2 className="cd-sh">Risk Assessment</h2>
          <div className="cd-compare">
            <div className="cd-cbox">
              <div className="cd-cbox-label">Current State</div>
              <div className={`cd-cbox-dist cd-bigdist-${lc}`}>
                {pair.before.distance_km.toFixed(2)} km
              </div>
              <span className={`cd-chip cd-chip-${lc}`}>{lvl}</span>
              {pair.before.risk?.score != null && (
                <div className="cd-score">
                  Score: {pair.before.risk.score} / 100
                </div>
              )}
            </div>

            <div className="cd-compare-arrow">→</div>

            <div className="cd-cbox">
              <div className="cd-cbox-label">After Maneuver</div>
              <div className="cd-cbox-dist">
                {pair.after.distance_km.toFixed(2)} km
              </div>
              <span className={`cd-chip cd-chip-${afterLc}`}>{afterLvl}</span>
              {pair.after.risk?.score != null && (
                <div className="cd-score">
                  Score: {pair.after.risk.score} / 100
                </div>
              )}
            </div>
          </div>

          {pair.maneuver && (
            <div className="cd-maneuver">
              <div className="cd-maneuver-label">AI Recommended Action</div>
              <div className="cd-maneuver-text">{pair.maneuver}</div>
            </div>
          )}
        </section>

        {/* ── Satellite detail cards ── */}
        <section className="cd-section">
          <h2 className="cd-sh">Satellite Details</h2>
          <div className="cd-sats-grid">
            <SatCard name={satName1} pos={pos1} db={db1} label="Satellite A" />
            <SatCard name={satName2} pos={pos2} db={db2} label="Satellite B" />
          </div>
        </section>
      </div>
    </div>
  );
}

function SatCard({ name, pos, db, label }) {
  return (
    <div className="cd-sat-card">
      <div className="cd-sat-header">
        <span className="cd-sat-label">{label}</span>
        {db?.color && (
          <span className="cd-sat-dot" style={{ background: db.color }} />
        )}
        <h3 className="cd-sat-name">{name}</h3>
      </div>

      {/* Real-time position */}
      {pos ? (
        <div className="cd-pos-block">
          <div className="cd-sub-label">Real-time Position (SGP4)</div>
          <div className="cd-pos-grid">
            <div className="cd-pos-item">
              <div className="cd-pos-val">{pos.lat.toFixed(3)}°</div>
              <div className="cd-pos-key">Latitude</div>
            </div>
            <div className="cd-pos-item">
              <div className="cd-pos-val">{pos.lon.toFixed(3)}°</div>
              <div className="cd-pos-key">Longitude</div>
            </div>
            <div className="cd-pos-item">
              <div className="cd-pos-val">{pos.alt_km.toFixed(0)} km</div>
              <div className="cd-pos-key">Altitude</div>
            </div>
          </div>
        </div>
      ) : (
        <div className="cd-pos-block cd-pos-na">
          <span>Position data unavailable</span>
        </div>
      )}

      {/* SAT_DB metadata */}
      {db ? (
        <div className="cd-meta-block">
          <div className="cd-sub-label">Satellite Metadata</div>
          <div className="cd-meta-list">
            {db.country  && <MetaRow k="Country"     v={db.country} />}
            {db.operator && <MetaRow k="Operator"    v={db.operator} />}
            {db.purpose  && <MetaRow k="Purpose"     v={db.purpose} />}
            {db.orbit    && <MetaRow k="Orbit"       v={db.orbit} />}
            {db.altitude && <MetaRow k="Nominal Alt" v={db.altitude} />}
            {db.launched && <MetaRow k="Launched"    v={db.launched} />}
          </div>
          {db.description && (
            <p className="cd-sat-desc">{db.description}</p>
          )}
        </div>
      ) : (
        <div className="cd-meta-block cd-meta-na">
          <span>No metadata in database for this object.</span>
        </div>
      )}

      <Link to="/tracker" className="cd-tracker-btn">
        View in Tracker →
      </Link>
    </div>
  );
}

function MetaRow({ k, v }) {
  return (
    <div className="cd-meta-row">
      <span className="cd-mk">{k}</span>
      <span className="cd-mv">{v}</span>
    </div>
  );
}
