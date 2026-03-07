export default function SimulationContext({ data }) {
  if (!data) return null;

  const lines = [
    { section: "SYSTEM", rows: [
      ["Source",   "CelesTrak GP"],
      ["Model",    "SGP4 / WGS-72"],
      ["Scan",     "All pairs"],
      ["Mode",     data.mode ?? "—"],
    ]},
    { section: "THIS RUN", rows: [
      ["Satellites",   String(data.meta?.satellites  ?? "—")],
      ["Pairs",        String(data.meta?.pairs_checked ?? "—")],
      ["Time",         `${data.meta?.processing_ms ?? "—"} ms`],
    ]},
    { section: "CLOCK", rows: [
      ["UTC", new Date(data.timestamp_utc).toUTCString().replace("GMT","UTC")],
    ]},
  ];

  return (
    <div className="sc-terminal">
      {/* Terminal title bar */}
      <div className="sc-terminal-header">
        <div className="sc-term-dots">
          <span />
          <span />
          <span />
        </div>
        <span className="sc-term-title">orbital-screener — live</span>
      </div>

      {/* Terminal body */}
      <div className="sc-terminal-body">
        {lines.map(({ section, rows }) => (
          <div key={section}>
            <div className="sc-term-section"># {section}</div>
            {rows.map(([k, v]) => (
              <div className="sc-term-line" key={k}>
                <span className="tl-key">{k}</span>
                <span className={`tl-val${section === "THIS RUN" ? " hi" : ""}`}>{v}</span>
              </div>
            ))}
          </div>
        ))}

        <div className="sc-prompt">
          <span>$</span>
          <span>monitoring...</span>
          <span className="sc-cursor" />
        </div>
      </div>
    </div>
  );
}
