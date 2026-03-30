const API = (import.meta.env.VITE_API_URL ?? "https://virenn77-spacedebrisai.hf.space").replace(/\/+$/, "");
const isBrowser = typeof window !== "undefined";
export const API_TERMS_STORAGE_KEY = "sdai_api_terms_version";
export const ACTIVE_API_KEY_STORAGE_KEY = "sdai_active_api_key";
export const GUEST_API_KEY_STORAGE_KEY = "sdai_guest_api_key";
export const GUEST_EMAIL_STORAGE_KEY = "sdai_guest_email";

function getStoredApiKey() {
  if (!isBrowser) return "";
  return localStorage.getItem(ACTIVE_API_KEY_STORAGE_KEY) || "";
}

function buildHeaders({ includeApiKey = true } = {}) {
  const headers = {};
  if (!isBrowser) return headers;
  const apiKey = getStoredApiKey();
  const email = localStorage.getItem("sdai_user_email")
    ?? localStorage.getItem(GUEST_EMAIL_STORAGE_KEY);
  if (includeApiKey && apiKey) {
    headers["X-API-Key"] = apiKey;
  }
  if (email) {
    headers["X-User-Email"] = email;
  }
  return headers;
}

async function parseError(res, fallbackMessage) {
  try {
    const data = await res.json();
    return data.detail ?? fallbackMessage;
  } catch {
    return fallbackMessage;
  }
}

async function fetchPublicJson(url, { timeoutMs = 25000 } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const hasApiKey = Boolean(getStoredApiKey());

  async function run(includeApiKey) {
    return await fetch(url, {
      cache: "no-store",
      headers: buildHeaders({ includeApiKey }),
      signal: controller.signal,
    });
  }

  try {
    let res = await run(true);
    if ((res.status === 401 || res.status === 403) && hasApiKey) {
      res = await run(false);
    }
    if (!res.ok) {
      throw new Error(await parseError(res, `Request failed with status ${res.status}`));
    }
    return await res.json();
  } finally {
    clearTimeout(timeout);
  }
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
  try {
    return await fetchPublicJson(`${API}/simulate`);
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error("Simulation request timed out. Backend is overloaded or slow.");
    }
    throw new Error("Failed to fetch simulation: " + err.message);
  }
}

export async function fetchTrackerPositions(filter = "all") {
  const url = filter === "all" 
    ? `${API}/tracker/positions` 
    : `${API}/tracker/positions?filter=${filter}`;
  try {
    return await fetchPublicJson(url);
  } catch (err) {
    throw new Error("Failed to fetch tracker positions: " + err.message);
  }
}

export async function fetchCDM() {
  try {
    return await fetchPublicJson(`${API}/cdm`);
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error("CDM request timed out. Backend is overloaded or slow.");
    }
    throw new Error("Failed to fetch CDM: " + err.message);
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

export async function fetchOdriSnapshot(limit = 10) {
  try {
    return await fetchPublicJson(`${API}/risk/odri?limit=${limit}`);
  } catch (err) {
    throw new Error("Failed to fetch ODRI snapshot: " + err.message);
  }
}

export async function fetchOdriForSatellite(satId, deltaT = 7) {
  const params = new URLSearchParams({
    sat_id: satId,
    delta_t: String(deltaT),
  });
  try {
    return await fetchPublicJson(`${API}/risk/odri?${params.toString()}`);
  } catch (err) {
    throw new Error("Failed to fetch satellite ODRI: " + err.message);
  }
}

export async function askCascadeQuestion(payload) {
  const res = await fetch(`${API}/cascade/ask`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...buildHeaders(),
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail ?? `Cascade API error ${res.status}`);
  return data;
}
