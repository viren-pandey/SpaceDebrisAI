import PropTypes from "prop-types";

const DOMAIN_META = [
  { key: "satcom", icon: "SATCOM", title: "Satellite Communications" },
  { key: "internet", icon: "LEO", title: "Internet (LEO constellations)" },
  { key: "gps", icon: "GPS", title: "GPS Accuracy" },
  { key: "launch", icon: "LCH", title: "Launch Windows" },
  { key: "iss", icon: "ISS", title: "ISS Safety" },
  { key: "solar", icon: "SOL", title: "Solar Observation" },
];

function getBand(score) {
  if (score >= 0.85) return "critical";
  if (score >= 0.65) return "warning";
  if (score >= 0.45) return "advisory";
  if (score >= 0.25) return "elevated";
  return "nominal";
}

function getTrend(current, projected) {
  if ((projected ?? current) - current > 0.03) return "up";
  if ((projected ?? current) - current < -0.03) return "down";
  return "flat";
}

export default function CascadeRiskCards({ cards }) {
  return (
    <div className="ci-card-grid">
      {DOMAIN_META.map((meta) => {
        const card = cards[meta.key];
        const band = getBand(card.score);
        const trend = getTrend(card.score, card.projectedScore);
        return (
          <article key={meta.key} className={`ci-risk-card ci-risk-card--${band}`}>
            <div className="ci-risk-top">
              <div className="ci-risk-id">{meta.icon}</div>
              <span className={`ci-risk-band ci-risk-band--${band}`}>{band.toUpperCase()}</span>
            </div>
            <h3 className="ci-risk-title">{meta.title}</h3>
            <div className="ci-risk-value">{card.value}</div>
            <p className="ci-risk-copy">{card.caption}</p>
            <div className="ci-risk-foot">
              <span className={`ci-risk-trend ci-risk-trend--${trend}`}>{trend === "up" ? "worse" : trend === "down" ? "improving" : "stable"}</span>
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
