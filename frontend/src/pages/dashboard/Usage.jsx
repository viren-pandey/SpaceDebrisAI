import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { fetchUsageHistory } from "../../api/dashboard";
import DashboardLayout from "../../components/dashboard/DashboardLayout";

export default function Usage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { navigate("/login"); return; }
    fetchUsageHistory().then(setHistory).catch(() => setHistory([])).finally(() => setLoading(false));
  }, [user, navigate]);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="spinner" /></div>;

  return (
    <DashboardLayout>
      <div className="page-container">
        <h1>Usage History</h1>
        <p className="page-subtitle">30-day poll usage breakdown</p>
        <table className="data-table">
          <thead><tr><th>Date</th><th>Polls Used</th></tr></thead>
          <tbody>
            {history.map(row => <tr key={row.date}><td>{row.date}</td><td>{row.polls.toLocaleString()}</td></tr>)}
            {history.length === 0 && <tr><td colSpan={2} className="empty-cell">No usage data available.</td></tr>}
          </tbody>
        </table>
      </div>
    </DashboardLayout>
  );
}
