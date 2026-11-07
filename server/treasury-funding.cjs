const crypto = require('node:crypto');
const {fail} = require('./admin-policy.cjs');
const {getTreasury} = require('./treasury-service.cjs');

const idPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const providerIdPattern = /^[A-Za-z0-9-]{1,100}$/;
const accountId = services => process.env.MONIME_MAIN_FINANCIAL_ACCOUNT_ID || services.config.monimeMainFinancialAccountId;
const project = snap => ({id: snap.id, amountMinor: snap.data().amountMinor, method: snap.data().method,
  status: snap.data().status, accountId: snap.data().accountId, checkoutUrl: snap.data().checkoutUrl || null,
  createdAt: snap.data().createdAt?.toDate?.()?.toISOString() || snap.data().createdAt || null,
  completedAt: snap.data().completedAt?.toDate?.()?.toISOString() || snap.data().completedAt || null});

function assertOwner(actor) {
  if (!actor.roles.includes('super_admin') || actor.deniedResources?.includes('treasury') || actor.deniedActions?.includes('treasury.fund'))
    fail(403, 'Owner treasury funding access is required.');
}
function amountMinor(value) {
  if (typeof value !== 'string' || !/^(?:[1-9]\d{0,4})(?:\.\d{1,2})?$/.test(value)) fail(400, 'Enter an amount from Le 1 to Le 99,999.99.');
  const [major, cents = ''] = value.split('.');
  const minor = Number(major) * 100 + Number(cents.padEnd(2, '0'));
  if (!Number.isSafeInteger(minor) || minor < 100 || minor > 9999999) fail(400, 'Invalid funding amount.');
  return minor;
}
async function verifiedMainAccount(services, providerGet) {
  const id = accountId(services);
  if (!/^fac-[A-Za-z0-9-]+$/.test(id || '')) fail(503, 'Main financial account is not configured.');
  const treasury = await getTreasury({
    loadDocument: async path => { const snap = await services.db.doc(path).get(); return snap.exists ? snap.data() : null; },
    fetchAccount: providerId => providerGet('/financial-accounts/' + providerId + '?withBalance=true'),
    configuredAccountId: id,
  });
  if (treasury.provider.verifiedAccountId !== id || treasury.configuration.warnings.some(warning => /Conflicting|invalid|incomplete|match/.test(warning)))
    fail(503, 'Main financial account could not be verified. Funding is unavailable.');
  return id;
}
function checkoutBody(record, id) {
  const returnUrl = 'https://www.hubpas.com/admin.html?funding=' + encodeURIComponent(id);
  return {
    name: 'Hubpas main account funding', reference: 'treasuryfund_' + id,
    description: 'Add funds to the Hubpas main financial account',
    financialAccountId: record.accountId, successUrl: returnUrl, cancelUrl: returnUrl,
    lineItems: [{type: 'custom', name: 'Main account funding', quantity: 1, price: {currency: 'SLE', value: record.amountMinor}}],
    paymentOptions: {card: {disable: record.method !== 'card'}, momo: {disable: record.method !== 'momo'}, bank: {disable: true}, wallet: {disable: true}},
    brandingOptions: {primaryColor: '#111111'},
    metadata: {kind: 'treasury_funding', funding_id: id},
  };
}
function safeCheckoutUrl(value) {
  try { const url = new URL(value); return url.protocol === 'https:' && (url.hostname === 'monime.io' || url.hostname.endsWith('.monime.io')) ? url.href : null; }
  catch { return null; }
}
async function startFunding(input, actor, services, providerGet, providerCreate) {
  assertOwner(actor);
  const amount = amountMinor(input.amount);
  if (!['momo', 'card'].includes(input.method)) fail(400, 'Select mobile money or card.');
  const id = input.requestId;
  if (!idPattern.test(id || '')) fail(400, 'Invalid funding request ID.');
  const mainId = await verifiedMainAccount(services, providerGet);
  const ref = services.db.collection('treasuryFundingTransactions').doc(id);
  const requestHash = crypto.createHash('sha256').update(JSON.stringify([actor.uid, amount, input.method, mainId])).digest('hex');
  const existing = await ref.get();
  if (!existing.exists) {
    try {
      await ref.create({actorUid: actor.uid, amountMinor: amount, currency: 'SLE', method: input.method,
        accountId: mainId, requestHash, status: 'initiating', createdAt: services.FieldValue.serverTimestamp(),
        idempotencyKey: 'treasuryfund-' + id});
    } catch (error) { if (error.code !== 6 && error.code !== 'already-exists') throw error; }
  }
  const snap = await ref.get(), record = snap.data();
  if (!record || record.actorUid !== actor.uid || record.requestHash !== requestHash) fail(409, 'This funding request ID was already used.');
  if (record.checkoutUrl) return project(snap);
  if (record.status !== 'initiating') fail(409, 'Funding request needs review before retry.');
  const response = await providerCreate(checkoutBody(record, id), record.idempotencyKey);
  const checkoutUrl = safeCheckoutUrl(response.redirectUrl);
  const verified = response.financialAccountId && response.reference ? response :
    await providerGet('/checkout-sessions/' + response.id);
  if (!providerIdPattern.test(response.id || '') || !checkoutUrl || verified.financialAccountId !== mainId || verified.reference !== 'treasuryfund_' + id)
    fail(503, 'Payment provider returned an unverified checkout. The request needs reconciliation.');
  await ref.update({checkoutSessionId: response.id, checkoutUrl, status: 'pending', updatedAt: services.FieldValue.serverTimestamp()});
  return project(await ref.get());
}
async function reconcileFunding(snap, services, providerGet) {
  const data = snap.data();
  if (!data.checkoutSessionId || !['pending', 'initiating'].includes(data.status)) return project(snap);
  if (!providerIdPattern.test(data.checkoutSessionId)) return project(snap);
  const session = await providerGet('/checkout-sessions/' + data.checkoutSessionId);
  const item = session.lineItems?.data?.[0];
  if (session.id !== data.checkoutSessionId || session.reference !== 'treasuryfund_' + snap.id ||
      session.financialAccountId !== data.accountId || item?.price?.currency !== 'SLE' ||
      item.price.value !== data.amountMinor || session.lineItems.data.length !== 1)
    fail(409, 'Provider checkout details differ from the funding record. Manual review is required.');
  if (!['completed', 'cancelled', 'expired'].includes(session.status)) return project(snap);
  const ref = snap.ref;
  await services.db.runTransaction(async tx => {
    const current = await tx.get(ref);
    if (current.data()?.status !== 'pending') return;
    tx.update(ref, {status: session.status, updatedAt: services.FieldValue.serverTimestamp(),
      ...(session.status === 'completed' ? {completedAt: services.FieldValue.serverTimestamp()} : {})});
    tx.create(services.db.collection('adminAuditLogs').doc('treasuryfund-' + snap.id), {
      actor: data.actorUid, action: 'treasury.fund.' + session.status, target: ref.path,
      correlationId: snap.id, accountId: data.accountId, amountMinor: data.amountMinor,
      currency: 'SLE', providerCheckoutId: data.checkoutSessionId,
      at: services.FieldValue.serverTimestamp(),
    });
  });
  return project(await ref.get());
}
async function listFunding(actor, services, providerGet, id) {
  assertOwner(actor);
  if (id && !idPattern.test(id)) fail(400, 'Invalid funding request ID.');
  if (id) {
    const snap = await services.db.collection('treasuryFundingTransactions').doc(id).get();
    if (!snap.exists) fail(404, 'Funding request not found.');
    return {transaction: await reconcileFunding(snap, services, providerGet)};
  }
  const snapshot = await services.db.collection('treasuryFundingTransactions').orderBy('createdAt', 'desc').limit(20).get();
  let checks = 0;
  const transactions = await Promise.all(snapshot.docs.map(async snap => {
    if (snap.data().status !== 'pending' || checks++ >= 3) return project(snap);
    try { return await reconcileFunding(snap, services, providerGet); }
    catch { return project(snap); }
  }));
  return {transactions};
}
module.exports = {amountMinor, checkoutBody, safeCheckoutUrl, startFunding, listFunding, reconcileFunding};
