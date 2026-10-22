// Bound access-check latency without caching a user's permission or revocation state.
function within(promise, milliseconds, message) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(
        () => reject(Object.assign(new Error(message), { status: 503 })),
        milliseconds,
      );
    }),
  ]).finally(() => clearTimeout(timer));
}
async function verifySession(auth, token, revoked) {
  try {
    return await auth.verifyIdToken(token, revoked);
  } catch (error) {
    if (
      /^auth\/(id-token-expired|id-token-revoked|invalid-id-token|argument-error|user-disabled|user-not-found)$/.test(
        error.code || "",
      )
    )
      throw Object.assign(
        new Error("Firebase session is invalid or revoked."),
        { status: 401 },
      );
    throw Object.assign(
      new Error(
        "Firebase access verification is temporarily unavailable. Retry dashboard access.",
      ),
      { status: 503 },
    );
  }
}
// Coalesce only requests that overlap in time. Completed checks are discarded:
// every subsequent request still obtains current revocation and role state.
const inFlight = new WeakMap();
function checkAccess(token, services) {
  let checks = inFlight.get(services);
  if (!checks) {
    checks = new Map();
    inFlight.set(services, checks);
  }
  if (checks.has(token)) return checks.get(token);
  const pending = runAccessCheck(token, services);
  checks.set(token, pending);
  pending.finally(() => {
    if (checks.get(token) === pending) checks.delete(token);
  }).catch(() => {});
  return pending;
}
async function runAccessCheck(token, services) {
  const active = new Set();
  const step = async (name, run) => {
    active.add(name);
    const start = Date.now();
    try {
      return await run();
    } finally {
      active.delete(name);
      services.traceAccess?.({ step: name, milliseconds: Date.now() - start });
    }
  };
  return within(
    (async () => {
      // Verify signature, issuer and audience before using the UID in any database lookup.
      const signed = await step("token-signature", () =>
        verifySession(services.auth, token, false),
      );
      // Firebase's full revocation/disabled check and the current Firestore assignment
      // are independent once the token signature is valid. No access is returned
      // until BOTH have succeeded.
      const [identity, assignment] = await Promise.all([
        step("session-revocation", () =>
          verifySession(services.auth, token, true),
        ),
        step("current-permissions", () =>
          services.readAssignment
            ? services.readAssignment(signed.uid)
            : services.db.doc("adminRoleAssignments/" + signed.uid).get(),
        ),
      ]);
      return { identity, assignment };
    })(),
    16000,
    "Dashboard access verification took too long. Retry dashboard access; no permissions were granted.",
  ).catch((error) => {
    services.traceAccess?.({
      step: "access-failed",
      pending: [...active],
      status: error.status || 503,
    });
    throw error;
  });
}
module.exports = { within, checkAccess };
