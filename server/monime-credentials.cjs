// Secret payloads stay in server memory. Local development reuses the pinned
// Secret Manager versions bound to the inspected production payment function.
const fs = require("node:fs"),
  path = require("node:path");
let cached, pending;
function environment(value) {
  if (["live", "prod", "production"].includes(value)) return "live";
  if (["test", "sandbox"].includes(value)) return "test";
  throw new Error(
    "Monime environment must be configured as production/live or test before verification.",
  );
}
async function monimeCredentials(
  services,
  { fetcher = fetch, now = Date.now, loadConfig } = {},
) {
  if (process.env.MONIME_ACCESS_TOKEN && process.env.MONIME_SPACE_ID)
    return {
      token: process.env.MONIME_ACCESS_TOKEN,
      space: process.env.MONIME_SPACE_ID,
      environment: environment(process.env.MONIME_ENV),
    };
  if (process.env.HUBPAS_LOCAL_SERVER !== "true" || process.env.K_SERVICE)
    throw new Error(
      "Existing server-held Monime credentials are not available.",
    );
  const configPath = path.join(__dirname, "local-config.json");
  const local = loadConfig
    ? loadConfig()
    : fs.existsSync(configPath)
      ? JSON.parse(fs.readFileSync(configPath, "utf8"))
      : {};
  const refs = local.monimeSecrets;
  if (
    !refs ||
    !/^\d+$/.test(String(refs.accessTokenVersion)) ||
    !/^\d+$/.test(String(refs.spaceIdVersion))
  )
    throw new Error(
      "Existing server-held Monime credentials are not configured for this local server.",
    );
  const env = environment(local.monimeEnvironment);
  const key =
    services.config.firebaseProjectId +
    ":" +
    refs.accessTokenVersion +
    ":" +
    refs.spaceIdVersion +
    ":" +
    env;
  if (cached?.key === key && cached.expires > now()) return cached.value;
  if (pending?.key === key) return pending.promise;
  const promise = (async () => {
    const access = await services.auth.app.options.credential.getAccessToken();
    const read = async (name, version) => {
      const response = await fetcher(
        "https://secretmanager.googleapis.com/v1/projects/" +
          services.config.firebaseProjectId +
          "/secrets/" +
          name +
          "/versions/" +
          version +
          ":access",
        {
          headers: { Authorization: "Bearer " + access.access_token },
          redirect: "error",
          signal: AbortSignal.timeout(10000),
        },
      );
      if (!response.ok)
        throw new Error(
          "Monime secret access unavailable (HTTP " +
            response.status +
            "). Check server Secret Manager permissions.",
        );
      const body = await response.json();
      if (typeof body.payload?.data !== "string")
        throw new Error("Invalid Monime secret payload.");
      const value = Buffer.from(body.payload.data, "base64")
        .toString("utf8")
        .trim();
      if (!value) throw new Error("The configured Monime secret is empty.");
      return value;
    };
    const [token, space] = await Promise.all([
      read("MONIME_ACCESS_TOKEN", refs.accessTokenVersion),
      read("MONIME_SPACE_ID", refs.spaceIdVersion),
    ]);
    const value = { token, space, environment: env };
    cached = { key, value, expires: now() + 300000 };
    return value;
  })();
  pending = { key, promise };
  try {
    return await promise;
  } finally {
    if (pending?.promise === promise) pending = null;
  }
}
module.exports = { monimeCredentials, environment };
