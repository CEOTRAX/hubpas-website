const { safeId, sanitize } = require("./admin-policy.cjs");
const { loadIdentities, clearIdentityCache } = require("./identity-cache.cjs");
const peopleFields = [
  "userId",
  "fromUserId",
  "toUserId",
  "counterpartyUserId",
  "requesterId",
  "clientId",
  "providerId",
  "hostId",
  "ownerId",
  "venueOwnerId",
  "subscriberId",
  "sellerId",
  "buyerId",
  "senderId",
  "callerId",
  "calleeId",
  "actorId",
  "actor",
];
async function enrichRecords(rows, resourceName, actor, services) {
  if (resourceName === "users" && actor.deniedResources?.includes("wallet"))
    rows = rows.map((row) => ({
      ...row,
      data: Object.fromEntries(
        Object.entries(row.data).filter(
          ([key]) =>
            ![
              "walletBalance",
              "walletHeldBalance",
              "wallet",
              "financialAccount",
              "monimeFinancialAccountId",
              "monimeUvan",
            ].includes(key),
        ),
      ),
    }));
  if (
    !rows.length ||
    actor.deniedResources?.includes("users") ||
    typeof services.db.getAll !== "function"
  )
    return rows;
  const ids = [
    ...new Set(
      rows.flatMap((row) =>
        [
          ...peopleFields.map((key) => row.data[key]),
          ...([
            "wallet",
            "adminRoleAssignments",
            "followers",
            "following",
          ].includes(resourceName)
            ? [row.id]
            : []),
        ].filter((id) => safeId(id)),
      ),
    ),
  ].slice(0, 100);
  const people = new Map();
  const events = new Map();
  if (
    resourceName === "savedEvents" &&
    !actor.deniedResources?.includes("events")
  )
    try {
      const eventIds = [
        ...new Set(
          rows.map((row) => row.data.eventId || row.id).filter(safeId),
        ),
      ].slice(0, 50);
      if (eventIds.length) {
        const docs = await loadIdentities(services, "events", eventIds, [
          "title",
          "dateTime",
          "status",
        ]);
        docs.forEach((data, id) => {
          if (data) events.set(id, sanitize(data, actor.roles));
        });
      }
    } catch {}
  if (ids.includes("hubpas"))
    people.set("hubpas", { name: "Hubpas platform account" });
  if (ids.length)
    try {
      const docs = await loadIdentities(services, "users", ids, [
        "displayName",
        "name",
        "username",
        "email",
        "phone",
      ]);
      docs.forEach((d, id) => {
        if (!d) return;
        people.set(id, {
          name:
            id === "hubpas"
              ? "Hubpas platform account"
              : String(d.displayName || d.name || d.username || "Customer"),
          email: sanitize(d.email, actor.roles, "email"),
          phone: sanitize(d.phone, actor.roles, "phone"),
        });
      });
    } catch {
      /* Keep financial records visible if the contact lookup is unavailable. */
    }
  return rows.map((row) => ({
    ...row,
    ...(resourceName === "savedEvents"
      ? { relatedEvent: events.get(row.data.eventId || row.id) || null }
      : {}),
    people: Object.fromEntries(
      [
        ...peopleFields.map((key) => [key, people.get(row.data[key])]),
        ...([
          "wallet",
          "adminRoleAssignments",
          "followers",
          "following",
        ].includes(resourceName)
          ? [["userId", people.get(row.id)]]
          : []),
      ].filter(([, value]) => value),
    ),
  }));
}
module.exports = { enrichRecords, clearIdentityCache };
