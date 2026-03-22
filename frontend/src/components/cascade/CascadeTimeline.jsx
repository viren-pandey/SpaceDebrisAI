import PropTypes from "prop-types";

function getBandColor(level) {
  switch (level) {
    case "CRITICAL":
      return "#f87171";
    case "WARNING":
      return "#fb923c";
    case "ADVISORY":
      return "#facc15";
    case "ELEVATED":
      return "#38bdf8";
    default:
      return "#4ade80";
  }
}

export default function CascadeTimeline({ timeline }) {
  const width = 960;
  const height = 280;
  const padding = 28;
  const values = timeline.map((point) => point.projected_odri);
  const maxValue = Math.max(1, ...values, 0.85);
  const minValue = 0;

  const xFor = (index) => padding + (index / Math.max(timeline.length - 1, 1)) * (width - padding * 2);
  const yFor = (value) =>
    height - padding - ((value - minValue) / Math.max(maxValue - minValue, 0.001)) * (height - padding * 2);

  const linePoints = timeline.map((point, index) => `${xFor(index)},${yFor(point.projected_odri)}`).join(" ");
  const dangerY = yFor(0.85);

  return (
    <section className="ci-timeline">
      <div className="ci-panel-head">
        <div>
          <p className="ci-kicker">30 Day Projection</p>
          <h2 className="ci-title">Cascade Effect Timeline</h2>
        </div>
        <div className="ci-timeline-legend">
          <span><i style={{ background: "#38bdf8" }} /> Average ODRI</span>
          <span><i style={{ background: "#f87171" }} /> Critical threshold</span>
        </div>
      </div>

      <div className="ci-chart-shell">
        <svg viewBox={`0 0 ${width} ${height}`} className="ci-chart-svg">
          <defs>
            <linearGradient id="ciDangerFill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="rgba(248,113,113,0.24)" />
              <stop offset="100%" stopColor="rgba(248,113,113,0.02)" />
            </linearGradient>
          </defs>
          <rect x="0" y="0" width={width} height={dangerY} fill="url(#ciDangerFill)" />
          <line x1={padding} x2={width - padding} y1={dangerY} y2={dangerY} stroke="#f87171" strokeDasharray="6 6" />

          {[0, 0.25, 0.5, 0.75, 1].map((tick) => (
            <g key={tick}>
              <line
                x1={padding}
                x2={width - padding}
                y1={yFor(tick)}
                y2={yFor(tick)}
                stroke="rgba(122,143,168,0.16)"
              />
              <text x="6" y={yFor(tick) + 4} fill="#7a8fa8" fontSize="11">
                {tick.toFixed(2)}
              </text>
            </g>
          ))}

          <polyline fill="none" stroke="#38bdf8" strokeWidth="4" points={linePoints} strokeLinejoin="round" strokeLinecap="round" />

          {timeline.map((point, index) => (
            <g key={point.date}>
              <circle cx={xFor(index)} cy={yFor(point.projected_odri)} r="4.5" fill={getBandColor(point.risk_level)} />
              {(index % 5 === 0 || index === timeline.length - 1) && (
                <text x={xFor(index) - 12} y={height - 8} fill="#7a8fa8" fontSize="11">
                  {point.date.slice(5)}
                </text>
              )}
            </g>
          ))}
        </svg>
      </div>

      <div className="ci-timeline-grid">
        {timeline.slice(-3).map((point) => (
          <div key={point.date} className="ci-timeline-card">
            <div className="ci-timeline-date">{point.date}</div>
            <div className="ci-timeline-row">
              <span>{point.projected_odri.toFixed(3)}</span>
              <span style={{ color: getBandColor(point.risk_level) }}>{point.risk_level}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

CascadeTimeline.propTypes = {
  timeline: PropTypes.arrayOf(
    PropTypes.shape({
      date: PropTypes.string.isRequired,
      projected_odri: PropTypes.number.isRequired,
      risk_level: PropTypes.string.isRequired,
    })
  ).isRequired,
};
