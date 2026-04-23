const API = (import.meta.env.VITE_API_URL ?? "https://virenn77-spacedebrisai.hf.space").replace(/\/+$/, "");

function getToken() {
  try { return localStorage.getItem("sdai_token") || ""; } catch { return ""; }
}

function authHeaders() {
  const t = getToken();
  return t ? { "Content-Type": "application/json", "X-Token": t } : { "Content-Type": "application/json" };
}

const opts = { credentials: "include", headers: authHeaders() };
const optsPost = (body) => ({
  credentials: "include",
  method: "POST",
  headers: { "Content-Type": "application/json", ...getToken() ? { "X-Token": getToken() } : {} },
  body: JSON.stringify(body),
});
const optsDelete = () => ({
  credentials: "include",
  method: "DELETE",
  headers: { ...getToken() ? { "X-Token": getToken() } : {} },
});

export async function fetchPollUsage() {
  const res = await fetch(`${API}/user/poll-usage`, opts);
  if (!res.ok) throw new Error("Failed to fetch usage");
  return res.json();
}

export async function fetchUserMe() {
  const res = await fetch(`${API}/user/me`, opts);
  if (!res.ok) throw new Error("Failed to fetch user");
  return res.json();
}

export async function fetchUsageHistory() {
  const res = await fetch(`${API}/user/usage/history`, opts);
  if (!res.ok) throw new Error("Failed to fetch history");
  return res.json();
}

export async function fetchApiKeys() {
  const res = await fetch(`${API}/user/api-keys`, opts);
  if (!res.ok) throw new Error("Failed to fetch api keys");
  return res.json();
}

export async function createApiKey(label) {
  const res = await fetch(`${API}/user/api-keys`, optsPost({ label }));
  if (!res.ok) throw new Error("Failed to create key");
  return res.json();
}

export async function revokeApiKey(keyId) {
  const res = await fetch(`${API}/user/api-keys/${keyId}`, optsDelete());
  if (!res.ok) throw new Error("Failed to revoke key");
  return res.json();
}

export async function submitContact(payload) {
  const res = await fetch(`${API}/user/contact`, optsPost(payload));
  if (!res.ok) throw new Error("Failed to submit contact");
  return res.json();
}
