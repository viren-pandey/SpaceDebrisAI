import PropTypes from "prop-types";

const DOMAIN_META = [
  { key: "satcom", icon: "🛰", title: "Satellite Communications" },
  { key: "internet", icon: "🌐", title: "Internet (LEO constellations)" },
  { key: "gps", icon: "📡", title: "GPS Accuracy" },
  { key: "launch", icon: "🚀", title: "Launch Windows" },
  { key: "iss", icon: "🧑‍🚀", title: "ISS Safety" },
  { key: "solar", icon: "☀", title: "Solar Observation" },
];

function getBand(score) {
  if (score >= 0.85) return { label: "CRITICAL", color: "bg-rose-500/15 text-rose-200 ring-1 ring-rose-400/30" };
  if (score >= 0.65) return { label: "WARNING", color: "bg-orange-500/15 text-orange-200 ring-1 ring-orange-400/30" };
  if (score >= 0.45) return { label: "ADVISORY", color: "bg-amber-500/15 text-amber-200 ring-1 ring-amber-400/30" };
  if (score >= 0.25) return { label: "ELEVATED", color: "bg-sky-500/15 text-sky-200 ring-1 ring-sky-400/30" };
  return { label: "NOMINAL", color: "bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-400/30" };
}

function getTrend(current, projected) {
  if ((projected ?? current) - current > 0.03) return "↑ worse";
  if ((projected ?? current) - current < -0.03) return "↓ improving";
  return "→ stable";
}

export default function CascadeRiskCards({ cards }) {
  return (
    <div className="grid gap-3">
      {DOMAIN_META.map((meta) => {
        const card = cards[meta.key];
        const band = getBand(card.score);
        return (
          <article
            key={meta.key}
            className="rounded-3xl border border-white/10 bg-slate-950/60 p-4 shadow-[0_20px_80px_rgba(2,12,24,0.45)] backdrop-blur"
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-slate-400">{meta.title}</p>
                <div className="mt-1 flex items-center gap-2 text-white">
                  <span className="text-xl">{meta.icon}</span>
                  <span className="text-lg font-semibold">{card.value}</span>
                </div>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold tracking-[0.2em] ${band.color}`}>
                {band.label}
              </span>
            </div>

            <p className="text-sm leading-6 text-slate-300">{card.caption}</p>

            <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
              <span>{getTrend(card.score, card.projectedScore)}</span>
              <span>{card.updatedAt}</span>
            </div>
          </article>
        );
      })}
    </div>
  );
}

CascadeRiskCards.propTypes = {
  cards: PropTypes.objectOf(
    PropTypes.shape({
      score: PropTypes.number.isRequired,
      projectedScore: PropTypes.number,
      value: PropTypes.string.isRequired,
      caption: PropTypes.string.isRequired,
      updatedAt: PropTypes.string.isRequired,
    })
  ).isRequired,
};
