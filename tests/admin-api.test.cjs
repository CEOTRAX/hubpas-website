const { test } = require("node:test"),
  assert = require("node:assert/strict");
const { handleAdmin } = require("../server/admin-api.cjs"),
  { fingerprint } = require("../server/admin-policy.cjs");
const value = (data, key, id) =>
  key === "__name__" ? id : key.split(".").reduce((v, k) => v?.[k], data);
const normalize = (v) =>
  v?.toDate ? v.toDate().getTime() : v instanceof Date ? v.getTime() : v;
const compare = (a, b) =>
  normalize(a) < normalize(b) ? -1 : normalize(a) > normalize(b) ? 1 : 0;
function database(initial) {
  const docs = new Map(Object.entries(initial)),
    reads = [],
    commits = [];
  let auto = 0;
  const snapshot = (path, data) => ({
    id: path.split("/").pop(),
    exists: data !== undefined,
    data: () => data,
  });
  const doc = (path) => ({
    path,
    id: path.split("/").pop(),
    get: async () => snapshot(path, docs.get(path)),
    update: async (patch) => {
      docs.set(path, { ...docs.get(path), ...patch });
    },
  });
  function query(
    collection,
    filters = [],
    orders = [],
    anchor = null,
    cap = null,
    fields = null,
  ) {
    const clone = (f = filters, o = orders, a = anchor, c = cap, p = fields) =>
      query(collection, f, o, a, c, p);
    return {
      path: collection,
      doc: (id) => doc(collection + "/" + (id || "auto-" + ++auto)),
      where: (k, op, v) => clone([...filters, [k, op, v]]),
      orderBy: (k, dir = "asc") => clone(filters, [...orders, [k, dir]]),
      startAfter: (...values) => clone(filters, orders, values),
      limit: (size) => clone(filters, orders, anchor, size),
      select: (...selection) => clone(filters, orders, anchor, cap, selection),
      count: () => ({
        get: async () => {
          reads.push({ kind: "count", collection, filters, cap: 0, orders });
          const count = [...docs].filter(
            ([path, data]) =>
              path.startsWith(collection + "/") &&
              !path.slice(collection.length + 1).includes("/") &&
              filters.every(([k, op, v]) => {
                const raw = value(data, k, path.split("/").pop());
                if (op === "==") return raw === v;
                const actual = normalize(raw),
                  desired = normalize(v);
                return (
                  typeof actual === typeof desired &&
                  (op === ">=" ? actual >= desired : actual < desired)
                );
              }),
          ).length;
          return { data: () => ({ count }) };
        },
      }),
      get: async () => {
        reads.push({ collection, cap, filters, orders });
        let rows = [...docs.entries()]
          .filter(
            ([path]) =>
              path.startsWith(collection + "/") &&
              path.slice(collection.length + 1).indexOf("/") === -1,
          )
          .map(([path, data]) => ({ path, id: path.split("/").pop(), data }));
        rows = rows.filter((row) =>
          filters.every(([k, op, v]) => {
            const raw = value(row.data, k, row.id);
            if (op === "==") return raw === v;
            if (op === "!=") return raw !== v;
            const actual = normalize(raw),
              desired = normalize(v);
            if (typeof actual !== typeof desired) return false;
            return op === ">=" ? actual >= desired : actual < desired;
          }),
        );
        const cmp = (a, b) => {
          for (const [k, dir] of orders) {
            const result =
              compare(value(a.data, k, a.id), value(b.data, k, b.id)) *
              (dir === "desc" ? -1 : 1);
            if (result) return result;
          }
          return 0;
        };
        rows.sort(cmp);
        if (anchor) {
          const fake = { id: anchor[anchor.length - 1], data: {} };
          orders.forEach(([k], index) => {
            if (k !== "__name__") fake.data[k] = anchor[index];
          });
          rows = rows.filter((row) => cmp(row, fake) > 0);
        }
        if (cap != null) rows = rows.slice(0, cap);
        return {
          docs: rows.map((row) =>
            snapshot(
              row.path,
              fields
                ? Object.fromEntries(
                    fields
                      .filter((key) => row.data[key] !== undefined)
                      .map((key) => [key, row.data[key]]),
                  )
                : row.data,
            ),
          ),
        };
      },
      aggregate: (spec) => ({
        get: async () => ({
          data: () =>
            Object.fromEntries(
              Object.entries(spec).map(([key, field]) => [
                key,
                [...docs]
                  .filter(
                    ([path]) =>
                      path.startsWith(collection + "/") &&
                      !path.slice(collection.length + 1).includes("/"),
                  )
                  .reduce(
                    (sum, [, data]) =>
                      sum + (typeof data[field] === "number" ? data[field] : 0),
                    0,
                  ),
              ]),
            ),
        }),
      }),
    };
  }
  return {
    docs,
    reads,
    commits,
    doc,
    collection: (path) => query(path),
    runTransaction: async (callback) => {
      const pending = [];
      const tx = {
        get: async (ref) => snapshot(ref.path, docs.get(ref.path)),
        update: (ref, patch) =>
          pending.push({ kind: "update", path: ref.path, data: patch }),
        create: (ref, data) =>
          pending.push({ kind: "create", path: ref.path, data }),
      };
      const result = await callback(tx);
      for (const op of pending)
        if (op.kind === "create" && docs.has(op.path))
          throw new Error("Already exists");
      for (const op of pending) {
        if (op.kind === "create") docs.set(op.path, op.data);
        else {
          const data = { ...docs.get(op.path) };
          for (const [key, v] of Object.entries(op.data)) {
            const parts = key.split(".");
            if (parts.length === 1) data[key] = v;
            else data[parts[0]] = { ...data[parts[0]], [parts[1]]: v };
          }
          docs.set(op.path, data);
        }
      }
      commits.push(pending);
      return result;
    },
  };
}
const services = (db) => ({
  db,
  auth: {
    verifyIdToken: async () => ({
      uid: "operator",
      hubpasAdminActive: true,
      hubpasAdminRoles:
        db.docs.get("adminRoleAssignments/operator")?.roles || [],
    }),
  },
  FieldPath: { documentId: () => "__name__" },
  FieldValue: { serverTimestamp: () => "server-time" },
  AggregateField: { sum: (field) => field },
  config: { firebaseProjectId: "dmap-50136" },
});
async function request(db, path, method = "GET", body, overrides = {}) {
  const res = {
    writeHead(status, headers) {
      this.status = status;
      this.headers = headers;
    },
    end(raw) {
      this.body = JSON.parse(raw);
    },
  };
  await handleAdmin(
    {
      url: "/api/admin/" + path,
      method,
      headers: { authorization: "Bearer valid" },
      body,
    },
    res,
    { ...services(db), ...overrides },
  );
  return res;
}
test("server pagination combines ISO/timestamp dates and returns bounded non-overlapping pages", async () => {
  const initial = {
    "adminRoleAssignments/operator": { active: true, roles: ["analyst"] },
  };
  for (let i = 0; i < 60; i++)
    initial["users/u-" + String(i).padStart(3, "0")] = {
      displayName: "User " + i,
      createdAt:
        i % 2
          ? "2026-10-" + String((i % 28) + 1).padStart(2, "0") + "T12:00:00Z"
          : {
              toDate: () =>
                new Date(
                  "2026-10-" +
                    String((i % 28) + 1).padStart(2, "0") +
                    "T12:00:00Z",
                ),
            },
      walletPinHash: "must-not-leak",
    };
  const db = database(initial),
    base = "records?resource=users&from=2026-10-01&to=2026-10-31&pageSize=25";
  const first = await request(db, base);
  assert.equal(first.status, 200);
  assert.equal(first.body.rows.length, 25);
  assert.ok(first.body.cursor);
  assert.ok(db.reads.every((read) => read.cap === 26));
  assert.ok(db.reads.every((read) => read.orders.at(-1)[1] === "desc"));
  assert.ok(!JSON.stringify(first.body).includes("must-not-leak"));
  const second = await request(
    db,
    base + "&cursor=" + encodeURIComponent(first.body.cursor),
  );
  assert.equal(second.status, 200);
  assert.equal(second.body.rows.length, 25);
  assert.equal(
    new Set([...first.body.rows, ...second.body.rows].map((row) => row.id))
      .size,
    50,
  );
  const third = await request(
    db,
    base + "&cursor=" + encodeURIComponent(second.body.cursor),
  );
  assert.equal(third.body.rows.length, 10);
  assert.equal(third.body.cursor, null);
  const mismatch = await request(
    db,
    "records?resource=users&from=2026-09-01&to=2026-09-30&cursor=" +
      encodeURIComponent(first.body.cursor),
  );
  assert.equal(mismatch.status, 400);
});
test("a role-authorised moderation change and its audit are atomic and idempotent", async () => {
  const previous = process.env.ADMIN_ACTIONS_ENABLED;
  process.env.ADMIN_ACTIONS_ENABLED = "true";
  try {
    const db = database({
      "adminRoleAssignments/operator": { active: true, roles: ["operations"] },
      "events/event-1": {
        title: "Published event",
        status: "published",
        dateTime: "2026-10-20",
      },
    });
    const detail = await request(db, "record?resource=events&id=event-1");
    assert.equal(detail.status, 200);
    const cached = await request(db, "records?resource=events");
    assert.equal(cached.body.rows[0].data.status, "published");
    const body = {
      action: "event.unpublish",
      id: "event-1",
      reason: "Organizer requested review",
      correlationId: "correlation-1",
      expectedVersion: detail.body.version,
    };
    const first = await request(db, "actions", "POST", body);
    assert.equal(first.status, 200);
    assert.equal(db.docs.get("events/event-1").status, "draft");
    const refreshed = await request(db, "records?resource=events");
    assert.equal(refreshed.body.rows[0].data.status, "draft");
    assert.equal(db.commits.length, 1);
    assert.equal(db.commits[0].length, 3);
    const audit = [...db.docs].find(([path]) =>
      path.startsWith("adminAuditLogs/"),
    )[1];
    assert.equal(audit.actor, "operator");
    assert.equal(audit.before.status, "published");
    assert.equal(audit.after.status, "draft");
    assert.equal(audit.reason, body.reason);
    assert.equal(audit.correlationId, body.correlationId);
    const again = await request(db, "actions", "POST", body);
    assert.equal(again.status, 200);
    assert.equal(again.body.auditId, first.body.auditId);
    assert.equal(db.commits[1].length, 0);
    const reused = await request(db, "actions", "POST", {
      ...body,
      reason: "A different purpose",
    });
    assert.equal(reused.status, 409);
    const illegal = await request(db, "actions", "POST", {
      ...body,
      action: "wallet.balance",
    });
    assert.equal(illegal.status, 400);
  } finally {
    if (previous === undefined) delete process.env.ADMIN_ACTIONS_ENABLED;
    else process.env.ADMIN_ACTIONS_ENABLED = previous;
  }
});
test("stale reviewed version and mutations disabled at rollout cannot alter data", async () => {
  const previous = process.env.ADMIN_ACTIONS_ENABLED;
  const db = database({
    "adminRoleAssignments/operator": { active: true, roles: ["operations"] },
    "events/e": { status: "published" },
  });
  const body = {
    action: "event.unpublish",
    id: "e",
    reason: "Review reason",
    correlationId: "c",
    expectedVersion: "wrong",
  };
  try {
    delete process.env.ADMIN_ACTIONS_ENABLED;
    assert.equal((await request(db, "actions", "POST", body)).status, 503);
    process.env.ADMIN_ACTIONS_ENABLED = "true";
    assert.equal((await request(db, "actions", "POST", body)).status, 409);
    assert.equal(db.docs.get("events/e").status, "published");
    assert.equal(db.commits.length, 0);
  } finally {
    if (previous === undefined) delete process.env.ADMIN_ACTIONS_ENABLED;
    else process.env.ADMIN_ACTIONS_ENABLED = previous;
  }
});

test("provider reconciliation keeps principal and fee legs separate and timeout unknown without writes", async () => {
  const db = database({
    "adminRoleAssignments/operator": { active: true, roles: ["finance"] },
    "walletTransactions/op": {
      status: "pending",
      monime: { payout: { id: "pay-1" }, platformFeeTransfer: { id: "itr-1" } },
    },
  });
  const calls = [];
  const result = await request(db, "reconcile?id=op", "GET", undefined, {
    providerGet: async (path) => {
      calls.push(path);
      if (path.includes("itr-1")) throw new Error("Timeout");
      return { status: "pending", amount: { currency: "SLE", value: 5500 } };
    },
  });
  assert.equal(result.status, 200);
  assert.deepEqual(calls.sort(), [
    "/internal-transfers/itr-1",
    "/payouts/pay-1",
  ]);
  assert.equal(result.body.providerChecks[0].status, "pending");
  assert.equal(result.body.providerChecks[1].status, "unknown");
  assert.match(result.body.providerChecks[1].error, /not proof of failure/);
  assert.equal(db.commits.length, 0);
  assert.equal(db.docs.get("walletTransactions/op").status, "pending");
});

test("dashboard roles, granular restrictions and stale claims are enforced by the API", async () => {
  const db = database({
    "adminRoleAssignments/operator": {
      active: true,
      roles: ["super_admin"],
      accessVersion: 3,
      deniedResources: ["events", "users"],
      deniedActions: ["venue.approve"],
    },
  });
  const auth = {
    verifyIdToken: async () => ({
      uid: "operator",
      hubpasAdminActive: true,
      hubpasAdminRoles: ["super_admin"],
      hubpasAdminVersion: 3,
      hubpasAdminDeniedResources: ["treasury"],
    }),
  };
  const session = await request(db, "session", "GET", undefined, { auth });
  assert.equal(session.status, 200);
  assert.ok(!session.body.resources.includes("events"));
  assert.ok(!session.body.resources.includes("users"));
  for (const path of [
    "records?resource=events",
    "treasury",
    "accounts",
    "account?id=fac-one",
    "events-insights",
  ])
    assert.equal(
      (await request(db, path, "GET", undefined, { auth })).status,
      403,
    );
  const overview = await request(db, "overview", "GET", undefined, { auth });
  assert.equal(overview.body.customerLiabilities, null);
  assert.equal(
    overview.body.cards.find((card) => card.label === "New registrations")
      .value,
    undefined,
  );
  assert.equal(
    (
      await request(
        db,
        "actions",
        "POST",
        { action: "venue.approve" },
        { auth },
      )
    ).status,
    403,
  );
  const stale = {
    verifyIdToken: async () => ({
      uid: "operator",
      hubpasAdminActive: true,
      hubpasAdminRoles: ["super_admin"],
      hubpasAdminVersion: 2,
    }),
  };
  assert.equal(
    (await request(db, "session", "GET", undefined, { auth: stale })).status,
    403,
  );
});

test("owner access provisioning preserves unrelated claims, audits, revokes sessions and is idempotent", async () => {
  const { setAccess } = require("../server/dashboard-access.cjs");
  const previous = process.env.ADMIN_ACCESS_MANAGEMENT_ENABLED;
  process.env.ADMIN_ACCESS_MANAGEMENT_ENABLED = "true";
  const db = database({
    "adminRoleAssignments/operator": { active: true, roles: ["super_admin"] },
  });
  let claims = { existingAppFlag: true },
    changes = 0,
    revocations = 0;
  const svc = {
    ...services(db),
    auth: {
      getUser: async () => ({ disabled: false, customClaims: claims }),
      setCustomUserClaims: async (uid, value) => {
        assert.equal(db.docs.get("adminRoleAssignments/target").active, false);
        claims = value;
        changes++;
      },
      revokeRefreshTokens: async () => revocations++,
    },
  };
  const body = {
    id: "target",
    active: true,
    roles: ["operations"],
    deniedResources: ["users", "treasury"],
    deniedActions: ["event.unpublish"],
    reason: "Event staff with restricted management scope",
    expectedVersion: 0,
    correlationId: "grant-1",
  };
  const actor = { uid: "operator", roles: ["super_admin"] };
  try {
    const result = await setAccess(body, actor, svc);
    assert.equal(result.version, 1);
    assert.equal(claims.existingAppFlag, true);
    assert.deepEqual(claims.hubpasAdminDeniedResources, ["treasury", "users"]);
    assert.equal(claims.hubpasAdminVersion, 1);
    assert.equal(revocations, 1);
    const doc = db.docs.get("adminRoleAssignments/target");
    assert.equal(doc.active, true);
    assert.equal(doc.status, "confirmed");
    assert.ok(
      [...db.docs.values()].some(
        (v) =>
          v.action === "dashboard.access.update" &&
          v.status === "confirmed" &&
          v.before &&
          v.after,
      ),
    );
    assert.deepEqual(await setAccess(body, actor, svc), result);
    assert.equal(changes, 1);
    await assert.rejects(
      () =>
        setAccess(
          { ...body, id: "operator", correlationId: "self" },
          actor,
          svc,
        ),
      (e) => e.status === 409,
    );
    await assert.rejects(
      () => setAccess(body, { uid: "staff", roles: ["operations"] }, svc),
      (e) => e.status === 403,
    );
  } finally {
    if (previous === undefined)
      delete process.env.ADMIN_ACCESS_MANAGEMENT_ENABLED;
    else process.env.ADMIN_ACCESS_MANAGEMENT_ENABLED = previous;
  }
});

test("an interrupted access grant fails closed and can never turn pending assignment into dashboard access", async () => {
  const { setAccess } = require("../server/dashboard-access.cjs");
  const previous = process.env.ADMIN_ACCESS_MANAGEMENT_ENABLED;
  process.env.ADMIN_ACCESS_MANAGEMENT_ENABLED = "true";
  const db = database({
    "adminRoleAssignments/operator": { active: true, roles: ["super_admin"] },
  });
  const svc = {
    ...services(db),
    auth: {
      getUser: async () => ({ customClaims: {} }),
      setCustomUserClaims: async () => {
        throw new Error("Auth unavailable");
      },
    },
  };
  try {
    await assert.rejects(
      () =>
        setAccess(
          {
            id: "target",
            active: true,
            roles: ["finance"],
            deniedResources: [],
            deniedActions: [],
            expectedVersion: 0,
            reason: "Finance team access grant",
            correlationId: "failed-grant",
          },
          { uid: "operator", roles: ["super_admin"] },
          svc,
        ),
      (e) => e.status === 503,
    );
    assert.equal(db.docs.get("adminRoleAssignments/target").active, false);
    assert.equal(
      db.docs.get("adminMutationRequests/access-operator-failed-grant").status,
      "needs_reconciliation",
    );
  } finally {
    if (previous === undefined)
      delete process.env.ADMIN_ACCESS_MANAGEMENT_ENABLED;
    else process.env.ADMIN_ACCESS_MANAGEMENT_ENABLED = previous;
  }
});

test("overview wallet liabilities aggregate each numeric field separately and exclude the platform mirror", async () => {
  const db = database({
    "adminRoleAssignments/operator": { active: true, roles: ["super_admin"] },
    "users/hubpas": { walletBalance: 500, walletHeldBalance: 300 },
    "users/a": { walletBalance: 100, walletHeldBalance: 5 },
    "users/b": { walletBalance: 40, walletHeldBalance: 7 },
    "users/c": { walletBalance: 7 },
    "users/d": { walletBalance: "1000" },
  });
  const res = await request(db, "overview");
  assert.equal(res.status, 200);
  assert.equal(res.body.customerLiabilities.walletBalanceMajor, 147);
  assert.equal(res.body.customerLiabilities.heldBalanceMajor, 12);
  assert.equal(res.body.errors.length, 0);
  const { safeMessage } = require("../server/admin-api.cjs");
  assert.equal(
    safeMessage({ code: 3, message: "The query requires an index." }),
    "Required database index is unavailable.",
  );
});

test("user finance page shows current ledger balances and only that user period activity", async () => {
  const db = database({
    "adminRoleAssignments/operator": { active: true, roles: ["finance"] },
    "users/target": {
      displayName: "Customer",
      walletBalance: 200,
      walletHeldBalance: 10,
      email: "target@example.com",
    },
    "users/other": { walletBalance: 900 },
    "walletTransactions/one": {
      userId: "target",
      status: "completed",
      type: "topup",
      netAmount: 50,
      timestamp: "2026-10-10T12:00:00Z",
    },
    "walletTransactions/two": {
      userId: "other",
      status: "completed",
      type: "topup",
      netAmount: 900,
      timestamp: "2026-10-10T12:00:00Z",
    },
    "walletTransactions/old": {
      userId: "target",
      status: "completed",
      type: "topup",
      netAmount: 75,
      timestamp: "2026-09-10T12:00:00Z",
    },
    "tickets/one": { userId: "target", createdAt: "2026-10-10T12:00:00Z" },
    "tickets/other": { userId: "other", createdAt: "2026-10-10T12:00:00Z" },
  });
  const res = await request(
    db,
    "user-summary?id=target&from=2026-10-01&to=2026-10-31",
  );
  assert.equal(res.status, 200);
  assert.equal(res.body.profile.data.walletBalance, 200);
  assert.equal(res.body.profile.data.walletHeldBalance, 10);
  assert.equal(res.body.finance.funding, 50);
  assert.equal(res.body.transactions.length, 1);
  assert.equal(res.body.tickets.count, 1);
  assert.ok(
    !db.reads.some(
      (read) => read.collection === "tickets" && read.kind !== "count",
    ),
  );
  assert.ok(
    db.reads
      .filter(
        (read) =>
          read.collection === "walletTransactions" && read.kind !== "count",
      )
      .every((read) => read.cap === 51),
  );
  assert.ok(
    db.reads
      .filter((read) =>
        ["walletTransactions", "tickets"].includes(read.collection),
      )
      .every((read) =>
        read.filters.some(
          ([key, op, value]) =>
            key === "userId" && op === "==" && value === "target",
        ),
      ),
  );
  db.docs.get("adminRoleAssignments/operator").deniedResources = ["wallet"];
  const blocked = await request(db, "user-summary?id=target");
  assert.equal(blocked.body.financialAccess, false);
  assert.equal(blocked.body.profile.data.walletBalance, undefined);
  assert.equal(blocked.body.profile.data.walletHeldBalance, undefined);
});

test("cached lists still enforce current permissions and token revocation on every request", async () => {
  const db = database({
    "adminRoleAssignments/operator": { active: true, roles: ["finance"] },
    "users/a": { displayName: "Customer" },
  });
  const first = await request(db, "records?resource=users");
  assert.equal(first.status, 200);
  const readCount = db.reads.length;
  const repeat = await request(db, "records?resource=users");
  assert.equal(repeat.status, 200);
  assert.equal(db.reads.length, readCount);
  db.docs.get("adminRoleAssignments/operator").deniedResources = ["users"];
  assert.equal((await request(db, "records?resource=users")).status, 403);
  const denied = await request(db, "records?resource=users", "GET", undefined, {
    auth: {
      verifyIdToken: async () => {
        throw Object.assign(Error("revoked"), {
          code: "auth/id-token-revoked",
        });
      },
    },
  });
  assert.notEqual(denied.status, 200);
});

test("overview uses aggregate counts instead of loading operational collections", async () => {
  const db = database({
    "adminRoleAssignments/operator": { active: true, roles: ["finance"] },
  });
  const result = await request(db, "overview?from=2026-10-01&to=2026-10-31");
  assert.equal(result.status, 200);
  assert.ok(
    db.reads
      .filter((read) =>
        ["events", "tickets", "venueBookings", "skillBookings"].includes(
          read.collection,
        ),
      )
      .every((read) => read.kind === "count"),
  );
  assert.ok(
    db.reads
      .filter(
        (read) =>
          read.collection === "walletTransactions" && read.kind !== "count",
      )
      .every((read) => read.cap === 101),
  );
});
