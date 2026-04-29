import { useEffect, useRef, useState } from "react";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { Analytics } from "@vercel/analytics/react";
import { AuthProvider } from "./contexts/AuthContext";
import Footer from "./components/Footer";
import Navbar from "./components/Navbar";
import SatelliteBackground from "./components/SatelliteBackground";
import { fetchBackendHealth, fetchSimulation } from "./api/backend";
import About from "./pages/About";
import AdminBypass from "./pages/admin/Bypass";
import AdminLogin from "./pages/admin/Login";
import AdminDashboard from "./pages/AdminDashboard";
import AllDebris from "./pages/AllDebris";
import ApiPage from "./pages/ApiPage";
import ApiTerms from "./pages/ApiTerms";
import ChangeReport from "./pages/ChangeReport";
import ConjunctionDetail from "./pages/ConjunctionDetail";
import Contact from "./pages/Contact";
import CascadeIntelligence from "./pages/CascadeIntelligence";
import CDMTimeline from "./pages/CDMTimeline";
import Dashboard from "./pages/Dashboard";
import UserDashboard from "./pages/dashboard/Dashboard";
import UserApiKeys from "./pages/dashboard/ApiKeys";
import UserUsage from "./pages/dashboard/Usage";
import UserContact from "./pages/dashboard/Contact";
import Docs from "./pages/Docs";
import HighRiskCollisions from "./pages/HighRiskCollisions";
import LiveCongestion from "./pages/LiveCongestion";
import Login from "./pages/Login";
import RealConjunctions from "./pages/RealConjunctions";
import Satellites from "./pages/Satellites";
import ShellInstability from "./pages/ShellInstability";
import SimulationStats from "./pages/SimulationStats";
import SpaceWeather from "./pages/SpaceWeather";
import Tracker from "./pages/Tracker";

const SIMULATION_REFRESH_MS = 60000;
const SIMULATION_ROUTES = new Set(["/", "/satellites"]);

function AppShell({ theme, toggleTheme }) {
  const location = useLocation();
  const shouldLoadSimulation = SIMULATION_ROUTES.has(location.pathname);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [backendStatus, setBackendStatus] = useState(null);
  const [loading, setLoading] = useState(shouldLoadSimulation);
  const hasLoadedSimulationRef = useRef(false);
  const isFetchingRef = useRef(false);
  const abortControllerRef = useRef(null);

  useEffect(() => {
    if (!shouldLoadSimulation) {
      setLoading(false);
      setError(null);
      return;
    }

    let active = true;
    async function loadSimulation() {
      if (isFetchingRef.current) return;
      isFetchingRef.current = true;
      
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();
      
      const isInitialLoad = !hasLoadedSimulationRef.current;
      if (isInitialLoad) {
        setLoading(true);
      }

      try {
        const nextData = await fetchSimulation();
        if (!active) return;
        setData(nextData);
        setError(null);
        setBackendStatus(null);
        hasLoadedSimulationRef.current = true;
      } catch (err) {
        if (!active || err.name === "AbortError") return;
        try {
          const health = await fetchBackendHealth();
          if (!active) return;
          setBackendStatus(health);
        } catch {
          if (!active) return;
          setBackendStatus(null);
        }
        setError(err.message);
      } finally {
        if (active && isInitialLoad) {
          setLoading(false);
        }
        isFetchingRef.current = false;
      }
    }

    loadSimulation();
    const timer = setInterval(loadSimulation, SIMULATION_REFRESH_MS);

    return () => {
      active = false;
      clearInterval(timer);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [shouldLoadSimulation]);

  return (
    <div className="app-root">
      {theme === "dark" && <SatelliteBackground />}
      <Navbar live={!loading && !error} theme={theme} onToggleTheme={toggleTheme} />
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Dashboard data={data} loading={loading} error={error} backendStatus={backendStatus} />} />
          <Route path="/satellites" element={<Satellites data={data} loading={loading} error={error} backendStatus={backendStatus} />} />
          <Route path="/tracker" element={<Tracker />} />
          <Route path="/all-debris" element={<AllDebris />} />
          <Route path="/real-conjunctions" element={<RealConjunctions />} />
          <Route path="/conjunction/:id" element={<ConjunctionDetail />} />
          <Route path="/api" element={<ApiPage />} />
          <Route path="/api/terms" element={<ApiTerms />} />
          <Route path="/docs" element={<Docs />} />
          <Route path="/cascade-intelligence" element={<CascadeIntelligence />} />
          <Route path="/spaceweather" element={<SpaceWeather />} />
          <Route path="/shell-instability" element={<ShellInstability />} />
          <Route path="/cdm-timeline" element={<CDMTimeline />} />
          <Route path="/dashboard" element={<UserDashboard />} />
          <Route path="/dashboard/api-keys" element={<UserApiKeys />} />
          <Route path="/dashboard/usage" element={<UserUsage />} />
          <Route path="/dashboard/contact" element={<UserContact />} />
          <Route path="/login" element={<Login />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/admin/bypass" element={<AdminBypass />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/congestion" element={<LiveCongestion />} />
          <Route path="/high-risk-collisions" element={<HighRiskCollisions />} />
          <Route path="/simulation-stats" element={<SimulationStats />} />
          <Route path="/change-report" element={<ChangeReport />} />
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
