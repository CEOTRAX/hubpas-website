import { leones } from "./admin-insights.mjs";
export const words = (value) =>
  String(value ?? "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/^./, (c) => c.toUpperCase());
const labels = {
  savedEvent: "Event",
  savedEventDate: "Event date",
  savedEventStatus: "Status",
  userId: "Customer",
  fromUserId: "Sender",
  toUserId: "Recipient",
  counterpartyUserId: "Other customer",
  requesterId: "Customer",
  clientId: "Customer",
  providerId: "Service provider",
  hostId: "Host",
  ownerId: "Owner",
  subscriberId: "Subscriber",
  sellerId: "Seller",
  buyerId: "Buyer",
  senderId: "Sender",
  venueOwnerId: "Venue owner",
  actor: "Staff member",
  actorId: "Staff member",
  timestamp: "Date",
  createdAt: "Created",
  requestedAt: "Requested",
  dateTime: "Event date",
  startDateTime: "Starts",
  endDateTime: "Ends",
  grossAmount: "Principal",
  amount: "Recorded amount",
  amountMajor: "Recorded amount",
  feeAmount: "Charge",
  netAmount: "Recorded net amount",
  walletBalance: "Current wallet balance",
  walletHeldBalance: "Held funds",
  accountType: "Account type",
  userPlan: "Plan",
  publicOrPrivate: "Visibility",
  verified: "Verified account",
  totalPrice: "Total price",
  totalAmount: "Total price",
  paymentStatus: "Payment",
  holdStatus: "Held funds",
  amountNet: "Wallet credit",
  processingFeeAmountMajor: "Processing charge",
  totalChargeAmountMajor: "Total charged",
};
export const fieldLabel = (key) => labels[key] || words(key);
const types = {
  withdrawal: "Withdrawal",
  wallet_withdrawal: "Withdrawal",
  transfer_out: "Money sent",
  transfer_in: "Money received",
  topup: "Wallet funding",
  top_up: "Wallet funding",
  wallet_topup: "Wallet funding",
  ticket_purchase: "Ticket purchase",
  ticket_sale: "Ticket sale",
  subscription: "Subscription",
  boost: "Event promotion",
  refund: "Refund",
  reversal: "Reversal",
  venue_booking: "Venue booking",
  skill_booking: "Service booking",
};
export const activityLabel = (value) =>
  types[value] || words(value || "Wallet activity");
export function readable(key, value, depth = 0) {
  if (value == null || value === "") return "Not recorded";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number")
    return /amount|price|fee|balance|revenue|cost/i.test(key) &&
      !/minor|rate|percent|bps/i.test(key)
      ? leones(value)
      : value.toLocaleString();
  if (typeof value === "string") {
    if (
      /date|time|createdAt|updatedAt|expiresAt|paidAt|requestedAt|completedAt|heldUntil|releasedAt|refundedAt/i.test(
        key,
      ) &&
      /^\d{4}-\d{2}-\d{2}/.test(value)
    ) {
      const date = new Date(value);
      if (Number.isFinite(+date))
        return (
          new Intl.DateTimeFormat("en-GB", {
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "UTC",
          }).format(date) + " UTC"
        );
    }
    return /status|type|plan|visibility|publicOrPrivate/.test(key)
      ? words(value)
      : value;
  }
  if (depth > 2) return "More information available";
  if (Array.isArray(value))
    return value.length
      ? value
          .slice(0, 5)
          .map((item) => readable(key, item, depth + 1))
          .join(" · ") +
          (value.length > 5 ? " · " + (value.length - 5) + " more" : "")
      : "None";
  return (
    Object.entries(value)
      .filter(([, v]) => v != null)
      .slice(0, 6)
      .map(([k, v]) => fieldLabel(k) + ": " + readable(k, v, depth + 1))
      .join(" · ") || "Not recorded"
  );
}
export const contactText = (person) =>
  [person?.phone, person?.email].filter(Boolean).join(" · ");
export function personFor(row, key) {
  const known = row.people?.[key];
  if (known) return known;
  if (key === "hostId" && row.data.hostName) return { name: row.data.hostName };
  if (key === "providerId" && row.data.providerName)
    return { name: row.data.providerName };
  if (
    key === "userId" &&
    (row.data.displayName || row.data.name || row.data.username)
  )
    return {
      name: row.data.displayName || row.data.name || row.data.username,
      phone: row.data.phone,
      email: row.data.email,
    };
  return {
    name: row.data[key] ? "Customer details unavailable" : "Not recorded",
  };
}
export function columnsFor(resource) {
  const layouts = {
    walletTransactions: [
      "userId",
      "type",
      "amount",
      "feeAmount",
      "status",
      "timestamp",
    ],
    walletTransfers: [
      "fromUserId",
      "toUserId",
      "grossAmount",
      "feeAmount",
      "status",
      "timestamp",
    ],
    wallet: ["userId", "walletBalance", "walletHeldBalance", "updatedAt"],
    walletTopupTransactions: [
      "userId",
      "totalChargeAmountMajor",
      "processingFeeAmountMajor",
      "amountNet",
      "status",
      "createdAt",
    ],
    orders: ["userId", "amount", "status", "paidAt"],
    users: [
      "userId",
      "walletBalance",
      "walletHeldBalance",
      "userPlan",
      "verified",
      "createdAt",
    ],
    events: ["title", "hostId", "dateTime", "venueName", "category", "status"],
    tickets: ["userId", "ticketLabel", "price", "status", "createdAt"],
    ticketListings: ["sellerId", "buyerId", "price", "status", "createdAt"],
    venueBookings: [
      "requesterId",
      "venueName",
      "spaceName",
      "startDateTime",
      "totalPrice",
      "paymentStatus",
      "status",
    ],
    skillBookings: [
      "clientId",
      "providerId",
      "skillTitle",
      "totalAmount",
      "paymentStatus",
      "status",
    ],
    venues: ["name", "ownerId", "city", "status"],
    skillServices: ["title", "providerId", "category", "status"],
    hostSubscriptions: [
      "subscriberId",
      "hostId",
      "amountMajor",
      "status",
      "expiresAt",
    ],
    adminRoleAssignments: ["userId", "roles", "active", "updatedAt"],
    eventChats: ["senderId", "type", "timestamp"],
    calls: ["callerId", "calleeId", "media", "status", "durationSec"],
    referralCodes: ["userId", "code", "usedCount"],
    raffleEntries: ["userId", "qty", "amountPaid", "createdAt"],
  };
  const extra = {
    followers: ["userId", "createdAt"],
    following: ["userId", "createdAt"],
    savedEvents: [
      "savedEvent",
      "savedEventDate",
      "savedEventStatus",
      "createdAt",
    ],
    notifications: ["type", "status", "read", "createdAt"],
    devices: ["platform", "createdAt"],
    vouchers: ["amount", "active", "expiresAt", "redeemedCount"],
    raffleTickets: [
      "userId",
      "raffleTitle",
      "ticketNumber",
      "pricePaid",
      "status",
    ],
    sponsorshipRequests: ["hostId", "status", "createdAt"],
    boostCampaigns: ["userId", "status", "createdAt"],
    spaceReviews: ["userId", "rating", "comment", "createdAt"],
    skillNotifications: [
      "clientId",
      "providerId",
      "channel",
      "status",
      "createdAt",
    ],
    skillBookingAuditLogs: ["actorId", "action", "createdAt"],
    platformPricing: [
      "proMonthlyPriceMajor",
      "businessMonthlyPriceMajor",
      "boostPricePerDayMajor",
    ],
    privateChats: ["type", "updatedAt"],
    directionsRequests: ["fromUserId", "toUserId", "status", "createdAt"],
    monime_webhooks: ["eventName", "receivedAt"],
    webhook: ["userId", "provider", "status", "amountGross", "createdAt"],
    adminAuditLogs: ["actorId", "action", "status", "at"],
    supportCases: ["subject", "status", "createdAt"],
    moderationCases: ["reason", "status", "createdAt"],
    eventGoing: ["userId", "createdAt"],
    pollVotes: ["userId", "amount", "createdAt"],
    eventPolls: ["question", "closesAt", "createdAt"],
  };
  return (
    layouts[resource] ||
    extra[resource] || ["name", "title", "status", "createdAt"]
  );
}
export function displayCell(row, key) {
  if (key === "savedEvent")
    return row.relatedEvent?.title || "Event details unavailable";
  if (key === "savedEventDate")
    return readable("dateTime", row.relatedEvent?.dateTime);
  if (key === "savedEventStatus")
    return readable("status", row.relatedEvent?.status);
  if (key === "type") return activityLabel(row.data.type);
  if (key === "amount")
    return readable(
      key,
      row.data.amount ?? row.data.amountMajor ?? row.data.grossAmount,
    );
  if (key === "userPlan")
    return readable(
      "plan",
      row.data.userPlan || row.data.accountType || "basic",
    );
  return readable(key, row.data[key]);
}
export const isPersonField = (key) =>
  Object.hasOwn(labels, key) && (/Id$/.test(key) || key === "actor");
export function recordTitle(resource, row) {
  return (
    row.data.title ||
    row.data.displayName ||
    row.data.name ||
    row.data.skillTitle ||
    (resource.startsWith("wallet")
      ? activityLabel(
          row.data.type || (resource === "walletTransfers" && "transfer_out"),
        )
      : "Record details")
  );
}
