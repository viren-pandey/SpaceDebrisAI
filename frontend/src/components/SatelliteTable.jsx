const RISK_COLOR = {
  CRITICAL: "#f87171",
  HIGH:     "#fb923c",
  MEDIUM:   "#fcd34d",
  LOW:      "#4ade80",
};

export default function SatelliteTable({ data }) {
  if (!data?.closest_pairs?.length) return null;

  return (
    <section className="sat-table-section">
      <div className="sat-table-header">
        <div>
          <h2 className="sat-table-title">All Screened Conjunctions</h2>
          <p className="sat-table-sub">
            {data.closest_pairs.length} closest pairs — sorted by separation distance
          </p>
        </div>
        <span className="sat-table-badge">{data.mode}</span>
      </div>

      <div className="sat-table-wrap">
        {/* Column headings */}
        <div className="sat-row sat-row-head">
          <span className="sat-col sat-col-rank">#</span>
          <span className="sat-col sat-col-names">Satellite pair</span>
          <span className="sat-col sat-col-dist">Current</span>
          <span className="sat-col sat-col-dist">After maneuver</span>
          <span className="sat-col sat-col-risk">Risk</span>
          <span className="sat-col sat-col-action">Recommended action</span>
        </div>

        {data.closest_pairs.map((pair, i) => {
          const level = pair.before.risk?.level ?? "LOW";
          const color = RISK_COLOR[level] ?? RISK_COLOR.LOW;
          return (
            <div
              key={i}
              className="sat-row"
              style={{ "--row-accent": color }}
            >
              <span className="sat-col sat-col-rank" style={{ color: "var(--text-3)" }}>
                {i + 1}
              </span>
              <span className="sat-col sat-col-names">
                <span className="sat-name">{pair.satellites[0]}</span>
                <span className="sat-sep">↔</span>
                <span className="sat-name">{pair.satellites[1]}</span>
              </span>
              <span className="sat-col sat-col-dist">
                <span className="sat-dist">{pair.before.distance_km.toFixed(1)}</span>
                <span className="sat-unit"> km</span>
              </span>
              <span className="sat-col sat-col-dist">
                <span className="sat-dist" style={{ color: "#86efac" }}>
                  {pair.after.distance_km.toFixed(1)}
                </span>
                <span className="sat-unit"> km</span>
              </span>
              <span className="sat-col sat-col-risk">
                <span className="sat-risk-badge" style={{ color, borderColor: color + "44", background: color + "11" }}>
                  {level}
                </span>
              </span>
              <span className="sat-col sat-col-action" title={pair.maneuver}>
                {pair.maneuver ?? "—"}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
