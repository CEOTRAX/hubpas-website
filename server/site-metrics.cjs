// Aggregate counters only. No event log, visitor IDs, IPs or user profiles in storage.
const crypto = require('node:crypto');
const DATABASE_URL = 'https://dmap-50136-site-metrics.firebaseio.com';
const ORIGINS = new Set(['https://dmap-50136.web.app', 'https://dmap-50136.firebaseapp.com', 'https://www.hubpas.com', 'https://hubpas.com']);
const PAGES = new Set(['website', 'privacy']);
const salt = crypto.randomBytes(32), rate = new Map(), seen = new Map();
function bad(status, message) { return Object.assign(new Error(message), {status}); }
function parseEvent(body) {
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { throw bad(400, 'Invalid event.'); } }
  if (!body || typeof body !== 'object' || !['pageview','androidDownload'].includes(body.type) || !PAGES.has(body.page) || !/^[a-zA-Z0-9-]{16,64}$/.test(body.id || '') || (body.visit !== undefined && typeof body.visit !== 'boolean')) throw bad(400, 'Invalid event.');
  if (Object.keys(body).some(key => !['type','page','id','visit'].includes(key))) throw bad(400, 'Unexpected event fields.');
  return {type:body.type, page:body.page, id:body.id, visit:body.type === 'pageview' && body.visit === true};
}
function countersFor(event, now = new Date()) {
  const day = now.toISOString().slice(0,10), delta = {};
  const add = name => { delta[`days/${day}/${name}`] = {'.sv':{increment:1}}; delta[`totals/${name}`] = {'.sv':{increment:1}}; };
  if (event.type === 'pageview') { add('pageViews'); add(event.page === 'privacy' ? 'privacyViews' : 'websiteViews'); if(event.visit) add('visits'); }
  else add('androidDownloads');
  delta.updatedAt = {'.sv':'timestamp'};
  return delta;
}
function database(services) {
  return async function request(path, method = 'GET', body) {
    const token = (await services.auth.app.options.credential.getAccessToken()).access_token;
    const response = await fetch(DATABASE_URL + path, {method, headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'}, body:body ? JSON.stringify(body) : undefined, signal:AbortSignal.timeout(8000)});
    if (!response.ok) throw bad(503, 'Website counters are temporarily unavailable.');
    return response.status === 204 ? null : response.json();
  };
}
function prune(map, now) { for (const [key, value] of map) if (value.expires <= now) map.delete(key); while(map.size > 4000) map.delete(map.keys().next().value); }
async function handleSiteMetrics(req, res, provided) {
  res.setHeader('Cache-Control','no-store'); res.setHeader('X-Content-Type-Options','nosniff');
  if (req.method !== 'POST') {res.writeHead(405,{'Allow':'POST'}).end(); return;}
  if (!ORIGINS.has(req.headers.origin) || req.headers['sec-fetch-site'] === 'cross-site') {res.writeHead(403).end(); return;}
  if (/bot|crawler|spider|preview|facebookexternalhit|monitor/i.test(req.headers['user-agent'] || '')) {res.writeHead(204).end(); return;}
  try {
    if (Number(req.headers['content-length'] || 0) > 1024) throw bad(413,'Event too large.');
    let body = req.body;
    if(body === undefined) { const chunks=[]; let size=0; for await (const chunk of req) {size+=chunk.length; if(size>1024)throw bad(413,'Event too large.');chunks.push(chunk);} body=Buffer.concat(chunks).toString(); }
    if(Buffer.isBuffer(body))body=body.toString();
    if (Buffer.byteLength(JSON.stringify(body) || '') > 1024) throw bad(413,'Event too large.');
    const event = parseEvent(body), now=Date.now();
    prune(rate,now);prune(seen,now);
    const key=crypto.createHmac('sha256',salt).update(String(req.ip || req.socket?.remoteAddress || '')+'|'+String(req.headers['user-agent'] || '')).digest('hex');
    const bucket=rate.get(key) || {count:0,expires:now+60000};
    if(++bucket.count>60)throw bad(429,'Too many events.');rate.set(key,bucket);
    if(seen.has(event.id)){res.writeHead(204).end();return;}
    seen.set(event.id,{expires:now+120000});
    try {
      if(provided?.writeCounters)await provided.writeCounters(countersFor(event));
      else await database(provided || require('./admin-runtime.cjs').runtime())('/metrics.json?print=silent','PATCH',countersFor(event));
    } catch(error){seen.delete(event.id);throw error;}
    res.writeHead(204).end();
  } catch(error) {res.writeHead(error.status || 503).end();}
}
function range(params, now = new Date()) {
  const today=now.toISOString().slice(0,10), first=new Date(now);first.setUTCDate(first.getUTCDate()-365);
  const from=params.get('from') || (params.get('all')==='1'?first.toISOString().slice(0,10):today.slice(0,7)+'-01'), to=params.get('to') || today;
  for(const value of [from,to]) if(!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0,10)!==value)throw bad(400,'Choose valid report dates.');
  if(from>to || (Date.parse(to)-Date.parse(from))/86400000>365)throw bad(400,'Choose a website report period of up to 366 days.');
  return {from,to};
}
async function readWebsiteInsights(params, services) {
  const {from,to}=range(params), request=database(services);
  const query=new URLSearchParams({orderBy:JSON.stringify('$key'),startAt:JSON.stringify(from),endAt:JSON.stringify(to),limitToFirst:'366'});
  const allTime=params.get('all')==='1';
  const [stored, meta, lifetime] = await Promise.all([request('/metrics/days.json?'+query),request('/metrics/meta.json'),allTime?request('/metrics/totals.json'):null]);
  const totals={visits:0,pageViews:0,androidDownloads:0,websiteViews:0,privacyViews:0}, days=[];
  for(let cursor=new Date(from);cursor<=new Date(to);cursor.setUTCDate(cursor.getUTCDate()+1)) {
    const date=cursor.toISOString().slice(0,10), row={date};
    for(const name of Object.keys(totals)){const value=Number(stored?.[date]?.[name]);row[name]=Number.isFinite(value)&&value>=0?value:0;totals[name]+=row[name];}days.push(row);
  }
  if(allTime)for(const name of Object.keys(totals)){const value=Number(lifetime?.[name]);totals[name]=Number.isFinite(value)&&value>=0?value:0;}
  return {from,to,totals,days,allTime,trackingStartedAt:meta?.trackingStartedAt || null,asOf:new Date().toISOString(),cacheSeconds:60};
}
module.exports={handleSiteMetrics,readWebsiteInsights,parseEvent,countersFor,range,DATABASE_URL};
