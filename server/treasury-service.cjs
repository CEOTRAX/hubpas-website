// Read-only service. Supply existing server-held Monime configuration through
// the adapter; no access token or raw provider response is returned to clients.
async function getTreasury({
  loadDocument,
  fetchAccount,
  configuredAccountId,
}) {
  const { resolveTreasuryConfig } = require("./treasury-config.cjs");
  const paths = ["platform/treasury", "wallet/hubpas", "users/hubpas"];
  const results = await Promise.allSettled(paths.map(loadDocument));
  const docs = results.map((result) =>
    result.status === "fulfilled" ? result.value || {} : {},
  );
  const config = resolveTreasuryConfig(...docs);
  results.forEach((result, index) => {
    if (result.status === "rejected")
      config.warnings.push(
        "Unable to inspect " +
          paths[index] +
          ". Account verification is incomplete.",
      );
  });
  const raw = docs[0].balance;
  const ledgerBalance =
    raw != null && raw !== "" && Number.isFinite(Number(raw))
      ? Number(raw)
      : null;
  if (ledgerBalance === null)
    config.warnings.push("Internal treasury ledger balance is unavailable.");
  const result = {
    ledger: {
      path: "platform/treasury",
      field: "balance",
      balanceMajor: ledgerBalance,
      currency: "SLE",
      counters: Object.fromEntries(
        [
          "withdrawalFees",
          "ticketSalesFees",
          "raffleFees",
          "boostRevenue",
          "subscriptionRevenue",
        ].map((key) => [
          key,
          typeof docs[0][key] === "number" && Number.isFinite(docs[0][key])
            ? docs[0][key]
            : null,
        ]),
      ),
    },
    provider: {
      availableMajor: null,
      currency: "SLE",
      verifiedAccountId: null,
    },
    configuration: config,
    fetchedAt: new Date().toISOString(),
  };
  if (!configuredAccountId) {
    config.warnings.push(
      "The server main-account ID is not configured; live Monime verification is unavailable.",
    );
    return result;
  }
  if (config.candidateId !== configuredAccountId) {
    config.warnings.push(
      "The treasury account does not match the server-configured main Monime account.",
    );
    return result;
  }
  if (
    config.warnings.some((warning) =>
      /Conflicting|invalid|incomplete/.test(warning),
    )
  )
    return result;
  try {
    const account = await fetchAccount(configuredAccountId);
    if (account.id !== configuredAccountId)
      throw new Error("Monime returned a different account ID.");
    const available = account.balance?.available;
    if (
      available?.currency !== "SLE" ||
      (account.currency && account.currency !== "SLE")
    )
      throw new Error("Monime returned a currency other than SLE.");
    if (!Number.isSafeInteger(available.value))
      throw new Error(
        "Monime available balance is not a valid minor-unit value.",
      );
    result.provider = {
      availableMajor: available.value / 100,
      availableMinor: available.value,
      currency: "SLE",
      verifiedAccountId: account.id,
      environment: account.serverEnvironment || null,
      accountName: account.name || null,
      uvan: account.uvan || null,
    };
    if (config.source === "Unverified source-code fallback") {
      config.warnings = config.warnings.filter(
        (warning) => !warning.startsWith("Treasury account ID is missing."),
      );
      config.source =
        "Verified server configuration (Firestore reference absent)";
      config.notes = [
        "Treasury account reference is absent in Firestore. The server-configured account was verified in Monime. Payment routing and database configuration were not changed.",
      ];
      config.references.push({
        source: "Server main-account configuration · Monime verified",
        id: account.id,
      });
    }
  } catch (error) {
    config.warnings.push(
      error.message || "Live Monime account verification failed.",
    );
  }
  return result;
}
module.exports = { getTreasury };
