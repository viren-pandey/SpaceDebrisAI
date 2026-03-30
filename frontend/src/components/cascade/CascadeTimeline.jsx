import PropTypes from "prop-types";

function getBandColor(level) {
  switch (level) {
    case "CRITICAL":
      return "#fb7185";
    case "WARNING":
      return "#fb923c";
    case "ADVISORY":
      return "#fbbf24";
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
    <section className="rounded-[2rem] border border-white/10 bg-slate-950/60 p-6 shadow-[0_20px_80px_rgba(2,12,24,0.45)] backdrop-blur">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-slate-400">30 Day Projection</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Cascade Effect Timeline</h2>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-sky-400" /> Average ODRI</span>
          <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-rose-400" /> Critical threshold</span>
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-white/10 bg-slate-900/60 p-3">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-[300px] w-full">
          <defs>
            <linearGradient id="odriDangerFill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="rgba(251,113,133,0.28)" />
              <stop offset="100%" stopColor="rgba(251,113,133,0.02)" />
            </linearGradient>
          </defs>

          <rect x="0" y="0" width={width} height={dangerY} fill="url(#odriDangerFill)" />
          <line x1={padding} x2={width - padding} y1={dangerY} y2={dangerY} stroke="#fb7185" strokeDasharray="6 6" />

          {[0, 0.25, 0.5, 0.75, 1].map((tick) => (
            <g key={tick}>
              <line
                x1={padding}
                x2={width - padding}
                y1={yFor(tick)}
                y2={yFor(tick)}
                stroke="rgba(148,163,184,0.14)"
              />
              <text x="6" y={yFor(tick) + 4} fill="#94a3b8" fontSize="11">
                {tick.toFixed(2)}
              </text>
            </g>
          ))}

          <polyline fill="none" stroke="#38bdf8" strokeWidth="4" points={linePoints} strokeLinejoin="round" strokeLinecap="round" />

          {timeline.map((point, index) => (
            <g key={point.date}>
              <circle cx={xFor(index)} cy={yFor(point.projected_odri)} r="4.5" fill={getBandColor(point.risk_level)} />
              {index % 5 === 0 || index === timeline.length - 1 ? (
                <text x={xFor(index) - 12} y={height - 8} fill="#94a3b8" fontSize="11">
                  {point.date.slice(5)}
                </text>
              ) : null}
            </g>
          ))}
        </svg>
      </div>

      <div className="mt-4 grid gap-2 md:grid-cols-3">
        {timeline.slice(-3).map((point) => (
          <div key={point.date} className="rounded-2xl border border-white/8 bg-white/4 px-4 py-3 text-sm text-slate-300">
            <div className="text-xs uppercase tracking-[0.18em] text-slate-500">{point.date}</div>
            <div className="mt-1 flex items-center justify-between">
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
