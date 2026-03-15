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

function SkeletonCard({ meta }) {
  return (
    <article className="ci-risk-card ci-risk-card--skeleton">
      <div className="ci-risk-top">
        <div className="ci-risk-id">{meta.icon}</div>
        <span className="ci-skeleton-pill" />
      </div>
      <div className="ci-skeleton-block ci-skeleton-title" />
      <div className="ci-skeleton-block ci-skeleton-value" />
      <div className="ci-skeleton-block ci-skeleton-copy" />
      <div className="ci-skeleton-block ci-skeleton-copy" />
    </article>
  );
}

SkeletonCard.propTypes = {
  meta: PropTypes.shape({
    icon: PropTypes.string.isRequired,
  }).isRequired,
};

export default function CascadeRiskCards({ cards, loading }) {
  return (
    <div className="ci-card-grid">
      {DOMAIN_META.map((meta) => {
        if (loading) {
          return <SkeletonCard key={meta.key} meta={meta} />;
        }

        const card = cards[meta.key];
        const band = getBand(card.score);
        const trend = getTrend(card.score, card.projectedScore);
        const pulse = band === "critical" || band === "warning";

        return (
          <article
            key={meta.key}
            className={`ci-risk-card ci-risk-card--${band}${pulse ? " ci-risk-card--pulse" : ""}`}
          >
            <div className="ci-risk-top">
              <div className="ci-risk-id">{meta.icon}</div>
              <span className={`ci-risk-band ci-risk-band--${band}`}>{band.toUpperCase()}</span>
            </div>
            <h3 className="ci-risk-title">{meta.title}</h3>
            <div className="ci-risk-value">{card.value}</div>
            <p className="ci-risk-copy">{card.caption}</p>
            <div className="ci-risk-foot">
              <span className={`ci-risk-trend ci-risk-trend--${trend}`}>
                {trend === "up" ? "worse" : trend === "down" ? "improving" : "stable"}
              </span>
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
  loading: PropTypes.bool,
};

CascadeRiskCards.defaultProps = {
  loading: false,
};
