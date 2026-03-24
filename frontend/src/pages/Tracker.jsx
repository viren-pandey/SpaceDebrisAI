import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Satellite } from "ootk";

import { fetchTrackerPositions } from "../api/backend";
import { SAT_DB } from "../data/satellites";

const SAT_BY_NORAD = {};
Object.entries(SAT_DB).forEach(([name, info]) => {
  SAT_BY_NORAD[info.noradId] = { ...info, name };
});

const MAP_W = 1000;
const MAP_H = 500;

function toXY(lon, lat) {
  return {
    x: ((lon + 180) / 360) * MAP_W,
    y: ((90 - lat) / 180) * MAP_H,
  };
}

const LANDMASSES = [
  [[-168, 54], [-140, 71], [-100, 73], [-80, 73], [-65, 60], [-55, 47], [-68, 47], [-77, 44], [-81, 26], [-88, 16], [-92, 15], [-95, 19], [-115, 29], [-117, 32], [-124, 37], [-127, 49], [-168, 54]],
  [[-73, 76], [-20, 76], [-18, 72], [-25, 60], [-44, 60], [-57, 63], [-73, 76]],
  [[-78, 8], [-60, 8], [-45, 5], [-35, 5], [-35, -8], [-40, -23], [-52, -33], [-67, -55], [-75, -50], [-75, -35], [-70, -20], [-75, -10], [-77, 0], [-78, 8]],
  [[-10, 36], [10, 36], [18, 37], [22, 37], [28, 41], [32, 37], [36, 36], [36, 41], [32, 45], [28, 50], [25, 56], [22, 60], [25, 65], [28, 70], [16, 70], [10, 63], [5, 58], [0, 60], [-5, 58], [-10, 56], [-10, 48], [-8, 44], [-10, 38], [-10, 36]],
  [[-18, 15], [0, 15], [10, 20], [35, 22], [43, 12], [52, 12], [45, 0], [40, -5], [35, -18], [30, -30], [25, -35], [18, -35], [15, -25], [10, -10], [5, 5], [0, 5], [-5, 5], [-10, 5], [-15, 10], [-18, 15]],
  [[25, 38], [32, 30], [37, 22], [45, 12], [50, 12], [60, 22], [67, 23], [75, 8], [80, 6], [95, 5], [100, 2], [105, -5], [102, -1], [108, 1], [115, 5], [120, 22], [125, 25], [130, 32], [140, 40], [140, 50], [130, 50], [120, 60], [100, 65], [80, 65], [50, 70], [30, 70], [25, 65], [32, 65], [40, 60], [55, 60], [70, 55], [80, 55], [90, 60], [100, 60], [115, 55], [130, 50], [130, 60], [140, 70], [110, 70], [80, 75], [55, 75], [35, 70], [30, 70], [25, 38]],
  [[66, 23], [73, 8], [80, 8], [80, 13], [77, 8], [80, 5], [82, 8], [80, 13], [82, 20], [80, 23], [75, 25], [70, 23], [66, 23]],
  [[130.6, 31.3], [131.5, 34.3], [135, 35], [137, 40], [141, 41], [141.5, 44], [140, 44.5], [135, 43], [131, 33.5], [130.6, 31.3]],
  [[113, -22], [114, -32], [120, -35], [128, -33], [137, -35], [140, -38], [148, -38], [151, -24], [151, -15], [145, -10], [135, -12], [125, -15], [115, -22], [113, -22]],
  [[-180, -70], [-90, -72], [-60, -70], [-30, -72], [0, -71], [30, -70], [60, -72], [90, -70], [120, -75], [150, -71], [180, -70], [180, -90], [-180, -90], [-180, -70]],
  [[43, -13], [50, -16], [49, -25], [44, -25], [43, -16], [43, -13]],
  [[108, 1], [113, 4], [117, 7], [118, 4], [115, 1], [110, 1], [108, 1]],
  [[95, 5], [103, 5], [106, 0], [104, -4], [100, -4], [95, 0], [95, 5]],
  [[-5, 50], [2, 51], [2, 53], [0, 55], [-4, 57], [-6, 57], [-8, 54], [-2, 51], [-5, 50]],
  [[166, -46], [171, -43], [172, -46], [169, -47], [166, -46]],
];

function WorldMapBg({ W, H }) {
  function xy([lon, lat]) {
    return `${(((lon + 180) / 360) * W).toFixed(1)},${(((90 - lat) / 180) * H).toFixed(1)}`;
  }

  return (
    <>
      {LANDMASSES.map((pts, i) => (
        <polygon
          key={i}
          points={pts.map(xy).join(" ")}
          fill="rgba(30,65,115,0.22)"
          stroke="rgba(56,189,248,0.32)"
          strokeWidth={0.75}
          strokeLinejoin="round"
        />
      ))}
    </>
  );
}

function computeGroundTrack(tle1, tle2) {
  try {
    const sat = new Satellite({ name: "gt", tle1, tle2 });
    const now = Date.now();
    const pts = [];

    for (let i = -10; i <= 60; i++) {
      try {
        const t = new Date(now + i * 2 * 60_000);
        const lla = sat.lla(t);
        const lat = typeof lla.lat === "number" ? lla.lat : (lla.lat?.value ?? 0);
        const lon = typeof lla.lon === "number" ? lla.lon : (lla.lon?.value ?? 0);
        pts.push({ lon, lat, isPast: i < 0 });
      } catch {
        // Skip bad propagation points while preserving the rest of the track.
      }
    }

    const segments = [[]];
    for (let i = 0; i < pts.length; i++) {
      if (i > 0 && Math.abs(pts[i].lon - pts[i - 1].lon) > 180) {
        segments.push([]);
      }
      segments[segments.length - 1].push(pts[i]);
    }

    return segments.filter((segment) => segment.length > 1);
  } catch {
    return [];
  }
}

const LAT_LINES = [-60, -30, 0, 30, 60];
const LON_LINES = [-150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150];
const SPECIAL_LAT = [23.5, -23.5, 66.5, -66.5];

export default function TrackerPage() {
  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState({});
  const [lastUpdate, setLastUpdate] = useState(null);
  const [hovered, setHovered] = useState(null);
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const timerRef = useRef(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchTrackerPositions(filter);
      const nextPositions = data.satellites ?? [];
      const nextErrors = {};

      nextPositions.forEach((sat) => {
        if (sat.error) {
          nextErrors[sat.noradId] = sat.error;
        }
      });

      setPositions(nextPositions);
      setErrors(nextErrors);
      setLastUpdate(new Date());
    } catch (error) {
      setErrors({ request: error.message ?? "Tracker API unavailable" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    timerRef.current = setInterval(refresh, 60_000);
    return () => clearInterval(timerRef.current);
  }, [refresh, filter]);

  const merged = positions.map((pos) => {
    const meta = SAT_BY_NORAD[pos.noradId] ?? {};
    return {
      name: pos.name,
      noradId: pos.noradId,
      color: meta.color ?? "#38bdf8",
      orbit: meta.orbit ?? "Tracked object",
      country: meta.country ?? "Unknown",
      countryCode: meta.countryCode ?? "UNK",
      operator: meta.operator ?? "Unspecified operator",
      purpose: meta.purpose ?? "Orbital object",
      altitude: meta.altitude ?? `${Math.round(pos.alt ?? 0)} km`,
      pos,
      error: errors[pos.noradId],
    };
  });

  const filteredMerged = useMemo(() => {
    if (!search.trim()) return merged;
    const query = search.toLowerCase();
    return merged.filter(
      (sat) =>
        sat.name.toLowerCase().includes(query) ||
        String(sat.noradId).includes(query)
    );
  }, [merged, search]);

  const activeId = selected ?? hovered;
  const activeSat = merged.find((sat) => sat.noradId === activeId);

  const groundTrack = useMemo(() => {
    if (!activeSat?.pos?.raw?.TLE_LINE_1) {
      return [];
    }
    return computeGroundTrack(
      activeSat.pos.raw.TLE_LINE_1,
      activeSat.pos.raw.TLE_LINE_2,
    );
  }, [
    activeSat?.noradId,
    activeSat?.pos?.raw?.TLE_LINE_1,
    activeSat?.pos?.raw?.TLE_LINE_2,
  ]);

  return (
    <>
      <div className="page-hero trk-hero">
        <p className="page-hero-eyebrow">Cached TLE Catalog | Backend API | OOTK</p>
        <h1 className="page-hero-title">
          Live Satellite
          <br />
          <span style={{ color: "var(--accent)" }}>Tracker</span>
        </h1>
        <p className="page-hero-sub">
          Orbital positions are served from the backend cache only. The server
          refreshes the KeepTrack catalog once per hour, and every browser request
          reads the local TLE cache.
        </p>

        <div className="trk-status-row">
          {loading && (
            <div className="trk-pill loading">
              <span className="trk-spinner" />
              Loading cached tracker positions...
            </div>
          )}
          {!loading && (
            <div className="trk-pill ok">
              <span className="trk-dot" />
              {positions.length} satellites live | updated {lastUpdate?.toLocaleTimeString()}
            </div>
          )}
          {!loading && Object.keys(errors).length > 0 && (
            <div className="trk-pill warn">
              {Object.keys(errors).length} unavailable
            </div>
          )}
          <button className="trk-refresh" onClick={refresh} disabled={loading}>
            Refresh
          </button>
        </div>

        <div className="trk-filter-bar">
          <button
            className={`trk-filter-pill${filter === "all" ? " active" : ""}`}
            onClick={() => setFilter("all")}
          >
            All
          </button>
          <button
            className={`trk-filter-pill${filter === "leo_debris" ? " active" : ""}`}
            onClick={() => setFilter("leo_debris")}
          >
            LEO Debris
          </button>
          <button
            className={`trk-filter-pill${filter === "all_debris" ? " active" : ""}`}
            onClick={() => setFilter("all_debris")}
          >
            All Debris
          </button>
          <input
            type="text"
            className="trk-search-input"
            placeholder="Search by name or NORAD..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <span className="trk-filter-count">
            {filteredMerged.length.toLocaleString()} / {positions.length.toLocaleString()}
          </span>
        </div>
      </div>

      <div className="trk-map-section">
        <div className="trk-map-wrap">
          <svg
            viewBox={`0 0 ${MAP_W} ${MAP_H}`}
            className="trk-map-svg"
            preserveAspectRatio="xMidYMid meet"
          >
            <defs>
              <radialGradient id="trkbg" cx="50%" cy="45%" r="80%">
                <stop offset="0%" stopColor="#060e22" />
                <stop offset="100%" stopColor="#020810" />
              </radialGradient>
              <filter id="trk-glow" x="-100%" y="-100%" width="300%" height="300%">
                <feGaussianBlur stdDeviation="5" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            <rect width={MAP_W} height={MAP_H} fill="url(#trkbg)" />
            <WorldMapBg W={MAP_W} H={MAP_H} />

            {LAT_LINES.map((lat) => (
              <line
                key={lat}
                x1={0}
                y1={toXY(0, lat).y}
                x2={MAP_W}
                y2={toXY(0, lat).y}
                stroke="rgba(56,189,248,0.06)"
                strokeWidth="0.8"
              />
            ))}

            {LON_LINES.map((lon) => (
              <line
                key={lon}
                x1={toXY(lon, 0).x}
                y1={0}
                x2={toXY(lon, 0).x}
                y2={MAP_H}
                stroke="rgba(56,189,248,0.06)"
                strokeWidth="0.8"
              />
            ))}

            {SPECIAL_LAT.map((lat) => (
              <line
                key={lat}
                x1={0}
                y1={toXY(0, lat).y}
                x2={MAP_W}
                y2={toXY(0, lat).y}
                stroke="rgba(56,189,248,0.04)"
                strokeWidth="0.8"
                strokeDasharray="3 8"
              />
            ))}

            <line
              x1={0}
              y1={MAP_H / 2}
              x2={MAP_W}
              y2={MAP_H / 2}
              stroke="rgba(56,189,248,0.25)"
              strokeWidth="1.2"
              strokeDasharray="6 4"
            />

            <line
              x1={MAP_W / 2}
              y1={0}
              x2={MAP_W / 2}
              y2={MAP_H}
              stroke="rgba(56,189,248,0.12)"
              strokeWidth="0.8"
              strokeDasharray="5 5"
            />

            <text
              x={8}
              y={MAP_H / 2 - 6}
              fill="rgba(56,189,248,0.35)"
              fontSize="9"
              fontFamily="monospace"
              letterSpacing="1"
            >
              EQUATOR
            </text>
            <text x={8} y={14} fill="rgba(255,255,255,0.1)" fontSize="8" fontFamily="monospace">
              90N
            </text>
            <text x={8} y={MAP_H - 4} fill="rgba(255,255,255,0.1)" fontSize="8" fontFamily="monospace">
              90S
            </text>
            {[-150, -90, -30, 30, 90, 150].map((lon) => (
              <text
                key={lon}
                x={toXY(lon, 0).x - 8}
                y={MAP_H - 4}
                fill="rgba(255,255,255,0.08)"
                fontSize="7.5"
                fontFamily="monospace"
              >
                {lon < 0 ? `${Math.abs(lon)}W` : `${lon}E`}
              </text>
            ))}

            {loading && (
              <text
                x={MAP_W / 2}
                y={MAP_H / 2}
                textAnchor="middle"
                fill="rgba(56,189,248,0.4)"
                fontSize="15"
                fontFamily="'Figtree', sans-serif"
              >
                Calculating orbital positions...
              </text>
            )}

            {groundTrack.map((segment, index) => (
              <polyline
                key={index}
                points={segment.map((point) => {
                  const { x, y } = toXY(point.lon, point.lat);
                  return `${x.toFixed(1)},${y.toFixed(1)}`;
                }).join(" ")}
                fill="none"
                stroke={activeSat?.color ?? "#38bdf8"}
                strokeWidth={1.8}
                strokeDasharray={segment[0]?.isPast ? "2 5" : "6 3"}
                opacity={segment[0]?.isPast ? 0.35 : 0.65}
              />
            ))}

            {filteredMerged.map((sat) => {
              if (!sat.pos) {
                return null;
              }

              const { x, y } = toXY(sat.pos.lon, sat.pos.lat);
              const isActive = hovered === sat.noradId || selected === sat.noradId;

              return (
                <g
                  key={sat.noradId}
                  style={{ cursor: "pointer" }}
                  onMouseEnter={() => setHovered(sat.noradId)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={() => setSelected((id) => (id === sat.noradId ? null : sat.noradId))}
                >
                  <circle
                    cx={x}
                    cy={y}
                    r={isActive ? 20 : 10}
                    fill={sat.color}
                    opacity={isActive ? 0.22 : 0.08}
                    style={{ transition: "r 0.2s, opacity 0.2s" }}
                  />
                  <text
                    x={x}
                    y={y + 0.5}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={isActive ? 18 : 12}
                    filter={isActive ? "url(#trk-glow)" : undefined}
                    style={{ userSelect: "none", transition: "font-size 0.2s" }}
                  >
                    &#x1F6F0;&#xFE0F;
                  </text>
                  {isActive && (
                    <text
                      x={x + (x > MAP_W - 130 ? -10 : 14)}
                      y={y + 16}
                      fill="#fff"
                      fontSize="11"
                      fontFamily="'Figtree', sans-serif"
                      fontWeight="700"
                      textAnchor={x > MAP_W - 130 ? "end" : "start"}
                      style={{ pointerEvents: "none" }}
                    >
                      {sat.name}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>

          {activeSat?.pos && (
            <div className="trk-info-card">
              <div className="tic-name" style={{ color: activeSat.color }}>
                {activeSat.name}
              </div>
              <div className="tic-badge">{activeSat.purpose}</div>
              <div className="tic-grid">
                <span className="tic-k">Latitude</span>
                <span className="tic-v">{activeSat.pos.lat.toFixed(4)} deg</span>
                <span className="tic-k">Longitude</span>
                <span className="tic-v">{activeSat.pos.lon.toFixed(4)} deg</span>
                <span className="tic-k">Altitude</span>
                <span className="tic-v">{activeSat.pos.alt.toFixed(1)} km</span>
                {activeSat.pos.inc !== null && activeSat.pos.inc !== undefined && (
                  <>
                    <span className="tic-k">Inclination</span>
                    <span className="tic-v">{Number(activeSat.pos.inc).toFixed(2)} deg</span>
                  </>
                )}
                {activeSat.pos.apogee !== null && activeSat.pos.apogee !== undefined && (
                  <>
                    <span className="tic-k">Apogee</span>
                    <span className="tic-v">{Number(activeSat.pos.apogee).toFixed(0)} km</span>
                  </>
                )}
                {activeSat.pos.perigee !== null && activeSat.pos.perigee !== undefined && (
                  <>
                    <span className="tic-k">Perigee</span>
                    <span className="tic-v">{Number(activeSat.pos.perigee).toFixed(0)} km</span>
                  </>
                )}
                {activeSat.pos.period !== null && activeSat.pos.period !== undefined && (
                  <>
                    <span className="tic-k">Period</span>
                    <span className="tic-v">{(Number(activeSat.pos.period) / 60).toFixed(1)} min</span>
                  </>
                )}
                <span className="tic-k">Orbit</span>
                <span className="tic-v">{activeSat.orbit}</span>
                <span className="tic-k">NORAD</span>
                <span className="tic-v">{activeSat.noradId}</span>
              </div>
              <div className="tic-operator">{activeSat.operator}</div>
            </div>
          )}
        </div>
      </div>

      <div className="trk-cards-section">
        <div className="trk-cards-header">
          <h2 className="trk-cards-title">Cached Tracker Objects</h2>
          <p className="trk-cards-hint">Click a card or map marker to inspect</p>
        </div>
        <div className="trk-cards-grid">
          {filteredMerged.map((sat) => {
            const isSelected = selected === sat.noradId;
            return (
              <div
                key={sat.noradId}
                className={`trk-card${isSelected ? " trk-card--sel" : ""}${sat.error ? " trk-card--err" : ""}`}
                style={{ "--tc": sat.color }}
                onClick={() => setSelected((id) => (id === sat.noradId ? null : sat.noradId))}
              >
                <div className="trk-card-top">
                  <div className="trk-card-dot" style={{ background: sat.color }} />
                  <div className="trk-card-name">{sat.name}</div>
                  <div className="trk-card-cc">{sat.countryCode}</div>
                </div>

                {sat.error ? (
                  <div className="trk-card-offline">Position unavailable</div>
                ) : sat.pos ? (
                  <div className="trk-card-data">
                    <div className="trk-row">
                      <span className="trk-row-k">Latitude</span>
                      <span className="trk-row-v">{sat.pos.lat.toFixed(2)} deg</span>
                    </div>
                    <div className="trk-row">
                      <span className="trk-row-k">Longitude</span>
                      <span className="trk-row-v">{sat.pos.lon.toFixed(2)} deg</span>
                    </div>
                    <div className="trk-row">
                      <span className="trk-row-k">Altitude</span>
                      <span className="trk-row-v">{sat.pos.alt.toFixed(0)} km</span>
                    </div>
                    {sat.pos.period && (
                      <div className="trk-row">
                        <span className="trk-row-k">Period</span>
                        <span className="trk-row-v">{(sat.pos.period / 60).toFixed(1)} min</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="trk-card-loading">
                    <span className="trk-spinner-sm" />
                    Loading...
                  </div>
                )}

                <div className="trk-card-footer">
                  <span className="trk-card-orbit">{sat.orbit}</span>
                  <span className="trk-card-purpose">{sat.purpose}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="trk-credit">
        Catalog source{" "}
        <a href="https://api.keeptrack.space" target="_blank" rel="noopener noreferrer" className="trk-link">
          KeepTrack API
        </a>{" "}
        via hourly backend refresh. Ground-track previews use{" "}
        <a href="https://github.com/thkruz/ootk" target="_blank" rel="noopener noreferrer" className="trk-link">
          OOTK
        </a>{" "}
        and every browser request stays on your backend.
      </div>
    </>
  );
}
