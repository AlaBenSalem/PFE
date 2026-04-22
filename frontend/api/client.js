// api/client.js — CORRIGÉ
// Fix : apiFetch intercepte les 401/403 et redirige vers login automatiquement
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

function normalizeApiBaseUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const noTrailingSlash = raw.replace(/\/+$/, '');
  if (noTrailingSlash.endsWith('/api')) return noTrailingSlash;
  return `${noTrailingSlash}/api`;
}

const ENV_API_BASE =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  process.env.EXPO_PUBLIC_API_URL ||
  process.env.EXPO_PUBLIC_API_BASE;

const IS_DEV = typeof __DEV__ !== 'undefined' && __DEV__;

function inferDevApiBaseUrl() {
  try {
    const hostUri =
      Constants.expoConfig?.hostUri ||
      Constants?.manifest2?.extra?.expoClient?.hostUri ||
      Constants?.manifest?.hostUri ||
      Constants?.manifest?.debuggerHost;
    const hostPort = String(hostUri || '').split('://').pop().split('/')[0];
    const host = hostPort.split(':')[0];
    if (host) return host;
  } catch {}
  return '';
}

function isLikelyIpAddress(host) {
  const value = String(host || '').trim();
  if (!value) return false;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(value)) return true;
  if (/^[0-9a-f:]+$/i.test(value) && value.includes(':')) return true;
  return false;
}

function getDevDefaultApiBaseUrl() {
  if (Platform.OS === 'web') return 'http://localhost:5000';
  const inferredHost = inferDevApiBaseUrl();
  if (isLikelyIpAddress(inferredHost)) return `http://${inferredHost}:5000`;
  return 'https://smartirrigation-2.onrender.com';
}

export const API_BASE_URL =
  normalizeApiBaseUrl(ENV_API_BASE) ||
  (IS_DEV
    ? normalizeApiBaseUrl(getDevDefaultApiBaseUrl())
    : 'https://smartirrigation-2.onrender.com/api');

export const API_ENDPOINTS = {
  auth: {
    login:          `${API_BASE_URL}/auth/login`,
    adminLogin:     `${API_BASE_URL}/admin/login`,
    register:       `${API_BASE_URL}/auth/register`,
    forgotPassword: `${API_BASE_URL}/auth/forgot-password`,
    verifyCode:     `${API_BASE_URL}/auth/verify-code`,
    resetPassword:  `${API_BASE_URL}/auth/reset-password`,
    profile:        `${API_BASE_URL}/auth/profile`,
    google:         `${API_BASE_URL}/auth/google`,
  },
  weather: {
    current:      `${API_BASE_URL}/weather/current`,
    history:      `${API_BASE_URL}/weather/history`,
    forecast:     `${API_BASE_URL}/weather/forecast`,
    calculateET0: `${API_BASE_URL}/weather/calculate-et0`,
    calculateETc: `${API_BASE_URL}/weather/calculate-etc`,
  },
  kc: {
    base:    `${API_BASE_URL}/kc`,
    search:  `${API_BASE_URL}/kc/search`,
    add:     `${API_BASE_URL}/kc/add`,
    delete:  (id) => `${API_BASE_URL}/kc/${id}`,
    byId:    (id) => `${API_BASE_URL}/kc/${id}`,
    mensuel: (culture) => `${API_BASE_URL}/kc/mensuel/${encodeURIComponent(culture)}`,
    current: (culture, mois) =>
      `${API_BASE_URL}/kc/current?culture=${encodeURIComponent(culture)}${mois ? `&mois=${mois}` : ''}`,
    init:    `${API_BASE_URL}/kc/init`,
  },
  cultures: {
    base: `${API_BASE_URL}/cultures`,
    byId: (id) => `${API_BASE_URL}/cultures/${id}`,
  },
  irrigations: {
    base:           `${API_BASE_URL}/irrigations`,
    byCulture:      (id) => `${API_BASE_URL}/irrigations/culture/${id}`,
    today:          `${API_BASE_URL}/irrigations/today`,
    calculateNeeds: (id) => `${API_BASE_URL}/irrigations/calculate-needs/${id}`,
    etcHistory:     (id, days = 30) => `${API_BASE_URL}/irrigations/etc-history/${id}?days=${days}`,
  },
  fertilisations: {
    base:       `${API_BASE_URL}/fertilisations`,
    byId:       (id) => `${API_BASE_URL}/fertilisations/${id}`,
    prochaines: `${API_BASE_URL}/fertilisations/prochaines`,
  },
  admin: {
    stats:       `${API_BASE_URL}/admin/stats`,
    users:       `${API_BASE_URL}/admin/users`,
    userStats:   (id) => `${API_BASE_URL}/admin/users/${id}/stats`,
    adminProfile: `${API_BASE_URL}/admin/profile`,
    volumeByDay: (days = 30, userId = null) =>
      `${API_BASE_URL}/admin/irrigations/volume-by-day?days=${days}${userId ? `&userId=${userId}` : ''}`,
    messagesUnreadCount: `${API_BASE_URL}/admin/messages/unread-count`,
    messagesList: ({ limit = 30, skip = 0, unreadOnly = false } = {}) =>
      `${API_BASE_URL}/admin/messages?limit=${limit}&skip=${skip}&unreadOnly=${unreadOnly}`,
    messageMarkRead: (id) => `${API_BASE_URL}/admin/messages/${id}/read`,
  },
  messages: {
    create: `${API_BASE_URL}/messages`,
  },
  users: {
    base: `${API_BASE_URL}/users`,
    byId: (id) => `${API_BASE_URL}/users/${id}`,
  },
  ai: {
    chat:   `${API_BASE_URL}/ai/chat`,
    status: `${API_BASE_URL}/ai/status`,
    tts:    `${API_BASE_URL}/ai/tts`,
  },
};

const TIMEOUT_MS = 30000;

// ✅ FIX : callback de déconnexion injectable (évite import circulaire)
// Appelé depuis useSession ou authAPI quand un 401 est intercepté
let _onUnauthorized = null;
export function setUnauthorizedCallback(cb) {
  _onUnauthorized = cb;
}

export async function apiFetch(urlOrPath, options = {}) {
  const { timeoutMs = TIMEOUT_MS, ...fetchOptions } = options;

  const url = urlOrPath.startsWith('http')
    ? urlOrPath
    : `${API_BASE_URL}${urlOrPath.startsWith('/') ? urlOrPath : '/' + urlOrPath}`;

  let authHeader = {};
  try {
    const adminToken = await AsyncStorage.getItem('adminToken');
    const userToken  = await AsyncStorage.getItem('userToken');
    const token = adminToken || userToken;
    if (token) authHeader = { Authorization: `Bearer ${token}` };
  } catch {}

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const mergedOptions = {
    ...fetchOptions,
    headers: {
      'Content-Type': 'application/json',
      ...authHeader,
      ...(fetchOptions.headers || {}),
    },
    signal: controller.signal,
  };

  try {
    const response = await fetch(url, mergedOptions);
    clearTimeout(timer);

    // ✅ FIX : intercepter 401/403 et déclencher déconnexion automatique
    if ((response.status === 401 || response.status === 403) && authHeader.Authorization) {
      console.warn(`[apiFetch] Token expiré ou invalide (${response.status}) — déconnexion automatique`);
      try {
        await AsyncStorage.multiRemove(['userToken', 'adminToken', 'userData', 'adminData']);
      } catch {}
      if (_onUnauthorized) {
        _onUnauthorized();
      }
    }

    return response;
  } catch (error) {
    clearTimeout(timer);
    if (error.name === 'AbortError') {
      throw new Error('Délai dépassé — vérifiez votre connexion internet');
    }
    if (String(error.message).includes('Network') || String(error.message).includes('fetch')) {
      throw new Error('Serveur inaccessible. Vérifiez votre connexion.');
    }
    throw error;
  }
}
