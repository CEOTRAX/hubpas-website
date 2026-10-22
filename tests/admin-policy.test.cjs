const { test } = require("node:test"),
  assert = require("node:assert/strict");
const {
  sanitize,
  projectRecord,
  normalizeLinkage,
  cursorCodec,
  financialSummary,
} = require("../server/admin-policy.cjs");
const {
  patchFor,
  rangeFrom,
  handleAdmin,
  authorize,
} = require("../server/admin-api.cjs");
const { getTreasury } = require("../server/treasury-service.cjs");
test("credentials, PINs, QR payloads and private message bodies are excluded", async () => {
  const { RESOURCES } = await import("../dashboard-schema.mjs");
  const data = {
    displayName: "User",
    walletPinHash: "secret",
    wallet: {
      pinHash: "secret",
      monime: { financialAccountId: "fac-user", accessToken: "secret" },
    },
    password: "secret",
    phone: "+23276123456",
    email: "person@example.com",
  };
  const row = projectRecord("u", data, RESOURCES.users, ["finance"]);
  const body = JSON.stringify(row);
  assert.ok(!body.includes("secret"));
  assert.ok(!body.includes("person@example.com"));
  assert.ok(!body.includes("+23276123456"));
  assert.ok(body.includes("fac-user"));
  const chat = projectRecord(
    "c",
    {
      participantIds: ["a", "b"],
      updatedAt: "2026-10-01",
      lastMessage: { text: "private text" },
      text: "private text",
      location: { lat: 1 },
      token: "secret",
    },
    RESOURCES.privateChats,
    ["support"],
  );
  assert.ok(!JSON.stringify(chat).includes("private text"));
  assert.equal(chat.data.location, undefined);
  assert.equal(
    sanitize({ sipCredentials: { password: "x" }, qrCode: "admission-secret" })
      .qrCode,
    undefined,
  );
});
test("legacy literal dotted linkage is observed and conflicts are flagged without rewriting", () => {
  const data = {
    financialAccount: { accountId: "fac-one" },
    "wallet.financialAccount.accountId": "fac-two",
  };
  assert.deepEqual(normalizeLinkage(data), {
    accountIds: ["fac-one", "fac-two"],
    inconsistent: true,
    hasLegacyLiteralKeys: true,
  });
  assert.equal(data["wallet.financialAccount.accountId"], "fac-two");
});
test("financial metrics do not double-count transfer legs, topups, platform mirrors or reversals", () => {
  const row = (id, data) => ({
    id,
    data: { status: "completed", timestamp: "2026-10-02", ...data },
  });
  const result = financialSummary([
    row("out", {
      type: "transfer_out",
      userId: "a",
      transferId: "t",
      netAmount: 100,
    }),
    row("in", {
      type: "transfer_in",
      userId: "b",
      transferId: "t",
      netAmount: 100,
    }),
    row("repeat", {
      type: "transfer_out",
      userId: "a",
      transferId: "t",
      netAmount: 100,
    }),
    row("mirror", {
      type: "topup",
      userId: "hubpas",
      orderId: "o",
      amount: 500,
    }),
    row("fund", { type: "topup", userId: "a", orderId: "o", amount: 500 }),
    row("duplicate", { type: "topup", userId: "a", orderId: "o", amount: 500 }),
    row("payer", { type: "subscription", userId: "a", amount: -250 }),
    row("platform", { type: "subscription", userId: "hubpas", amount: 250 }),
    row("reverse", {
      type: "topup",
      userId: "a",
      amount: 500,
      status: "reversed",
    }),
    row("unknown", {
      type: "topup",
      userId: "a",
      amount: 300,
      status: undefined,
    }),
  ]);
  assert.equal(result.transferPrincipal, 100);
  assert.equal(result.funding, 500);
  assert.equal(result.subscriptionIncome, 250);
  assert.equal(result.reversed, 1);
  assert.equal(result.failed, 0);
  assert.equal(result.recordsWithUnconfirmedStatus, 1);
});
test("cursor signatures prevent tampering and expire", () => {
  const codec = cursorCodec("test-secret");
  const cursor = codec.encode({ uid: "a", expires: Date.now() + 10000 });
  assert.equal(codec.decode(cursor).uid, "a");
  assert.throws(() => codec.decode(cursor + "x"));
  assert.throws(() => codec.decode(codec.encode({ expires: 1 })));
});
test("range boundaries are UTC and include the selected last day", () => {
  const range = rangeFrom(
    new URLSearchParams({ from: "2026-10-01", to: "2026-10-31" }),
  );
  assert.equal(range.end.toISOString(), "2026-11-01T00:00:00.000Z");
  assert.throws(() =>
    rangeFrom(new URLSearchParams({ from: "2026-10-10", to: "2026-10-01" })),
  );
});
test("arbitrary balance changes and financial refunds are not mutation actions", () => {
  assert.throws(() => patchFor("wallet.setBalance", { balance: 999 }, {}));
  assert.throws(() => patchFor("withdrawal.retry", {}, {}));
  assert.deepEqual(patchFor("event.unpublish", {}, { status: "published" }), {
    status: "draft",
    publicOrPrivate: "private",
  });
  assert.throws(() => patchFor("event.unpublish", {}, { status: "draft" }));
  assert.throws(() =>
    patchFor("pricing.update", { prices: { withdrawalFee: 0 } }, {}),
  );
  assert.equal(
    patchFor(
      "pricing.update",
      { prices: { proMonthlyPriceMajor: 300 } },
      { adminVersion: 2 },
    ).adminVersion,
    3,
  );
});
function fakeServices(role, active = true) {
  return {
    auth: {
      verifyIdToken: async () => ({
        uid: "user",
        hubpasAdminActive: true,
        hubpasAdminRoles: role ? [role] : [],
      }),
    },
    db: {
      doc: (path) => ({
        get: async () => ({
          exists: path === "adminRoleAssignments/user",
          data: () => ({ active, roles: role ? [role] : [], isAdmin: true }),
        }),
      }),
    },
  };
}
const response = () => ({
  writeHead(status, headers) {
    this.status = status;
    this.headers = headers;
  },
  end(body) {
    this.body = JSON.parse(body);
  },
});
test("a client-editable profile admin flag does not grant dashboard access", async () => {
  const forged = fakeServices("finance");
  forged.auth.verifyIdToken = async () => ({ uid: "user" });
  await assert.rejects(
    () => authorize({ headers: { authorization: "Bearer valid" } }, forged),
    (error) => error.status === 403,
  );
  await assert.rejects(
    () =>
      authorize(
        { headers: { authorization: "Bearer valid" } },
        fakeServices(null),
      ),
    (error) => error.status === 403,
  );
  await assert.rejects(
    () =>
      authorize(
        { headers: { authorization: "Bearer valid" } },
        fakeServices("finance", false),
      ),
    (error) => error.status === 403,
  );
});
test("every privileged route rejects unauthenticated callers", async () => {
  for (const path of [
    "session",
    "records",
    "overview",
    "events-insights",
    "treasury",
    "accounts",
    "account",
    "health",
    "actions",
    "reconcile",
    "dashboard-access",
    "user-summary",
  ]) {
    const res = response();
    await handleAdmin(
      { headers: {}, url: "/api/admin/" + path, method: "GET" },
      res,
      fakeServices("super_admin"),
    );
    assert.equal(res.status, 401, path);
  }
});
test("support cannot inspect finance accounts or wallet operations", async () => {
  for (const path of [
    "treasury",
    "accounts",
    "records?resource=walletTransactions",
  ]) {
    const res = response();
    await handleAdmin(
      {
        headers: { authorization: "Bearer valid" },
        url: "/api/admin/" + path,
        method: "GET",
      },
      res,
      fakeServices("support"),
    );
    assert.equal(res.status, 403, path);
  }
});
test("analyst cannot mutate and cannot select arbitrary collections", async () => {
  const denied = response();
  await handleAdmin(
    {
      headers: { authorization: "Bearer valid" },
      url: "/api/admin/actions",
      method: "POST",
      body: {
        action: "event.unpublish",
        id: "e",
        reason: "Valid reason",
        correlationId: "x",
      },
    },
    denied,
    fakeServices("analyst"),
  );
  assert.equal(denied.status, 403);
  const arbitrary = response();
  await handleAdmin(
    {
      headers: { authorization: "Bearer valid" },
      url: "/api/admin/records?resource=sipCredentials",
      method: "GET",
    },
    arbitrary,
    fakeServices("finance"),
  );
  assert.equal(arbitrary.status, 400);
});
test("main ledger and minor-unit provider balance stay separate; conflicts block provider calls", async () => {
  let calls = 0;
  const docs = {
    "platform/treasury": {
      balance: 48520,
      monimeFinancialAccountId: "fac-main",
    },
    "wallet/hubpas": {
      walletBalance: 48520,
      financialAccount: { accountId: "fac-main" },
    },
    "users/hubpas": {
      walletBalance: 48520,
      monimeFinancialAccountId: "fac-main",
    },
  };
  const options = {
    loadDocument: async (path) => docs[path],
    configuredAccountId: "fac-main",
    fetchAccount: async (id) => {
      calls++;
      return {
        id,
        name: "Main",
        uvan: "123",
        currency: "SLE",
        balance: { available: { currency: "SLE", value: 4728012 } },
      };
    },
  };
  const result = await getTreasury(options);
  assert.equal(result.ledger.balanceMajor, 48520);
  assert.equal(result.provider.availableMinor, 4728012);
  assert.equal(result.provider.availableMajor, 47280.12);
  assert.equal(result.provider.uvan, "123");
  docs["users/hubpas"].monimeFinancialAccountId = "fac-conflict";
  const blocked = await getTreasury(options);
  assert.equal(blocked.provider.availableMajor, null);
  assert.equal(calls, 1);
  assert.match(blocked.configuration.warnings.join(" "), /Conflicting/);
});

test("missing treasury reference is labelled verified only after a matching SLE provider response", async () => {
  const { resolveTreasuryConfig } = require("../server/treasury-config.cjs");
  const id = resolveTreasuryConfig().candidateId;
  const options = {
    loadDocument: async (path) =>
      path === "platform/treasury" ? { balance: 20 } : {},
    configuredAccountId: id,
    fetchAccount: async () => ({
      id,
      currency: "SLE",
      serverEnvironment: "live",
      balance: { available: { currency: "SLE", value: 1250 } },
    }),
  };
  const result = await getTreasury(options);
  assert.equal(result.provider.availableMajor, 12.5);
  assert.equal(result.provider.environment, "live");
  assert.equal(result.configuration.warnings.length, 0);
  assert.match(result.configuration.source, /Verified server/);
  assert.match(result.configuration.notes[0], /not changed/);
  const failed = await getTreasury({
    ...options,
    fetchAccount: async () => ({
      id: "fac-wrong",
      balance: { available: { currency: "SLE", value: 1250 } },
    }),
  });
  assert.equal(failed.provider.verifiedAccountId, null);
  assert.match(failed.configuration.warnings.join(" "), /unverified/);
});

test('finance activity separates platform charges, commission and principal without counting provider fees or transfer mirrors',()=>{
 const rows=[
  {id:'w',data:{userId:'customer',type:'withdrawal',status:'completed',netAmount:55,feeAmount:1.65,metadata:{platformFeeAmountMajor:1.1}}},
  {id:'s',data:{userId:'customer',type:'transfer_out',status:'completed',transferId:'t',netAmount:200,feeAmount:4}},
  {id:'r',data:{userId:'other',type:'transfer_in',status:'completed',transferId:'t',netAmount:200}},
  {id:'buy',data:{userId:'customer',type:'ticket_purchase',status:'paid',amount:75}},
  {id:'sale',data:{userId:'host',type:'ticket_sale',status:'completed',amount:70,feeAmount:5}},
  {id:'failed',data:{userId:'customer',type:'withdrawal',status:'failed',netAmount:500,metadata:{platformFeeAmountMajor:10}}}
 ];
 const result=financialSummary(rows);
 assert.equal(result.recordedPlatformCharges,5.1);assert.equal(result.recordedCommission,5);assert.equal(result.transactionVolume,330);assert.equal(result.transactionCount,6);assert.equal(result.failed,1);
});
