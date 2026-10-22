// Process-local only: caching never writes Firestore or replaces authorization.
const stores = new WeakMap();
class ReadCache {
  constructor({ now = Date.now, max = 160 } = {}) {
    this.now = now;
    this.max = max;
    this.entries = new Map();
    this.generation = 0;
  }
  async get(key, ttl, loader, { fresh = false } = {}) {
    const now = this.now(),
      entry = this.entries.get(key);
    if (
      entry &&
      (entry.promise || entry.expires > now) &&
      (!fresh || entry.promise || now - entry.created < 5000)
    )
      return entry.promise || entry.value;
    const generation = this.generation;
    const next = { created: now };
    next.promise = Promise.resolve()
      .then(loader)
      .then((value) => {
        if (this.generation === generation && this.entries.get(key) === next) {
          next.value = value;
          next.expires = this.now() + ttl;
          next.created = this.now();
          delete next.promise;
        }
        return value;
      })
      .catch((error) => {
        if (this.entries.get(key) === next) this.entries.delete(key);
        throw error;
      });
    this.entries.delete(key);
    this.entries.set(key, next);
    while (this.entries.size > this.max)
      this.entries.delete(this.entries.keys().next().value);
    return next.promise;
  }
  clear() {
    this.generation++;
    this.entries.clear();
  }
}
function storeFor(services) {
  let cache = stores.get(services.db);
  if (!cache) {
    cache = new ReadCache();
    stores.set(services.db, cache);
  }
  return cache;
}
function cachedRead(services, actor, path, params, ttl, loader) {
  const query = new URLSearchParams(params);
  const fresh = query.get("fresh") === "1";
  query.delete("fresh");
  query.sort();
  const key = JSON.stringify([
    actor.uid,
    actor.roles,
    actor.deniedResources || [],
    actor.deniedActions || [],
    actor.accessVersion || 0,
    path,
    query.toString(),
  ]);
  return storeFor(services).get(key, ttl, loader, { fresh });
}
module.exports = { ReadCache, storeFor, cachedRead };
