const test = require('node:test');
const assert = require('node:assert/strict');
const {projectEvents, readFeaturedEvents} = require('../server/featured-events.cjs');

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
