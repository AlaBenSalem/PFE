import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE_URL } from "@api/client";

const TOKENS = {
  user:      "userToken",
  admin:     "adminToken",
  userData:  "userData",
  adminData: "adminData",
};

// ✅ request merge correctement les headers
async function request(path, options = {}) {
  const url = `${API_BASE_URL}${path}`;
  const { headers: extraHeaders, ...restOptions } = options;

  const res = await fetch(url, {
    ...restOptions,
    headers: {
      "Content-Type": "application/json",
      ...(extraHeaders || {}),
    },
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.message || data?.error || "Erreur réseau");
  }
  return data;
}

export const authAPI = {
  // ── USER ────────────────────────────────────────────────────────────────────
  async register(body) {
    const data = await request("/auth/register", {
      method: "POST",
      body: JSON.stringify(body),
    });
    if (data.token) await AsyncStorage.setItem(TOKENS.user, data.token);
    if (data.user)  await AsyncStorage.setItem(TOKENS.userData, JSON.stringify(data.user));
    return data;
  },

  async login(body) {
    const data = await request("/auth/login", {
      method: "POST",
      body: JSON.stringify(body),
    });
    if (data.token) await AsyncStorage.setItem(TOKENS.user, data.token);
    if (data.user)  await AsyncStorage.setItem(TOKENS.userData, JSON.stringify(data.user));
    return data;
  },

  async googleLogin({ idToken, accessToken }) {
    const body = idToken ? { idToken } : { accessToken };
    return request("/auth/google", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  async getUser() {
    try {
      const raw = await AsyncStorage.getItem(TOKENS.userData);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  },

  async getUserToken() {
    try { return await AsyncStorage.getItem(TOKENS.user); }
    catch { return null; }
  },

  async forgotPassword(body) {
    return request("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  async verifyCode(body) {
    return request("/auth/verify-code", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  async resetPassword(body) {
    return request("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  // ── ADMIN ───────────────────────────────────────────────────────────────────
  async adminLogin(body) {
    // ✅ Route correcte : /admin/login (pas /auth/admin/login)
    const data = await request("/admin/login", {
      method: "POST",
      body: JSON.stringify(body),
    });
    if (data.token) await AsyncStorage.setItem(TOKENS.admin, data.token);
    if (data.admin) await AsyncStorage.setItem(TOKENS.adminData, JSON.stringify(data.admin));
    return data;
  },

  async getAdmin() {
    try {
      const raw = await AsyncStorage.getItem(TOKENS.adminData);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  },

  async getAdminToken() {
    try { return await AsyncStorage.getItem(TOKENS.admin); }
    catch { return null; }
  },

  async adminUsers() {
    const token = await this.getAdminToken();
    if (!token) throw new Error("Token admin manquant — reconnectez-vous");
    return request("/admin/users", {
      headers: { Authorization: `Bearer ${token}` },
    });
  },

  async adminDeleteUser(id) {
    const token = await this.getAdminToken();
    if (!token) throw new Error("Token admin manquant — reconnectez-vous");
    return request(`/admin/users/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
  },

  // ── LOGOUT ──────────────────────────────────────────────────────────────────
  async logout() {
    await AsyncStorage.multiRemove([
      TOKENS.user, TOKENS.admin, TOKENS.userData, TOKENS.adminData,
    ]);
  },
};
