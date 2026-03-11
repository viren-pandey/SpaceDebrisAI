const STEPS = [
  {
    num: "01",
    label: "TLE",
    title: "TLE Ingestion",
    desc: "Two-Line Element sets flow through a layered pipeline: live catalogs, a Space-Track-refreshed local debris cache, and a bundled fallback set when remote sources fail.",
  },
  {
    num: "02",
    label: "SGP4",
    title: "SGP4 Propagation",
    desc: "Each satellite position is propagated to the current epoch using the SGP4 model, yielding precise TEME coordinates and velocity vectors accurate to within tens of metres.",
  },
  {
    num: "03",
    label: "RISK",
    title: "Risk Classification",
    desc: "All satellite pairs are screened. An altitude-weighted classifier assigns CRITICAL, HIGH, MEDIUM, or LOW risk levels based on separation distance, relative velocity, and orbital altitude.",
  },
  {
    num: "04",
    label: "AI",
    title: "Avoidance Maneuver",
    desc: "For each flagged pair, the AI engine computes a delta-v recommendation to raise separation to a safe distance, modelling the post-maneuver trajectory with the same SGP4 propagator.",
  },
];

const TECH = [
  { name: "FastAPI",       desc: "Async Python backend serving the simulation API at port 8000.", color: "#38bdf8" },
  { name: "SGP4",          desc: "Industry-standard orbital mechanics propagator for TLE data.", color: "#818cf8" },
  { name: "ML Classifier", desc: "Custom altitude-factor risk engine with multi-threshold scoring.", color: "#f472b6" },
  { name: "React 19",      desc: "Component-driven UI with live data polling and SPA routing.",  color: "#4ade80" },
  { name: "CelesTrak + Space-Track", desc: "Live GP feeds plus authenticated debris downloads feeding the local cache and future paid tier.", color: "#fb923c" },
  { name: "Docker",        desc: "Containerised deployment of both backend and frontend services.", color: "#60a5fa" },
  { name: "Vite 7",        desc: "Next-generation build tooling with instant hot-module reload.",  color: "#fbbf24" },
  { name: "Python 3.11",   desc: "Core backend runtime with asyncio and numerical libraries.",    color: "#34d399" },
];

export default function About() {
  return (
    <>
      {/* Page hero */}
      <div className="page-hero about-hero">
        <div className="page-hero-eyebrow">About the project</div>
        <h1 className="page-hero-title">How SpaceDebrisAI works</h1>
        <p className="page-hero-sub">
          An end-to-end system for real-time satellite conjunction screening, from multi-source TLE
          ingestion and a 17k+ cached debris catalog to AI-powered avoidance recommendations.
        </p>
      </div>

      {/* How it works */}
      <section className="about-section">
        <h2 className="about-section-title">How it works</h2>
        <div className="steps-grid">
          {STEPS.map((s) => (
            <div className="step-card" key={s.num}>
              <div className="step-num">{s.num}</div>
              <div className="step-label">{s.label}</div>
              <div className="step-content">
                <h3 className="step-title">{s.title}</h3>
                <p className="step-desc">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Tech stack */}
      <section className="about-section">
        <h2 className="about-section-title">Technology stack</h2>
        <div className="tech-grid">
          {TECH.map((t) => (
            <div className="tech-card" key={t.name} style={{ "--tc": t.color }}>
              <div className="tech-accent" style={{ background: t.color }} />
              <h3 className="tech-name">{t.name}</h3>
              <p className="tech-desc">{t.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Key features */}
      <section className="about-section">
        <h2 className="about-section-title">Key capabilities</h2>
        <div className="feature-grid">
          {[
            ["Layered TLE sourcing", "Catalog ingestion can fall back across live feeds, Space-Track-refreshed local cache, and bundled simulated TLE data"],
            ["Multi-pair screening", "All N-choose-2 satellite pair combinations screened every request"],
            ["Risk classification",  "Altitude-weighted scoring mapped to four actionable risk levels"],
            ["Maneuver planning",    "Per-risk-level delta-v recommendations with post-maneuver distance estimates"],
            ["Tiered API access",    "Free public access covers a 500-object slice, with a paid 10k+ object tier announced at $10/month and 5-second polling"],
            ["API-first design",     "Full REST API at /simulate, /satellites, and /health with auto-generated Swagger docs"],
          ].map(([title, desc]) => (
            <div className="feature-card" key={title}>
              <div className="feature-dot" />
              <div>
                <div className="feature-title">{title}</div>
                <div className="feature-desc">{desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Credit */}
      <section className="about-credit">
        <p>Built by <strong style={{ color: "var(--text-1)" }}>Viren Pandey</strong> — 2026 — SpaceDebrisAI</p>
        <p style={{ marginTop: 6 }}>
          API docs: <a className="about-link" href={`${import.meta.env.VITE_API_URL ?? "https://virenn77-spacedebrisai.hf.space"}/docs`} target="_blank" rel="noopener noreferrer">API docs</a>
        </p>
      </section>
    </>
  );
}
