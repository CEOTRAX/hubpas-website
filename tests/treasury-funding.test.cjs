const test = require('node:test');
const assert = require('node:assert/strict');
const {amountMinor, checkoutBody, safeCheckoutUrl, startFunding, listFunding} = require('../server/treasury-funding.cjs');

const mainId = 'fac-k6PFYiMj6XJuRpwRF4K73mqKpBJ';
const id = 'c9a6b2d3-4555-4f77-8111-123456789abc';
const owner = {uid: 'owner', roles: ['super_admin'], deniedResources: [], deniedActions: []};
function fakeServices() {
  const docs = new Map();
  const doc = path => ({path, id: path.split('/').at(-1),
    async get() {return {id: this.id, ref: this, exists: docs.has(path), data: () => docs.get(path)};},
    async create(data) {if (docs.has(path)) throw Object.assign(new Error('exists'), {code: 6}); docs.set(path, data);},
    async update(data) {docs.set(path, {...docs.get(path), ...data});},
  });
  return {config: {monimeMainFinancialAccountId: mainId}, FieldValue: {serverTimestamp: () => '2026-11-07T12:00:00Z'},
    db: {doc, collection: name => ({doc: key => doc(name + '/' + key), orderBy: () => ({limit: () => ({get: async () => ({docs: [...docs.keys()].filter(key => key.startsWith(name + '/')).map(key => awaitable(doc(key), docs.get(key)))})})})}),
      runTransaction: async callback => callback({get: ref => ref.get(), update: (ref, data) => docs.set(ref.path, {...docs.get(ref.path), ...data}),
        create: (ref, data) => docs.set(ref.path, data)})}, docs};
}
function awaitable(ref, data) {return {id: ref.id, ref, data: () => data};}

test('funding validates exact SLE cents and hosted checkout URL', () => {
  assert.equal(amountMinor('100.25'), 10025);
  assert.throws(() => amountMinor('1.999'));
  assert.throws(() => amountMinor('0.50'));
  assert.equal(safeCheckoutUrl('https://checkout.monime.io/pay/abc'), 'https://checkout.monime.io/pay/abc');
  assert.equal(safeCheckoutUrl('https://monime.io.evil.example/pay'), null);
  const body = checkoutBody({accountId: mainId, amountMinor: 10025, method: 'momo'}, id);
  assert.equal(body.financialAccountId, mainId);
  assert.equal(body.paymentOptions.card.disable, true);
  assert.equal(body.paymentOptions.momo.disable, false);
  assert.equal(body.lineItems[0].price.value, 10025);
});

test('owner funding creates one pending record and confirms only matching provider settlement', async () => {
  const services = fakeServices();
  let checkoutStatus = 'pending', creates = 0;
  const read = async path => {
    if (path.startsWith('/financial-accounts/')) return {id: mainId, currency: 'SLE', balance: {available: {currency: 'SLE', value: 5000}}};
    return {id: 'scs-123', status: checkoutStatus, reference: 'treasuryfund_' + id, financialAccountId: mainId,
      lineItems: {data: [{price: {currency: 'SLE', value: 10025}}]}};
  };
  const create = async body => {creates++; return {id: 'scs-123', redirectUrl: 'https://checkout.monime.io/pay/abc',
    financialAccountId: body.financialAccountId, reference: body.reference};};
  const input = {requestId: id, amount: '100.25', method: 'momo'};
  const first = await startFunding(input, owner, services, read, create);
  assert.equal(first.status, 'pending');
  assert.equal(first.amountMinor, 10025);
  await startFunding(input, owner, services, read, create);
  assert.equal(creates, 1);
  checkoutStatus = 'completed';
  const listed = await listFunding(owner, services, read);
  assert.equal(listed.transactions[0].status, 'completed');
  assert.equal(services.docs.get('adminAuditLogs/treasuryfund-' + id).amountMinor, 10025);
  assert.equal(services.docs.get('platform/treasury'), undefined);
});

test('finance role and restricted owner cannot start funding', async () => {
  const services = fakeServices();
  const stub = async () => {throw new Error('provider should not run');};
  await assert.rejects(startFunding({requestId: id, amount: '10', method: 'card'},
    {...owner, roles: ['finance']}, services, stub, stub), {status: 403});
  await assert.rejects(startFunding({requestId: id, amount: '10', method: 'card'},
    {...owner, deniedActions: ['treasury.fund']}, services, stub, stub), {status: 403});
});
