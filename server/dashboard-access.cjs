const { fail, safeId, fingerprint } = require("./admin-policy.cjs");
async function contract() {
  const { ROLES, RESOURCES, ACTIONS } =
    await import("./shared/dashboard-schema.mjs");
  return {
    roles: ROLES,
    resources: [...Object.keys(RESOURCES), "treasury", "operationsHealth", "websiteInsights"],
    actions: Object.keys(ACTIONS),
  };
}
function owner(actor) {
  if (!actor.roles.includes("super_admin"))
    fail(403, "Only a dashboard owner can manage dashboard access.");
}
async function getAccess(id, actor, services) {
  owner(actor);
  if (!safeId(id)) fail(400, "A valid Firebase user UID is required.");
  const [snap, user, catalog] = await Promise.all([
    services.db.doc("adminRoleAssignments/" + id).get(),
    services.auth.getUser(id),
    contract(),
  ]);
  const d = snap.exists ? snap.data() : {};
  return {
    id,
    active: d.active === true,
    roles: d.roles || [],
    deniedResources: d.deniedResources || [],
    deniedActions: d.deniedActions || [],
    version: d.accessVersion || 0,
    status: d.status || "not_provisioned",
    signedRoles: user.customClaims?.hubpasAdminRoles || [],
    catalog,
  };
}
async function setAccess(input, actor, services) {
  owner(actor);
  if (process.env.ADMIN_ACCESS_MANAGEMENT_ENABLED !== "true")
    fail(
      503,
      "Dashboard access changes require server access-management setup.",
    );
  if (
    !safeId(input.id) ||
    !safeId(input.correlationId) ||
    typeof input.reason !== "string" ||
    input.reason.trim().length < 5 ||
    input.reason.length > 1000
  )
    fail(400, "User UID, reason and correlation ID are required.");
  if (input.id === actor.uid)
    fail(
      409,
      "You cannot change your own dashboard access. Ask another owner.",
    );
  if (input.id === "hubpas")
    fail(403, "The platform mirror account cannot receive dashboard access.");
  const catalog = await contract();
  const list = (values, allowed) =>
    Array.isArray(values) &&
    values.every((v) => typeof v === "string" && allowed.includes(v))
      ? [...new Set(values)].sort()
      : fail(400, "Invalid dashboard role or restriction.");
  const roles = list(input.roles, catalog.roles),
    deniedResources = list(input.deniedResources, catalog.resources),
    deniedActions = list(input.deniedActions, catalog.actions);
  if (
    typeof input.active !== "boolean" ||
    (input.active && !roles.length) ||
    !Number.isInteger(input.expectedVersion) ||
    input.expectedVersion < 0
  )
    fail(400, "Active access requires roles and a reviewed access version.");
  const user = await services.auth.getUser(input.id);
  if (input.active && user.disabled)
    fail(
      409,
      "Reactivate the Firebase account before granting dashboard access.",
    );
  const spec = { active: input.active, roles, deniedResources, deniedActions };
  const requestHash = fingerprint({
    id: input.id,
    ...spec,
    reason: input.reason,
    expectedVersion: input.expectedVersion,
  });
  const assignment = services.db.doc("adminRoleAssignments/" + input.id),
    request = services.db.doc(
      "adminMutationRequests/access-" + actor.uid + "-" + input.correlationId,
    ),
    audit = services.db.collection("adminAuditLogs").doc();
  const intent = await services.db.runTransaction(async (tx) => {
    const oldRequest = await tx.get(request),
      old = await tx.get(assignment),
      actorAssignment = await tx.get(
        services.db.doc("adminRoleAssignments/" + actor.uid),
      );
    if (actor.bootstrap !== true) {
      if (
        actorAssignment.exists &&
        (actorAssignment.data().active !== true ||
          !actorAssignment.data().roles?.includes("super_admin"))
      )
        fail(
          403,
          "Owner access was removed while this change was being reviewed.",
        );
      if (!actorAssignment.exists && process.env.ADMIN_UID !== actor.uid)
        fail(403, "Owner role assignment is unavailable.");
    }
    if (old.exists && old.data().status === "pending")
      fail(
        409,
        "An access update is already in progress. Reconcile it before another change.",
      );
    if (oldRequest.exists) {
      if (oldRequest.data().requestHash !== requestHash)
        fail(
          409,
          "Correlation ID already belongs to a different access change.",
        );
      if (oldRequest.data().status === "confirmed")
        return { replay: oldRequest.data().result };
      fail(
        409,
        "This access change needs reconciliation; do not retry with another correlation ID.",
      );
    }
    const before = old.exists ? old.data() : {};
    if ((before.accessVersion || 0) !== input.expectedVersion)
      fail(409, "Dashboard access changed. Reload before saving.");
    const version = input.expectedVersion + 1;
    const pending = {
      ...spec,
      active: false,
      accessVersion: version,
      status: "pending",
      updatedBy: actor.uid,
      updatedAt: services.FieldValue.serverTimestamp(),
    };
    if (old.exists) tx.update(assignment, pending);
    else tx.create(assignment, pending);
    tx.create(request, {
      status: "pending",
      requestHash,
      target: assignment.path,
      actor: actor.uid,
      correlationId: input.correlationId,
    });
    tx.create(audit, {
      actor: actor.uid,
      roles: actor.roles,
      action: "dashboard.access.update",
      target: assignment.path,
      reason: input.reason,
      correlationId: input.correlationId,
      before,
      intendedAfter: { ...spec, accessVersion: version },
      status: "pending",
      at: services.FieldValue.serverTimestamp(),
    });
    return { before, version };
  });
  if (intent.replay) return intent.replay;
  try {
    await services.auth.setCustomUserClaims(input.id, {
      ...(user.customClaims || {}),
      hubpasAdminActive: spec.active,
      hubpasAdminRoles: roles,
      hubpasAdminVersion: intent.version,
      hubpasAdminDeniedResources: deniedResources,
      hubpasAdminDeniedActions: deniedActions,
    });
    await services.auth.revokeRefreshTokens(input.id);
    const result = {
      ok: true,
      id: input.id,
      version: intent.version,
      auditId: audit.id,
      notice:
        "Access updated. The user must sign in again to receive refreshed dashboard permissions.",
    };
    await services.db.runTransaction(async (tx) => {
      const current = await tx.get(assignment);
      if (
        current.data()?.accessVersion !== intent.version ||
        current.data()?.status !== "pending"
      )
        fail(409, "Access provisioning changed concurrently.");
      tx.update(assignment, { ...spec, status: "confirmed" });
      tx.update(request, { status: "confirmed", result });
      tx.create(services.db.doc("adminAuditLogs/" + audit.id + "-confirmed"), {
        actor: actor.uid,
        roles: actor.roles,
        action: "dashboard.access.update",
        target: assignment.path,
        reason: input.reason,
        correlationId: input.correlationId,
        before: intent.before,
        after: { ...spec, accessVersion: intent.version },
        status: "confirmed",
        at: services.FieldValue.serverTimestamp(),
      });
    });
    return result;
  } catch (error) {
    // Fail closed: the pending assignment remains inactive even if Auth changed.
    await request.update({ status: "needs_reconciliation" });
    fail(
      503,
      "Dashboard access remains blocked pending reconciliation. No financial records were changed.",
    );
  }
}
module.exports = { getAccess, setAccess };
