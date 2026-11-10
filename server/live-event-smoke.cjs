// Bounded, read-only event management check against the configured project.
const { runtime } = require('./admin-runtime.cjs');
const { listEvents, eventDetail } = require('./admin-events.cjs');
const { cursorCodec } = require('./admin-policy.cjs');

async function main() {
  const uid = process.argv[2];
  if (!uid) throw new Error('Owner UID required.');
  const services = runtime();
  try {
    const [user, assignment] = await Promise.all([services.auth.getUser(uid), services.db.doc('adminRoleAssignments/' + uid).get()]);
    const role = assignment.data();
    if (!role?.active || !role.roles?.includes('super_admin') || !user.customClaims?.hubpasAdminActive ||
        !user.customClaims?.hubpasAdminRoles?.includes('super_admin') || user.customClaims.hubpasAdminVersion !== role.accessVersion) throw new Error('Owner claims and assignment do not match.');
    const actor = { uid, roles: ['super_admin'], deniedResources: role.deniedResources || [], deniedActions: role.deniedActions || [] };
    const page = await listEvents(new URLSearchParams(), actor, services, cursorCodec('local-smoke-only'));
    console.log('Event list query succeeded; rows:', page.rows.length, 'has next page:', Boolean(page.cursor));
    if (page.rows[0]) {
      const detail = await eventDetail(new URLSearchParams({ id: page.rows[0].id }), actor, services);
      console.log('Event detail queries succeeded; ticket sample:', detail.tickets.length, 'boost sample:', detail.boosts.length);
    }
  } finally { await services.db.terminate(); }
}
main().catch(error => { console.error('Live event read check failed:', error.message); process.exitCode = 1; });
