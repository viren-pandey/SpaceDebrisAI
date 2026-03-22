const HIGHLIGHTS = [
  { value: "60", label: "req / min" },
  { value: "10s", label: "min poll" },
  { value: "3x", label: "ban threshold" },
];

export default function ProTierBanner() {
  return (
    <div className="ap-premium-box">
      <div className="ap-premium-box-head">
        <div>
          <p className="ap-premium-eyebrow">Fair use policy</p>
          <h3 className="ap-premium-title">Polling rules are enforced server-side</h3>
        </div>
        <span className="ap-premium-pill">Active</span>
      </div>

      <p className="ap-premium-copy">
        Keys are issued only after accepting the polling terms. Requests that exceed the
        public cadence are throttled first and automatically banned after repeated violations.
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
        Use the published limits on the terms page before wiring this into automated jobs.
      </p>
    </div>
  );
}
