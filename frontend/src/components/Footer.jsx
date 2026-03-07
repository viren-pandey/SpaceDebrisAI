import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <nav className="footer-links">
          <a className="footer-link" href={`${import.meta.env.VITE_API_URL ?? "http://localhost:8000"}/docs`} target="_blank" rel="noopener noreferrer">API Docs</a>
          <span className="footer-divider" />
          <Link className="footer-link" to="/api">API Portal</Link>
          <span className="footer-divider" />
          <a className="footer-link" href="/">Dashboard</a>
          <span className="footer-divider" />
          <a className="footer-link" href={`${import.meta.env.VITE_API_URL ?? "http://localhost:8000"}/simulate`} target="_blank" rel="noopener noreferrer">Raw data</a>
        </nav>
        <p className="footer-copy">© 2026 Viren Pandey — SpaceDebrisAI</p>
      </div>
    </footer>
  );
}
