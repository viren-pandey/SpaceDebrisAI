import { useState, useRef, useEffect } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

const MAIN_LINKS = [
  { label: "Dashboard", to: "/" },
  { label: "Satellites", to: "/satellites" },
  { label: "Tracker",   to: "/tracker" },
  { label: "CDM",  to: "/real-conjunctions" },
  { label: "Cascade",   to: "/cascade-intelligence" },
];

const MONITOR_DROPDOWN = [
  { label: "CDM Timeline", to: "/cdm-timeline" },
  { label: "Shell Risk", to: "/shell-instability" },
  { label: "Space Weather", to: "/spaceweather" },
  { label: "Debris", to: "/all-debris" },
];

const SECONDARY_LINKS = [
  { label: "Docs", to: "/docs" },
  { label: "About", to: "/about" },
];

const BRAND = [
  { chars: "Space",  base: 0 },
  { chars: "Debris", base: 5 },
  { chars: "AI",     base: 11, accent: true },
];

export default function Navbar({ live, theme, onToggleTheme }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [monitorOpen, setMonitorOpen] = useState(false);
  const dropdownRef = useRef(null);
  const isDark = theme === "dark";
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

 
  const isMonitorActive = MONITOR_DROPDOWN.some(item => location.pathname === item.to);


  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setMonitorOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);


  useEffect(() => {
    setMonitorOpen(false);
  }, [location.pathname]);

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        {/* Brand */}
        <NavLink to="/" className="navbar-brand" onClick={() => setMenuOpen(false)}>
          <span className="nb-brand-text">
            {BRAND.map(({ chars, base, accent }) =>
              chars.split("").map((ch, i) => (
                <span
                  key={base + i}
                  className="nb-letter"
                  style={{
                    animationDelay: `${(base + i) * 0.055}s`,
                    color: accent ? "var(--accent)" : undefined,
                  }}
                >
                  {ch}
                </span>
              ))
            )}
          </span>
        </NavLink>

        {/* Desktop nav links */}
        <div className="navbar-navs">
          {MAIN_LINKS.map(({ label, to }) => (
            <NavLink
              key={label}
              to={to}
              end={to === "/"}
              className={({ isActive }) => isActive ? "nav-link nav-link-active" : "nav-link"}
            >
              {label}
            </NavLink>
          ))}

          {/* Monitor dropdown */}
          <div className="nav-dropdown" ref={dropdownRef}>
            <button
              className={`nav-link nav-dropdown-trigger ${isMonitorActive ? "nav-link-active" : ""}`}
              onClick={() => setMonitorOpen(!monitorOpen)}
            >
              Monitor
              <span className="dropdown-arrow">▾</span>
            </button>
            
            {monitorOpen && (
              <div className="nav-dropdown-menu">
                {MONITOR_DROPDOWN.map(({ label, to }) => (
                  <NavLink
                    key={label}
                    to={to}
                    end
                    className={({ isActive }) => 
                      `nav-dropdown-item ${isActive ? "dropdown-item-active" : ""}`
                    }
                    onClick={() => setMonitorOpen(false)}
                  >
                    {label}
                  </NavLink>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right side controls */}
        <div className="navbar-right">
          {/* Secondary links */}
          {SECONDARY_LINKS.map(({ label, to }) => (
            <NavLink
              key={label}
              to={to}
              className={({ isActive }) => isActive ? "nav-link nav-link-active" : "nav-link"}
            >
              {label}
            </NavLink>
          ))}

          {/* API link */}
          <NavLink to="/api" className={({ isActive }) => isActive ? "nav-link nav-link-active nb-api-link" : "nav-link nb-api-link"}>
            API
          </NavLink>

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

          {/* Auth button */}
          {user ? (
            <button className="nb-auth-btn nb-auth-btn--out" onClick={signOut} title={user.email}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <circle cx="7" cy="4.5" r="2.5" stroke="currentColor" strokeWidth="1.3"/>
                <path d="M1.5 12.5c0-3.036 2.462-5.5 5.5-5.5s5.5 2.464 5.5 5.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
              Sign out
            </button>
          ) : (
            <button className="nb-auth-btn nb-auth-btn--in" onClick={() => navigate("/login")}>
              Sign in
            </button>
          )}

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
          {MAIN_LINKS.map(({ label, to }) => (
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
          
          <div className="mobile-divider">Monitor</div>
          
          {MONITOR_DROPDOWN.map(({ label, to }) => (
            <NavLink
              key={label}
              to={to}
              className={({ isActive }) => isActive ? "mobile-link mobile-link-active" : "mobile-link"}
              onClick={() => setMenuOpen(false)}
            >
              {label}
            </NavLink>
          ))}
          
          <NavLink to="/api" className={({ isActive }) => isActive ? "mobile-link mobile-link-active" : "mobile-link"} onClick={() => setMenuOpen(false)}>API</NavLink>
          <NavLink to="/docs" className={({ isActive }) => isActive ? "mobile-link mobile-link-active" : "mobile-link"} onClick={() => setMenuOpen(false)}>Docs</NavLink>
          <NavLink to="/about" className={({ isActive }) => isActive ? "mobile-link mobile-link-active" : "mobile-link"} onClick={() => setMenuOpen(false)}>About</NavLink>
          
          {user ? (
            <button className="mobile-link mobile-signout" onClick={() => { signOut(); setMenuOpen(false); }}>Sign out</button>
          ) : (
            <button className="mobile-link mobile-signin" onClick={() => { navigate("/login"); setMenuOpen(false); }}>Sign in</button>
          )}
          <div className={`mobile-status${live ? "" : " offline"}`}>
            <span className={`live-dot${live ? "" : " offline"}`} />
            {live ? "Live" : "Offline"}
          </div>
        </div>
      )}
    </nav>
  );
}
