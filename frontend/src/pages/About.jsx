const STEPS = [
  {
    num: "01",
    label: "TLE",
    title: "TLE Ingestion",
    desc: "Two-Line Element sets are fetched from KeepTrack by an hourly backend job, normalized into a local cache, and served from disk on every user-facing request.",
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
  { name: "KeepTrack Cache", desc: "Hourly KeepTrack catalog refreshes feed the local cache so all user-facing routes stay offline from external TLE providers.", color: "#fb923c" },
  { name: "Docker",        desc: "Containerised deployment of both backend and frontend services.", color: "#60a5fa" },
  { name: "Vite 7",        desc: "Next-generation build tooling with instant hot-module reload.",  color: "#fbbf24" },
  { name: "Python 3.11",   desc: "Core backend runtime with asyncio and numerical libraries.",    color: "#34d399" },
];

export default function About() {
  return (
    <>
      <div className="page-hero about-hero">
        <div className="page-hero-eyebrow">About the project</div>
        <h1 className="page-hero-title">How SpaceDebrisAI works</h1>
        <p className="page-hero-sub">
          An end-to-end system for real-time satellite conjunction screening, from an hourly-refreshed
          KeepTrack cache and a 33k+ local TLE catalog to AI-powered avoidance recommendations.
        </p>
      </div>

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

      <section className="about-section">
        <h2 className="about-section-title">Key capabilities</h2>
        <div className="feature-grid">
          {[
            ["Hourly cache refresh", "KeepTrack is contacted once per hour by the backend, and every public route reads only from the local TLE cache"],
            ["Multi-pair screening", "The public simulation screens the current 2000-object slice from the cached catalog on a short server-side result cache"],
            ["Risk classification",  "Altitude-weighted scoring mapped to four actionable risk levels"],
            ["Maneuver planning",    "Per-risk-level delta-v recommendations with post-maneuver distance estimates"],
            ["Fair-use API access",  "Public access is monitored server-side, with explicit polling terms, automatic throttling, and automatic bans for repeated abuse"],
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

      <section className="about-credit">
        <p>Built by <strong style={{ color: "var(--text-1)" }}>Viren Pandey</strong> — 2026 — SpaceDebrisAI</p>
        <p style={{ marginTop: 6 }}>
          API docs: <a className="about-link" href={`${import.meta.env.VITE_API_URL ?? "https://virenn77-spacedebrisai.hf.space"}/docs`} target="_blank" rel="noopener noreferrer">API docs</a>
        </p>
      </section>
    </>
  );
}
