const crypto = require("node:crypto");
const {
  fail,
  safeId,
  sanitize,
  projectRecord,
  cursorCodec,
  fingerprint,
  financialSummary,
} = require("./admin-policy.cjs");
const { runtime, providerGet } = require("./admin-runtime.cjs");
const { getTreasury } = require("./treasury-service.cjs");
const { getAccess, setAccess } = require("./dashboard-access.cjs");
const { enrichRecords } = require("./record-identities.cjs");
const { cachedRead, storeFor } = require("./read-cache.cjs");
const { listFields, summaryFields } = require("./record-projections.cjs");
const localCursorSecret = crypto.randomBytes(32).toString("hex");
const codec = {
  current: () => {
    if (process.env.K_SERVICE && !process.env.ADMIN_CURSOR_SECRET)
      fail(503, "Shared server cursor signing key is not configured.");
    return cursorCodec(process.env.ADMIN_CURSOR_SECRET || localCursorSecret);
  },
  encode: (value) => codec.current().encode(value),
  decode: (value) => codec.current().decode(value),
};
const send = (res, status, data) => {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  res.end(JSON.stringify(data));
};
let schemaPromise;
const schema = () =>
  (schemaPromise ||= import("./shared/dashboard-schema.mjs"));

async function authorize(req, services) {
  const token = /^Bearer (.+)$/.exec(req.headers.authorization || "")?.[1];
  if (!token) fail(401, "Admin sign-in required.");
  const { identity, assignment } =
    await require("./access-check.cjs").checkAccess(token, services);
  const { ROLES } = await schema();
  const signedRoles =
    identity.hubpasAdminActive === true &&
    Array.isArray(identity.hubpasAdminRoles)
      ? identity.hubpasAdminRoles.filter((role) => ROLES.includes(role))
      : [];
  let roles =
    assignment.exists &&
    assignment.data().active === true &&
    Array.isArray(assignment.data().roles)
      ? assignment.data().roles.filter((role) => signedRoles.includes(role))
      : [];
  if (
    !assignment.exists &&
    process.env.ADMIN_UID &&
    identity.uid === process.env.ADMIN_UID
  )
    roles = ["super_admin"];
  if (!roles.length)
    fail(
      403,
      "No active trusted dashboard role assignment and signed admin claims. Profile role/isAdmin fields are not used.",
    );
  if (
    assignment.exists &&
    assignment.data().accessVersion != null &&
    identity.hubpasAdminVersion !== assignment.data().accessVersion
  )
    fail(403, "Dashboard permissions changed. Sign out and sign in again.");
  const deniedResources = [
    ...new Set([
      ...(Array.isArray(identity.hubpasAdminDeniedResources)
        ? identity.hubpasAdminDeniedResources
        : []),
      ...(Array.isArray(assignment.data()?.deniedResources)
        ? assignment.data().deniedResources
        : []),
    ]),
  ];
  const deniedActions = [
    ...new Set([
      ...(Array.isArray(identity.hubpasAdminDeniedActions)
        ? identity.hubpasAdminDeniedActions
        : []),
      ...(Array.isArray(assignment.data()?.deniedActions)
        ? assignment.data().deniedActions
        : []),
    ]),
  ];
  return {
    uid: identity.uid,
    roles,
    deniedResources,
    deniedActions,
    accessVersion: assignment.data()?.accessVersion || 0,
  };
}
function allowResource(actor, name) {
  if (actor.deniedResources?.includes(name))
    fail(403, "Your dashboard access is restricted for this resource.");
}
function requireRole(actor, roles) {
  if (!actor.roles.some((role) => roles.includes(role)))
    fail(403, "Your dashboard role cannot access this resource.");
}
function rangeFrom(params) {
  const from = params.get("from"),
    to = params.get("to");
  if (!from && !to) return null;
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(from || "") ||
    !/^\d{4}-\d{2}-\d{2}$/.test(to || "")
  )
    fail(400, "Dates must be YYYY-MM-DD in UTC.");
  const start = new Date(from),
    end = new Date(to);
  end.setUTCDate(end.getUTCDate() + 1);
  if (
    !Number.isFinite(+start) ||
    !Number.isFinite(+end) ||
    start >= end ||
    end - start > 366 * 86400000
  )
    fail(400, "Choose a valid date range of at most 366 days.");
  return { start, end };
}
async function resourceFor(params, actor, services) {
  const { RESOURCES } = await schema();
  const name = params.get("resource");
  const resource = Object.hasOwn(RESOURCES, name) ? RESOURCES[name] : null;
  if (!resource)
    fail(400, "Unknown resource. Arbitrary collections are not allowed.");
  requireRole(actor, resource.roles);
  allowResource(actor, name);
  let collection = resource.collection;
  if (resource.parent) {
    const parent = params.get("parent"),
      nested = params.get("nested");
    if (!safeId(parent) || (resource.grandchild && !safeId(nested)))
      fail(400, "A valid parent record is required.");
    collection =
      resource.parent +
      "/" +
      parent +
      "/" +
      resource.child +
      (resource.grandchild ? "/" + nested + "/" + resource.grandchild : "");
  }
  return { name, resource, ref: services.db.collection(collection) };
}
function queryBase(
  ref,
  resource,
  params,
  format,
  services,
  orderByDate = false,
) {
  const range = rangeFrom(params);
  let query = ref;
  const status = params.get("status"),
    type = params.get("type"),
    search = params.get("search"),
    searchField = params.get("searchField");
  for (const [field, value] of [
    ["status", status],
    ["type", type],
  ])
    if (value && value !== "all") {
      if (!resource.fields.includes(field) || value.length > 80)
        fail(400, "Unsupported status/type filter.");
      query = query.where(field, "==", value);
    }
  if (search) {
    const permitted = [
      "userId",
      "eventId",
      "transferId",
      "orderId",
      "requestId",
      "checkoutSessionId",
      "hostId",
      "providerId",
      "clientId",
      "username",
      "displayName",
      "name",
      "invoiceNumber",
    ];
    if (searchField === "id") return { directId: search, query };
    if (
      !permitted.includes(searchField) ||
      !resource.fields.includes(searchField) ||
      search.length > 160
    )
      fail(400, "Choose a supported exact-match search field.");
    query = query.where(searchField, "==", search);
  }
  if (range)
    query = query
      .where(
        resource.dateField,
        ">=",
        format === "iso" ? range.start.toISOString().slice(0, 10) : range.start,
      )
      .where(
        resource.dateField,
        "<",
        format === "iso" ? range.end.toISOString().slice(0, 10) : range.end,
      );
  if (range || orderByDate) query = query.orderBy(resource.dateField, "desc");
  return {
    query: query.orderBy(
      services.FieldPath.documentId(),
      range || orderByDate ? "desc" : "asc",
    ),
    range,
  };
}
async function records(params, actor, services) {
  const { name, resource, ref } = await resourceFor(params, actor, services);
  if (resource.fixedId) {
    const snap = await ref.doc(resource.fixedId).get();
    return {
      rows: snap.exists
        ? [
            projectRecord(
              snap.id,
              snap.data(),
              resource,
              actor.roles,
              actor.deniedResources,
            ),
          ]
        : [],
      cursor: null,
      source: ref.path + "/" + resource.fixedId,
      newSchema: !!resource.newSchema,
    };
  }
  const size = Math.max(1, Math.min(50, Number(params.get("pageSize")) || 25));
  const scope = fingerprint({
    resource: name,
    from: params.get("from"),
    to: params.get("to"),
    status: params.get("status"),
    type: params.get("type"),
    search: params.get("search"),
    searchField: params.get("searchField"),
    parent: params.get("parent"),
    nested: params.get("nested"),
  });
  const previous = params.get("cursor")
    ? codec.decode(params.get("cursor"))
    : null;
  if (previous && (previous.scope !== scope || previous.uid !== actor.uid))
    fail(400, "Cursor does not match this user and filter.");
  const range = rangeFrom(params),
    formats =
      params.get("searchField") === "id" && params.get("search")
        ? ["all"]
        : range
          ? ["timestamp", "iso"]
          : ["all"];
  const projection = listFields(name, resource).filter(
    (field) => field !== "__name__",
  );
  const snapshots = await Promise.all(
    formats.map(async (format) => {
      const built = queryBase(ref, resource, params, format, services);
      if (built.directId) {
        if (!safeId(built.directId)) fail(400, "Invalid record ID.");
        const snap = await ref.doc(built.directId).get();
        return { format, docs: snap.exists ? [snap] : [], direct: true };
      }
      let query = built.query.select(...projection);
      const anchor = previous?.anchors?.[format];
      if (anchor)
        query = range
          ? query.startAfter(
              format === "timestamp" ? new Date(anchor.date) : anchor.date,
              anchor.id,
            )
          : query.startAfter(anchor.id);
      const snap = await query.limit(size + 1).get();
      return { format, docs: snap.docs };
    }),
  );
  const merged = [
    ...new Map(
      snapshots
        .flatMap((group) =>
          group.docs.map((doc) => ({ doc, format: group.format })),
        )
        .map((item) => [item.doc.id, item]),
    ).values(),
  ].sort((a, b) =>
    range
      ? Date.parse(toDate(b.doc.data()[resource.dateField])) -
          Date.parse(toDate(a.doc.data()[resource.dateField])) ||
        b.doc.id.localeCompare(a.doc.id)
      : a.doc.id.localeCompare(b.doc.id),
  );
  const page = merged.slice(0, size);
  const anchors = { ...(previous?.anchors || {}) };
  page.forEach(({ doc, format }) => {
    anchors[format] = {
      id: doc.id,
      date: range ? toDate(doc.data()[resource.dateField]) : null,
    };
  });
  const more = !snapshots.some((group) => group.direct) && merged.length > size;
  return {
    rows: await enrichRecords(
      page.map(({ doc }) =>
        projectRecord(
          doc.id,
          doc.data(),
          resource,
          actor.roles,
          actor.deniedResources,
        ),
      ),
      name,
      actor,
      services,
    ),
    cursor: more
      ? codec.encode({
          uid: actor.uid,
          scope,
          anchors,
          expires: Date.now() + 1800000,
        })
      : null,
    source: ref.path,
    dateField: resource.dateField,
    newSchema: !!resource.newSchema,
    status: "available",
    metadataOnly: !!resource.privateMetadata,
  };
}
const toDate = (value) =>
  typeof value?.toDate === "function"
    ? value.toDate().toISOString()
    : String(value || "");
async function sample(
  name,
  params,
  actor,
  services,
  cap = 200,
  keepSearch = false,
  projection = null,
) {
  const own = new URLSearchParams(params);
  own.set("resource", name);
  own.delete("cursor");
  own.delete("status");
  own.delete("type");
  if (!keepSearch) {
    own.delete("search");
    own.delete("searchField");
  }
  const { resource, ref } = await resourceFor(own, actor, services);
  const formats = rangeFrom(own) ? ["timestamp", "iso"] : ["all"];
  const snaps = await Promise.all(
    formats.map(async (format) => {
      const built = queryBase(ref, resource, own, format, services, true);
      const snap = await built.query
        .select(...(projection || summaryFields(name, resource)))
        .limit(cap + 1)
        .get();
      return snap.docs;
    }),
  );
  const raw = [
    ...new Map(
      snaps.flat().map((doc) => [doc.id, { id: doc.id, data: doc.data() }]),
    ).values(),
  ];
  raw.sort(
    (a, b) =>
      Date.parse(toDate(b.data[resource.dateField])) -
        Date.parse(toDate(a.data[resource.dateField])) ||
      b.id.localeCompare(a.id),
  );
  return {
    rows: raw.slice(0, cap),
    limited: raw.length > cap || snaps.some((docs) => docs.length > cap),
  };
}
async function resourceInsights(params, actor, services) {
  const { name, resource, ref } = await resourceFor(params, actor, services);
  const { insightFieldsFor, resourceSummary } = await import("./shared/admin-insights.mjs");
  if (resource.parent && !params.get("parent"))
    fail(400, "Choose a parent record before viewing this breakdown.");
  if (resource.fixedId) {
    const snap = await ref.doc(resource.fixedId).get();
    return {
      ...resourceSummary(snap.exists ? [{ data: snap.data() }] : [], name, resource.dateField, snap.exists ? 1 : 0),
      exact: true,
      errors: [],
      asOf: new Date().toISOString(),
    };
  }
  const [countResult, sampleResult, verifiedResult] = await Promise.allSettled([
    countResource(name, params, actor, services),
    sample(name, params, actor, services, 100, false, insightFieldsFor(name, resource)),
    name === "users"
      ? countResource(name, params, actor, services, { verified: true })
      : Promise.resolve(null),
  ]);
  const errors = [countResult, sampleResult, verifiedResult].flatMap((result) =>
    result.status === "rejected" && result.reason?.status !== 403
      ? [safeMessage(result.reason)]
      : [],
  );
  const sampled = sampleResult.status === "fulfilled"
    ? sampleResult.value
    : { rows: [], limited: false };
  return {
    ...resourceSummary(
      sampled.rows,
      name,
      resource.dateField,
      countResult.status === "fulfilled" ? countResult.value : null,
      sampled.limited,
    ),
    verifiedTotal: verifiedResult.status === "fulfilled" ? verifiedResult.value : null,
    exact: countResult.status === "fulfilled",
    errors: [...new Set(errors)],
    asOf: new Date().toISOString(),
  };
}
async function countResource(name, params, actor, services, filters = {}) {
  const own = new URLSearchParams(params);
  own.set("resource", name);
  own.delete("cursor");
  const { resource, ref } = await resourceFor(own, actor, services);
  const formats = rangeFrom(own) ? ["timestamp", "iso"] : ["all"];
  const values = await Promise.all(
    formats.map(async (format) => {
      let query = queryBase(ref, resource, own, format, services).query;
      for (const [field, value] of Object.entries(filters))
        query = query.where(field, "==", value);
      if (typeof query.count !== "function")
        fail(503, "Server count aggregation is unavailable.");
      return (await query.count().get()).data().count;
    }),
  );
  return values.reduce((sum, value) => sum + value, 0);
}
async function overview(params, actor, services) {
  // The current wallet snapshot is independent of the period counts. Start it
  // alongside the count queries so a cold aggregate does not add another round trip.
  const liabilitiesPromise = customerLiabilitiesForOverview(params, actor, services);
  const names = [
    "users",
    "events",
    "tickets",
    "venueBookings",
    "skillBookings",
    "walletTransactions",
  ];
  const extraPromise = Promise.allSettled([
    countResource("users", params, actor, services, { verified: true }),
    countResource("tickets", params, actor, services, { status: "used" }),
    countResource("walletTransactions", params, actor, services),
  ]);
  const result = await Promise.allSettled(
    names.map(async (name) =>
      name === "walletTransactions"
        ? sample(name, params, actor, services, 100)
        : { count: await countResource(name, params, actor, services) },
    ),
  );
  const data = Object.fromEntries(
    names.map((name, i) => [
      name,
      result[i].status === "fulfilled" ? result[i].value : null,
    ]),
  );
  const errors = names.flatMap((name, i) =>
    result[i].status === "rejected"
      ? [
          {
            resource: name,
            message: "Unavailable: " + safeMessage(result[i].reason),
          },
        ]
      : [],
  );
  const extra = await extraPromise;
  extra.forEach((entry, i) => {
    if (entry.status === "rejected" && entry.reason.status !== 403)
      errors.push({
        resource: [
          "verified-registrations",
          "redeemed-tickets",
          "wallet-count",
        ][i],
        message: safeMessage(entry.reason),
      });
  });
  const countValue = (i) =>
    extra[i].status === "fulfilled" ? extra[i].value : undefined;
  const cards = [
    {
      label: "New registrations",
      value: data.users?.count,
      definition: "Registrations in the selected UTC period · server count.",
    },
    {
      label: "Verified registrations",
      value: countValue(0),
      definition: "Registered in period with recorded verified=true.",
    },
    {
      label: "Events",
      value: data.events?.count,
      definition:
        "events.dateTime in selected range; draft and cancelled remain identifiable.",
    },
    {
      label: "Tickets created",
      value: data.tickets?.count,
      definition:
        "Ticket records created in period, including later refunds/cancellations.",
    },
    {
      label: "Redeemed tickets",
      value: countValue(1),
      definition:
        "Issued in period and currently used; not a count by scan date.",
    },
    {
      label: "Venue / skill bookings",
      value:
        data.venueBookings && data.skillBookings
          ? data.venueBookings.count + data.skillBookings.count
          : undefined,
      definition:
        "Requested in selected period; both sources remain separate below.",
    },
  ];
  const finance = data.walletTransactions
    ? financialSummary(data.walletTransactions.rows)
    : null;
  if (finance && countValue(2) != null) {
    finance.transactionCount = countValue(2);
    finance.recordCountExact = true;
  }
  const limited =
    Object.values(data).some((source) => source?.limited) ||
    (countValue(2) != null &&
      data.walletTransactions &&
      countValue(2) > data.walletTransactions.rows.length);
  const { customerLiabilities, error: liabilitiesError } = await liabilitiesPromise;
  if (liabilitiesError)
    errors.push({
      resource: "customer-wallet-liabilities",
      message: safeMessage(liabilitiesError),
    });
  return {
    cards,
    finance,
    customerLiabilities,
    errors,
    limited,
    coverage: limited
      ? "Platform counts are aggregated. Transaction amounts use up to 100 recent entries; narrow the period for complete observed amounts."
      : "Platform counts use server aggregations. Transaction amounts use confirmed recorded activity.",
    financeLimit: 100,
    currency: "SLE",
    definitions: {
      finance:
        "Successful recorded walletTransactions only; transfer_in legs excluded, transfer_out deduplicated by transferId, topups by orderId, positive hubpas subscription/boost revenue counted once. Refunds/reversals are not revenue. Missing statuses excluded; legacy currency absent is source-default SLE and deployed version remains unverified.",
    },
    asOf: new Date().toISOString(),
  };
}
async function customerLiabilitiesForOverview(params, actor, services) {
  let customerLiabilities = null;
  if (
    !actor.deniedResources?.includes("users") &&
    !actor.deniedResources?.includes("wallet") &&
    actor.roles.some((role) =>
      ["super_admin", "finance", "analyst"].includes(role),
    )
  )
    try {
      const users = services.db.collection("users");
      const current = await storeFor(services).get(
        "customer-liabilities",
        60000,
        async () => {
          const [balance, held, mirror] = await Promise.all([
            users
              .aggregate({
                value: services.AggregateField.sum("walletBalance"),
              })
              .get(),
            users
              .aggregate({
                value: services.AggregateField.sum("walletHeldBalance"),
              })
              .get(),
            users
              .where(services.FieldPath.documentId(), "==", "hubpas")
              .select("walletBalance", "walletHeldBalance")
              .limit(1)
              .get(),
          ]);
          const platform = mirror.docs[0]?.data() || {};
          const numeric = (value) =>
            typeof value === "number" && Number.isFinite(value) ? value : 0;
          return {
            walletBalanceMajor:
              balance.data().value - numeric(platform.walletBalance),
            heldBalanceMajor:
              held.data().value - numeric(platform.walletHeldBalance),
            source:
              "users.walletBalance / walletHeldBalance; platform identity hubpas excluded. wallet mirrors are not added.",
            period: "current snapshot, not date-filtered",
            asOf: new Date().toISOString(),
          };
        },
        { fresh: params.get("fresh") === "1" },
      );
      customerLiabilities = current;
    } catch (error) {
      return { customerLiabilities: null, error };
    }
  return { customerLiabilities, error: null };
}
async function userSummary(params, actor, services) {
  const id = params.get("id");
  if (!safeId(id)) fail(400, "A valid customer reference is required.");
  const own = new URLSearchParams(params);
  own.set("resource", "users");
  const { resource, ref } = await resourceFor(own, actor, services);
  // All of these are independent reads for the same authorised customer.
  const profilePromise = ref.doc(id).get();
  const contactAccess = actor.roles.some((role) =>
    ["super_admin", "support"].includes(role),
  );
  const identityPromise =
    typeof services.auth.getUser === "function"
      ? storeFor(services)
          .get("auth-profile:" + id, 30000, () => services.auth.getUser(id))
          .then((user) => ({ user }), (error) => ({ error }))
      : Promise.resolve({ user: null });
  const addressPromise = contactAccess
    ? services.db
        .doc("users/" + id + "/private/address")
        .get()
        .then((snap) => ({ snap }), (error) => ({ error }))
    : Promise.resolve({ snap: null });
  const financial =
    actor.roles.some((role) => ["super_admin", "finance"].includes(role)) &&
    !actor.deniedResources?.includes("wallet");
  const countsPromise = Promise.allSettled(
    ["walletTransactions", "tickets"].map((name) => {
      const p = new URLSearchParams(params);
      p.set("search", id);
      p.set("searchField", "userId");
      return countResource(name, p, actor, services);
    }),
  );
  const sourcesPromise = Promise.allSettled(
    ["walletTransactions"].map(async (name) => {
      const p = new URLSearchParams(params);
      p.set("search", id);
      p.set("searchField", "userId");
      return sample(name, p, actor, services, 50, true);
    }),
  );
  const snap = await profilePromise;
  if (!snap.exists) fail(404, "Customer not found.");
  const profile = projectRecord(
    id,
    snap.data(),
    resource,
    actor.roles,
    actor.deniedResources,
  );
  profile.version = fingerprint(profile.data);
  profile.source = ref.path + "/" + id;
  const [identity, address] = await Promise.all([
    identityPromise,
    addressPromise,
  ]);
  const authUser = identity.user;
  const raw = snap.data();
  const addressData = address.snap?.exists ? address.snap.data() : {};
  const textField = (value, limit = 180) =>
    typeof value === "string" && value.trim()
      ? value.trim().slice(0, limit)
      : null;
  const authDate = (value) => {
    const date = new Date(value || "");
    return Number.isFinite(+date) ? date.toISOString() : null;
  };
  const contact = (value, key) =>
    contactAccess ? textField(value, 254) : sanitize(value, actor.roles, key);
  const profileDetails = {
    contactAccess,
    email: contact(authUser?.email || raw.email, "email"),
    backupEmail: contactAccess ? textField(raw.backupEmail, 254) : null,
    phone: contact(authUser?.phoneNumber || raw.phone, "phone"),
    joinedAt:
      profile.data.createdAt || authDate(authUser?.metadata?.creationTime),
    lastSignInAt: authDate(authUser?.metadata?.lastSignInTime),
    streetAddress: contactAccess
      ? textField(addressData.streetAddress || raw.address)
      : null,
    city: contactAccess ? textField(addressData.city, 100) : null,
    region: contactAccess ? textField(addressData.region, 100) : null,
    postalCode: contactAccess ? textField(addressData.postalCode, 24) : null,
    country: contactAccess ? textField(addressData.country, 80) : null,
  };
  if (!financial)
    for (const key of [
      "walletBalance",
      "walletHeldBalance",
      "wallet",
      "financialAccount",
      "monimeFinancialAccountId",
    ])
      delete profile.data[key];
  const sources = await sourcesPromise;
  const rows = sources[0].status === "fulfilled" ? sources[0].value.rows : [];
  const definitions = await schema();
  const transactions = rows
    .slice(0, 12)
    .map((row) =>
      projectRecord(
        row.id,
        row.data,
        definitions.RESOURCES.walletTransactions,
        actor.roles,
      ),
    );
  const counts = await countsPromise;
  const tickets =
    counts[1].status === "fulfilled"
      ? { count: counts[1].value, limited: false }
      : null;
  const authStatus = authUser
    ? authUser.disabled ? "Suspended" : "Active"
    : id === actor.uid ? "Active" : "Not available";
  const finance =
    financial && sources[0].status === "fulfilled"
      ? financialSummary(rows)
      : null;
  if (finance && counts[0].status === "fulfilled") {
    finance.transactionCount = counts[0].value;
    finance.recordCountExact = true;
  }
  return {
    profile,
    profileDetails,
    authStatus,
    finance,
    transactions,
    tickets,
    limited:
      (counts[0].status === "fulfilled" && counts[0].value > rows.length) ||
      sources.some(
        (source) => source.status === "fulfilled" && source.value.limited,
      ),
    summaryLimit: 50,
    errors: [
      ...(identity.error
        ? [{ source: "Account identity", message: safeMessage(identity.error) }]
        : []),
      ...(address.error
        ? [{ source: "Personal address", message: safeMessage(address.error) }]
        : []),
      ...sources.flatMap((source, i) =>
        source.status === "rejected"
          ? [
              {
                source: ["Wallet activity", "Tickets"][i],
                message: safeMessage(source.reason),
              },
            ]
          : [],
      ),
      ...counts.flatMap((source, i) =>
        source.status === "rejected"
          ? [
              {
                source: ["Wallet count", "Tickets"][i],
                message: safeMessage(source.reason),
              },
            ]
          : [],
      ),
    ],
    financialAccess: financial,
    asOf: new Date().toISOString(),
    period: rangeFrom(params) ? "Selected period" : "All time",
  };
}
async function eventInsights(params, actor, services) {
  const result = await sample("events", params, actor, services, 120);
  const { eventStats } = await import("./shared/admin-insights.mjs");
  return {
    rows: result.rows.map((row) => ({
      id: row.id,
      data: sanitize({
        title: row.data.title,
        dateTime: toDate(row.data.dateTime),
        endDateTime: row.data.endDateTime,
        status: row.data.status,
        location: row.data.location,
        category: row.data.category,
        venueName: row.data.venueName,
      }),
    })),
    stats: eventStats(result.rows, new Date(), "dateTime"),
    limited: result.limited,
    asOf: new Date().toISOString(),
  };
}
async function bodyFrom(req) {
  if (req.body && typeof req.body === "object") {
    if (Buffer.byteLength(JSON.stringify(req.body)) > 20000)
      fail(413, "Request too large.");
    return req.body;
  }
  let data = "";
  for await (const chunk of req) {
    data += chunk;
    if (data.length > 20000) fail(413, "Request too large.");
  }
  try {
    return JSON.parse(data || "{}");
  } catch {
    fail(400, "Invalid JSON request.");
  }
}
function patchFor(action, input, current) {
  switch (action) {
    case "event.removeCoHost": {
      if (
        !safeId(input.coHostId) ||
        input.coHostId === current.hostId ||
        !Array.isArray(current.coHosts) ||
        !current.coHosts.some((member) => member.userId === input.coHostId)
      )
        fail(
          400,
          "Select an existing co-host; the event owner cannot be removed.",
        );
      return {
        coHosts: current.coHosts.filter(
          (member) => member.userId !== input.coHostId,
        ),
      };
    }
    case "user.grantPlan": {
      if (!["basic", "pro", "business"].includes(input.plan))
        fail(400, "Select Basic, Pro or Business.");
      const expiry = new Date(input.expiresAt);
      if (
        !Number.isFinite(+expiry) ||
        expiry <= new Date() ||
        expiry - Date.now() > 366 * 86400000
      )
        fail(400, "Entitlement expiry must be within the next 366 days.");
      return {
        accountType: input.plan,
        userPlan: input.plan,
        businessPlan: input.plan === "business" ? "business" : "free",
        verified: true,
        "subscription.plan": input.plan,
        "subscription.status": "active",
        "subscription.expiresAt": expiry.toISOString(),
        "subscription.adminGranted": true,
      };
    }
    case "event.unpublish":
      if (current.status !== "published")
        fail(409, "Only a published event can be unpublished.");
      return { status: "draft", publicOrPrivate: "private" };
    case "user.restrictPublishing":
      return {
        "contentAccess.publicPublishingLocked": true,
        "contentAccess.reason": "admin_restriction",
      };
    case "user.restorePublishing":
      return {
        "contentAccess.publicPublishingLocked": false,
        "contentAccess.reason": "admin_restored",
      };
    case "user.setVerification":
      if (typeof input.verified !== "boolean")
        fail(400, "verified must be boolean.");
      return { verified: input.verified };
    case "user.publishLimit":
      if (
        !Number.isInteger(input.limit) ||
        input.limit < 1 ||
        input.limit > 10000
      )
        fail(400, "Publishing limit must be an integer from 1 to 10000.");
      return { "adminLimits.maxPublishedEventsTotal": input.limit };
    case "venue.suspend":
      return { status: "suspended" };
    case "venue.approve":
      return { status: "approved" };
    case "skill.pause":
      if (current.status !== "active")
        fail(409, "Only an active listing can be paused.");
      return { status: "paused" };
    case "pricing.update": {
      const allowed = [
        "basicMonthlyPriceMajor",
        "basicYearlyMonthlyPriceMajor",
        "proMonthlyPriceMajor",
        "proYearlyMonthlyPriceMajor",
        "businessMonthlyPriceMajor",
        "businessYearlyMonthlyPriceMajor",
        "boostPricePerDayMajor",
      ];
      const patch = {};
      const legacyRemaps = {
        basicMonthlyPriceMajor: [59],
        basicYearlyMonthlyPriceMajor: [49],
        proMonthlyPriceMajor: [100],
        proYearlyMonthlyPriceMajor: [80],
        businessMonthlyPriceMajor: [350],
        businessYearlyMonthlyPriceMajor: [250, 449.99],
      };
      for (const [key, value] of Object.entries(input.prices || {})) {
        if (legacyRemaps[key]?.includes(value))
          fail(
            409,
            "The app pricing initializer remaps this legacy price. Verify and update that backend before selecting it.",
          );
        if (
          !allowed.includes(key) ||
          !Number.isFinite(value) ||
          value < 0 ||
          value > 1e7
        )
          fail(400, "Invalid stored pricing field.");
        patch[key] = value;
      }
      if (!Object.keys(patch).length)
        fail(400, "Enter a pricing field to change.");
      return {
        ...patch,
        adminVersion: (Number(current.adminVersion) || 0) + 1,
        adminEffectiveAt: new Date().toISOString(),
      };
    }
    default:
      fail(
        400,
        "Unsupported action. Financial balance edits/refunds/retries are not generic actions.",
      );
  }
}
async function mutation(input, actor, services) {
  const { ACTIONS, RESOURCES } = await schema(),
    definition = Object.hasOwn(ACTIONS, input.action)
      ? ACTIONS[input.action]
      : null;
  if (!definition)
    fail(
      400,
      "Action is not enabled. Historical financial records cannot be edited.",
    );
  requireRole(actor, definition.roles);
  allowResource(actor, definition.resource);
  if (actor.deniedActions?.includes(input.action))
    fail(
      403,
      "This management action is restricted for your dashboard account.",
    );
  if (process.env.ADMIN_ACTIONS_ENABLED !== "true")
    fail(
      503,
      "Mutations are disabled until rollout approval and permission checks are complete.",
    );
  if (
    !safeId(input.id) ||
    typeof input.reason !== "string" ||
    input.reason.trim().length < 5 ||
    input.reason.length > 1000 ||
    !safeId(input.correlationId)
  )
    fail(400, "Record ID, reason and correlation ID are required.");
  if (input.id === "hubpas")
    fail(
      403,
      "The platform mirror identity cannot be changed through an account workflow.",
    );
  if (["user.suspend", "user.reactivate"].includes(input.action))
    return authMutation(input, actor, services);
  const resource = RESOURCES[definition.resource],
    target = resource.collection + "/" + (resource.fixedId || input.id);
  const idem = services.db.doc(
    "adminMutationRequests/" +
      fingerprint({ uid: actor.uid, id: input.correlationId }),
  );
  const ref = services.db.doc(target),
    audit = services.db.collection("adminAuditLogs").doc(),
    requestHash = fingerprint(input);
  return services.db.runTransaction(async (tx) => {
    const [prior, snap] = await Promise.all([tx.get(idem), tx.get(ref)]);
    if (prior.exists) {
      if (prior.data().requestHash !== requestHash)
        fail(409, "Correlation ID was already used for a different action.");
      return prior.data().result;
    }
    if (!snap.exists) fail(404, "Target record does not exist.");
    const before = snap.data();
    if (
      input.expectedVersion &&
      input.expectedVersion !==
        fingerprint(
          projectRecord(
            snap.id,
            before,
            resource,
            actor.roles,
            actor.deniedResources,
          ).data,
        )
    )
      fail(
        409,
        "Record changed since it was reviewed. Refresh before making changes.",
      );
    const patch = patchFor(input.action, input, before);
    const result = {
      ok: true,
      auditId: audit.id,
      correlationId: input.correlationId,
    };
    tx.update(ref, patch);
    tx.create(audit, {
      actor: actor.uid,
      roles: actor.roles,
      action: input.action,
      target,
      at: services.FieldValue.serverTimestamp(),
      reason: input.reason.trim(),
      before: sanitize(
        Object.fromEntries(
          Object.keys(patch).map((key) => [
            key,
            key.split(".").reduce((value, part) => value?.[part], before),
          ]),
        ),
      ),
      after: sanitize(patch),
      correlationId: input.correlationId,
    });
    if (input.action === "pricing.update")
      tx.create(services.db.doc("platformPricingVersions/" + audit.id), {
        ...sanitize(before),
        version: Number(before.adminVersion) || 0,
        supersededAt: services.FieldValue.serverTimestamp(),
        auditId: audit.id,
      });
    tx.create(idem, {
      actor: actor.uid,
      requestHash,
      result,
      at: services.FieldValue.serverTimestamp(),
    });
    return result;
  });
}
async function authMutation(input, actor, services) {
  if (input.id === actor.uid) fail(403, "Self-suspension is not supported.");
  const assignment = await services.db
    .doc("adminRoleAssignments/" + input.id)
    .get();
  if (
    assignment.exists &&
    assignment.data().roles?.includes("super_admin") &&
    !actor.roles.includes("super_admin")
  )
    fail(403, "Operations cannot suspend a super admin.");
  const id = fingerprint({ uid: actor.uid, id: input.correlationId }),
    ref = services.db.doc("adminMutationRequests/" + id);
  const before = await services.auth.getUser(input.id),
    disabled = input.action === "user.suspend",
    requestHash = fingerprint(input);
  const started = await services.db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists) {
      if (snap.data().requestHash !== requestHash)
        fail(409, "Correlation ID already used.");
      if (snap.data().status === "confirmed") return snap.data().result;
      fail(
        409,
        "Account operation is pending reconciliation; inspect the audit before repeating it.",
      );
    }
    tx.create(ref, {
      actor: actor.uid,
      target: input.id,
      action: input.action,
      status: "pending",
      requestHash,
      reason: input.reason,
      before: { disabled: before.disabled },
      intendedAfter: { disabled },
      at: services.FieldValue.serverTimestamp(),
    });
    tx.create(services.db.doc("adminAuditLogs/" + id + "-intent"), {
      actor: actor.uid,
      roles: actor.roles,
      action: input.action,
      target: "auth/users/" + input.id,
      status: "pending",
      reason: input.reason,
      before: { disabled: before.disabled },
      intendedAfter: { disabled },
      correlationId: input.correlationId,
      at: services.FieldValue.serverTimestamp(),
    });
    return null;
  });
  if (started) return started;
  try {
    await services.auth.updateUser(input.id, { disabled });
    if (disabled) await services.auth.revokeRefreshTokens(input.id);
    const audit = services.db.collection("adminAuditLogs").doc(),
      result = {
        ok: true,
        auditId: audit.id,
        correlationId: input.correlationId,
      };
    await services.db.runTransaction(async (tx) => {
      await tx.get(ref);
      tx.update(ref, { status: "confirmed", result });
      tx.create(audit, {
        actor: actor.uid,
        roles: actor.roles,
        action: input.action,
        target: "auth/users/" + input.id,
        before: { disabled: before.disabled },
        after: { disabled },
        reason: input.reason,
        correlationId: input.correlationId,
        at: services.FieldValue.serverTimestamp(),
      });
    });
    return result;
  } catch (error) {
    await ref.update({
      status: "needs_reconciliation",
      lastError: "Account authentication operation could not be confirmed.",
      updatedAt: services.FieldValue.serverTimestamp(),
    });
    fail(
      503,
      "Account change is pending reconciliation. Do not assume the operation failed or repeat it with a new request.",
    );
  }
}
function safeMessage(error) {
  if (error.status) return error.message;
  const code = String(error.code || "");
  if (["7", "permission-denied"].includes(code))
    return "Permission denied by backend IAM.";
  if (
    ["9", "failed-precondition"].includes(code) ||
    /requires an? index|index.*not.*support/i.test(String(error.message || ""))
  )
    return "Required database index is unavailable.";
  return "Backend service unavailable; check configured credentials and rollout.";
}
async function handleAdmin(req, res, provided) {
  try {
    if (!/^Bearer .+$/.test(req.headers.authorization || ""))
      fail(401, "Admin sign-in required.");
    const services = provided || runtime(),
      actor = await authorize(req, services),
      { RESOURCES, ACTIONS, VERSION } = await schema();
    const readProvider = services.providerGet || providerGet;
    const url = new URL(req.url, "http://localhost"),
      path = url.pathname.replace(/^\/api\/admin\/?/, "");
    if (req.method === "GET" && path === "session")
      return send(res, 200, {
        uid: actor.uid,
        roles: actor.roles,
        version: VERSION,
        deploymentRevision: process.env.K_REVISION || "local/unverified",
        resources: Object.keys(RESOURCES).filter(
          (key) =>
            !actor.deniedResources.includes(key) &&
            RESOURCES[key].roles.some((role) => actor.roles.includes(role)),
        ),
        actions:
          process.env.ADMIN_ACTIONS_ENABLED === "true"
            ? Object.keys(ACTIONS).filter(
                (key) =>
                  !actor.deniedActions.includes(key) &&
                  !actor.deniedResources.includes(ACTIONS[key].resource) &&
                  ACTIONS[key].roles.some((role) => actor.roles.includes(role)),
              )
            : [],
        appDeploymentStatus: "unverified",
        deniedResources: actor.deniedResources,
        canManageAccess: actor.roles.includes("super_admin"),
        accessManagementEnabled:
          process.env.ADMIN_ACCESS_MANAGEMENT_ENABLED === "true",
      });
    if (req.method === "GET" && path === "dashboard-access")
      return send(
        res,
        200,
        await getAccess(url.searchParams.get("id"), actor, services),
      );
    if (req.method === "POST" && path === "dashboard-access")
      return send(
        res,
        200,
        await (async () => {
          const result = await setAccess(await bodyFrom(req), actor, services);
          storeFor(services).clear();
          require("./record-identities.cjs").clearIdentityCache(services);
          return result;
        })(),
      );
    if (req.method === "GET" && path === "records")
      return send(
        res,
        200,
        await cachedRead(services, actor, path, url.searchParams, 5000, () =>
          records(url.searchParams, actor, services),
        ),
      );
    if (req.method === "GET" && path === "resource-insights")
      return send(
        res,
        200,
        await cachedRead(services, actor, path, url.searchParams, 30000, () =>
          resourceInsights(url.searchParams, actor, services),
        ),
      );
    if (req.method === "GET" && path === "record") {
      const { name, resource, ref } = await resourceFor(
        url.searchParams,
        actor,
        services,
      );
      const id = resource.fixedId || url.searchParams.get("id");
      if (!safeId(id)) fail(400, "Invalid record ID.");
      const snap = await ref.doc(id).get();
      if (!snap.exists) fail(404, "Record not found.");
      const [row] = await enrichRecords(
        [
          projectRecord(
            snap.id,
            snap.data(),
            resource,
            actor.roles,
            actor.deniedResources,
          ),
        ],
        name,
        actor,
        services,
      );
      return send(res, 200, {
        ...row,
        source: ref.path + "/" + snap.id,
        version: fingerprint(row.data),
      });
    }
    if (req.method === "GET" && path === "website-insights") {
      allowResource(actor, "websiteInsights");
      return send(res, 200, await cachedRead(services, actor, path, url.searchParams, 60000, () => require('./site-metrics.cjs').readWebsiteInsights(url.searchParams, services)));
    }
    if (req.method === "GET" && path === "overview")
      return send(
        res,
        200,
        await cachedRead(services, actor, path, url.searchParams, 30000, () =>
          overview(url.searchParams, actor, services),
        ),
      );
    if (req.method === "GET" && path === "user-summary")
      return send(
        res,
        200,
        await cachedRead(services, actor, path, url.searchParams, 5000, () =>
          userSummary(url.searchParams, actor, services),
        ),
      );
    if (req.method === "GET" && path === "events-insights")
      return send(
        res,
        200,
        await cachedRead(services, actor, path, url.searchParams, 30000, () =>
          eventInsights(url.searchParams, actor, services),
        ),
      );
    if (req.method === "GET" && path === "treasury") {
      allowResource(actor, "treasury");
      requireRole(actor, ["super_admin", "finance"]);
      const result = await cachedRead(
        services,
        actor,
        path,
        url.searchParams,
        15000,
        () =>
          getTreasury({
            loadDocument: async (path) => {
              const snap = await services.db.doc(path).get();
              return snap.exists ? snap.data() : null;
            },
            fetchAccount: (id) =>
              readProvider("/financial-accounts/" + id + "?withBalance=true"),
            configuredAccountId:
              process.env.MONIME_MAIN_FINANCIAL_ACCOUNT_ID ||
              services.config.monimeMainFinancialAccountId,
          }),
      );
      return send(res, 200, result);
    }
    if (req.method === "GET" && path === "accounts") {
      allowResource(actor, "treasury");
      requireRole(actor, ["super_admin", "finance"]);
      const result = await cachedRead(
        services,
        actor,
        path,
        url.searchParams,
        60000,
        () => readProvider("/financial-accounts?withBalance=true"),
      );
      const rows = Array.isArray(result) ? result : result.items || [];
      return send(res, 200, {
        accounts: rows
          .slice(0, 50)
          .filter((row) => row.currency === "SLE")
          .map((row) => ({
            id: row.id,
            name: row.name,
            uvan: row.uvan,
            currency: row.currency,
            availableMinor: row.balance?.available?.value,
          })),
        notice:
          "Accounts returned by the configured Monime Space; changing payment routing is a separate approved reconciliation workflow.",
      });
    }
    if (req.method === "GET" && path === "account") {
      allowResource(actor, "treasury");
      requireRole(actor, ["super_admin", "finance"]);
      const id = url.searchParams.get("id");
      if (!/^fac-[A-Za-z0-9-]+$/.test(id || ""))
        fail(400, "Invalid financial-account ID.");
      const account = await readProvider(
        "/financial-accounts/" + id + "?withBalance=true",
      );
      if (
        account.id !== id ||
        account.currency !== "SLE" ||
        account.balance?.available?.currency !== "SLE" ||
        !Number.isSafeInteger(account.balance.available.value)
      )
        fail(
          409,
          "Account identity, currency, or balance could not be verified.",
        );
      return send(res, 200, {
        id: account.id,
        name: account.name,
        uvan: account.uvan,
        currency: "SLE",
        availableMinor: account.balance.available.value,
        availableMajor: account.balance.available.value / 100,
        verifiedAt: new Date().toISOString(),
        environment: account.serverEnvironment || process.env.MONIME_ENV,
        selectionOnly: true,
      });
    }
    if (req.method === "GET" && path === "health") {
      allowResource(actor, "operationsHealth");
      return send(res, 200, {
        adminApi: VERSION,
        revision: process.env.K_REVISION || "local/unverified",
        appFunctions: services.config.liveInspection
          ? services.config.liveInspection.functionsCount +
            " deployed functions inspected on " +
            services.config.liveInspection.checkedOn +
            ". App source revision remains unverified."
          : "Live function metadata has not been inspected.",
        firestoreEdition:
          services.config.firestoreEdition ||
          "Database edition has not been inspected.",
        features: {
          spaces: "App-local localStorage toggle; no global backend switch.",
          skills: "App-local localStorage toggle; no global backend switch.",
        },
        financialActions:
          "Payout retry/refund and held-fund release are intentionally unavailable without approved server reconciliation.",
      });
    }
    if (req.method === "GET" && path === "reconcile") {
      allowResource(actor, "walletTransactions");
      requireRole(actor, ["super_admin", "finance"]);
      const id = url.searchParams.get("id");
      if (!safeId(id)) fail(400, "Invalid wallet operation ID.");
      const snap = await services.db.doc("walletTransactions/" + id).get();
      if (!snap.exists) fail(404, "Operation not found.");
      const data = snap.data();
      const references = [
        ["principal payout", data.monime?.payout?.id, "payouts"],
        [
          "principal transfer",
          data.monime?.transfer?.id || data.monime?.internalTransfer?.id,
          "internal-transfers",
        ],
        [
          "platform fee transfer",
          data.monime?.platformFeeTransfer?.id,
          "internal-transfers",
        ],
      ].filter(
        ([, id]) => typeof id === "string" && /^[A-Za-z0-9-]+$/.test(id),
      );
      const results = await Promise.allSettled(
        references.map(async ([kind, providerId, collection]) => {
          const value = await readProvider("/" + collection + "/" + providerId);
          return {
            kind,
            id: providerId,
            status: value.status || "unknown",
            failureDetail: sanitize(value.failureDetail),
            amount: value.amount,
          };
        }),
      );
      return send(res, 200, {
        id,
        providerChecks: results.map((result, i) =>
          result.status === "fulfilled"
            ? result.value
            : {
                kind: references[i][0],
                id: references[i][1],
                status: "unknown",
                error:
                  "Provider read unavailable; timeout is not proof of failure.",
              },
        ),
        notice: references.length
          ? "Read-only reconciliation. Principal and fee legs are separate; no retry/refund was executed."
          : "No supported provider reference found. Inspect linkage before authorising any correction.",
        checkedAt: new Date().toISOString(),
      });
    }
    if (req.method === "POST" && path === "actions")
      return send(
        res,
        200,
        await (async () => {
          const result = await mutation(await bodyFrom(req), actor, services);
          storeFor(services).clear();
          require("./record-identities.cjs").clearIdentityCache(services);
          return result;
        })(),
      );
    fail(
      405,
      "Endpoint or method is not supported. No arbitrary document editing is exposed.",
    );
  } catch (error) {
    send(res, error.status || 503, {
      error: safeMessage(error),
      status: error.status || 503,
    });
  }
}
module.exports = {
  handleAdmin,
  authorize,
  requireRole,
  records,
  rangeFrom,
  patchFor,
  mutation,
  safeMessage,
  overview,
  userSummary,
};
