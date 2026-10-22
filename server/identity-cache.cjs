// Contact labels only; authorization and masking remain per request.
const stores = new WeakMap();
function state(db) {
  if (!stores.has(db))
    stores.set(db, { values: new Map(), pending: new Map() });
  return stores.get(db);
}
async function loadIdentities(services, collection, ids, fieldMask) {
  const cache = state(services.db),
    key = (id) => collection + ":" + id;
  const missing = ids.filter(
    (id) =>
      !(cache.values.get(key(id))?.expires > Date.now()) &&
      !cache.pending.has(key(id)),
  );
  if (missing.length) {
    const task = Promise.resolve()
      .then(() =>
        services.db.getAll(
          ...missing.map((id) => services.db.doc(collection + "/" + id)),
          { fieldMask },
        ),
      )
      .then((docs) => {
        docs.forEach((doc) => {
          cache.values.set(key(doc.id), {
            data: doc.exists ? doc.data() : null,
            expires: Date.now() + (doc.exists ? 60000 : 10000),
          });
        });
        while (cache.values.size > 1000)
          cache.values.delete(cache.values.keys().next().value);
      })
      .finally(() => missing.forEach((id) => cache.pending.delete(key(id))));
    missing.forEach((id) => cache.pending.set(key(id), task));
  }
  let timer;
  try {
    await Promise.race([
      Promise.all([
        ...new Set(ids.map((id) => cache.pending.get(key(id))).filter(Boolean)),
      ]),
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("Contact lookup timed out")),
          8000,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
  return new Map(ids.map((id) => [id, cache.values.get(key(id))?.data]));
}
function clearIdentityCache(services) {
  stores.delete(services.db);
}
module.exports = { loadIdentities, clearIdentityCache };
