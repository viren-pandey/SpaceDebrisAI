import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

const navItems = [
  { path: "/dashboard", label: "Home", icon: "⌂" },
  { path: "/dashboard/profile", label: "Profile", icon: "👤" },
  { path: "/dashboard/api-keys", label: "API Keys", icon: "⚿" },
  { path: "/dashboard/usage", label: "Usage", icon: "⎔" },
  { path: "/dashboard/contact", label: "Contact", icon: "✉" },
];

export default function DashboardLayout({ children }) {
  const { user, signOut, isOwner } = useAuth();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="dashboard-layout">
      <aside className={`dashboard-sidebar ${collapsed ? "collapsed" : ""}`}>
        <div className="sidebar-header">
          <Link to="/dashboard" className="sidebar-logo">
            <span className="logo-icon">🛰</span>
            {!collapsed && <span className="logo-text">SpaceDebrisAI</span>}
          </Link>
          <button className="sidebar-toggle" onClick={() => setCollapsed(!collapsed)}>
            {collapsed ? "→" : "←"}
          </button>
        </div>
        <nav className="sidebar-nav">
          {navItems.map(item => (
            <Link
              key={item.path}
              to={item.path}
              className={`sidebar-link ${location.pathname === item.path ? "active" : ""}`}
            >
              <span className="link-icon">{item.icon}</span>
              {!collapsed && <span className="link-label">{item.label}</span>}
            </Link>
          ))}
        </nav>
        <div className="sidebar-footer">
          {isOwner && <span className="owner-chip">Owner</span>}
          <span className="user-email">{user?.email?.split("@")[0]}</span>
          <Link to="/" className="sidebar-link">← Main Site</Link>
          <button className="sidebar-link logout-btn" onClick={signOut}>Logout</button>
        </div>
      </aside>
      <main className="dashboard-main">
        {children}
      </main>
    </div>
  );
}
