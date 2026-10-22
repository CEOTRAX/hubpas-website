const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path");
const { JSDOM } = require("../server/node_modules/jsdom");
test("preview navigates every module, shows separate treasury and metadata, and never calls the backend", async () => {
  const dom = new JSDOM(
    fs.readFileSync(path.join(__dirname, "../admin.html"), "utf8"),
    { url: "http://127.0.0.1:8080/admin.html?preview=1" },
  );
  global.document = dom.window.document;
  global.location = dom.window.location;
  global.__HUBPAS_TEST__ = true;
  const { mountDashboard } = await import("../admin-console.mjs");
  let calls = 0;
  const app = await mountDashboard({
    forcePreview: true,
    fetcher: () => {
      calls++;
      throw new Error("Preview must not fetch live data");
    },
  });
  assert.equal(document.getElementById("app").hidden, false);
  assert.match(document.getElementById("notice").textContent, /PREVIEW/);
  await app.openModule("wallets");
  assert.match(document.getElementById("table").textContent, /Customer/);
  assert.match(
    document.getElementById("table").textContent,
    /Withdrawal|Money sent/,
  );
  assert.doesNotMatch(
    document.getElementById("table").textContent,
    /demo-withdrawal|demo-transfer|userId|"payout"/,
  );
  document.querySelector("[data-open]").click();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(document.getElementById("technical-info").open, false);
  assert.doesNotMatch(
    document.getElementById("detail-fields").textContent,
    /"payout"|po-example/,
  );
  document.getElementById("close-detail").click();
  for (const module of [
    "website",
    "users",
    "wallets",
    "events",
    "venues",
    "skills",
    "subscriptions",
    "community",
    "moderation",
    "operations",
    "treasury",
    "overview",
  ]) {
    await app.openModule(module);
    if(module==='website') {
      assert.equal(document.getElementById('website-insights').hidden,false);
      assert.match(document.getElementById('website-insights').textContent,/Android download clicks/);
      assert.match(document.getElementById('website-insights').textContent,/Daily activity/);
      assert.doesNotMatch(document.getElementById('website-insights').textContent,/could not load/);
    }
    assert.equal(
      document.getElementById("page-title").textContent.length > 0,
      true,
      module,
    );
  }
  await app.openModule("events");
  assert.equal(document.querySelectorAll(".day").length, 42);
  assert.equal(document.querySelectorAll(".calendar-event").length, 3);
  document.getElementById("period").value = "last-month";
  await app.loadEvents();
  assert.equal(document.querySelectorAll(".calendar-event").length, 0);
  document.getElementById("period").value = "this-month";
  await app.loadEvents();
  const record = document.querySelector("[data-open]");
  record.click();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(document.getElementById("dialog").hidden, false);
  assert.equal(document.getElementById("detail-actions").children.length, 0);
  document.getElementById("close-detail").click();
  assert.equal(document.getElementById("dialog").hidden, true);
  await app.openModule("users");
  assert.match(document.getElementById("table").textContent, /wallet balance/i);
  document.querySelector("[data-open]").click();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(document.getElementById("user-profile-view").hidden, false);
  assert.equal(document.getElementById("detail-page").hidden, false);
  assert.equal(
    document.getElementById("dialog").parentElement.id,
    "detail-page",
  );
  assert.equal(
    document.querySelector("#dialog .dialog-card").getAttribute("aria-modal"),
    null,
  );
  document.querySelector('[data-related="followers"]').click();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(document.getElementById("records").hidden, false);
  assert.equal(document.getElementById("detail-page").hidden, true);
  assert.equal(app.state.resource, "followers");
  document.getElementById("related-back").click();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(document.getElementById("detail-page").hidden, false);
  assert.equal(app.state.resource, "users");
  assert.match(
    document.getElementById("user-profile-view").textContent,
    /Current wallet balance/,
  );
  assert.match(
    document.getElementById("user-profile-view").textContent,
    /Recent wallet activity/,
  );
  [...document.getElementById("detail-actions").querySelectorAll("button")]
    .find((button) => button.textContent === "Manage dashboard access")
    .click();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(document.getElementById("access-form").hidden, false);
  assert.equal(document.querySelectorAll('[data-permission="role"]').length, 5);
  assert.equal(document.getElementById("save-access").disabled, true);
  assert.equal(document.getElementById("live-signin").hidden, false);
  document.getElementById("close-detail").click();
  await app.openModule("community");
  assert.match(
    document.getElementById("workflow-note").textContent,
    /Metadata/,
  );
  await app.openModule("treasury");
  assert.match(document.getElementById("treasury").textContent, /48,520.00/);
  assert.match(document.getElementById("treasury").textContent, /47,280.00/);
  assert.match(document.getElementById("treasury").textContent, /Example/);
  await assert.rejects(
    () =>
      app.api("actions", new URLSearchParams(), "POST", { action: "anything" }),
    /disabled/,
  );
  assert.equal(calls, 0);
  assert.equal(document.querySelector('[name="pin"]'), null);
  dom.window.close();
  delete global.document;
  delete global.location;
});
