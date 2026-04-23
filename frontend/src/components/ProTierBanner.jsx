const HIGHLIGHTS_STANDARD = [
  { value: "60", label: "req / min" },
  { value: "10s", label: "min poll" },
  { value: "3x", label: "ban threshold" },
];

const HIGHLIGHTS_OWNER = [
  { value: "10 000", label: "req / min" },
  { value: "0.5s", label: "min poll" },
  { value: "N/A", label: "ban threshold" },
];

export default function ProTierBanner({ isOwner }) {
  const highlights = isOwner ? HIGHLIGHTS_OWNER : HIGHLIGHTS_STANDARD;
  return (
    <div className="ap-premium-box">
      <div className="ap-premium-box-head">
        <div>
          <p className="ap-premium-eyebrow">{isOwner ? "Owner tier" : "Fair use policy"}</p>
          <h3 className="ap-premium-title">
            {isOwner
              ? "Owner tier — no throttling"
              : "Polling rules are enforced server-side"}
          </h3>
        </div>
        <span className={`ap-premium-pill ${isOwner ? "ap-premium-pill--owner" : ""}`}>
          {isOwner ? "Owner" : "Active"}
        </span>
      </div>

      <p className="ap-premium-copy">
        {isOwner
          ? "Your account is the owner/admin of this app. Requests use owner-tier quota with no polling restrictions."
          : "Keys are issued only after accepting the polling terms. Requests that exceed the public cadence are throttled first and automatically banned after repeated violations."}
      </p>

      <div className="ap-premium-stats">
        {highlights.map((item) => (
          <div key={item.label} className="ap-premium-stat">
            <strong>{item.value}</strong>
            <span>{item.label}</span>
          </div>
        ))}
      </div>

      {!isOwner && (
        <p className="ap-premium-footnote">
          Use the published limits on the terms page before wiring this into automated jobs.
        </p>
      )}
    </div>
  );
}
