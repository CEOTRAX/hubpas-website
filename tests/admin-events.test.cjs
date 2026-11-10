const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mutateEvent, eventDetail, listEvents, scanTicket, queueNotification, configureEventFeature } = require('../server/admin-events.cjs');
const { cursorCodec } = require('../server/admin-policy.cjs');

function memoryServices() {
  const values = new Map([
    ['events/e1', { title: 'Original', hostId: 'host-one', status: 'published', publicVisibility: 'visible', ticketTiers: [{ id: 'standard', name: 'Standard', price: 10, sold: 1 }], interactiveFeatures: { ticketsEnabled: true } }],
    ['tickets/t1', { eventId: 'e1', userId: 'buyer-one', status: 'active', price: 10, qrCode: 'ticket-secret' }],
  ]);
  const writes = [];
  let auditSequence = 0;
  const ref = path => ({ path, id: path.split('/').at(-1), get: async () => snap(path), collection: name => collection(path + '/' + name) });
  const snap = path => ({ id: path.split('/').at(-1), ref: ref(path), exists: values.has(path), data: () => values.get(path) });
  const collection = path => ({
    doc: id => ref(path + '/' + (id || `audit-${++auditSequence}`)),
    where: (field, _operator, value) => ({
      where: (nextField, _nextOperator, nextValue) => ({ limit: () => ({ get: async () => {
        const docs = [...values.keys()].filter(key => key.startsWith(path + '/') && key.split('/').length === 2 && values.get(key)[field] === value && values.get(key)[nextField] === nextValue).map(key => snap(key));
        return { docs, empty: !docs.length };
      } }) }),
      limit: () => ({ get: async () => {
        const docs = [...values.keys()].filter(key => key.startsWith(path + '/') && key.split('/').length === 2 && values.get(key)[field] === value).map(key => snap(key));
        return { docs, empty: !docs.length };
      } }),
    }),
    limit: () => ({ get: async () => ({ docs: [] }) }),
    orderBy: () => ({ limit: () => ({ get: async () => ({ docs: [] }) }) }),
  });
  const db = {
    doc: ref, collection,
    runTransaction: async task => {
      const staged = [];
      const result = await task({
        get: async target => snap(target.path),
        update: (target, patch) => staged.push(['update', target.path, patch]),
        create: (target, data) => staged.push(['create', target.path, data]),
      });
      for (const [kind, path, data] of staged) {
        if (kind === 'create' && values.has(path)) throw new Error('Already exists');
        values.set(path, kind === 'update' ? { ...values.get(path), ...data } : data);
        writes.push([kind, path]);
      }
      return result;
    },
  };
  return { db, values, writes, FieldValue: { serverTimestamp: () => 'SERVER_TIME' }, FieldPath: { documentId: () => '__name__' } };
}
const owner = { uid: 'admin-one', roles: ['super_admin'], deniedResources: [], deniedActions: [] };
const request = (value, requestId = 'unique-request-123') => ({ id: 'e1', action: 'visibility', value, reason: 'Policy review requires a visibility change', requestId });

test('admin visibility is atomic, audited, idempotent and preserves purchased tickets', async () => {
  const prior = process.env.ADMIN_EVENT_ACTIONS_ENABLED;
  process.env.ADMIN_EVENT_ACTIONS_ENABLED = 'true';
  try {
    const services = memoryServices();
    const result = await mutateEvent(request('hidden'), owner, services);
    assert.equal(result.ok, true);
    assert.equal(services.values.get('events/e1').publicVisibility, 'hidden');
    assert.deepEqual(services.values.get('tickets/t1'), { eventId: 'e1', userId: 'buyer-one', status: 'active', price: 10, qrCode: 'ticket-secret' });
    const audit = services.values.get('adminAuditLogs/' + result.auditId);
    assert.equal(audit.adminUid, owner.uid);
    assert.equal(audit.eventId, 'e1');
    assert.equal(audit.before.publicVisibility, 'visible');
    assert.equal(audit.after.publicVisibility, 'hidden');
    assert.match(audit.reason, /Policy review/);
    assert.deepEqual(await mutateEvent(request('hidden'), owner, services), result);
    assert.equal(services.writes.length, 3);
    await mutateEvent(request('visible', 'unique-request-124'), owner, services);
    assert.equal(services.values.get('events/e1').publicVisibility, 'visible');
  } finally { if (prior === undefined) delete process.env.ADMIN_EVENT_ACTIONS_ENABLED; else process.env.ADMIN_EVENT_ACTIONS_ENABLED = prior; }
});

test('non-admin and denied event roles cannot read or mutate', async () => {
  const services = memoryServices();
  const nonAdmin = { uid: 'customer-one', roles: [], deniedResources: [], deniedActions: [] };
  await assert.rejects(listEvents(new URLSearchParams(), nonAdmin, services, cursorCodec('test')), /access denied/);
  await assert.rejects(eventDetail(new URLSearchParams({ id: 'e1' }), nonAdmin, services), /access denied/);
  await assert.rejects(mutateEvent(request('hidden'), nonAdmin, services), /access denied/);
  await assert.rejects(eventDetail(new URLSearchParams({ id: 'e1' }), { ...owner, deniedResources: ['events'] }, services), /access denied/);
  assert.equal(services.writes.length, 0);
});

test('protected financial fields and sold tier terms are rejected', async () => {
  const prior = process.env.ADMIN_EVENT_ACTIONS_ENABLED;
  process.env.ADMIN_EVENT_ACTIONS_ENABLED = 'true';
  try {
    const services = memoryServices();
    await assert.rejects(mutateEvent({ ...request({ revenue: 500 }), action: 'details' }, owner, services), /supported event fields/);
    await assert.rejects(mutateEvent({ ...request({ ticketTiers: [{ id: 'standard', name: 'Standard', price: 1, sold: 1 }] }), action: 'access' }, owner, services), /protected event fields/);
    assert.deepEqual(services.values.get('tickets/t1'), { eventId: 'e1', userId: 'buyer-one', status: 'active', price: 10, qrCode: 'ticket-secret' });
    assert.equal(services.writes.length, 0);
  } finally { if (prior === undefined) delete process.env.ADMIN_EVENT_ACTIONS_ENABLED; else process.env.ADMIN_EVENT_ACTIONS_ENABLED = prior; }
});

test('admin scan records check-in without changing ticket ownership or payment', async () => {
  const prior = process.env.ADMIN_EVENT_ACTIONS_ENABLED;
  process.env.ADMIN_EVENT_ACTIONS_ENABLED = 'true';
  try {
    const services = memoryServices();
    services.values.set('events/e1', { ...services.values.get('events/e1'), dateTime: '2026-01-01T20:00:00Z' });
    const input = { id: 'e1', qrCode: 'ticket-secret', reason: 'Gate supervisor verified entry', requestId: 'unique-scan-request-123' };
    const result = await scanTicket(input, owner, services);
    assert.equal(result.status, 'used');
    const ticket = services.values.get('tickets/t1');
    assert.equal(ticket.userId, 'buyer-one');
    assert.equal(ticket.price, 10);
    assert.equal(ticket.usedPax, 1);
    assert.equal(services.values.get('adminAuditLogs/' + result.auditId).action, 'event.scan');
    assert.equal(JSON.stringify(services.values.get('adminAuditLogs/' + result.auditId)).includes('ticket-secret'), false);
    assert.deepEqual(await scanTicket(input, owner, services), result);
    await assert.rejects(scanTicket({ ...input, requestId: 'another-scan-request-123' }, owner, services), /no longer valid/);
  } finally { if (prior === undefined) delete process.env.ADMIN_EVENT_ACTIONS_ENABLED; else process.env.ADMIN_EVENT_ACTIONS_ENABLED = prior; }
});

test('event feature configuration and notification queue are audited without payment writes', async () => {
  const prior = process.env.ADMIN_EVENT_ACTIONS_ENABLED;
  process.env.ADMIN_EVENT_ACTIONS_ENABLED = 'true';
  try {
    const services = memoryServices();
    const feature = await configureEventFeature({ id: 'e1', kind: 'poll', value: { question: 'Which artist?', options: ['One', 'Two'] }, reason: 'Event operations requested a free vote', requestId: 'feature-request-123' }, owner, services);
    assert.equal(feature.ok, true);
    assert.equal(services.values.get('events/e1').interactiveFeatures.polls[0].votePricing, 'free');
    const queued = await queueNotification({ id: 'e1', message: 'Doors open at 7 pm.', audience: { buyers: true, rsvps: false }, reason: 'Notify ticket buyers about gate opening', requestId: 'notification-request-123' }, owner, services);
    assert.equal(queued.status, 'queued');
    assert.equal(services.values.get('adminEventNotifications/notification-request-123').eventId, 'e1');
    assert.equal(services.values.get('adminAuditLogs/' + queued.auditId).action, 'event.notify');
    assert.equal(services.values.get('tickets/t1').userId, 'buyer-one');
    assert.equal([...services.writes].some(([, path]) => path.startsWith('walletTransactions/')), false);
  } finally { if (prior === undefined) delete process.env.ADMIN_EVENT_ACTIONS_ENABLED; else process.env.ADMIN_EVENT_ACTIONS_ENABLED = prior; }
});

test('event search paginates without repeating rows and supports exact ID', async () => {
  const events = Array.from({ length: 32 }, (_, index) => ({ id: 'event-' + String(index).padStart(2, '0'), data: {
    title: index % 2 ? 'Music night' : 'Community day', hostId: index % 2 ? 'music-host' : 'other-host',
    status: 'published', dateTime: '2026-11-' + String(index % 28 + 1).padStart(2, '0'),
  } }));
  const snap = row => ({ id: row.id, data: () => row.data });
  const services = {
    FieldPath: { documentId: () => '__name__' },
    db: {
      doc: path => ({ get: async () => {
        const row = events.find(item => path === 'events/' + item.id);
        return { id: row?.id, exists: Boolean(row), data: () => row?.data };
      } }),
      collection: name => name === 'events'
        ? { orderBy: () => ({ limit: limit => ({
          startAfter: id => ({ get: async () => ({ docs: events.filter(row => row.id > id).slice(0, limit).map(snap) }) }),
          get: async () => ({ docs: events.slice(0, limit).map(snap) }),
        }) }) }
        : { where: () => ({ limit: () => ({ get: async () => ({ docs: [] }) }) }) },
    },
  };
  const codec = cursorCodec('event-test-secret');
  const first = await listEvents(new URLSearchParams(), owner, services, codec);
  assert.equal(first.rows.length, 25);
  assert.ok(first.cursor);
  const second = await listEvents(new URLSearchParams({ cursor: first.cursor }), owner, services, codec);
  assert.equal(second.rows.length, 7);
  assert.equal(new Set([...first.rows, ...second.rows].map(row => row.id)).size, 32);
  const filtered = await listEvents(new URLSearchParams({ host: 'music-host', search: 'music' }), owner, services, codec);
  assert.equal(filtered.rows.length, 16);
  const exact = await listEvents(new URLSearchParams({ id: 'event-07' }), owner, services, codec);
  assert.deepEqual(exact.rows.map(row => row.id), ['event-07']);
});
