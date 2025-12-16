// --- API base dinámica (se guarda en localStorage) ---
const API_URL_KEY = "apiUrl";
const TOKEN_KEY = "token";

export function getApiUrl() {
  return localStorage.getItem(API_URL_KEY) || "";
}

export function setApiUrl(url) {
  // normaliza: sin slash final
  const normalized = (url || "").trim().replace(/\/+$/, "");
  localStorage.setItem(API_URL_KEY, normalized);
  return normalized;
}

export function clearApiUrl() {
  localStorage.removeItem(API_URL_KEY);
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || "";
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function request(path, { method = "GET", body } = {}) {
  const baseUrl = getApiUrl();
  if (!baseUrl) throw new Error("Falta la URL de la API.");

  const token = getToken();

  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg = data?.error || `Error HTTP ${res.status}`;
    throw new Error(msg);
  }

  return data;
}

export const api = {
  login: (username, password) =>
    request("/auth/login", { method: "POST", body: { username, password } }),

  me: () => request("/auth/me"),

  getConfig: () => request("/config"),

  createKey: (key, value) =>
    request(`/config/${encodeURIComponent(key)}`, { method: "POST", body: { value } }),

  patchConfig: (patch) =>
    request("/config", { method: "PATCH", body: patch }),

  deleteKey: (key) =>
    request(`/config/${encodeURIComponent(key)}`, { method: "DELETE" }),
};
