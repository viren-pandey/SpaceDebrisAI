import { useMemo, useState } from "react";
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

function getRiskLevel(score) {
  if (score >= 0.85) return "CRITICAL";
  if (score >= 0.65) return "WARNING";
  if (score >= 0.45) return "ADVISORY";
  if (score >= 0.25) return "ELEVATED";
  return "NOMINAL";
}

export default function CascadeTimeline({ timeline, loading }) {
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const width = 960;
  const height = 320;
  const padding = 30;

  const chart = useMemo(() => {
    const values = timeline.map((point) => point.projected_odri);
    const maxValue = Math.max(1, ...values, 0.85);
    const minValue = 0;
    const xFor = (index) => padding + (index / Math.max(timeline.length - 1, 1)) * (width - padding * 2);
    const yFor = (value) =>
      height - padding - ((value - minValue) / Math.max(maxValue - minValue, 0.001)) * (height - padding * 2);
    const linePoints = timeline.map((point, index) => `${xFor(index)},${yFor(point.projected_odri)}`).join(" ");
    const areaPoints = `${padding},${height - padding} ${linePoints} ${width - padding},${height - padding}`;
    const dangerY = yFor(0.85);
    const thresholdRatio = Math.min(1, Math.max(0, dangerY / height));

    return {
      maxValue,
      xFor,
      yFor,
      linePoints,
      areaPoints,
      dangerY,
      thresholdRatio,
    };
  }, [timeline]);

  const hoveredPoint = hoveredIndex == null ? null : timeline[hoveredIndex];

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
        {loading ? (
          <div className="ci-chart-skeleton" />
        ) : (
          <div className="ci-chart-wrap">
            <svg viewBox={`0 0 ${width} ${height}`} className="ci-chart-svg">
              <defs>
                <linearGradient id="ciLineFill" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="rgba(248, 113, 113, 0.36)" />
                  <stop offset={`${chart.thresholdRatio * 100}%`} stopColor="rgba(248, 113, 113, 0.24)" />
                  <stop offset={`${chart.thresholdRatio * 100}%`} stopColor="rgba(56, 189, 248, 0.24)" />
                  <stop offset="100%" stopColor="rgba(56, 189, 248, 0.04)" />
                </linearGradient>
              </defs>
              <rect x="0" y="0" width={width} height={chart.dangerY} fill="rgba(248, 113, 113, 0.06)" />
              <rect x="0" y={chart.dangerY} width={width} height={height - chart.dangerY} fill="rgba(56, 189, 248, 0.03)" />
              <polygon points={chart.areaPoints} fill="url(#ciLineFill)" />
              <line x1={padding} x2={width - padding} y1={chart.dangerY} y2={chart.dangerY} stroke="#f87171" strokeDasharray="6 6" />

              {[0, 0.25, 0.5, 0.75, 1].map((tick) => (
                <g key={tick}>
                  <line
                    x1={padding}
                    x2={width - padding}
                    y1={chart.yFor(tick)}
                    y2={chart.yFor(tick)}
                    stroke="rgba(122,143,168,0.16)"
                  />
                  <text x="6" y={chart.yFor(tick) + 4} fill="#7a8fa8" fontSize="11">
                    {tick.toFixed(2)}
                  </text>
                </g>
              ))}

              <polyline fill="none" stroke="#38bdf8" strokeWidth="4" points={chart.linePoints} strokeLinejoin="round" strokeLinecap="round" />

              {timeline.map((point, index) => (
                <g key={point.date}>
                  <circle
                    cx={chart.xFor(index)}
                    cy={chart.yFor(point.projected_odri)}
                    r={hoveredIndex === index ? "6" : "4.5"}
                    fill={getBandColor(point.risk_level)}
                    onMouseEnter={() => setHoveredIndex(index)}
                    onMouseLeave={() => setHoveredIndex(null)}
                  />
                  {(index % 5 === 0 || index === timeline.length - 1) && (
                    <text x={chart.xFor(index) - 12} y={height - 8} fill="#7a8fa8" fontSize="11">
                      {point.date.slice(5)}
                    </text>
                  )}
                </g>
              ))}
            </svg>

            {hoveredPoint ? (
              <div className="ci-chart-tooltip">
                <div>{hoveredPoint.date}</div>
                <strong>{hoveredPoint.projected_odri.toFixed(3)}</strong>
                <span>{hoveredPoint.risk_level ?? getRiskLevel(hoveredPoint.projected_odri)}</span>
              </div>
            ) : null}
          </div>
        )}
      </div>

      <div className="ci-timeline-grid">
        {(loading ? [] : timeline.slice(-3)).map((point) => (
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
      critical_threshold: PropTypes.number,
      risk_level: PropTypes.string,
    })
  ).isRequired,
  loading: PropTypes.bool,
};

CascadeTimeline.defaultProps = {
  loading: false,
};
