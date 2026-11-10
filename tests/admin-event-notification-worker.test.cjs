const { test } = require('node:test');
const assert = require('node:assert/strict');
const { deliverAdminEventNotification } = require('../server/admin-event-notification-worker.cjs');

test('admin event delivery respects preferences and deduplicates in-app notices', async () => {
  const created = new Set();
  const pushes = [];
  const updates = [];
  const user = (uid) => ({
    get: async () => ({ data: () => ({ notificationPreferences: uid === 'opted-out' ? [] : ['event_updates'] }) }),
    collection: (name) => ({
      doc: id => ({ create: async value => {
        const key = uid + '/' + id;
        if (created.has(key)) { const error = new Error('exists'); error.code = 6; throw error; }
        created.add(key); assert.equal(value.kind, 'event_update');
      } }),
      get: async () => ({ docs: [{ id: 'fallback-token', data: () => ({ token: 'device-' + uid }) }] }),
    }),
  });
  const db = {
    doc: path => path === 'events/e1'
      ? { get: async () => ({ exists: true, data: () => ({ title: 'The event' }) }), collection: () => ({ limit: () => ({ get: async () => ({ docs: [] }) }) }) }
      : user(path.split('/')[1]),
    collection: name => ({ where: () => ({ limit: () => ({ get: async () => ({ docs: [
      { data: () => ({ type: 'ticket', status: 'active', userId: 'buyer' }) },
      { data: () => ({ type: 'ticket', status: 'active', userId: 'opted-out' }) },
    ] }) }) }) }),
  };
  const notification = { id: 'request-one', exists: true,
    data: () => ({ eventId: 'e1', adminUid: 'admin', message: 'Doors open soon', audience: { buyers: true }, status: 'queued' }),
    ref: { update: async value => updates.push(value) },
  };
  const deps = { db, messaging: { sendEachForMulticast: async value => { pushes.push(value); return { responses: [{ success: true }] }; } }, serverTimestamp: () => 'NOW' };
  await deliverAdminEventNotification(notification, deps);
  assert.equal(updates.at(-1).status, 'sent');
  assert.equal(updates.at(-1).recipientsCount, 1);
  assert.equal(pushes.length, 1);
  assert.equal(pushes[0].tokens[0], 'device-buyer');
  await deliverAdminEventNotification(notification, deps);
  assert.equal(pushes.length, 1);
  assert.equal(created.size, 1);
});
