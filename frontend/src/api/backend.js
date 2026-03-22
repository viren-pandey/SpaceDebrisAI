const API = (import.meta.env.VITE_API_URL ?? "https://virenn77-spacedebrisai.hf.space").replace(/\/+$/, "");
const isBrowser = typeof window !== "undefined";
export const API_TERMS_STORAGE_KEY = "sdai_api_terms_version";
export const ACTIVE_API_KEY_STORAGE_KEY = "sdai_active_api_key";
export const GUEST_API_KEY_STORAGE_KEY = "sdai_guest_api_key";
export const GUEST_EMAIL_STORAGE_KEY = "sdai_guest_email";

function buildHeaders() {
  const headers = {};
  if (!isBrowser) return headers;
  const apiKey = localStorage.getItem(ACTIVE_API_KEY_STORAGE_KEY);
  const email = localStorage.getItem("sdai_user_email")
    ?? localStorage.getItem(GUEST_EMAIL_STORAGE_KEY);
  if (apiKey) {
    headers["X-API-Key"] = apiKey;
  }
  if (email) {
    headers["X-User-Email"] = email;
  }
  return headers;
}

export async function fetchApiKeyPolicy() {
  const res = await fetch(`${API}/api-keys/policy`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Policy API error ${res.status}`);
  return await res.json();
}

export async function issueApiKey(payload) {
  const res = await fetch(`${API}/api-keys/issue`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail ?? `Issue API key error ${res.status}`);
  return data;
}

export async function revokeApiKey(key) {
  const res = await fetch(`${API}/api-keys/revoke`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail ?? `Revoke API key error ${res.status}`);
  return data;
}

export async function fetchSimulation() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);
  try {
    const res = await fetch(`${API}/simulate`, {
      cache: "no-store",
      headers: buildHeaders(),
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`Simulation API error: ${res.status}`);
    }
    return await res.json();
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error("Simulation request timed out. Backend is overloaded or slow.");
    }
    throw new Error("Failed to fetch simulation: " + err.message);
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchTrackerPositions(filter = "all") {
  const url = filter === "all" 
    ? `${API}/tracker/positions` 
    : `${API}/tracker/positions?filter=${filter}`;
  const res = await fetch(url, {
    cache: "no-store",
    headers: buildHeaders(),
  });
  if (!res.ok) throw new Error(`Tracker API error ${res.status}`);
  return await res.json();
}

export async function fetchCDM() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);
  try {
    const res = await fetch(`${API}/cdm`, {
      cache: "no-store",
      headers: buildHeaders(),
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`CDM API error: ${res.status}`);
    }
    return await res.json();
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error("CDM request timed out. Backend is overloaded or slow.");
    }
    throw new Error("Failed to fetch CDM: " + err.message);
  } finally {
    clearTimeout(timeout);
  }
}

export async function refreshCDM() {
  const res = await fetch(`${API}/cdm/refresh`, {
    method: "POST",
    cache: "no-store",
    headers: buildHeaders(),
  });
  if (!res.ok) throw new Error(`CDM refresh error ${res.status}`);
  return await res.json();
}
