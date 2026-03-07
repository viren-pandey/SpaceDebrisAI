import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import SatelliteBackground from "./components/SatelliteBackground";
import Footer from "./components/Footer";
import Dashboard from "./pages/Dashboard";
import Satellites from "./pages/Satellites";
import About from "./pages/About";
import Tracker from "./pages/Tracker";
import ApiPage from "./pages/ApiPage";
import ConjunctionDetail from "./pages/ConjunctionDetail";
import { fetchSimulation } from "./api/backend";

export default function App() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState(
    () => localStorage.getItem("sd-theme") || "dark"
  );

  // Apply theme to <html> element so CSS [data-theme] selectors work globally
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("sd-theme", theme);
  }, [theme]);

  useEffect(() => {
    fetchSimulation()
      .then((d) => { setData(d); setLoading(false); })
      .catch((err) => { setError(err.message); setLoading(false); });
  }, []);

  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  return (
    <BrowserRouter>
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
            <Route path="/about" element={<About />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </BrowserRouter>
  );
}
