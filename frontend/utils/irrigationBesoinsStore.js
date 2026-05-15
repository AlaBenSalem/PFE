// Singleton store: irrigation page writes besoins, AI chat reads them.
// On web: uses localStorage (synchronous) so data survives page refreshes instantly.
// On native: uses AsyncStorage (async, fire-and-forget writes).

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'smartirrig_besoins_v1';

let _store = {};

// ── Auto-load at module init (web: synchronous, instant) ─────────────────────
if (Platform.OS === 'web') {
  try {
    const raw = typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY);
    if (raw) _store = JSON.parse(raw);
  } catch {}
}

// ── Write ─────────────────────────────────────────────────────────────────────
export function updateIrrigationBesoins(cultureId, nom, besoins) {
  if (!cultureId || !besoins) return;
  _store = { ..._store, [cultureId]: { nom, besoins } };
  if (Platform.OS === 'web') {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(_store)); } catch {}
  } else {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(_store)).catch(() => {});
  }
}

// ── Read ──────────────────────────────────────────────────────────────────────
export function getIrrigationBesoinsSnapshot() {
  return _store;
}

// ── Load for native (no-op on web, already loaded synchronously above) ────────
export async function loadBesoinsFromStorage() {
  if (Platform.OS === 'web' || Object.keys(_store).length > 0) return;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) _store = JSON.parse(raw);
  } catch {}
}
