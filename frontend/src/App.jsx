import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Analytics } from "@vercel/analytics/react";
import { AuthProvider } from "./contexts/AuthContext";
import Navbar from "./components/Navbar";
import SatelliteBackground from "./components/SatelliteBackground";
import Footer from "./components/Footer";
import Dashboard from "./pages/Dashboard";
import Satellites from "./pages/Satellites";
import About from "./pages/About";
import Tracker from "./pages/Tracker";
import ApiPage from "./pages/ApiPage";
import ConjunctionDetail from "./pages/ConjunctionDetail";
import Login from "./pages/Login";
import Docs from "./pages/Docs";
import { fetchSimulation } from "./api/backend";

const SIMULATION_REFRESH_MS = 15000;

export default function App() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState(
    () => localStorage.getItem("sd-theme") || "dark"
  );

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("sd-theme", theme);
  }, [theme]);

  useEffect(() => {
    let active = true;

    async function loadSimulation({ initial = false } = {}) {
      if (initial) {
        setLoading(true);
      }

      try {
        const nextData = await fetchSimulation();
        if (!active) return;
        setData(nextData);
        setError(null);
      } catch (err) {
        if (!active) return;
        setError(err.message);
      } finally {
        if (active && initial) {
          setLoading(false);
        }
      }
    }

    loadSimulation({ initial: true });
    const timer = setInterval(() => {
      loadSimulation();
    }, SIMULATION_REFRESH_MS);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="app-root">
          {theme === "dark" && <SatelliteBackground />}
          <Navbar live={!loading && !error} theme={theme} onToggleTheme={toggleTheme} />
          <main className="main-content">
            <Routes>
              <Route path="/" element={<Dashboard data={data} loading={loading} error={error} />} />
              <Route path="/satellites" element={<Satellites data={data} loading={loading} error={error} />} />
              <Route path="/tracker" element={<Tracker />} />
              <Route path="/conjunction/:id" element={<ConjunctionDetail />} />
              <Route path="/api" element={<ApiPage />} />
              <Route path="/docs" element={<Docs />} />
              <Route path="/login" element={<Login />} />
              <Route path="/about" element={<About />} />
            </Routes>
          </main>
          <Footer />
          <Analytics />
        </div>
      </AuthProvider>
    </BrowserRouter>
  );
}
