function resolveTreasuryConfig(treasury = {}, wallet = {}, user = {}) {
  const references = [
    [
      "platform/treasury.monimeFinancialAccountId",
      treasury.monimeFinancialAccountId,
    ],
    [
      "platform/treasury.mainFinancialAccountId",
      treasury.mainFinancialAccountId,
    ],
    [
      "wallet/hubpas.financialAccount.accountId",
      wallet.financialAccount?.accountId,
    ],
    [
      "users/hubpas.wallet.monime.financialAccountId",
      user.wallet?.monime?.financialAccountId,
    ],
    ["users/hubpas.monimeFinancialAccountId", user.monimeFinancialAccountId],
    [
      "wallet/hubpas literal financialAccount.accountId",
      wallet["financialAccount.accountId"],
    ],
    [
      "wallet/hubpas literal wallet.financialAccount.accountId",
      wallet["wallet.financialAccount.accountId"],
    ],
    [
      "users/hubpas literal wallet.monime.financialAccountId",
      user["wallet.monime.financialAccountId"],
    ],
  ]
    .filter(([, value]) => typeof value === "string" && value.trim())
    .map(([source, value]) => ({ source, id: value.trim() }));
  const preferred = references.find((ref) =>
    ref.source.startsWith("platform/treasury."),
  );
  const fallbackId = "fac-k6PFYiMj6XJuRpwRF4K73mqKpBJ";
  const candidateId = preferred?.id || fallbackId;
  const warnings = [];
  if (!preferred)
    warnings.push(
      "Treasury account ID is missing. Source-code fallback is unverified and is not automatically selected.",
    );
  if (new Set([candidateId, ...references.map((ref) => ref.id)]).size > 1)
    warnings.push(
      "Conflicting Monime account IDs were found across treasury and subscription records.",
    );
  if (!/^fac-[A-Za-z0-9-]+$/.test(candidateId))
    warnings.push("The treasury financial-account ID has an invalid format.");
  return {
    candidateId,
    source: preferred?.source || "Unverified source-code fallback",
    references,
    warnings,
  };
}


module.exports={resolveTreasuryConfig};
