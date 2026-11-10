const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');

async function deliverAdminEventNotification(snapshot, deps = {}) {
  if (!snapshot?.exists) return;
  const data = snapshot.data();
  if (data?.status !== 'queued') return;
  const db = deps.db || getFirestore();
  const messaging = deps.messaging || getMessaging();
  const stamp = deps.serverTimestamp || (() => FieldValue.serverTimestamp());
  const eventId = String(data.eventId || '');
  const event = await db.doc('events/' + eventId).get();
  if (!event.exists) {
    await snapshot.ref.update({ status: 'failed', error: 'Event no longer exists.', updatedAt: stamp() });
    return;
  }
  const recipients = new Set();
  if (data.audience?.buyers === true) {
    const tickets = await db.collection('tickets').where('eventId', '==', eventId).limit(1200).get();
    for (const doc of tickets.docs) {
      const ticket = doc.data();
      if (ticket.type !== 'rsvp' && !['cancelled', 'refunded', 'failed'].includes(ticket.status) && ticket.userId) recipients.add(ticket.userId);
    }
  }
  if (data.audience?.rsvps === true) {
    const rsvps = await db.doc('events/' + eventId).collection('rsvps').limit(1200).get();
    for (const doc of rsvps.docs) if (doc.data().status !== 'not_going') recipients.add(doc.id);
  }
  recipients.delete(data.adminUid);
  const ids = [...recipients].slice(0, 2000);
  let delivered = 0;
  let failed = 0;
  for (let offset = 0; offset < ids.length; offset += 20) {
    const results = await Promise.allSettled(ids.slice(offset, offset + 20).map(async uid => {
      const userRef = db.doc('users/' + uid);
      const user = await userRef.get();
      const prefs = user.data()?.notificationPreferences;
      if (Array.isArray(prefs) && !prefs.includes('event_updates')) return 'opted_out';
      const notificationRef = userRef.collection('notifications').doc('admin-event-' + snapshot.id);
      try {
        await notificationRef.create({ title: String(event.data().title || 'Event update').slice(0, 100), body: data.message,
          route: '/events/' + eventId, kind: 'event_update', data: { eventId }, read: false, createdAt: stamp() });
      } catch (error) {
        if (error.code === 6 || error.code === 'already-exists') return 'already_sent';
        throw error;
      }
      const devices = await userRef.collection('devices').get();
      const tokens = devices.docs.map(doc => String(doc.data().token || doc.id)).filter(Boolean).slice(0, 500);
      if (tokens.length) await messaging.sendEachForMulticast({ tokens,
        notification: { title: String(event.data().title || 'Event update').slice(0, 100), body: data.message },
        data: { eventId, route: '/events/' + eventId } });
      return 'delivered';
    }));
    for (const result of results) if (result.status === 'fulfilled') {
      if (result.value === 'delivered' || result.value === 'already_sent') delivered++;
    } else failed++;
  }
  await snapshot.ref.update({ status: failed ? 'partial' : 'sent', recipientsCount: delivered, failedCount: failed, updatedAt: stamp() });
}

module.exports = { deliverAdminEventNotification };
