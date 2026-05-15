// Singleton store: irrigation page writes besoins, AI chat reads them.
// Using a module-level object avoids React Context overhead for cross-tree sharing.

let _store = {}; // { [cultureId]: { nom, besoins } }

export function updateIrrigationBesoins(cultureId, nom, besoins) {
  if (!cultureId || !besoins) return;
  _store = {
    ..._store,
    [cultureId]: { nom, besoins },
  };
}

export function getIrrigationBesoinsSnapshot() {
  return _store;
}
