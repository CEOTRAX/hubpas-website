// Public projection of upcoming events. Never return raw Firestore documents.
const MAX_SCANNED = 100;
const MAX_FEATURED = 3;

function eventTime(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d/.test(value)) return NaN;
  return Date.parse(value);
}

function safeImage(value) {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && ['firebasestorage.googleapis.com', 'storage.googleapis.com'].includes(url.hostname)
      ? url.href : null;
  } catch { return null; }
}

function publicText(value, limit = 500) {
  return typeof value === 'string' ? value.trim().slice(0, limit) : '';
}

function publicEvent(doc, now = Date.now()) {
  const data = typeof doc.data === 'function' ? doc.data() : doc.data;
  if (!data || data.status !== 'published' || data.publicOrPrivate !== 'public' || data.moderationRemoved === true) return null;
  const start = eventTime(data.dateTime);
  const end = eventTime(data.endDateTime);
  if (!Number.isFinite(start) || (Number.isFinite(end) ? end < now : start < now)) return null;
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(doc.id || '') || !publicText(data.title)) return null;
  const features = data.interactiveFeatures || {};
  const tiers = Array.isArray(data.ticketTiers) ? data.ticketTiers : [];
  const access = tiers.filter(tier => tier && ['ticket', 'table'].includes(tier.type) &&
    Number.isFinite(Number(tier.price)) && Number(tier.price) >= 0).slice(0, 12).map(tier => ({
      name: publicText(tier.name, 80), type: tier.type, price: Number(tier.price),
      description: publicText(tier.description, 220),
      soldOut: Number.isFinite(Number(tier.quantity)) && Number(tier.quantity) > 0 && Number(tier.sold) >= Number(tier.quantity),
    })).filter(tier => tier.name);
  const donationTiers = Array.isArray(data.donationTiers) ? data.donationTiers : [];
  const donations = donationTiers.slice(0, 10).map(tier => ({
    name: publicText(tier?.name, 80), amount: Number.isFinite(Number(tier?.amount)) && Number(tier.amount) >= 0 ? Number(tier.amount) : null,
    openAmount: tier?.isOpenAmount === true,
  })).filter(tier => tier.name);
  const campaign = features.donationCampaign || {};
  return {
    id: doc.id, title: publicText(data.title, 120), shortDescription: publicText(data.shortDescription, 260),
    description: publicText(data.description, 6000), dateTime: data.dateTime,
    endDateTime: Number.isFinite(end) ? data.endDateTime : null,
    category: publicText(data.category, 50), ageRating: data.ageRating === '18+' ? '18+' : null,
    image: safeImage(data.image) || safeImage(data.imageThumbnail),
    location: publicText(data.location, 120), district: publicText(data.district, 100),
    venueName: publicText(data.venueName, 120), fullAddress: publicText(data.fullAddress, 240),
    hostName: publicText(data.hostName, 100), hostPhoto: safeImage(data.hostPhoto),
    chatEnabled: data.chatEnabled === true,
    tickets: features.ticketsEnabled === true ? access.filter(tier => tier.type === 'ticket') : [],
    tables: features.tablesEnabled === true ? access.filter(tier => tier.type === 'table') : [],
    donations: features.donationsEnabled === true ? donations : [],
    donationCampaign: features.donationsEnabled === true && campaign.enabled === true ? {
      title: publicText(campaign.title, 100), description: publicText(campaign.description, 400),
      goalAmount: Number.isFinite(Number(campaign.goalAmount)) && Number(campaign.goalAmount) > 0 ? Number(campaign.goalAmount) : null,
    } : null,
  };
}

function projectEvents(documents, now = Date.now()) {
  return documents.flatMap(doc => {
    const data = typeof doc.data === 'function' ? doc.data() : doc.data;
    if (!data || data.status !== 'published' || data.publicOrPrivate !== 'public' || data.moderationRemoved === true) return [];
    const start = eventTime(data.dateTime);
    const end = eventTime(data.endDateTime);
    if (!Number.isFinite(start) || (Number.isFinite(end) ? end < now : start < now)) return [];
    if (!/^[A-Za-z0-9_-]{1,80}$/.test(doc.id || '') || typeof data.title !== 'string' || !data.title.trim()) return [];
    return [{
      id: doc.id,
      title: data.title.trim().slice(0, 100),
      dateTime: data.dateTime,
      category: typeof data.category === 'string' ? data.category.slice(0, 32) : '',
      location: typeof data.district === 'string' && data.district.trim() ? data.district.trim().slice(0, 80)
        : typeof data.location === 'string' ? data.location.trim().slice(0, 80) : '',
      image: safeImage(data.imageThumbnail) || safeImage(data.image),
      ageRating: data.ageRating === '18+' ? '18+' : null,
    }];
  }).sort((a, b) => eventTime(a.dateTime) - eventTime(b.dateTime)).slice(0, MAX_FEATURED);
}

async function readFeaturedEvents(db, now = Date.now()) {
  const startDay = new Date(now - 86400000).toISOString().slice(0, 10);
  const snapshot = await db.collection('events').where('dateTime', '>=', startDay)
    .orderBy('dateTime').limit(MAX_SCANNED).get();
  return projectEvents(snapshot.docs, now);
}

function featuredEventsHandler(db) {
  let cached = null;
  return async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Access-Control-Allow-Origin', 'https://www.hubpas.com');
    if (req.method !== 'GET') { res.writeHead(405, {'Allow': 'GET'}).end(); return; }
    try {
      const id = new URL(req.url || '/', 'https://www.hubpas.com').searchParams.get('id');
      if (id !== null) {
        if (!/^[A-Za-z0-9_-]{1,80}$/.test(id)) { res.writeHead(400, {'Cache-Control': 'no-store'}).end(JSON.stringify({error: 'Invalid event.'})); return; }
        const snapshot = await db.collection('events').doc(id).get();
        const event = snapshot.exists ? publicEvent(snapshot) : null;
        if (!event) { res.writeHead(404, {'Cache-Control': 'no-store'}).end(JSON.stringify({error: 'Event not found.'})); return; }
        res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300');
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({event}));
        return;
      }
      if (!cached || cached.expires < Date.now()) {
        cached = {events: await readFeaturedEvents(db), expires: Date.now() + 60000};
      }
      res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300');
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({events: cached.events}));
    } catch {
      res.writeHead(503, {'Cache-Control': 'no-store'}).end(JSON.stringify({error: 'Events are temporarily unavailable.'}));
    }
  };
}

module.exports = {projectEvents, publicEvent, readFeaturedEvents, featuredEventsHandler};
