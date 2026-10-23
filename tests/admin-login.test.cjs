const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { JSDOM } = require("../server/node_modules/jsdom");
test("sign-in shows server failures and retries the same account without needing an auth-state event", async () => {
  const dom = new JSDOM(
    fs.readFileSync(
      require("node:path").join(__dirname, "../admin.html"),
      "utf8",
    ),
    { url: "http://127.0.0.1:8080/admin.html" },
  );
  global.document = dom.window.document;
  global.location = dom.window.location;
  global.__HUBPAS_TEST__ = true;
  const { mountDashboard } = await import("../admin-console.mjs");
  const user = { uid: "owner", getIdToken: async () => "test-token" };
  let attempts = 0,
    sessionReads = 0,
    allow = false,
    failAuth = false,
    timeout = false;
  const sdk = [
    { initializeApp: () => ({}) },
    {
      getAuth: () => ({}),
      onAuthStateChanged: (_auth, callback) => {
        callback(user);
      },
      signOut: async () => {},
      signInWithEmailAndPassword: async () => {
        attempts++;
        if (failAuth) throw new Error("Invalid account password");
        return { user };
      },
      signInWithCustomToken: async () => ({ user }),
    },
  ];
  await mountDashboard({
    authLoader: async () => sdk,
    fetcher: async (url) => {
      if (url.endsWith("/session")) {
        sessionReads++;
        if (timeout)
          throw Object.assign(new Error("signal timed out"), {
            name: "TimeoutError",
          });
        return {
          ok: allow,
          status: allow ? 200 : 503,
          json: async () =>
            allow
              ? {
                  uid: "owner",
                  roles: ["super_admin"],
                  resources: ["users"],
                  actions: [],
                  version: "test",
                }
              : {
                  error:
                    "Local admin server has no Firebase Admin credentials.",
                },
        };
      }
      return {
        ok: true,
        json: async () => ({
          cards: [],
          errors: [],
          limited: false,
          coverage: "test",
          asOf: "test",
        }),
      };
    },
  });
  const form = document.getElementById("login-form"),
    submit = document.getElementById("login-submit");
  assert.equal(submit.disabled, false);
  assert.equal(sessionReads, 0);
  assert.equal(document.getElementById("app").hidden, true);
  assert.match(
    document.getElementById("login-status").textContent,
    /do not open.*automatically/,
  );
  await form.onsubmit({ preventDefault() {} });
  assert.equal(document.getElementById("login-error").hidden, false);
  assert.match(
    document.getElementById("login-error").textContent,
    /Signed in successfully.*credentials/,
  );
  assert.equal(document.getElementById("app").hidden, true);
  assert.equal(submit.disabled, false);
  assert.equal(submit.textContent, "Retry dashboard");
  timeout = true;
  await form.onsubmit({ preventDefault() {} });
  assert.equal(attempts, 1);
  assert.match(
    document.getElementById("login-error").textContent,
    /Select Retry dashboard/,
  );
  assert.doesNotMatch(
    document.getElementById("login-error").textContent,
    /signal timed out/,
  );
  timeout = false;
  allow = true;
  await form.onsubmit({ preventDefault() {} });
  assert.equal(attempts, 1);
  assert.equal(sessionReads, 3);
  assert.equal(document.getElementById("app").hidden, false);
  assert.equal(document.getElementById("login").hidden, true);
  failAuth = true;
  await form.onsubmit({ preventDefault() {} });
  assert.match(
    document.getElementById("login-error").textContent,
    /Invalid account password/,
  );
  assert.doesNotMatch(
    document.getElementById("login-error").textContent,
    /Signed in successfully/,
  );
  dom.window.close();
  delete global.document;
  delete global.location;
});

test("an old preview URL opens real sign-in without sample dashboard data", async () => {
  const dom = new JSDOM(
    fs.readFileSync(require("node:path").join(__dirname, "../admin.html"), "utf8"),
    { url: "http://127.0.0.1:8080/admin.html?preview=1" },
  );
  global.document = dom.window.document;
  global.location = dom.window.location;
  global.history = dom.window.history;
  global.__HUBPAS_TEST__ = true;
  let authLoads = 0;
  const { mountDashboard } = await import("../admin-console.mjs");
  await mountDashboard({
    authLoader: async () => {
      authLoads++;
      return [
        { initializeApp: () => ({}) },
        {
          getAuth: () => ({}),
          onAuthStateChanged: (_auth, callback) => callback(null),
          signOut: async () => {},
          signInWithEmailAndPassword: async () => {},
          signInWithCustomToken: async () => {},
        },
      ];
    },
    fetcher: () => { throw new Error("No admin request before sign-in"); },
  });
  assert.equal(authLoads, 1);
  assert.equal(dom.window.location.search, "");
  assert.equal(document.getElementById("app").hidden, true);
  assert.equal(document.getElementById("login").hidden, false);
  assert.doesNotMatch(document.body.textContent, /Mariama Kamara|248 example registrations/);
  dom.window.close();
  delete global.document;
  delete global.location;
  delete global.history;
});
