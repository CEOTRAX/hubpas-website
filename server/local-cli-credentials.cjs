// Development-only adapter. Reuses the explicit signed-in CLI account in memory;
// never writes credentials, returns them to HTTP clients, or loads in Cloud Functions.
const path = require("node:path");
function localCliCredentials() {
  if (
    process.env.K_SERVICE ||
    process.env.HUBPAS_LOCAL_SERVER !== "true" ||
    !process.env.FIREBASE_TOOLS_DIR ||
    !process.env.FIREBASE_CLI_ACCOUNT
  )
    return null;
  try {
    const auth = require(
      path.join(process.env.FIREBASE_TOOLS_DIR, "lib", "auth.js"),
    );
    const api = require(
      path.join(process.env.FIREBASE_TOOLS_DIR, "lib", "api.js"),
    );
    const account = auth
      .getAllAccounts()
      .find((a) => a.user.email === process.env.FIREBASE_CLI_ACCOUNT);
    if (!account?.tokens?.refresh_token)
      throw new Error("No signed-in account");
    return {
      type: "authorized_user",
      client_id: api.clientId(),
      client_secret: api.clientSecret(),
      refresh_token: account.tokens.refresh_token,
    };
  } catch {
    const error = new Error(
      "The configured local Firebase CLI account is unavailable. Complete Firebase login for that account.",
    );
    error.status = 503;
    throw error;
  }
}
module.exports = { localCliCredentials };
