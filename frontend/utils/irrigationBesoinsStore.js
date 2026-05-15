// Singleton store: irrigation page writes besoins, AI chat reads them.
// Persisted to AsyncStorage so the store survives page refreshes.

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'smartirrig_besoins_v1';

let _store = {}; // { [cultureId]: { nom, besoins } }

export function updateIrrigationBesoins(cultureId, nom, besoins) {
  if (!cultureId || !besoins) return;
  _store = { ..._store, [cultureId]: { nom, besoins } };
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(_store)).catch(() => {});
}

export function getIrrigationBesoinsSnapshot() {
  return _store;
}

// Call once on app/chat mount — loads persisted data into memory if store is empty.
export async function loadBesoinsFromStorage() {
  if (Object.keys(_store).length > 0) return;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) _store = JSON.parse(raw);
  } catch {}
}
