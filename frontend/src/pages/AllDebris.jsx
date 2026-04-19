import { useState, useEffect, useRef, useCallback } from "react";
import { fetchTrackerPositions } from "../api/backend";

const ORBIT_LABELS = {
  LEO: "LEO",
  MEO: "MEO",
  GEO: "GEO",
};

const ORBIT_COLORS = {
  LEO: "#00f5c4",
  MEO: "#facc15",
  GEO: "#fb923c",
};

function getOrbit(altKm) {
  if (altKm < 2000) return "LEO";
  if (altKm < 35786) return "MEO";
  return "GEO";
}

function formatNumber(num) {
  return num?.toLocaleString() ?? "—";
}

export default function AllDebris() {
  const [debris, setDebris] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const timerRef = useRef(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchTrackerPositions("all_debris");
      setDebris(data.satellites ?? []);
      setLastUpdate(new Date());
      setError(null);
    } catch (err) {
      setError(err.message ?? "Failed to fetch debris data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    timerRef.current = setInterval(refresh, 60_000);
    return () => clearInterval(timerRef.current);
  }, [refresh]);

  const orbitCounts = debris.reduce(
    (acc, sat) => {
      const orbit = getOrbit(sat.alt);
      acc[orbit] = (acc[orbit] ?? 0) + 1;
      return acc;
    },
    { LEO: 0, MEO: 0, GEO: 0 }
  );

  const toggleExpand = (noradId) => {
    setExpanded(expanded === noradId ? null : noradId);
  };

  return (
    <>
      <div className="sph-hero">
        <div className="sph-ring sph-ring-1" />
        <div className="sph-ring sph-ring-2" />
        <div className="sph-ring sph-ring-3" />
        <div className="sph-globe" />

        <div className="sph-pill">
          <span className={"live-dot" + (loading || error ? " offline" : "")} />
          {loading ? "Loading..." : error ? "Error" : "Live"}
        </div>

        <p className="sph-pre">CATALOG</p>
        <h1 className="sph-big-num">{formatNumber(debris.length)}</h1>
        <h2 className="sph-label">GLOBAL DEBRIS CATALOG</h2>
        <p className="sph-tagline">
          All tracked debris across LEO, MEO, and GEO from KeepTrack cache
        </p>

        <div className="sph-stats-row">
          <div className="sph-stat">
            <span className="sph-sv" style={{ color: ORBIT_COLORS.LEO }}>{formatNumber(orbitCounts.LEO)}</span>
            <span className="sph-sl">LEO</span>
          </div>
          <div className="sph-sdiv" />
          <div className="sph-stat">
            <span className="sph-sv" style={{ color: ORBIT_COLORS.MEO }}>{formatNumber(orbitCounts.MEO)}</span>
            <span className="sph-sl">MEO</span>
          </div>
          <div className="sph-sdiv" />
          <div className="sph-stat">
            <span className="sph-sv" style={{ color: ORBIT_COLORS.GEO }}>{formatNumber(orbitCounts.GEO)}</span>
            <span className="sph-sl">GEO</span>
          </div>
        </div>
      </div>

      {loading && (
        <div className="loading-state">
          <div className="spinner" />
          <p>Fetching debris catalog...</p>
        </div>
      )}
      {error && !loading && (
        <div className="error-state">
          <p>{error}</p>
          <button className="trk-refresh" onClick={refresh}>Retry</button>
        </div>
      )}

      {!loading && !error && (
        <div className="spc-grid-section">
          <div className="spc-grid-header">
            <div>
              <h2 className="spc-grid-title">Debris Objects</h2>
              <p className="spc-grid-sub">
                {formatNumber(debris.length)} debris tracked — click a row to expand
              </p>
            </div>
            <div className="debris-header-right">
              <span className="spc-india-note">
                Last updated: {lastUpdate?.toLocaleTimeString() ?? "—"}
              </span>
              <button className="trk-refresh" onClick={refresh}>
                Refresh
              </button>
            </div>
          </div>

          <div className="debris-table-wrap">
            <table className="debris-table">
              <thead>
                <tr>
                  <th></th>
                  <th>NORAD ID</th>
                  <th>Name</th>
                  <th>Latitude</th>
                  <th>Longitude</th>
                  <th>Altitude (km)</th>
                  <th>Orbit</th>
                </tr>
              </thead>
              <tbody>
                {debris.map((sat) => {
                  const orbit = getOrbit(sat.alt);
                  const orbitColor = ORBIT_COLORS[orbit];
                  const isExpanded = expanded === sat.noradId;
                  return (
                    <>
                      <tr 
                        key={sat.noradId} 
                        className="debris-row"
                        onClick={() => toggleExpand(sat.noradId)}
                      >
                        <td className="debris-expand">{isExpanded ? "▼" : "▶"}</td>
                        <td className="debris-norad">{sat.noradId}</td>
                        <td className="debris-name">{sat.name}</td>
                        <td className="debris-num">{sat.lat?.toFixed(4) ?? "—"}</td>
                        <td className="debris-num">{sat.lon?.toFixed(4) ?? "—"}</td>
                        <td className="debris-num">{sat.alt?.toFixed(1) ?? "—"}</td>
                        <td>
                          <span
                            className="orbit-badge"
                            style={{
                              color: orbitColor,
                              borderColor: orbitColor + "55",
                              background: orbitColor + "12",
                            }}
                          >
                            {orbit}
                          </span>
                        </td>
                      </tr>
                      {isExpanded && sat.raw && (
                        <tr key={`${sat.noradId}-detail`} className="debris-detail-row">
                          <td colSpan={7}>
                            <div className="debris-detail">
                              <div className="debris-detail-section">
                                <span className="debris-detail-label">TLE Line 1</span>
                                <code className="debris-tle">{sat.raw.TLE_LINE_1}</code>
                              </div>
                              <div className="debris-detail-section">
                                <span className="debris-detail-label">TLE Line 2</span>
                                <code className="debris-tle">{sat.raw.TLE_LINE_2}</code>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
