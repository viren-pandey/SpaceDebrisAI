import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div className="footer-brand">
          <span className="footer-logo">SpaceDebris<span style={{ color: "var(--accent)" }}>AI</span></span>
          <p className="footer-tagline">Real-time orbital collision monitoring powered by SGP4 propagation.</p>
        </div>
        <div className="footer-columns">
          <div className="footer-col">
            <div className="footer-col-title">Platform</div>
            <Link className="footer-link" to="/">Dashboard</Link>
            <Link className="footer-link" to="/satellites">Satellites</Link>
            <Link className="footer-link" to="/tracker">Tracker</Link>
            <Link className="footer-link" to="/cascade-intelligence">Cascade AI</Link>
          </div>
          <div className="footer-col">
            <div className="footer-col-title">Monitor</div>
            <Link className="footer-link" to="/real-conjunctions">CDM</Link>
            <Link className="footer-link" to="/high-risk-collisions">High-Risk</Link>
            <Link className="footer-link" to="/spaceweather">Space Weather</Link>
            <Link className="footer-link" to="/shell-instability">Shell Risk</Link>
          </div>
          <div className="footer-col">
            <div className="footer-col-title">Developer</div>
            <Link className="footer-link" to="/api">API Portal</Link>
            <a className="footer-link" href={`${import.meta.env.VITE_API_URL ?? "https://virenn77-spacedebrisai.hf.space"}/docs`} target="_blank" rel="noopener noreferrer">API Docs</a>
            <a className="footer-link" href={`${import.meta.env.VITE_API_URL ?? "https://virenn77-spacedebrisai.hf.space"}/simulate`} target="_blank" rel="noopener noreferrer">Raw Data</a>
          </div>
        </div>
      </div>
      <div className="footer-bottom">
        <p className="footer-copy">© 2026 Viren Pandey — SpaceDebrisAI</p>
      </div>
    </footer>
  );
}
