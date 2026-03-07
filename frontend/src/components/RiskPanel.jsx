import { useState } from "react";
import { useNavigate } from "react-router-dom";

const RISK_ORDER = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
const LC = { CRITICAL: "crit", HIGH: "high", MEDIUM: "med", LOW: "low" };

const RISK_COLORS = {
  CRITICAL: "239,68,68",
  HIGH: "249,115,22",
  MEDIUM: "245,158,11",
  LOW: "34,197,94",
};

export default function RiskPanel({ data }) {
  const [idx, setIdx] = useState(0);
  const navigate = useNavigate();

  if (!data?.closest_pairs?.length) {
    return (
      <div className="rp-wrap" style={{ padding: 40, color: "var(--text-dim)" }}>
        No active conjunctions. Monitoring continues…
      </div>
    );
  }

  const sorted = [...data.closest_pairs].sort((a, b) => {
    const al = RISK_ORDER[a.before.risk?.level ?? "LOW"] ?? 3;
    const bl = RISK_ORDER[b.before.risk?.level ?? "LOW"] ?? 3;
    if (al !== bl) return al - bl;
    return a.before.distance_km - b.before.distance_km;
  });

  const pair = sorted[idx];
  const lvl = pair.before.risk?.level ?? "LOW";
  const lc = LC[lvl] || "low";
  const rgb = RISK_COLORS[lvl] || RISK_COLORS.LOW;
  const afterLvl = pair.after?.risk?.level ?? "LOW";

  function handleClick() {
    navigate(`/conjunction/${idx}`, {
      state: { pair, satellites: data.satellites ?? [], timestamp: data.timestamp_utc },
    });
  }

  return (
    <div
      className="rp-wrap"
      style={{ "--rp-rgb": rgb }}
    >
      {/* Ambient glow blob */}
      <div className="rp-glow-blob" />

      {/* Top accent bar */}
      <div className={`rp-accent-bar rp-accent-${lc}`} />

      {/* Header row */}
      <div className="rp-header-row">
        <div className="rp-header-left">
          <span className={`rp-pulse-dot rp-pd-${lc}`} />
          <span className={`rp-lvl-tag rp-lvl-${lc}`}>{lvl}</span>
          <span className="rp-header-label">CONJUNCTION ALERT</span>
        </div>
        <div className="rp-header-right">
          <button
            className="rp-arrow-btn"
            disabled={idx === 0}
            onClick={(e) => { e.stopPropagation(); setIdx(i => Math.max(0, i - 1)); }}
            aria-label="Previous"
          >‹</button>
          <span className="rp-counter">{idx + 1} <span className="rp-counter-of">of</span> {sorted.length}</span>
          <button
            className="rp-arrow-btn"
            disabled={idx === sorted.length - 1}
            onClick={(e) => { e.stopPropagation(); setIdx(i => Math.min(sorted.length - 1, i + 1)); }}
            aria-label="Next"
          >›</button>
        </div>
      </div>

      {/* Main body — click to view detail */}
      <div className="rp-body rp-clickable" onClick={handleClick}>

        {/* Satellite names */}
        <div className="rp-sat-names">
          <span className="rp-sat-name">{pair.satellites[0]}</span>
          <span className="rp-cross">✕</span>
          <span className="rp-sat-name">{pair.satellites[1]}</span>
        </div>

        {/* Big distance */}
        <div className="rp-distance-hero">
          <div className="rp-distance-label">Closest approach distance</div>
          <div className={`rp-distance-number ${lc}`}>
            {pair.before.distance_km.toFixed(2)}
            <span className="km-unit">km</span>
          </div>
        </div>

        {/* Before / After */}
        <div className="rp-compare-row">
          <div className="rp-compare-cell">
            <div className="cc-label">Current separation</div>
            <div className="cc-val">{pair.before.distance_km.toFixed(2)}</div>
            <div className="cc-unit">km</div>
            <span className={`cc-badge ${lvl}`}>{lvl}</span>
          </div>
          <div className="rp-compare-cell rp-compare-cell-after">
            <div className="cc-label">Post-maneuver</div>
            <div className="cc-val">{pair.after?.distance_km?.toFixed(2) ?? "—"}</div>
            <div className="cc-unit">km</div>
            <span className={`cc-badge ${afterLvl}`}>{afterLvl}</span>
          </div>
        </div>

        {/* AI recommendation */}
        {pair.maneuver_recommendation && (
          <div className="rp-maneuver">
            <strong>AI Recommendation</strong>
            {pair.maneuver_recommendation}
          </div>
        )}

        <div className="rp-click-hint">View full conjunction detail →</div>
      </div>

      {/* Footer */}
      <div className="rp-nav">
        <span className="rp-nav-ts">
          {new Date(data.timestamp_utc).toUTCString().replace("GMT", "UTC")}
        </span>
      </div>
    </div>
  );
}

