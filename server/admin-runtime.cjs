const config = require("./config.json");
let services;
function runtime() {
  if (services) return services;
  const cliCredentials =
    require("./local-cli-credentials.cjs").localCliCredentials();
  if (
    process.env.HUBPAS_LOCAL_SERVER === "true" &&
    !process.env.GOOGLE_APPLICATION_CREDENTIALS &&
    !cliCredentials
  ) {
    const path = require("node:path"),
      fs = require("node:fs"),
      os = require("node:os");
    const root =
      process.env.CLOUDSDK_CONFIG ||
      (process.env.APPDATA
        ? path.join(process.env.APPDATA, "gcloud")
        : path.join(os.homedir(), ".config", "gcloud"));
    if (
      !fs.existsSync(path.join(root, "application_default_credentials.json"))
    ) {
      const error = new Error(
        "The local admin server has no Firebase Admin credentials. Browser sign-in cannot open the dashboard until server access to dmap-50136 is configured.",
      );
      error.status = 503;
      throw error;
    }
  }
  const {
    getApps,
    initializeApp,
    applicationDefault,
    refreshToken,
  } = require("firebase-admin/app");
  const { getAuth } = require("firebase-admin/auth");
  const {
    getFirestore,
    FieldPath,
    FieldValue,
    AggregateField,
  } = require("firebase-admin/firestore");
  const app =
    getApps().find((app) => app.name === "hubpas-admin") ||
    initializeApp(
      {
        credential: cliCredentials
          ? require("./server-credential.cjs").sharedCredential(
              refreshToken(cliCredentials),
            )
          : applicationDefault(),
        projectId: config.firebaseProjectId,
      },
      "hubpas-admin",
    );
  services = {
    db: cliCredentials
      ? new (require("@google-cloud/firestore").Firestore)({
          projectId: config.firebaseProjectId,
          credentials: cliCredentials,
          preferRest: true,
        })
      : getFirestore(app),
    auth: getAuth(app),
    FieldPath,
    FieldValue,
    AggregateField,
    config,
    ...(process.env.HUBPAS_LOCAL_SERVER === "true"
      ? {
          traceAccess: (trace) =>
            console.log(
              JSON.stringify({ event: "dashboard-access", ...trace }),
            ),
        }
      : {}),
  };
  if (process.env.HUBPAS_LOCAL_SERVER === "true")
    services.readAssignment =
      require("./local-assignment-reader.cjs").assignmentReader(services);
  return services;
}
async function providerGet(path) {
  if (
    !/^\/(financial-accounts|payouts|internal-transfers)(\/[A-Za-z0-9-]+)?(\?withBalance=true)?$/.test(
      path,
    )
  )
    throw new Error("Unsupported provider read.");
  const credentials =
    await require("./monime-credentials.cjs").monimeCredentials(runtime());
  const response = await fetch("https://api.monime.io/v1" + path, {
    headers: {
      Authorization: "Bearer " + credentials.token,
      "Monime-Space-Id": credentials.space,
      "Monime-Version": process.env.MONIME_VERSION || "caph.2025-08-23",
    },
    redirect: "error",
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok)
    throw new Error("Provider read unavailable (" + response.status + ").");
  const body = await response.json();
  if (!body.success || !body.result)
    throw new Error("Invalid provider response.");
  return Array.isArray(body.result)
    ? body.result
    : { ...body.result, serverEnvironment: credentials.environment };
}
module.exports = { runtime, providerGet };
