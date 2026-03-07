import { useState } from "react";
import { NavLink } from "react-router-dom";

const NAV_LINKS = [
  { label: "Dashboard", to: "/" },
  { label: "Satellites", to: "/satellites" },
  { label: "Tracker",   to: "/tracker" },
  { label: "About",     to: "/about" },
];

export default function Navbar({ live, theme, onToggleTheme }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const isDark = theme === "dark";

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        {/* Brand */}
        <NavLink to="/" className="navbar-brand" onClick={() => setMenuOpen(false)}>
          <div className="navbar-logo">SD</div>
          <span>SpaceDebris<span style={{ color: "var(--accent)" }}>AI</span></span>
        </NavLink>

        {/* Desktop nav links */}
        <div className="navbar-navs">
          {NAV_LINKS.map(({ label, to }) => (
            <NavLink
              key={label}
              to={to}
              end={to === "/"}
              className={({ isActive }) => isActive ? "nav-link nav-link-active" : "nav-link"}
            >
              {label}
            </NavLink>
          ))}
        </div>

        {/* Right side controls */}
        <div className="navbar-right">
          {/* Theme toggle */}
          <button
            className="theme-toggle"
            onClick={onToggleTheme}
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
            title={isDark ? "Light mode" : "Dark mode"}
          >
            {isDark ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5"/>
                <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
            )}
          </button>

          {/* Live status pill — desktop only */}
          <div className={`navbar-status nb-status-desktop${live ? "" : " offline"}`}>
            <span className={`live-dot${live ? "" : " offline"}`} />
            {live ? "Live" : "Offline"}
          </div>

          {/* Hamburger — mobile only */}
          <button
            className={`hamburger${menuOpen ? " open" : ""}`}
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            <span /><span /><span />
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {menuOpen && (
        <div className="mobile-menu" onClick={() => setMenuOpen(false)}>
          {NAV_LINKS.map(({ label, to }) => (
            <NavLink
              key={label}
              to={to}
              end={to === "/"}
              className={({ isActive }) => isActive ? "mobile-link mobile-link-active" : "mobile-link"}
              onClick={() => setMenuOpen(false)}
            >
              {label}
            </NavLink>
          ))}
          <div className={`mobile-status${live ? "" : " offline"}`}>
            <span className={`live-dot${live ? "" : " offline"}`} />
            {live ? "Live" : "Offline"}
          </div>
        </div>
      )}
    </nav>
  );
}
