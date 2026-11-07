const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {JSDOM} = require('../server/node_modules/jsdom');

test('owner sees funding form only for a verified main account', async () => {
  const dom = new JSDOM(fs.readFileSync(path.join(__dirname, '../admin.html'), 'utf8'), {url: 'http://127.0.0.1:8080/admin.html'});
  global.document = dom.window.document;
  global.location = dom.window.location;
  global.__HUBPAS_TEST__ = true;
  const {mountDashboard} = await import('../admin-console.mjs');
  const user = {uid: 'owner', getIdToken: async () => 'token'};
  const response = data => ({ok: true, status: 200, json: async () => data});
  await mountDashboard({authLoader: async () => [{initializeApp: () => ({})}, {
    getAuth: () => ({}), onAuthStateChanged: (_auth, callback) => callback(user), signOut: async () => {},
  }], fetcher: async url => {
    if (url.endsWith('/session')) return response({uid: 'owner', roles: ['super_admin'], resources: [], actions: [], version: 'test'});
    if (url.endsWith('/treasury')) return response({provider: {availableMajor: 100, verifiedAccountId: 'fac-main'},
      ledger: {balanceMajor: 50, counters: {}}, configuration: {warnings: [], references: []}, fetchedAt: '2026-11-07T12:00:00Z'});
    if (url.endsWith('/accounts')) return response({accounts: []});
    if (url.endsWith('/treasury-funding')) return response({transactions: []});
    return response({cards: [], errors: [], limited: false, coverage: 'test', asOf: 'test'});
  }});
  await document.getElementById('login-continue').onclick();
  document.querySelector('[data-module="treasury"]').click();
  await new Promise(resolve => setTimeout(resolve, 30));
  assert.ok(document.getElementById('treasury-funding-form'));
  assert.equal(document.querySelector('#treasury-funding-form button').disabled, false);
  assert.match(document.getElementById('funding-transactions').textContent, /No main account funding requests/);
  dom.window.close();
  delete global.document;
  delete global.location;
});
