const API = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000";

export async function fetchSimulation() {
  const res = await fetch(`${API}/simulate`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error("Failed to fetch simulation its our fault sorry");
  }
  return await res.json();
}

export async function fetchTrackerPositions() {
  const res = await fetch(`${API}/tracker/positions`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Tracker API error ${res.status}`);
  return await res.json();
}
