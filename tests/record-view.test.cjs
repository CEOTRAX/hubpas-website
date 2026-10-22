const { test } = require("node:test"),
  assert = require("node:assert/strict");
const { enrichRecords } = require("../server/record-identities.cjs");
test("staff identity lookup is bounded, masked and leaves financial records untouched", async () => {
  let requested;
  const services = {
    db: {
      doc: (path) => ({ path }),
      getAll: async (...args) => {
        requested = args;
        return [
          {
            id: "customer",
            exists: true,
            data: () => ({
              displayName: "Mariama Kamara",
              email: "mariama@example.com",
              phone: "+23276123456",
              walletPinHash: "never-export",
            }),
          },
        ];
      },
    },
  };
  const row = {
    id: "payment",
    data: { userId: "customer", amount: 55, type: "withdrawal" },
  };
  const [result] = await enrichRecords(
    [row, row],
    "walletTransactions",
    { roles: ["finance"] },
    services,
  );
  assert.equal(requested.length, 2);
  assert.deepEqual(requested[1].fieldMask, [
    "displayName",
    "name",
    "username",
    "email",
    "phone",
  ]);
  assert.equal(result.people.userId.name, "Mariama Kamara");
  assert.equal(result.people.userId.phone, "••••3456");
  assert.equal(result.people.userId.email, "m***@example.com");
  assert.equal(result.data, row.data);
  assert.ok(!JSON.stringify(result).includes("never-export"));
  requested = null;
  await enrichRecords(
    [row],
    "walletTransactions",
    { roles: ["finance"], deniedResources: ["users"] },
    services,
  );
  assert.equal(requested, null);
});
test("wallet presentation uses human labels, dates and recorded SLE values without guessing success", async () => {
  const view = await import("../record-view.mjs");
  const row = {
    data: { type: "transfer_out", amount: 204, feeAmount: 4, status: null },
    people: { userId: { name: "Mariama" } },
  };
  assert.equal(view.displayCell(row, "type"), "Money sent");
  assert.equal(view.personFor(row, "userId").name, "Mariama");
  assert.match(view.displayCell(row, "amount"), /204/);
  assert.equal(view.readable("status", null), "Not recorded");
  assert.match(
    view.readable("createdAt", "2026-10-11T10:00:00Z"),
    /11 Oct 2026/,
  );
  assert.doesNotMatch(
    view.readable("subscription", { plan: "pro", status: "active" }),
    /[{}"]|plan:/,
  );
});
