import { useEffect, useRef, useState } from "react";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { Analytics } from "@vercel/analytics/react";
import { AuthProvider } from "./contexts/AuthContext";
import Footer from "./components/Footer";
import Navbar from "./components/Navbar";
import SatelliteBackground from "./components/SatelliteBackground";
import { fetchSimulation } from "./api/backend";
import About from "./pages/About";
import AdminDashboard from "./pages/AdminDashboard";
import AllDebris from "./pages/AllDebris";
import ApiPage from "./pages/ApiPage";
import ApiTerms from "./pages/ApiTerms";
import ConjunctionDetail from "./pages/ConjunctionDetail";
import Contact from "./pages/Contact";
import CascadeIntelligence from "./pages/CascadeIntelligence";
import Dashboard from "./pages/Dashboard";
import Docs from "./pages/Docs";
import LiveCongestion from "./pages/LiveCongestion";
import Login from "./pages/Login";
import RealConjunctions from "./pages/RealConjunctions";
import Satellites from "./pages/Satellites";
import Tracker from "./pages/Tracker";

const SIMULATION_REFRESH_MS = 60000;
const SIMULATION_ROUTES = new Set(["/", "/satellites"]);

function AppShell({ theme, toggleTheme }) {
  const location = useLocation();
  const shouldLoadSimulation = SIMULATION_ROUTES.has(location.pathname);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(shouldLoadSimulation);
  const hasLoadedSimulationRef = useRef(false);

  useEffect(() => {
    if (!shouldLoadSimulation) {
      setLoading(false);
      setError(null);
      return;
    }

    let active = true;
    async function loadSimulation() {
      const isInitialLoad = !hasLoadedSimulationRef.current;
      if (isInitialLoad) {
        setLoading(true);
      }

      try {
        const nextData = await fetchSimulation();
        if (!active) return;
        setData(nextData);
        setError(null);
        hasLoadedSimulationRef.current = true;
      } catch (err) {
        if (!active) return;
        setError(err.message);
      } finally {
        if (active && isInitialLoad) {
          setLoading(false);
        }
      }
    }

    loadSimulation();
    const timer = setInterval(loadSimulation, SIMULATION_REFRESH_MS);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [shouldLoadSimulation]);

  return (
    <div className="app-root">
      {theme === "dark" && <SatelliteBackground />}
      <Navbar live={!loading && !error} theme={theme} onToggleTheme={toggleTheme} />
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Dashboard data={data} loading={loading} error={error} />} />
          <Route path="/satellites" element={<Satellites data={data} loading={loading} error={error} />} />
          <Route path="/tracker" element={<Tracker />} />
          <Route path="/all-debris" element={<AllDebris />} />
          <Route path="/real-conjunctions" element={<RealConjunctions />} />
          <Route path="/conjunction/:id" element={<ConjunctionDetail />} />
          <Route path="/api" element={<ApiPage />} />
          <Route path="/api/terms" element={<ApiTerms />} />
          <Route path="/docs" element={<Docs />} />
          <Route path="/cascade-intelligence" element={<CascadeIntelligence />} />
          <Route path="/login" element={<Login />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/congestion" element={<LiveCongestion />} />
        </Routes>
      </main>
      <Footer />
      <Analytics />
    </div>
  );
}

export default function App() {
  const [theme, setTheme] = useState(
    () => localStorage.getItem("sd-theme") || "dark"
  );

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("sd-theme", theme);
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  return (
    <BrowserRouter>
      <AuthProvider>
        <AppShell theme={theme} toggleTheme={toggleTheme} />
      </AuthProvider>
    </BrowserRouter>
  );
}
