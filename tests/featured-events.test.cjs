const test = require('node:test');
const assert = require('node:assert/strict');
const {projectEvents, publicEvent, readFeaturedEvents, featuredEventsHandler} = require('../server/featured-events.cjs');

const now = Date.parse('2026-11-06T12:00:00Z');
const record = (id, changes = {}) => ({id, data: () => ({
  title: ' Live show ', dateTime: '2026-12-05T20:00', status: 'published',
  publicOrPrivate: 'public', image: 'https://firebasestorage.googleapis.com/v0/b/b/o/photo.jpg?alt=media',
  ...changes,
})});

test('public feed excludes drafts, private, removed and past events', () => {
  const events = projectEvents([
    record('draft', {status: 'draft'}), record('private', {publicOrPrivate: 'private'}),
    record('removed', {moderationRemoved: true}), record('past', {dateTime: '2026-01-01T20:00'}),
    record('visible'),
  ], now);
  assert.deepEqual(events.map(event => event.id), ['visible']);
  assert.equal(events[0].title, 'Live show');
  assert.deepEqual(Object.keys(events[0]), ['id','title','dateTime','category','location','image','ageRating']);
});

test('event images and text are projected safely', () => {
  const [event] = projectEvents([record('safe', {
    imageThumbnail: 'javascript:alert(1)', image: 'https://evil.example/picture.jpg',
    location: 'Freetown', district: 'Western Area Urban', ageRating: '18+',
    hostId: 'private-user-id', invitedUsers: ['private-user-id'],
  })], now);
  assert.equal(event.image, null);
  assert.equal(event.location, 'Western Area Urban');
  assert.equal(event.ageRating, '18+');
  assert.equal(JSON.stringify(event).includes('private-user-id'), false);
});

test('query reads bounded upcoming records and orders cards by date', async () => {
  const calls = [];
  const db = {collection(name) { calls.push(['collection', name]); return {
    where(...args) {calls.push(['where', ...args]); return this;},
    orderBy(...args) {calls.push(['orderBy', ...args]); return this;},
    limit(value) {calls.push(['limit', value]); return this;},
    async get() {return {docs: [record('later', {dateTime:'2027-01-01T12:00'}),record('earlier')]};},
  };}};
  const events = await readFeaturedEvents(db, now);
  assert.deepEqual(events.map(event => event.id), ['earlier','later']);
  assert.ok(calls.some(call => call[0] === 'limit' && call[1] <= 100));
});

test('event detail exposes public content and enabled access only', () => {
  const event = publicEvent(record('detail', {
    description: 'Live music\nFood and drinks', hostName: 'The host', hostId: 'secret-host-id',
    fullAddress: 'The venue', chatEnabled: true, privateChatMessages: ['secret message'],
    ticketTiers: [
      {name: 'General admission', type: 'ticket', price: 75, quantity: 100, sold: 5},
      {name: 'Table for four', type: 'table', price: 300, quantity: 10, sold: 10},
    ],
    donationTiers: [{name: 'Supporter', amount: 50}],
    interactiveFeatures: {ticketsEnabled: true, tablesEnabled: false, donationsEnabled: true},
  }), now);
  assert.equal(event.description, 'Live music\nFood and drinks');
  assert.equal(event.hostName, 'The host');
  assert.equal(event.chatEnabled, true);
  assert.deepEqual(event.tickets.map(tier => tier.name), ['General admission']);
  assert.deepEqual(event.tables, []);
  assert.deepEqual(event.donations.map(tier => tier.name), ['Supporter']);
  assert.equal(JSON.stringify(event).includes('secret'), false);
});

test('event detail rejects unpublished, private, removed and ended records', () => {
  assert.equal(publicEvent(record('draft', {status: 'draft'}), now), null);
  assert.equal(publicEvent(record('private', {publicOrPrivate: 'private'}), now), null);
  assert.equal(publicEvent(record('removed', {moderationRemoved: true}), now), null);
  assert.equal(publicEvent(record('past', {dateTime: '2026-01-01T20:00'}), now), null);
});

test('event detail endpoint reads one event and rejects invalid IDs', async () => {
  const reads = [];
  const db = {collection: () => ({doc: id => ({get: async () => {reads.push(id); return {...record(id), exists: true};}})})};
  const request = url => ({method: 'GET', url});
  const response = () => ({statusCode: 200, headers: {}, setHeader(key, value) {this.headers[key] = value;},
    writeHead(code) {this.statusCode = code; return this;}, end(body) {this.body = body; return this;}});
  const handler = featuredEventsHandler(db);
  const valid = response();
  await handler(request('/api/featured-events?id=one'), valid);
  assert.equal(valid.statusCode, 200);
  assert.equal(JSON.parse(valid.body).event.id, 'one');
  const invalid = response();
  await handler(request('/api/featured-events?id=../secret'), invalid);
  assert.equal(invalid.statusCode, 400);
  assert.deepEqual(reads, ['one']);
});
