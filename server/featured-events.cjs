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

module.exports = {projectEvents, readFeaturedEvents, featuredEventsHandler};
