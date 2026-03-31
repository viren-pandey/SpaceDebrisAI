import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Satellite } from "ootk";
import {
  ComposableMap,
  Geographies,
  Geography,
  Sphere,
  Graticule,
  ZoomableGroup,
} from "react-simple-maps";

import { fetchTrackerPositions } from "../api/backend";
import { SAT_DB } from "../data/satellites";

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

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

export default function TrackerPage() {
  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState({});
  const [lastUpdate, setLastUpdate] = useState(null);
  const [requestFailed, setRequestFailed] = useState(false);
  const [hovered, setHovered] = useState(null);
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [zoom, setZoom] = useState(1);
  const [center, setCenter] = useState([0, 0]);
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
      setRequestFailed(false);
    } catch (error) {
      setErrors({ request: error.message ?? "Tracker API unavailable" });
      setRequestFailed(true);
    } finally {
      setLoading(false);
    }
  }, [filter]);

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
          {!loading && !requestFailed && (
            <div className="trk-pill ok">
              <span className="trk-dot" />
              {positions.length} satellites live | updated {lastUpdate?.toLocaleTimeString()}
            </div>
          )}
          {!loading && requestFailed && (
            <div className="trk-pill warn">
              Tracker feed unavailable | last successful update {lastUpdate?.toLocaleTimeString() ?? "never"}
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
          <div className="trk-map-controls">
            <button className="trk-zoom-btn" onClick={() => setZoom((z) => Math.min(z * 1.5, 4))}>+</button>
            <button className="trk-zoom-btn" onClick={() => setZoom((z) => Math.max(z / 1.5, 1))}>-</button>
            <button className="trk-zoom-btn" onClick={() => { setZoom(1); setCenter([0, 0]); }}>Reset</button>
          </div>
          <ComposableMap
            projection="geoMercator"
            projectionConfig={{ scale: 140 }}
            width={1000}
            height={500}
            style={{ width: "100%", height: "auto" }}
          >
            <ZoomableGroup
              zoom={zoom}
              center={center}
              onMoveEnd={({ coordinates }) => setCenter(coordinates)}
              onZoomEnd={({ zoom }) => setZoom(zoom)}
              maxZoom={4}
              minZoom={1}
            >
              <Sphere stroke="rgba(56,189,248,0.08)" strokeWidth={0.5} fill="transparent" />
              <Graticule stroke="rgba(56,189,248,0.05)" strokeWidth={0.5} step={[30, 30]} />
              <Geographies geography={GEO_URL}>
                {({ geographies }) =>
                  geographies.map((geo) => (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      fill="rgba(30,65,90,0.35)"
                      stroke="rgba(56,189,248,0.15)"
                      strokeWidth={0.4}
                      style={{
                        default: { outline: "none" },
                        hover: { fill: "rgba(40,90,120,0.5)", outline: "none" },
                        pressed: { fill: "rgba(50,110,150,0.6)", outline: "none" },
                      }}
                    />
                  ))
                }
              </Geographies>
            </ZoomableGroup>
          </ComposableMap>
          
          <svg
            className="trk-overlay-svg"
            viewBox="0 0 1000 500"
            preserveAspectRatio="xMidYMid meet"
          >
            <defs>
              <filter id="trk-glow" x="-100%" y="-100%" width="300%" height="300%">
                <feGaussianBlur stdDeviation="5" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {loading && (
              <text
                x={500}
                y={250}
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
                strokeWidth={1.8 / zoom}
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
                    r={isActive ? 20 / zoom : 10 / zoom}
                    fill={sat.color}
                    opacity={isActive ? 0.22 : 0.08}
                    style={{ transition: "r 0.2s, opacity 0.2s" }}
                  />
                  <text
                    x={x}
                    y={y + 0.5}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={isActive ? 18 / zoom : 12 / zoom}
                    filter={isActive ? "url(#trk-glow)" : undefined}
                    style={{ userSelect: "none", transition: "font-size 0.2s" }}
                  >
                    &#x1F6F0;&#xFE0F;
                  </text>
                  {isActive && (
                    <text
                      x={x + (x > 870 ? -10 : 14)}
                      y={y + 16}
                      fill="#fff"
                      fontSize="11"
                      fontFamily="'Figtree', sans-serif"
                      fontWeight="700"
                      textAnchor={x > 870 ? "end" : "start"}
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
