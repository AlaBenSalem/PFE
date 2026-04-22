import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE_URL } from "@api/client";

async function getTokens() {
  const [adminToken, userToken] = await Promise.all([
    AsyncStorage.getItem("adminToken"),
    AsyncStorage.getItem("userToken"),
  ]);
  return [adminToken, userToken].filter(Boolean);
}

async function requestWithFallback(method, path, body) {
  const tokens = await getTokens();
  const url = `${API_BASE_URL}${path}`;
  const options = {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  };

  let lastError = "No token available";

  for (const token of tokens) {
    try {
      const response = await fetch(url, {
        ...options,
        headers: { ...options.headers, Authorization: `Bearer ${token}` },
      });
      const text = await response.text();
      let data = {};
      try { data = JSON.parse(text); } catch {}

      if (response.ok || data?.success) return data;

      lastError = data?.message || data?.error || `HTTP ${response.status}`;
      if (response.status !== 401 && response.status !== 403) {
        throw new Error(lastError);
      }
    } catch (error) {
      lastError = error.message;
      if (!error.message.includes("401") && !error.message.includes("403")) {
        throw error;
      }
    }
  }

  if (method === "DELETE") {
    const id = path.split("/").pop();
    const fallbackUrl = `${API_BASE_URL}/users/${id}`;
    const response = await fetch(fallbackUrl, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
    });
    const data = await response.json().catch(() => ({}));
    if (response.ok || data?.success) return data;
    throw new Error(data?.message || data?.error || `Suppression echouee (${response.status})`);
  }

  throw new Error(lastError || "Acces refuse reconnectez-vous.");
}

export const adminAPI = {
  // ── Users ────────────────────────────────────────────────────────────────
  listUsers()          { return requestWithFallback("GET",    "/admin/users"); },
  createUser(body)     { return requestWithFallback("POST",   "/admin/users", body); },
  updateUser(id, body) { return requestWithFallback("PUT",    `/admin/users/${id}`, body); },
  toggleUserStatus(id) { return requestWithFallback("PATCH",  `/admin/users/${id}/status`); },
  deleteUser(id)       { return requestWithFallback("DELETE", `/admin/users/${id}`); },

  // ── Cultures (liste des cultures des users, pour admin) ──────────────────
  listCultures()         { return requestWithFallback("GET",    "/cultures"); },
  deleteCulture(id)      { return requestWithFallback("DELETE", `/cultures/${id}`); },

  // ── User stats ───────────────────────────────────────────────────────────
  getUserStats(id)       { return requestWithFallback("GET",    `/admin/users/${id}/stats`); },
  updateAdminProfile(body) { return requestWithFallback("PATCH",  `/admin/profile`, body); },

  // ── Base Kc (KCReference) ────────────────────────────────────────────────
  // GET  /api/kc         → toutes les cultures de la base Kc
  listKcCultures()     { return requestWithFallback("GET", "/kc"); },

  // POST /api/kc         → ajouter une culture dans la base Kc
  addKcCulture(body)   { return requestWithFallback("POST", "/kc", body); },

  // DELETE /api/kc/:id   → supprimer une culture de la base Kc
  deleteKcCulture(id)  { return requestWithFallback("DELETE", `/kc/${id}`); },
};