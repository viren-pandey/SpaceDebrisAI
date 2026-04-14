const HIGHLIGHTS = [
  { value: "10k+", label: "objects" },
  { value: "$10",  label: "per month" },
  { value: "5s",   label: "max polling" },
];

export default function ProTierBanner() {
  return (
    <div className="ap-premium-box">
      <div className="ap-premium-box-head">
        <div>
          <p className="ap-premium-eyebrow">New announcement</p>
          <h3 className="ap-premium-title">Paid API tier for larger debris coverage</h3>
        </div>
        <span className="ap-premium-pill">Coming soon</span>
      </div>

      <p className="ap-premium-copy">
        The announced paid tier expands access to over 10,000 objects, priced at $10 per
        month, with a maximum polling cadence of one request every 5 seconds.
      </p>

      <div className="ap-premium-stats">
        {HIGHLIGHTS.map((item) => (
          <div key={item.label} className="ap-premium-stat">
            <strong>{item.value}</strong>
            <span>{item.label}</span>
          </div>
        ))}
      </div>

      <p className="ap-premium-footnote">
        The current free API stays on the public 2000-object slice for demos, prototypes,
        and browser-based exploration.
      </p>
    </div>
  );
}
