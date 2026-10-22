const crypto = require("node:crypto");
const safeId = (value) =>
  typeof value === "string" && /^[A-Za-z0-9_:@.-]{1,160}$/.test(value);
const forbidden =
  /pin|password|secret|token|biometric|sip|qrCode|rawBody|payload|signature|authorization|cookie|headers|credential|privateKey|^body$|^raw$/i;
function fail(status, message) {
  const error = new Error(message);
  error.status = status;
  throw error;
}
function sanitize(value, roles = [], key = "", depth = 0) {
  if (forbidden.test(key)) return undefined;
  if (depth > 8) return "[Nested data omitted]";
  if (value == null || typeof value !== "object") {
    if (typeof value === "string") {
      if (/email/i.test(key)) return value.replace(/^(.).+(@.*)$/, "$1***$2");
      if (/phone|accountNumber/i.test(key))
        return value.length > 4 ? "••••" + value.slice(-4) : "••••";
      return value
        .replace(
          /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,
          (email) => email[0] + "***" + email.slice(email.indexOf("@")),
        )
        .replace(
          /\+232[\d -]{8,16}/g,
          (phone) => "••••" + phone.replace(/\D/g, "").slice(-4),
        )
        .slice(0, 2000);
    }
    return value;
  }
  if (typeof value.toDate === "function") return value.toDate().toISOString();
  if (typeof value.path === "string" && value.firestore) return value.path;
  if (Array.isArray(value))
    return value
      .slice(0, 200)
      .map((item) => sanitize(item, roles, key, depth + 1));
  return Object.fromEntries(
    Object.entries(value)
      .map(([name, item]) => [name, sanitize(item, roles, name, depth + 1)])
      .filter(([, item]) => item !== undefined),
  );
}
function projectRecord(id, data, resource, roles, deniedResources = []) {
  const allowed = {};
  for (const field of resource.fields)
    if (Object.hasOwn(data, field)) allowed[field] = data[field];
  // Metadata endpoints never expose message bodies, attachments or location.
  if (resource.privateMetadata)
    for (const key of [
      "text",
      "message",
      "lastMessage",
      "mediaUrl",
      "location",
      "fullAddress",
      "description",
    ])
      delete allowed[key];
  if (
    (!roles.includes("finance") && !roles.includes("super_admin")) ||
    (resource.collection === "users" && deniedResources.includes("wallet"))
  )
    for (const key of [
      "wallet",
      "financialAccount",
      "monimeFinancialAccountId",
      "monimeUvan",
      "walletBalance",
      "walletHeldBalance",
      "monime",
    ])
      delete allowed[key];
  const linkage = normalizeLinkage(data);
  return {
    id,
    data: sanitize(allowed, roles),
    ...(!deniedResources.includes("wallet") &&
    roles.some((role) => ["finance", "super_admin"].includes(role)) &&
    ["wallet", "users"].includes(resource.collection)
      ? { linkage }
      : {}),
  };
}
function normalizeLinkage(data = {}) {
  const ids = [
    data.financialAccount?.accountId,
    data.wallet?.financialAccount?.accountId,
    data.wallet?.monime?.financialAccountId,
    data.monimeFinancialAccountId,
    data["financialAccount.accountId"],
    data["wallet.financialAccount.accountId"],
    data["wallet.monime.financialAccountId"],
  ].filter((value) => typeof value === "string" && value);
  return {
    accountIds: [...new Set(ids)],
    inconsistent: new Set(ids).size > 1,
    hasLegacyLiteralKeys: Object.keys(data).some(
      (key) => key.includes(".") && /financialAccount|monime/.test(key),
    ),
  };
}
function fingerprint(value) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(value))
    .digest("hex");
}
function cursorCodec(secret) {
  return {
    encode: (data) => {
      const encoded = Buffer.from(JSON.stringify(data)).toString("base64url");
      return (
        encoded +
        "." +
        crypto.createHmac("sha256", secret).update(encoded).digest("base64url")
      );
    },
    decode: (value) => {
      if (typeof value !== "string" || value.length > 5000)
        fail(400, "Invalid page cursor.");
      const [payload, signature] = value.split(".");
      const expected = crypto
        .createHmac("sha256", secret)
        .update(payload || "")
        .digest("base64url");
      if (
        !signature ||
        signature.length !== expected.length ||
        !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
      )
        fail(400, "Invalid page cursor. Refresh the first page.");
      try {
        const parsed = JSON.parse(Buffer.from(payload, "base64url").toString());
        if (parsed.expires < Date.now()) fail(400, "Page cursor expired.");
        return parsed;
      } catch {
        fail(400, "Page cursor expired or invalid.");
      }
    },
  };
}
function financialSummary(rows, now = new Date()) {
  const success = new Set([
    "completed",
    "succeeded",
    "success",
    "paid",
    "confirmed",
  ]);
  const totals = {
    transactionCount: rows.length,
    successfulTransactions: 0,
    transactionVolume: 0,
    recordedPlatformCharges: 0,
    recordedCommission: 0,
    funding: 0,
    withdrawalPrincipal: 0,
    transferPrincipal: 0,
    subscriptionIncome: 0,
    boostIncome: 0,
    referralExpenses: 0,
    pending: 0,
    failed: 0,
    reversed: 0,
    partial: 0,
    staleProcessing: 0,
    recordsWithUnconfirmedStatus: 0,
  };
  const seen = new Set();
  for (const { id, data } of rows) {
    const status = String(data.status || "").toLowerCase();
    const currency = data.currency || data.metadata?.currency || "SLE";
    if (currency !== "SLE") continue;
    if (!status) {
      totals.recordsWithUnconfirmedStatus++;
      continue;
    }
    if (["processing", "pending", "queued"].includes(status)) {
      totals.pending++;
      const date = Date.parse(data.timestamp || data.createdAt);
      if (Number.isFinite(date) && now - date > 24 * 3600000)
        totals.staleProcessing++;
      continue;
    }
    if (status === "failed") {
      totals.failed++;
      continue;
    }
    if (status === "reversed") {
      totals.reversed++;
      continue;
    }
    if (["partially_completed", "partially_failed"].includes(status)) {
      totals.partial++;
      continue;
    }
    if (!success.has(status)) continue;
    const type = data.type,
      platform = data.userId === "hubpas";
    if (
      platform &&
      [
        "topup",
        "withdrawal",
        "transfer_in",
        "transfer_out",
        "referral_reward",
      ].includes(type)
    )
      continue;
    if (type === "transfer_in") continue;
    const canonical =
      type === "transfer_out"
        ? "transfer:" + (data.transferId || id)
        : type === "topup"
          ? "topup:" + (data.orderId || id)
          : type + ":" + id;
    if (seen.has(canonical)) continue;
    seen.add(canonical);
    if (!platform) totals.successfulTransactions++;
    const principal = Math.abs(
      Number(
        data.netAmount ??
          (type === "withdrawal"
            ? (data.metadata?.principalAmountMajor ??
              data.metadata?.netAmountMajor)
            : undefined) ??
          data.grossAmount ??
          data.amount,
      ) || 0,
    );
    if (
      !platform &&
      [
        "topup",
        "withdrawal",
        "transfer_out",
        "ticket_purchase",
        "raffle_purchase",
        "donation",
        "venue_booking",
        "skill_booking",
      ].includes(type)
    )
      totals.transactionVolume += principal;
    if (!platform && type === "withdrawal")
      totals.recordedPlatformCharges +=
        Number(
          data.metadata?.platformFeeAmountMajor ??
            data.metadata?.platformFeeMajor,
        ) || 0;
    if (!platform && type === "transfer_out")
      totals.recordedPlatformCharges += Number(data.feeAmount) || 0;
    if (!platform && ["ticket_sale", "raffle_sale"].includes(type))
      totals.recordedCommission += Number(data.feeAmount) || 0;
    if (!platform && type === "topup") totals.funding += principal;
    if (!platform && type === "withdrawal")
      totals.withdrawalPrincipal += principal;
    if (!platform && type === "transfer_out")
      totals.transferPrincipal += principal;
    if (platform && type === "subscription" && Number(data.amount) > 0)
      totals.subscriptionIncome += Number(data.amount);
    if (
      platform &&
      /boost/.test(data.metadata?.kind || type) &&
      Number(data.amount) > 0
    )
      totals.boostIncome += Number(data.amount);
    if (!platform && type === "referral_reward")
      totals.referralExpenses += principal;
  }
  return totals;
}
module.exports = {
  fail,
  safeId,
  sanitize,
  projectRecord,
  normalizeLinkage,
  cursorCodec,
  fingerprint,
  financialSummary,
};
