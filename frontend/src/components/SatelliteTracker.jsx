import { useState, useEffect, useRef } from "react";
import { SAT_DB } from "../data/satellites";

const MAP_W = 1000;
const MAP_H = 500;

function toXY(lon, lat) {
  return {
    x: ((lon + 180) / 360) * MAP_W,
    y: ((90 - lat) / 180) * MAP_H,
  };
}

const SAT_BY_NORAD = {};
Object.entries(SAT_DB).forEach(([name, info]) => {
  SAT_BY_NORAD[info.noradId] = { ...info, name };
});

// Lat/lon grid definition
const LAT_LINES = [-60, -30,   0,  30,  60];
const LON_LINES = [-150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150];
const SPECIAL_LATS = [23.5, -23.5, 66.5, -66.5]; // tropics & polar circles

export default function SatelliteTracker() {
  const [positions, setPositions] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [hovered, setHovered]     = useState(null);
  const [selected, setSelected]   = useState(null);
  const intervalRef = useRef(null);

  const fetchPositions = async () => {
    try {
      const r = await fetch("http://127.0.0.1:8000/tracker/positions");
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      setPositions(d.satellites ?? []);
      setLastUpdate(new Date());
      setError(null);
    } catch (e) {
      setError("N2YO API unavailable — retrying in 30 s");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPositions();
    intervalRef.current = setInterval(fetchPositions, 30_000);
    return () => clearInterval(intervalRef.current);
  }, []);

  const activeSat = selected ?? hovered;
  const activeSatData = activeSat
    ? positions.find(p => p.noradId === activeSat)
    : null;
  const activeSatInfo = activeSat ? SAT_BY_NORAD[activeSat] : null;

  return (
    <section className="tracker-section">
      {/* Header */}
      <div className="tracker-header">
        <div>
          <h2 className="tracker-title">Live Satellite Tracker</h2>
          <p className="tracker-sub">
            Real-time orbital positions via N2YO &middot;{" "}
            {positions.length > 0 && `${positions.length} satellites`}
          </p>
        </div>
        <div className="tracker-meta">
          {loading && <span className="tracker-pill loading">Fetching positions…</span>}
          {error && !loading && <span className="tracker-pill err">{error}</span>}
          {lastUpdate && !loading && (
            <span className="tracker-pill ok">
              <span className="tracker-dot" />
              Updated {lastUpdate.toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      {/* ── World-grid map ───────────────────────────────── */}
      <div className="tracker-map-wrap">
        <svg
          viewBox={`0 0 ${MAP_W} ${MAP_H}`}
          className="tracker-map-svg"
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            <radialGradient id="mapbg" cx="50%" cy="50%" r="80%">
              <stop offset="0%"   stopColor="#050f22"/>
              <stop offset="100%" stopColor="#020810"/>
            </radialGradient>
            {/* Glow filter per satellite color */}
            <filter id="dot-glow" x="-80%" y="-80%" width="260%" height="260%">
              <feGaussianBlur stdDeviation="4" result="blur"/>
              <feMerge>
                <feMergeNode in="blur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>

          {/* Background */}
          <rect width={MAP_W} height={MAP_H} fill="url(#mapbg)"/>

          {/* Regular grid lines */}
          {LAT_LINES.map(lat => {
            const y = toXY(0, lat).y;
            return (
              <line key={`lat-${lat}`}
                x1={0} y1={y} x2={MAP_W} y2={y}
                stroke="rgba(56,189,248,0.07)" strokeWidth="0.8"/>
            );
          })}
          {LON_LINES.map(lon => {
            const x = toXY(lon, 0).x;
            return (
              <line key={`lon-${lon}`}
                x1={x} y1={0} x2={x} y2={MAP_H}
                stroke="rgba(56,189,248,0.07)" strokeWidth="0.8"/>
            );
          })}

          {/* Equator */}
          <line x1={0} y1={MAP_H / 2} x2={MAP_W} y2={MAP_H / 2}
            stroke="rgba(56,189,248,0.22)" strokeWidth="1"
            strokeDasharray="6 4"/>

          {/* Tropics & polar circles */}
          {SPECIAL_LATS.map(lat => {
            const y = toXY(0, lat).y;
            return (
              <line key={`sp-${lat}`}
                x1={0} y1={y} x2={MAP_W} y2={y}
                stroke="rgba(56,189,248,0.05)" strokeWidth="0.8"
                strokeDasharray="3 7"/>
            );
          })}

          {/* Prime meridian */}
          <line x1={MAP_W / 2} y1={0} x2={MAP_W / 2} y2={MAP_H}
            stroke="rgba(56,189,248,0.14)" strokeWidth="0.8"
            strokeDasharray="6 4"/>

          {/* Axis labels */}
          <text x={6} y={MAP_H / 2 - 5} fill="rgba(56,189,248,0.35)"
            fontSize="9" fontFamily="monospace" letterSpacing="1">EQUATOR</text>
          <text x={6} y={14}            fill="rgba(255,255,255,0.12)"
            fontSize="9" fontFamily="monospace">90°N</text>
          <text x={6} y={MAP_H - 4}    fill="rgba(255,255,255,0.12)"
            fontSize="9" fontFamily="monospace">90°S</text>
          {[-150,-90,-30,30,90,150].map(lon => (
            <text key={lon} x={toXY(lon,0).x - 10} y={MAP_H - 4}
              fill="rgba(255,255,255,0.1)" fontSize="8" fontFamily="monospace">
              {lon > 0 ? `${lon}°E` : `${Math.abs(lon)}°W`}
            </text>
          ))}

          {/* LEO / GEO orbital zone labels */}
          <text x={MAP_W - 6} y={14} fill="rgba(34,197,94,0.3)"
            fontSize="9" fontFamily="monospace" textAnchor="end">LEO</text>

          {/* Satellite dots */}
          {positions.map(sat => {
            if (sat.error) return null;
            const info  = SAT_BY_NORAD[sat.noradId];
            const color = info?.color ?? "#38bdf8";
            const { x, y } = toXY(sat.lon, sat.lat);
            const isHov = hovered === sat.noradId;
            const isSel = selected === sat.noradId;
            const active = isHov || isSel;

            return (
              <g key={sat.noradId}
                style={{ cursor: "pointer" }}
                onMouseEnter={() => setHovered(sat.noradId)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => setSelected(s => s === sat.noradId ? null : sat.noradId)}
              >
                {/* Outer glow ring */}
                <circle cx={x} cy={y} r={active ? 18 : 10}
                  fill={color} opacity={active ? 0.15 : 0.07}
                  style={{ transition: "r 0.2s, opacity 0.2s" }}/>
                {/* Mid ring */}
                <circle cx={x} cy={y} r={active ? 7 : 4}
                  fill={color} opacity={active ? 0.35 : 0.18}
                  style={{ transition: "r 0.2s" }}/>
                {/* Core dot */}
                <circle cx={x} cy={y} r={active ? 5 : 3.5}
                  fill={color} opacity={active ? 1 : 0.88}
                  filter="url(#dot-glow)"
                  style={{ transition: "r 0.2s" }}/>
                {/* Name label when active */}
                {active && (
                  <text
                    x={x + (x > MAP_W - 120 ? -8 : 10)}
                    y={y + 4}
                    fill="#fff"
                    fontSize="11"
                    fontFamily="'Figtree', sans-serif"
                    fontWeight="600"
                    textAnchor={x > MAP_W - 120 ? "end" : "start"}
                    style={{ pointerEvents: "none" }}>
                    {sat.name}
                  </text>
                )}
              </g>
            );
          })}

          {/* Loading overlay */}
          {loading && positions.length === 0 && (
            <text x={MAP_W / 2} y={MAP_H / 2} textAnchor="middle"
              fill="rgba(56,189,248,0.5)" fontSize="14" fontFamily="monospace">
              Fetching satellite positions…
            </text>
          )}
        </svg>

        {/* Hover / selected info card inside the map */}
        {activeSat && activeSatData && activeSatInfo && (
          <div className="tracker-hover-card">
            <div className="thc-name" style={{ color: activeSatInfo.color }}>
              {activeSatData.name}
            </div>
            <div className="thc-rows">
              <span className="thc-k">LAT</span>
              <span className="thc-v">{activeSatData.lat?.toFixed(3)}°</span>
              <span className="thc-k">LON</span>
              <span className="thc-v">{activeSatData.lon?.toFixed(3)}°</span>
              <span className="thc-k">ALT</span>
              <span className="thc-v">{activeSatData.alt?.toFixed(0)} km</span>
              <span className="thc-k">AZ</span>
              <span className="thc-v">{activeSatData.azimuth?.toFixed(1)}°</span>
              <span className="thc-k">EL</span>
              <span className="thc-v">{activeSatData.elevation?.toFixed(1)}°</span>
              <span className="thc-k">ORBIT</span>
              <span className="thc-v">{activeSatInfo.orbit}</span>
              <span className="thc-k">NORAD</span>
              <span className="thc-v">{activeSatData.noradId}</span>
            </div>
            <div className="thc-operator">{activeSatInfo.operator}</div>
          </div>
        )}
      </div>

      {/* ── Satellite data grid ──────────────────────────── */}
      <div className="tracker-grid">
        {positions.map(sat => {
          const info  = SAT_BY_NORAD[sat.noradId];
          const color = info?.color ?? "#38bdf8";
          const isSel = selected === sat.noradId;
          return (
            <div
              key={sat.noradId}
              className={`tg-card${isSel ? " tg-card--sel" : ""}`}
              style={{ "--tc": color }}
              onClick={() => setSelected(s => s === sat.noradId ? null : sat.noradId)}
            >
              <div className="tg-top">
                <div className="tg-dot" style={{ background: color }}/>
                <div className="tg-name">{sat.name}</div>
                <div className="tg-orbit">{info?.orbit ?? "—"}</div>
              </div>
              {sat.error ? (
                <div className="tg-err">Unavailable</div>
              ) : (
                <div className="tg-data">
                  <span className="tg-k">LAT</span>
                  <span className="tg-v">{sat.lat?.toFixed(1)}°</span>
                  <span className="tg-k">LON</span>
                  <span className="tg-v">{sat.lon?.toFixed(1)}°</span>
                  <span className="tg-k">ALT</span>
                  <span className="tg-v">{sat.alt?.toFixed(0)} km</span>
                </div>
              )}
              <div className="tg-norad">NORAD {sat.noradId}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
