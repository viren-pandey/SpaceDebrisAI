import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";

const RISK_ORDER = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
const LC = { CRITICAL: "crit", HIGH: "high", MEDIUM: "med", LOW: "low" };

const RISK_COLORS = {
  CRITICAL: "239,68,68",
  HIGH: "249,115,22",
  MEDIUM: "245,158,11",
  LOW: "34,197,94",
};

const AUTO_ADVANCE_MS = 5000;

export default function RiskPanel({ data }) {
  const [idx, setIdx] = useState(0);
  const navigate = useNavigate();
  const timerRef = useRef(null);

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

  const total = sorted.length;

  // Auto-advance: reset then start a 5 s timer every time idx or total changes
  const resetTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setIdx((i) => (i + 1 < total ? i + 1 : 0));
    }, AUTO_ADVANCE_MS);
  }, [total]);

  useEffect(() => {
    resetTimer();
    return () => clearInterval(timerRef.current);
  }, [resetTimer]);

  // Arrow click: jump + restart timer
  function go(next) {
    setIdx(next);
    resetTimer();
  }

  const pair = sorted[idx];
  const lvl = pair.before.risk?.level ?? "LOW";
  const lc = LC[lvl] || "low";
  const rgb = RISK_COLORS[lvl] || RISK_COLORS.LOW;
  const afterLvl = pair.after?.risk?.level ?? "LOW";

  const tcaTime = pair.tca_time ? new Date(pair.tca_time).toLocaleString() : "—";
  const pcValue = pair.pc_scientific ?? "—";
  const confidence = pair.confidence ?? "LOW";
  const missDistance = pair.miss_distance_km ?? pair.before.distance_km;

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

      {/* Top accent bar + auto-advance progress line */}
      <div className={`rp-accent-bar rp-accent-${lc}`}>
        <div className="rp-progress-line" key={idx} style={{ "--rp-prog-color": `rgb(${rgb})` }} />
      </div>

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
            onClick={(e) => { e.stopPropagation(); go(Math.max(0, idx - 1)); }}
            aria-label="Previous"
          >‹</button>
          <span className="rp-counter">{idx + 1} <span className="rp-counter-of">of</span> {sorted.length}</span>
          <button
            className="rp-arrow-btn"
            disabled={idx === sorted.length - 1}
            onClick={(e) => { e.stopPropagation(); go(Math.min(sorted.length - 1, idx + 1)); }}
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
          <div className="rp-distance-label">Time of Closest Approach</div>
          <div className={`rp-distance-number ${lc}`}>
            {tcaTime}
          </div>
        </div>

        {/* TCA Info Row */}
        <div className="rp-tca-row">
          <div className="rp-tca-item">
            <span className="rp-tca-label">Miss Distance</span>
            <span className="rp-tca-value">{missDistance.toFixed(2)} km</span>
          </div>
          <div className="rp-tca-item">
            <span className="rp-tca-label">Probability of Collision</span>
            <span className="rp-tca-value pc-value">{pcValue}</span>
          </div>
          <div className="rp-tca-item">
            <span className="rp-tca-label">Confidence</span>
            <span className={`rp-tca-value rp-confidence rp-conf-${confidence.toLowerCase()}`}>{confidence}</span>
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

