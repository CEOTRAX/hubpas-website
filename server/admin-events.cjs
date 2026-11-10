const { fail, safeId, sanitize, fingerprint } = require('./admin-policy.cjs');

const READ_ROLES = ['super_admin', 'operations', 'support', 'analyst'];
const WRITE_ROLES = ['super_admin', 'operations'];
const DETAIL_FIELDS = new Set([
  'title', 'shortDescription', 'description', 'image', 'additionalImages', 'promoVideo',
  'promoVideoPoster', 'musicTrackId', 'ageRating', 'category', 'categories',
  'publicOrPrivate', 'privateAudience', 'dateTime', 'endDateTime', 'showCountdown',
  'isRecurring', 'recurrenceType', 'recurrenceEndsAt', 'recurrenceDays',
  'recurrenceTime', 'recurrenceSchedule', 'recurrenceDate', 'recurrenceDateString',
  'venueName', 'location', 'district', 'fullAddress', 'latitude', 'longitude',
  'capacity', 'autoClose', 'allowVendors',
  'lookingForSponsors', 'analyticsEnabled', 'chatEnabled',
]);
const ACCESS_FIELDS = new Set(['ticketTiers', 'donationTiers', 'interactiveFeatures', 'ticketPrice', 'ticketLimit']);
const IMMUTABLE_NESTED = /^(sold|soldTickets|currentAmount|revenue|amountPaid|paid|used|usedPax|winner|drawStatus|purchase|payment|transaction|provider|checkout|order|balance|payout|refund)/i;
const BOOST_DISTRICTS = ['Bandajuma', 'Bo', 'Bombali', 'Bonthe', 'Falaba', 'Kailahun', 'Kambia', 'Karene', 'Kenema', 'Koinadugu', 'Kono', 'Kpanguma', 'Moyamba', 'Port Loko', 'Pujehun', 'Tonkolili', 'Western Area Rural', 'Western Area Urban'];

function requireEvents(actor, write = false) {
  if (actor.deniedResources?.includes('events') || !actor.roles?.some(role => (write ? WRITE_ROLES : READ_ROLES).includes(role))) fail(403, 'Event management access denied.');
  if (write && (process.env.ADMIN_EVENT_ACTIONS_ENABLED !== 'true' || actor.deniedActions?.includes('event.manage'))) fail(403, 'Event changes are not enabled for this role or server.');
}
function eventId(value) {
  if (!safeId(value)) fail(400, 'Invalid event ID.');
  return value;
}
function clean(value, depth = 0) {
  if (depth > 5 || JSON.stringify(value).length > 30000) fail(400, 'Event update is too large.');
  if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) return value;
  if (Array.isArray(value)) {
    if (value.length > 100) fail(400, 'Too many list entries.');
    return value.map(item => clean(item, depth + 1));
  }
  if (!value || typeof value !== 'object' || Object.keys(value).some(key => key.includes('.') || key.startsWith('__') || IMMUTABLE_NESTED.test(key))) fail(400, 'Update contains protected event fields.');
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clean(item, depth + 1)]));
}
function allowedPatch(input, fields) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || !Object.keys(input).length || Object.keys(input).some(key => !fields.has(key))) fail(400, 'Choose supported event fields.');
  return clean(input);
}
function validateDetailPatch(patch) {
  for (const [key, value] of Object.entries(patch)) {
    if (['image', 'promoVideo', 'promoVideoPoster'].includes(key) && value && (typeof value !== 'string' || !/^https:\/\//i.test(value) || value.length > 2000)) fail(400, 'Media must use a secure HTTPS URL.');
    if (key === 'additionalImages' && (!Array.isArray(value) || value.length > 12 || value.some(url => typeof url !== 'string' || !/^https:\/\//i.test(url) || url.length > 2000))) fail(400, 'Additional images must use secure HTTPS URLs.');
    if (['title', 'shortDescription', 'description', 'location', 'district', 'fullAddress', 'venueName', 'category'].includes(key) && (typeof value !== 'string' || value.length > (key === 'description' ? 6000 : 300))) fail(400, 'Invalid event text.');
    if (['dateTime', 'endDateTime'].includes(key) && value && (typeof value !== 'string' || !Number.isFinite(Date.parse(value)))) fail(400, 'Invalid event date.');
    if (key === 'capacity' && (!Number.isSafeInteger(value) || value < 1)) fail(400, 'Capacity must be a positive whole number.');
    if (key === 'publicOrPrivate' && !['public', 'private'].includes(value)) fail(400, 'Invalid publication audience.');
  }
}
function assertAccessSafety(before, patch) {
  if (patch.ticketTiers) {
    if (!Array.isArray(patch.ticketTiers)) fail(400, 'Ticket tiers must be a list.');
    const original = Array.isArray(before.ticketTiers) ? before.ticketTiers : [];
    if (patch.ticketTiers.some(tier => !original.some(prior => (prior.id || prior.name) === (tier.id || tier.name)) && (!safeId(tier.id) || typeof tier.name !== 'string' || !tier.name.trim() || tier.name.length > 100 || !['ticket', 'table'].includes(tier.type) || !Number.isFinite(tier.price) || tier.price < 0 || !Number.isSafeInteger(tier.quantity) || tier.quantity < 1 || (tier.type === 'table' && (!Number.isSafeInteger(tier.tableCapacity) || tier.tableCapacity < 1))))) fail(400, 'Invalid ticket or table tier.');
    if (new Set(patch.ticketTiers.map(tier => tier.id || tier.name)).size !== patch.ticketTiers.length) fail(400, 'Tier IDs must be unique.');
    for (const tier of original) {
      const priorId = tier.id || tier.name;
      const next = patch.ticketTiers.find(item => (item.id || item.name) === priorId);
      if (!next) fail(409, 'Existing access tiers cannot be removed through this workflow.');
      if (Number(next.price) !== Number(tier.price) || next.type !== tier.type || next.name !== tier.name || Number(next.quantity) < Number(tier.sold || 0)) fail(409, 'Existing access prices and types cannot be changed.');
    }
    patch.ticketTiers = patch.ticketTiers.map(tier => {
      const prior = original.find(item => (item.id || item.name) === (tier.id || tier.name));
      return prior ? { ...tier, sold: prior.sold || 0 } : tier;
    });
  }
  if (patch.donationTiers) {
    if (!Array.isArray(patch.donationTiers)) fail(400, 'Donation tiers must be a list.');
    const original = Array.isArray(before.donationTiers) ? before.donationTiers : [];
    if (patch.donationTiers.some(tier => !original.some(prior => (prior.id || prior.name) === (tier.id || tier.name)) && (!safeId(tier.id) || typeof tier.name !== 'string' || !tier.name.trim() || tier.name.length > 100 || !Number.isFinite(tier.amount) || tier.amount <= 0))) fail(400, 'Invalid donation tier.');
    if (new Set(patch.donationTiers.map(tier => tier.id || tier.name)).size !== patch.donationTiers.length) fail(400, 'Donation tier IDs must be unique.');
    for (const tier of original) {
      const next = patch.donationTiers.find(item => (item.id || item.name) === (tier.id || tier.name));
      if (!next || next.name !== tier.name || Number(next.amount || 0) !== Number(tier.amount || 0)) fail(409, 'Existing donation terms cannot be changed through this workflow.');
    }
  }
  if (patch.interactiveFeatures) {
    const old = before.interactiveFeatures || {};
    for (const [key, value] of Object.entries(old)) {
      if (value && typeof value === 'object' && !Array.isArray(value) && patch.interactiveFeatures[key]) {
        for (const [nested, current] of Object.entries(value)) if (IMMUTABLE_NESTED.test(nested)) patch.interactiveFeatures[key][nested] = current;
      }
    }
  }
}
function projection(snap) {
  const data = snap.data();
  return { id: snap.id, data: sanitize({
    title: data.title, hostId: data.hostId, hostName: data.hostName,
    dateTime: data.dateTime, endDateTime: data.endDateTime, status: data.status,
    publicOrPrivate: data.publicOrPrivate, publicVisibility: data.publicVisibility || 'visible',
    category: data.category, location: data.location, district: data.district,
    image: data.image, ticketTiers: data.ticketTiers, donationTiers: data.donationTiers,
    interactiveFeatures: data.interactiveFeatures, ticketPrice: data.ticketPrice,
    revenue: data.revenue, goingCount: data.goingCount, rsvpCount: data.rsvpCount,
    views: data.views, coHosts: data.coHosts, createdAt: data.createdAt,
  }) };
}
function matches(row, filters) {
  const d = row.data;
  return (!filters.host || d.hostId === filters.host) &&
    (!filters.status || d.status === filters.status) &&
    (!filters.from || String(d.dateTime || '').slice(0, 10) >= filters.from) &&
    (!filters.to || String(d.dateTime || '').slice(0, 10) <= filters.to) &&
    (!filters.search || String(d.title || '').toLowerCase().includes(filters.search));
}
async function listEvents(params, actor, services, codec) {
  requireEvents(actor);
  const id = params.get('id');
  if (id) {
    const snap = await services.db.doc('events/' + eventId(id)).get();
    return { rows: snap.exists ? [projection(snap)] : [], cursor: null };
  }
  const filters = {
    host: params.get('host') || '', status: params.get('status') || '',
    from: params.get('from') || '', to: params.get('to') || '',
    search: String(params.get('search') || '').toLowerCase().trim(),
  };
  if (filters.host && !safeId(filters.host)) fail(400, 'Invalid host ID.');
  if (filters.search.length > 100 || [filters.from, filters.to].some(value => value && !/^\d{4}-\d{2}-\d{2}$/.test(value))) fail(400, 'Invalid event filters.');
  const scope = fingerprint({ uid: actor.uid, filters });
  const prior = params.get('cursor') ? codec.decode(params.get('cursor')) : null;
  if (prior && prior.scope !== scope) fail(400, 'Event cursor does not match the filters.');
  const rows = [];
  let lastId = prior?.lastId || null;
  let exhausted = false;
  for (let page = 0; page < 10 && rows.length < 25; page++) {
    let query = services.db.collection('events').orderBy(services.FieldPath.documentId()).limit(100);
    if (lastId) query = query.startAfter(lastId);
    const snapshot = await query.get();
    if (!snapshot.docs.length) { exhausted = true; break; }
    let consumed = 0;
    for (const snap of snapshot.docs) {
      consumed++;
      lastId = snap.id;
      const row = projection(snap);
      if (matches(row, filters)) rows.push(row);
      if (rows.length === 25) break;
    }
    if (snapshot.docs.length < 100 && consumed === snapshot.docs.length) { exhausted = true; break; }
  }
  await Promise.all(rows.map(async row => {
    const campaigns = await services.db.collection('boostCampaigns').where('eventId', '==', row.id).limit(20).get();
    const statuses = campaigns.docs.map(doc => String(doc.data().status || 'unknown').toLowerCase());
    row.data.boostStatus = statuses.includes('active') ? 'active' : statuses.includes('pending') ? 'pending' : statuses.at(0) || 'none';
  }));
  return { rows, cursor: exhausted || !lastId ? null : codec.encode({ scope, lastId, expires: Date.now() + 1800000 }), limited: !exhausted };
}
async function eventDetail(params, actor, services) {
  requireEvents(actor);
  const id = eventId(params.get('id'));
  const snap = await services.db.doc('events/' + id).get();
  if (!snap.exists) fail(404, 'Event not found.');
  const data = snap.data();
  const safe = Object.fromEntries([...DETAIL_FIELDS, ...ACCESS_FIELDS, 'vendorSlots', 'sponsors', 'hostId', 'hostName', 'status', 'publicVisibility', 'visibilityUpdatedAt', 'coHosts', 'coHostIds', 'coHostAccess', 'goingCount', 'rsvpCount', 'views', 'revenue', 'createdAt', 'updatedAt'].filter(key => Object.hasOwn(data, key)).map(key => [key, data[key]]));
  const [boosts, tickets, rsvps, going, audits, notifications, daily] = await Promise.all([
    services.db.collection('boostCampaigns').where('eventId', '==', id).limit(50).get(),
    services.db.collection('tickets').where('eventId', '==', id).limit(50).get(),
    snap.ref.collection('rsvps').limit(50).get(), snap.ref.collection('going').limit(50).get(),
    services.db.collection('adminAuditLogs').where('eventId', '==', id).limit(100).get(),
    services.db.collection('adminEventNotifications').where('eventId', '==', id).limit(50).get(),
    services.db.collection('eventStatsDaily').where('eventId', '==', id).limit(90).get(),
  ]);
  return { id, data: sanitize(safe), boosts: boosts.docs.map(doc => ({ id: doc.id, data: sanitize(doc.data()) })),
    tickets: tickets.docs.map(doc => ({ id: doc.id, data: sanitize({ userId: doc.data().userId, status: doc.data().status, ticketTierId: doc.data().ticketTierId, createdAt: doc.data().createdAt, usedPax: doc.data().usedPax, totalPax: doc.data().totalPax }) })),
    rsvps: rsvps.docs.map(doc => ({ id: doc.id, data: sanitize(doc.data()) })),
    going: going.docs.map(doc => ({ id: doc.id, data: sanitize(doc.data()) })),
    audits: audits.docs.map(doc => ({ id: doc.id, data: sanitize(doc.data()) })).sort((a, b) => String(b.data.at || '').localeCompare(String(a.data.at || ''))),
    notifications: notifications.docs.map(doc => ({ id: doc.id, data: sanitize({ status: doc.data().status, recipientsCount: doc.data().recipientsCount, failedCount: doc.data().failedCount, createdAt: doc.data().createdAt, message: doc.data().message }) })),
    daily: daily.docs.map(doc => ({ id: doc.id, data: sanitize({ date: doc.data().date, views: doc.data().views, clicks: doc.data().clicks, ticketSales: doc.data().ticketSales, revenue: doc.data().revenue, purchases: doc.data().purchases }) })).sort((a, b) => String(a.data.date || a.id).localeCompare(String(b.data.date || b.id))),
    countsLimited: { boosts: boosts.size === 50, tickets: tickets.size === 50, rsvps: rsvps.size === 50, going: going.size === 50, audits: audits.size === 100, notifications: notifications.size === 50, daily: daily.size === 90 },
  };
}
async function mutateEvent(input, actor, services) {
  requireEvents(actor, true);
  const id = eventId(input?.id);
  const action = input?.action;
  const reason = String(input?.reason || '').trim();
  const requestId = String(input?.requestId || '');
  if (!['visibility', 'details', 'access', 'cohosts'].includes(action)) fail(400, 'Unsupported event action.');
  if (reason.length < 10 || reason.length > 500 || !/^[A-Za-z0-9-]{12,100}$/.test(requestId)) fail(400, 'A reason and unique request ID are required.');
  if (actor.deniedActions?.includes('event.' + action)) fail(403, 'This event action is restricted for your role.');
  const eventRef = services.db.doc('events/' + id);
  const requestRef = services.db.doc('adminEventRequests/' + requestId);
  const auditRef = services.db.collection('adminAuditLogs').doc();
  const requestHash = fingerprint({ id, action, reason, value: input.value });
  return services.db.runTransaction(async tx => {
    const [eventSnap, requestSnap] = await Promise.all([tx.get(eventRef), tx.get(requestRef)]);
    if (requestSnap.exists) {
      if (requestSnap.data().actor !== actor.uid || requestSnap.data().requestHash !== requestHash) fail(409, 'Request ID was already used.');
      return requestSnap.data().result;
    }
    if (!eventSnap.exists) fail(404, 'Event not found.');
    const before = eventSnap.data();
    let patch;
    if (action === 'visibility') {
      if (!['visible', 'hidden', 'removed'].includes(input.value)) fail(400, 'Invalid visibility state.');
      patch = { publicVisibility: input.value, visibilityUpdatedAt: services.FieldValue.serverTimestamp() };
    } else if (action === 'details') {
      patch = allowedPatch(input.value, DETAIL_FIELDS);
      validateDetailPatch(patch);
    }
    else if (action === 'access') {
      const raw = input.value && typeof input.value === 'object' ? { ...input.value } : input.value;
      let switches;
      if (raw?.interactiveFeatures) {
        const featureKeys = ['ticketsEnabled', 'tablesEnabled', 'raffleEnabled', 'donationsEnabled', 'votesEnabled', 'rsvpEnabled', 'inviteEnabled', 'itemsEnabled'];
        if (Object.keys(raw.interactiveFeatures).some(key => !featureKeys.includes(key)) || Object.values(raw.interactiveFeatures).some(value => typeof value !== 'boolean')) fail(400, 'Only supported access switches can be changed here.');
        switches = raw.interactiveFeatures;
        delete raw.interactiveFeatures;
      }
      patch = Object.keys(raw || {}).length ? allowedPatch(raw, ACCESS_FIELDS) : {};
      if (switches) {
        if (switches.raffleEnabled === true) {
          const raffle = before.interactiveFeatures?.raffle;
          if (!raffle || Number(raffle.ticketPrice || 0) !== 0 || raffle.eligibility !== 'everyone') fail(409, 'Configure a free raffle before enabling it.');
        }
        patch.interactiveFeatures = { ...(before.interactiveFeatures || {}), ...switches };
      }
      if (!Object.keys(patch).length) fail(400, 'Choose an access setting.');
      assertAccessSafety(before, patch);
    } else {
      const coHosts = clean(input.value);
      const permissionKeys = ['canEditEvent', 'canManageTickets', 'canViewAnalytics', 'scanTickets', 'canManageRevenue', 'canSendNotifications'];
      if (!Array.isArray(coHosts) || coHosts.some(item => !safeId(item.userId) || !['pending', 'accepted'].includes(item.status) || item.userId === before.hostId || !item.permissions || typeof item.permissions !== 'object' || Object.keys(item.permissions).some(key => !permissionKeys.includes(key) || typeof item.permissions[key] !== 'boolean'))) fail(400, 'Invalid co-host list.');
      if (new Set(coHosts.map(item => item.userId)).size !== coHosts.length) fail(400, 'Co-host UIDs must be unique.');
      patch = { coHosts, coHostIds: [...new Set(coHosts.map(item => item.userId))] };
    }
    const oldValues = Object.fromEntries(Object.keys(patch).map(key => [key, before[key] ?? null]));
    const newValues = Object.fromEntries(Object.keys(patch).filter(key => key !== 'visibilityUpdatedAt').map(key => [key, patch[key]]));
    const result = { ok: true, auditId: auditRef.id, id, action };
    tx.update(eventRef, { ...patch, updatedAt: services.FieldValue.serverTimestamp() });
    tx.create(auditRef, { actor: actor.uid, adminUid: actor.uid, roles: actor.roles, eventId: id,
      action: 'event.' + action, target: eventRef.path, before: sanitize(oldValues), after: sanitize(newValues),
      reason, requestId, at: services.FieldValue.serverTimestamp() });
    tx.create(requestRef, { actor: actor.uid, requestHash, result, at: services.FieldValue.serverTimestamp() });
    return result;
  });
}

async function scanTicket(input, actor, services) {
  requireEvents(actor, true);
  if (actor.deniedActions?.includes('event.scan')) fail(403, 'Ticket scanning is restricted for your role.');
  const id = eventId(input?.id);
  const qrCode = String(input?.qrCode || '').trim();
  const reason = String(input?.reason || '').trim();
  const requestId = String(input?.requestId || '');
  if (!qrCode || qrCode.length > 500 || reason.length < 10 || reason.length > 500 || !/^[A-Za-z0-9-]{12,100}$/.test(requestId)) fail(400, 'A ticket code, reason and unique request ID are required.');
  const requestedPax = input.paxCount == null ? null : Number(input.paxCount);
  if (requestedPax !== null && (!Number.isSafeInteger(requestedPax) || requestedPax < 1 || requestedPax > 100)) fail(400, 'Invalid attendee count.');
  const eventRef = services.db.doc('events/' + id);
  const matches = await services.db.collection('tickets').where('eventId', '==', id).where('qrCode', '==', qrCode).limit(1).get();
  if (matches.empty || !matches.docs.length) fail(404, 'Ticket not found for this event.');
  const ticketRef = matches.docs[0].ref;
  const requestRef = services.db.doc('adminEventRequests/' + requestId);
  const auditRef = services.db.collection('adminAuditLogs').doc();
  const requestHash = fingerprint({ id, ticketId: ticketRef.id, qrCode, requestedPax, reason });
  return services.db.runTransaction(async tx => {
    const [eventSnap, ticketSnap, requestSnap] = await Promise.all([tx.get(eventRef), tx.get(ticketRef), tx.get(requestRef)]);
    if (requestSnap.exists) {
      if (requestSnap.data().actor !== actor.uid || requestSnap.data().requestHash !== requestHash) fail(409, 'Request ID was already used.');
      return requestSnap.data().result;
    }
    if (!eventSnap.exists || !ticketSnap.exists || ticketSnap.data().eventId !== id) fail(404, 'Event ticket not found.');
    if (Date.parse(String(eventSnap.data().dateTime || '')) > Date.now()) fail(409, 'Tickets can only be scanned once the event starts.');
    const before = ticketSnap.data();
    const totalPax = Number.isSafeInteger(before.totalPax) && before.totalPax > 0 ? before.totalPax : 1;
    const usedPax = Number.isSafeInteger(before.usedPax) ? before.usedPax : before.status === 'used' ? totalPax : 0;
    if (before.status === 'cancelled' || before.status === 'refunded' || before.status === 'used' || before.usedAt || usedPax >= totalPax) fail(409, 'Ticket is no longer valid for entry.');
    if (totalPax > 1 && requestedPax === null) fail(400, 'Enter the number of attendees for this table ticket.');
    const pax = requestedPax || 1;
    if (pax > totalPax - usedPax) fail(409, 'Requested attendees exceed the remaining places.');
    const nextPax = usedPax + pax;
    const status = nextPax >= totalPax ? 'used' : 'active';
    const now = new Date().toISOString();
    const patch = { status, usedPax: nextPax, lastScannedAt: now, usedByUserId: actor.uid, usedByRole: 'platform_admin' };
    if (status === 'used') patch.usedAt = now;
    const result = { ok: true, ticketId: ticketRef.id, status, usedPax: nextPax, totalPax, auditId: auditRef.id };
    tx.update(ticketRef, patch);
    tx.create(auditRef, { actor: actor.uid, adminUid: actor.uid, roles: actor.roles, eventId: id, action: 'event.scan', target: ticketRef.path,
      before: { status: before.status || null, usedPax, totalPax }, after: { status, usedPax: nextPax, totalPax },
      reason, requestId, at: services.FieldValue.serverTimestamp() });
    tx.create(requestRef, { actor: actor.uid, requestHash, result, at: services.FieldValue.serverTimestamp() });
    return result;
  });
}

async function queueNotification(input, actor, services) {
  requireEvents(actor, true);
  if (actor.deniedActions?.includes('event.notify')) fail(403, 'Event notifications are restricted for your role.');
  const id = eventId(input?.id);
  const message = String(input?.message || '').trim();
  const reason = String(input?.reason || '').trim();
  const requestId = String(input?.requestId || '');
  const audience = { buyers: input?.audience?.buyers === true, rsvps: input?.audience?.rsvps === true };
  if (!message || message.length > 500 || !Object.values(audience).some(Boolean) || reason.length < 10 || reason.length > 500 || !/^[A-Za-z0-9-]{12,100}$/.test(requestId)) fail(400, 'Enter a message, audience, reason and unique request ID.');
  const eventRef = services.db.doc('events/' + id);
  const requestRef = services.db.doc('adminEventRequests/' + requestId);
  const notificationRef = services.db.doc('adminEventNotifications/' + requestId);
  const auditRef = services.db.collection('adminAuditLogs').doc();
  const requestHash = fingerprint({ id, message, audience, reason });
  return services.db.runTransaction(async tx => {
    const [eventSnap, requestSnap] = await Promise.all([tx.get(eventRef), tx.get(requestRef)]);
    if (requestSnap.exists) {
      if (requestSnap.data().actor !== actor.uid || requestSnap.data().requestHash !== requestHash) fail(409, 'Request ID was already used.');
      return requestSnap.data().result;
    }
    if (!eventSnap.exists) fail(404, 'Event not found.');
    const result = { ok: true, status: 'queued', notificationId: requestId, auditId: auditRef.id };
    tx.create(notificationRef, { eventId: id, adminUid: actor.uid, message, audience, status: 'queued', reason, createdAt: services.FieldValue.serverTimestamp() });
    tx.create(auditRef, { actor: actor.uid, adminUid: actor.uid, roles: actor.roles, eventId: id, action: 'event.notify', target: notificationRef.path,
      before: null, after: { message, audience, status: 'queued' }, reason, requestId, at: services.FieldValue.serverTimestamp() });
    tx.create(requestRef, { actor: actor.uid, requestHash, result, at: services.FieldValue.serverTimestamp() });
    return result;
  });
}

async function updateBoostTargeting(input, actor, services) {
  requireEvents(actor, true);
  if (actor.deniedActions?.includes('event.boost')) fail(403, 'Boost management is restricted for your role.');
  const id = eventId(input?.id);
  const campaignId = eventId(input?.campaignId);
  const reason = String(input?.reason || '').trim();
  const requestId = String(input?.requestId || '');
  const targeting = input?.targeting;
  const districts = Array.isArray(targeting?.districts) ? [...new Set(targeting.districts)] : [];
  const interests = Array.isArray(targeting?.interests) ? [...new Set(targeting.interests)] : [];
  if (reason.length < 10 || reason.length > 500 || !/^[A-Za-z0-9-]{12,100}$/.test(requestId) ||
      !Array.isArray(targeting?.districts) || !districts.length || districts.some(value => !BOOST_DISTRICTS.includes(value)) ||
      !Array.isArray(targeting?.interests) || interests.length > 12 || interests.some(value => typeof value !== 'string' || value.length > 40) ||
      !['All', '18–24', '25–34', '35–44', '45–54', '55+'].includes(targeting.ageRange) ||
      !['Both', 'Male', 'Female'].includes(targeting.gender)) fail(400, 'Choose valid boost targeting and provide a reason.');
  const next = { districts, location: districts.join(', '), ageRange: targeting.ageRange, gender: targeting.gender, interests };
  const campaignRef = services.db.doc('boostCampaigns/' + campaignId);
  const requestRef = services.db.doc('adminEventRequests/' + requestId);
  const auditRef = services.db.collection('adminAuditLogs').doc();
  const requestHash = fingerprint({ id, campaignId, next, reason });
  return services.db.runTransaction(async tx => {
    const [campaign, requestSnap] = await Promise.all([tx.get(campaignRef), tx.get(requestRef)]);
    if (requestSnap.exists) {
      if (requestSnap.data().actor !== actor.uid || requestSnap.data().requestHash !== requestHash) fail(409, 'Request ID was already used.');
      return requestSnap.data().result;
    }
    if (!campaign.exists || campaign.data().eventId !== id) fail(404, 'Boost campaign not found for this event.');
    const result = { ok: true, campaignId, auditId: auditRef.id };
    tx.update(campaignRef, { targeting: next, updatedAt: services.FieldValue.serverTimestamp() });
    tx.create(auditRef, { actor: actor.uid, adminUid: actor.uid, roles: actor.roles, eventId: id, action: 'event.boost', target: campaignRef.path,
      before: { targeting: sanitize(campaign.data().targeting || null) }, after: { targeting: next }, reason, requestId,
      at: services.FieldValue.serverTimestamp() });
    tx.create(requestRef, { actor: actor.uid, requestHash, result, at: services.FieldValue.serverTimestamp() });
    return result;
  });
}

async function configureEventFeature(input, actor, services) {
  requireEvents(actor, true);
  if (actor.deniedActions?.includes('event.configure')) fail(403, 'Feature configuration is restricted for your role.');
  const id = eventId(input?.id);
  const kind = String(input?.kind || '');
  const reason = String(input?.reason || '').trim();
  const requestId = String(input?.requestId || '');
  const value = input?.value;
  if (!['raffle', 'poll', 'donationCampaign', 'rsvpSettings', 'vendorSlot', 'sponsorSeeking'].includes(kind) || reason.length < 10 || reason.length > 500 || !/^[A-Za-z0-9-]{12,100}$/.test(requestId) || !value || typeof value !== 'object' || Array.isArray(value)) fail(400, 'Choose a feature and provide a reason.');
  const eventRef = services.db.doc('events/' + id);
  const requestRef = services.db.doc('adminEventRequests/' + requestId);
  const auditRef = services.db.collection('adminAuditLogs').doc();
  const requestHash = fingerprint({ id, kind, value, reason });
  return services.db.runTransaction(async tx => {
    const [snap, requestSnap] = await Promise.all([tx.get(eventRef), tx.get(requestRef)]);
    if (requestSnap.exists) {
      if (requestSnap.data().actor !== actor.uid || requestSnap.data().requestHash !== requestHash) fail(409, 'Request ID was already used.');
      return requestSnap.data().result;
    }
    if (!snap.exists) fail(404, 'Event not found.');
    const before = snap.data();
    const features = before.interactiveFeatures || {};
    let patch;
    if (kind === 'raffle') {
      const old = features.raffle || {};
      if (typeof value.title !== 'string' || !value.title.trim() || value.title.length > 100 || typeof value.prize !== 'string' || value.prize.length > 200 || !Number.isSafeInteger(value.totalTickets) || value.totalTickets < Number(old.soldTickets || 0) || value.totalTickets < 1 || !Number.isFinite(Date.parse(value.drawDateTime))) fail(400, 'Invalid free raffle configuration.');
      patch = { interactiveFeatures: { ...features, raffleEnabled: true, raffle: { ...old, enabled: true, title: value.title.trim(), prize: value.prize.trim(), totalTickets: value.totalTickets, drawDateTime: value.drawDateTime, ticketPrice: 0, eligibility: 'everyone' } } };
    } else if (kind === 'poll') {
      if (typeof value.question !== 'string' || !value.question.trim() || value.question.length > 200 || !Array.isArray(value.options) || value.options.length < 2 || value.options.length > 8 || value.options.some(option => typeof option !== 'string' || !option.trim() || option.length > 100)) fail(400, 'Invalid poll question or options.');
      const prior = Array.isArray(features.polls) ? features.polls : [];
      if (prior.length >= 50) fail(409, 'Poll limit reached.');
      const poll = { id: requestId, question: value.question.trim(), options: value.options.map((label, index) => ({ id: requestId + '-' + index, label: label.trim() })), visibility: 'public', anonymous: false, allowMultiple: false, votePricing: 'free', pricePerVote: 0, status: 'live' };
      patch = { interactiveFeatures: { ...features, votesEnabled: true, polls: [...prior, poll] } };
    } else if (kind === 'donationCampaign') {
      if (typeof value.title !== 'string' || !value.title.trim() || value.title.length > 100 || typeof value.description !== 'string' || value.description.length > 500 || !Number.isFinite(value.goalAmount) || value.goalAmount <= 0) fail(400, 'Invalid donation campaign.');
      patch = { interactiveFeatures: { ...features, donationsEnabled: true, donationCampaign: { ...(features.donationCampaign || {}), enabled: true, title: value.title.trim(), description: value.description.trim(), goalAmount: value.goalAmount } } };
    } else if (kind === 'rsvpSettings') {
      if (typeof value.enabled !== 'boolean' || typeof value.collectMaybe !== 'boolean' || (value.deadline && !Number.isFinite(Date.parse(value.deadline))) || !Number.isSafeInteger(value.maxAttendees) || value.maxAttendees < 1) fail(400, 'Invalid RSVP settings.');
      patch = { interactiveFeatures: { ...features, rsvpEnabled: value.enabled, rsvpSettings: { ...(features.rsvpSettings || {}), enabled: value.enabled, collectMaybe: value.collectMaybe, deadline: value.deadline || '', maxAttendees: value.maxAttendees } } };
    } else if (kind === 'vendorSlot') {
      const slots = Array.isArray(before.vendorSlots) ? before.vendorSlots : [];
      if (slots.length >= 100 || typeof value.name !== 'string' || !value.name.trim() || value.name.length > 100 || !Number.isFinite(value.price) || value.price < 0 || !Number.isSafeInteger(value.quantity) || value.quantity < 1 || typeof value.description !== 'string' || value.description.length > 500) fail(400, 'Invalid vendor slot.');
      patch = { allowVendors: true, vendorSlots: [...slots, { id: requestId, name: value.name.trim(), price: value.price, quantity: value.quantity, sold: 0, description: value.description.trim() }] };
    } else {
      if (typeof value.enabled !== 'boolean') fail(400, 'Invalid sponsor setting.');
      patch = { lookingForSponsors: value.enabled };
    }
    const oldValues = Object.fromEntries(Object.keys(patch).map(key => [key, before[key] ?? null]));
    const result = { ok: true, id, kind, auditId: auditRef.id };
    tx.update(eventRef, { ...patch, updatedAt: services.FieldValue.serverTimestamp() });
    tx.create(auditRef, { actor: actor.uid, adminUid: actor.uid, roles: actor.roles, eventId: id, action: 'event.configure.' + kind, target: eventRef.path,
      before: sanitize(oldValues), after: sanitize(patch), reason, requestId, at: services.FieldValue.serverTimestamp() });
    tx.create(requestRef, { actor: actor.uid, requestHash, result, at: services.FieldValue.serverTimestamp() });
    return result;
  });
}

module.exports = { listEvents, eventDetail, mutateEvent, scanTicket, queueNotification, updateBoostTargeting, configureEventFeature, requireEvents };
