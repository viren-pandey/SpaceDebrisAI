const API = import.meta.env.VITE_API_URL ?? "https://virenn77-spacedebrisai.hf.space";
const isBrowser = typeof window !== "undefined";

function buildHeaders() {
  const headers = {};
  if (!isBrowser) return headers;
  const email = localStorage.getItem("sdai_user_email")
    ?? localStorage.getItem("sdai_guest_email");
  if (email) {
    headers["X-User-Email"] = email;
  }
  return headers;
}

export async function fetchSimulation() {
  const res = await fetch(`${API}/simulate`, {
    cache: "no-store",
    headers: buildHeaders(),
  });
  if (!res.ok) {
    throw new Error("Failed to fetch simulation its our fault sorry");
  }
  return await res.json();
}

export async function fetchTrackerPositions() {
  const res = await fetch(`${API}/tracker/positions`, {
    cache: "no-store",
    headers: buildHeaders(),
  });
  if (!res.ok) throw new Error(`Tracker API error ${res.status}`);
  return await res.json();
}
