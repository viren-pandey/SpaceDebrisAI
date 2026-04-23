const API = (import.meta.env.VITE_API_URL ?? "https://virenn77-spacedebrisai.hf.space").replace(/\/+$/, "");

export async function fetchPollUsage() {
  const email = localStorage.getItem("sdai_user_email") || "";
  const res = await fetch(`${API}/user/poll-usage`, {
    headers: { "X-User-Email": email }
  });
  if (!res.ok) throw new Error("Failed to fetch usage");
  return res.json();
}

export async function fetchUserMe() {
  const email = localStorage.getItem("sdai_user_email") || "";
  const res = await fetch(`${API}/user/me`, {
    headers: { "X-User-Email": email }
  });
  if (!res.ok) throw new Error("Failed to fetch user");
  return res.json();
}

export async function fetchUsageHistory() {
  const email = localStorage.getItem("sdai_user_email") || "";
  const res = await fetch(`${API}/user/usage/history`, {
    headers: { "X-User-Email": email }
  });
  if (!res.ok) throw new Error("Failed to fetch history");
  return res.json();
}

export async function fetchApiKeys() {
  const email = localStorage.getItem("sdai_user_email") || "";
  const res = await fetch(`${API}/user/api-keys`, {
    headers: { "X-User-Email": email }
  });
  if (!res.ok) throw new Error("Failed to fetch api keys");
  return res.json();
}

export async function createApiKey(label) {
  const email = localStorage.getItem("sdai_user_email") || "";
  const res = await fetch(`${API}/user/api-keys`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-User-Email": email },
    body: JSON.stringify({ label })
  });
  if (!res.ok) throw new Error("Failed to create key");
  return res.json();
}

export async function revokeApiKey(keyId) {
  const email = localStorage.getItem("sdai_user_email") || "";
  const res = await fetch(`${API}/user/api-keys/${keyId}`, {
    method: "DELETE",
    headers: { "X-User-Email": email }
  });
  if (!res.ok) throw new Error("Failed to revoke key");
  return res.json();
}

export async function submitContact(payload) {
  const email = localStorage.getItem("sdai_user_email") || "";
  const res = await fetch(`${API}/user/contact`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-User-Email": email },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error("Failed to submit contact");
  return res.json();
}
