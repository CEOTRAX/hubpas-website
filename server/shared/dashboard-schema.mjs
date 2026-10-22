// Source mapping inspected in the Hubpas app repository. This is also the
// server allowlist: clients cannot provide an arbitrary collection or field.
export const VERSION = "hubpas-admin-2026.10.06";
export const ROLES = [
  "super_admin",
  "finance",
  "operations",
  "support",
  "analyst",
];
const all = ROLES;
const finance = ["super_admin", "finance", "analyst"];
const operations = ["super_admin", "operations", "support", "analyst"];
const resource = (collection, dateField, fields, roles = all, extra = {}) => ({
  collection,
  dateField,
  fields: fields.split(" "),
  roles,
  ...extra,
});
export const RESOURCES = {
  adminRoleAssignments: resource(
    "adminRoleAssignments",
    "updatedAt",
    "active roles deniedResources deniedActions accessVersion status updatedBy updatedAt",
    ["super_admin"],
  ),
  users: resource(
    "users",
    "createdAt",
    "displayName name username email phone accountType userType profileType userPlan businessPlan venuePlan verified subscription createdAt updatedAt contentAccess adminLimits venueId venueOwnerId venueStaffRole walletBalance walletHeldBalance monimeFinancialAccountId monimeUvan wallet financialAccount",
  ),
  wallet: resource(
    "wallet",
    "createdAt",
    "userId walletBalance walletHeldBalance financialAccount wallet monimeFinancialAccountId updatedAt createdAt",
    finance,
    { financial: true },
  ),
  walletTransactions: resource(
    "walletTransactions",
    "timestamp",
    "userId type amount grossAmount feeAmount netAmount status timestamp eventId orderId transferId requestId checkoutSessionId purchaseTxId ticketIds quantity counterpartyUserId holdStatus heldUntil releasedAt refundedAt audit metadata monime",
    finance,
    { financial: true },
  ),
  walletTransfers: resource(
    "walletTransfers",
    "timestamp",
    "fromUserId toUserId grossAmount feeAmount netAmount status timestamp completedAt requestId feeMode monime failureDetail",
    finance,
    { financial: true },
  ),
  walletTopupTransactions: resource(
    "walletTopupTransactions",
    "createdAt",
    "userId amount amountNet processingFeeAmountMajor totalChargeAmountMajor status currency createdAt paidAt checkoutSessionId walletTransactionId providerId updatedAt",
    finance,
    { financial: true },
  ),
  orders: resource(
    "orders",
    "createdAt",
    "userId amount amountMajor amountNet status currency createdAt paidAt checkoutSessionId transactionId metadata monime updatedAt",
    finance,
    { financial: true },
  ),
  vouchers: resource(
    "vouchers",
    "createdAt",
    "amount currency active expiresAt maxRedemptions redeemedCount createdAt",
    finance,
    { financial: true },
  ),
  events: resource(
    "events",
    "dateTime",
    "title hostId hostName status publicOrPrivate dateTime endDateTime category categories location fullAddress venueId venueName venueSpaceId venueSpaceName venueBookingId capacity ticketLimit ticketPrice ticketTiers donationTiers interactiveFeatures coHosts goingCount views rsvpCount revenue chatEnabled chatCount createdAt",
    operations,
  ),
  tickets: resource(
    "tickets",
    "createdAt",
    "eventId userId sellerId status price ticketType ticketLabel ticketTierId purchaseTxId listingId listedForSale createdAt transferredAt refundedAt totalPax usedPax",
    all,
    { financial: true },
  ),
  ticketListings: resource(
    "ticketListings",
    "createdAt",
    "ticketId eventId sellerId buyerId price originalPrice ticketTierId ticketTierName status createdAt soldAt cancelledAt",
    all,
    { financial: true },
  ),
  raffleEntries: resource(
    "events",
    "createdAt",
    "userId name qty amountDue amountPaid latestTicketIds updatedAt createdAt",
    all,
    { financial: true, parent: "events", child: "raffleEntries" },
  ),
  raffleTickets: resource(
    "events",
    "createdAt",
    "eventId hostId userId entryId raffleTitle ticketNumber pricePaid amountPaid status purchasedAt createdAt",
    all,
    { parent: "events", child: "raffleTickets" },
  ),
  sponsorshipRequests: resource(
    "sponsorshipRequests",
    "createdAt",
    "eventId sponsorUserId hostId amount amountMajor status createdAt updatedAt message",
    all,
    { financial: true },
  ),
  boostCampaigns: resource(
    "boostCampaigns",
    "createdAt",
    "eventId userId status startsAt endsAt startDate endDate days amount amountMajor budget createdAt",
    all,
    { financial: true },
  ),
  eventStatsDaily: resource(
    "eventStatsDaily",
    "date",
    "eventId date views clicks goingCount purchases ticketSales revenue updatedAt",
    all,
  ),
  eventGoing: resource(
    "events",
    "createdAt",
    "userId createdAt updatedAt status",
    operations,
    { parent: "events", child: "going" },
  ),
  eventPolls: resource(
    "events",
    "createdAt",
    "question options visibility anonymous allowMultiple votePricing pricePerVote closesAt createdAt",
    operations,
    { parent: "events", child: "polls" },
  ),
  pollVotes: resource(
    "events",
    "createdAt",
    "userId optionId optionIds amount createdAt",
    operations,
    { parent: "events", child: "polls", grandchild: "votes" },
  ),
  venues: resource(
    "venues",
    "createdAt",
    "ownerId name address fullAddress city spaces status contentAccess subAccounts subAccountIds createdAt updatedAt",
    operations,
  ),
  venueBookings: resource(
    "venueBookings",
    "requestedAt",
    "venueId spaceId venueOwnerId requesterId eventId eventTitle venueName spaceName startDateTime endDateTime totalPrice status requestedAt acceptedAt rejectedAt cancelledAt completedAt paymentStatus holdStatus heldUntil",
    all,
    { financial: true },
  ),
  spaceReviews: resource(
    "spaceReviews",
    "createdAt",
    "venueId spaceId userId authorId stars rating comment createdAt updatedAt",
    operations,
  ),
  skillServices: resource(
    "skillServices",
    "createdAt",
    "providerId providerName title category status pricingTiers availabilitySchedule serviceAreas responseTimeHours instantBookEnabled currency createdAt updatedAt",
    operations,
  ),
  skillBookings: resource(
    "skillBookings",
    "requestedAt",
    "skillId providerId clientId skillTitle category serviceDate startDateTime endDateTime serviceArea totalAmount depositAmount paymentStatus paymentMethod status invoiceNumber requestedAt updatedAt confirmedAt cancelledAt completedAt",
    all,
    { financial: true },
  ),
  skillNotifications: resource(
    "skillNotifications",
    "createdAt",
    "bookingId providerId clientId channel status template createdAt updatedAt",
    operations,
  ),
  skillBookingAuditLogs: resource(
    "skillBookingAuditLogs",
    "createdAt",
    "bookingId skillId providerId clientId actorId actorRole action createdAt metadata",
    all,
  ),
  hostSubscriptions: resource(
    "hostSubscriptions",
    "createdAt",
    "subscriberId userId hostId amountMajor platformFeeMajor hostRevenueMajor status createdAt expiresAt startsAt renewedAt",
    all,
    { financial: true },
  ),
  referralCodes: resource(
    "referralCodes",
    "createdAt",
    "userId code usedCount createdAt updatedAt",
    all,
  ),
  platformPricing: resource(
    "platform",
    "updatedAt",
    "basicMonthlyPriceMajor basicYearlyMonthlyPriceMajor proMonthlyPriceMajor proYearlyMonthlyPriceMajor businessMonthlyPriceMajor businessYearlyMonthlyPriceMajor boostPricePerDayMajor createdAt updatedAt adminVersion adminEffectiveAt",
    finance,
    { fixedId: "pricing", financial: true },
  ),
  eventChats: resource(
    "eventChats",
    "timestamp",
    "eventId chatId senderId type timestamp status requestId",
    operations,
    { privateMetadata: true },
  ),
  privateChats: resource(
    "privateChats",
    "updatedAt",
    "type participantIds updatedAt unreadCount eventId eventDateTime eventStatus",
    operations,
    { privateMetadata: true },
  ),
  calls: resource(
    "calls",
    "createdAt",
    "callerId calleeId callerUid receiverUid media status durationSec provider createdAt startedAt endedAt updatedAt",
    operations,
    { privateMetadata: true },
  ),
  directionsRequests: resource(
    "directionsRequests",
    "createdAt",
    "fromUserId toUserId eventId status createdAt updatedAt",
    operations,
    { privateMetadata: true },
  ),
  followers: resource("users", "createdAt", "userId createdAt", operations, {
    parent: "users",
    child: "followers",
  }),
  following: resource("users", "createdAt", "userId createdAt", operations, {
    parent: "users",
    child: "following",
  }),
  savedEvents: resource("users", "createdAt", "eventId createdAt", operations, {
    parent: "users",
    child: "savedEvents",
  }),
  notifications: resource(
    "users",
    "createdAt",
    "type status read createdAt eventId",
    operations,
    { parent: "users", child: "notifications" },
  ),
  devices: resource(
    "users",
    "updatedAt",
    "platform model appVersion updatedAt createdAt",
    operations,
    { parent: "users", child: "devices" },
  ),
  monime_webhooks: resource(
    "monime_webhooks",
    "receivedAt",
    "eventName receivedAt",
    finance,
    {
      privateMetadata: true,
      notice:
        "Receipt metadata is written before signature verification; it is not proof of successful processing. Raw bodies, headers and signatures are excluded.",
    },
  ),
  webhook: resource(
    "webhook",
    "createdAt",
    "provider userId kind status orderId checkoutSessionId transactionId amountGross amountNet currency feeRate creditedAt updatedAt createdAt",
    finance,
    { privateMetadata: true },
  ),
  adminAuditLogs: resource(
    "adminAuditLogs",
    "at",
    "actor action target reason at correlationId before after",
    ["super_admin", "finance", "operations", "support"],
    { newSchema: true },
  ),
  supportCases: resource(
    "supportCases",
    "createdAt",
    "targetResource targetId assignedTo status reason createdAt updatedAt privateAccessApprovedBy privateAccessExpiresAt",
    ["super_admin", "support"],
    { newSchema: true },
  ),
  moderationCases: resource(
    "moderationCases",
    "createdAt",
    "targetResource targetId assignedTo status reason createdAt updatedAt",
    ["super_admin", "operations", "support"],
    { newSchema: true },
  ),
};
export const MODULES = [
  {
    id: "overview",
    label: "Overview",
    icon: "▦",
    section: "Platform",
    resources: [],
  },
  {
    id: "website",
    label: "Website insights",
    icon: "↗",
    section: "Platform",
    resources: [],
  },
  {
    id: "users",
    label: "Users & accounts",
    icon: "◉",
    section: "Platform",
    resources: ["users", "adminRoleAssignments"],
  },
  {
    id: "treasury",
    label: "Main account",
    icon: "▣",
    section: "Finance",
    resources: [],
  },
  {
    id: "wallets",
    label: "Wallet operations",
    icon: "⇄",
    section: "Finance",
    resources: [
      "walletTransactions",
      "walletTransfers",
      "walletTopupTransactions",
      "orders",
      "wallet",
      "vouchers",
    ],
  },
  {
    id: "events",
    label: "Events & tickets",
    icon: "□",
    section: "Activity",
    resources: [
      "events",
      "tickets",
      "ticketListings",
      "raffleEntries",
      "raffleTickets",
      "sponsorshipRequests",
      "boostCampaigns",
      "eventStatsDaily",
    ],
  },
  {
    id: "venues",
    label: "Venues & spaces",
    icon: "⌂",
    section: "Activity",
    resources: ["venues", "venueBookings", "spaceReviews"],
  },
  {
    id: "skills",
    label: "Skills & services",
    icon: "◇",
    section: "Activity",
    resources: [
      "skillServices",
      "skillBookings",
      "skillNotifications",
      "skillBookingAuditLogs",
    ],
  },
  {
    id: "subscriptions",
    label: "Plans & pricing",
    icon: "◷",
    section: "Platform",
    resources: [
      "users",
      "hostSubscriptions",
      "platformPricing",
      "referralCodes",
      "boostCampaigns",
    ],
  },
  {
    id: "community",
    label: "Chats & calls",
    icon: "▤",
    section: "Operations",
    resources: ["eventChats", "privateChats", "calls", "directionsRequests"],
  },
  {
    id: "moderation",
    label: "Moderation & support",
    icon: "⚑",
    section: "Operations",
    resources: ["moderationCases", "supportCases"],
  },
  {
    id: "operations",
    label: "Operations & audit",
    icon: "⚙",
    section: "Operations",
    resources: [
      "monime_webhooks",
      "webhook",
      "adminAuditLogs",
      "skillBookingAuditLogs",
    ],
  },
];
export const ACTIONS = {
  "event.removeCoHost": {
    resource: "events",
    roles: ["super_admin", "operations"],
    label: "Remove co-host access",
    description:
      "Remove an existing coHosts userId entry. The owner and ticket/payment records are unchanged.",
  },
  "user.grantPlan": {
    resource: "users",
    roles: ["super_admin"],
    label: "Grant plan entitlement",
    description:
      "Audited admin exception with expiry. No wallet charge, provider payment or revenue entry is created; historical amounts are preserved.",
  },
  "user.suspend": {
    resource: "users",
    roles: ["super_admin", "operations"],
    label: "Suspend account",
    description:
      "Disable Firebase Authentication and revoke refresh tokens. Existing app-client behaviour and token expiry still need live rollout verification.",
  },
  "user.reactivate": {
    resource: "users",
    roles: ["super_admin", "operations"],
    label: "Reactivate account",
    description:
      "Re-enable Firebase Authentication without editing balances, subscriptions, or payment history.",
  },
  "event.unpublish": {
    resource: "events",
    roles: ["super_admin", "operations"],
    label: "Unpublish event",
    description:
      "Set an existing event to draft/private so the public visibility query excludes it. Preserve tickets and payment history.",
  },
  "user.restrictPublishing": {
    resource: "users",
    roles: ["super_admin", "operations"],
    label: "Restrict public publishing",
    description:
      "Set the contentAccess lock read by Spaces/Skills publishing helpers.",
  },
  "user.restorePublishing": {
    resource: "users",
    roles: ["super_admin", "operations"],
    label: "Restore public publishing",
    description:
      "Remove the admin publishing lock; subscription expiry checks still apply.",
  },
  "user.setVerification": {
    resource: "users",
    roles: ["super_admin", "operations"],
    label: "Set verification",
    description:
      "Update the verified badge flag; paid-plan badges may also be applied by the app.",
  },
  "user.publishLimit": {
    resource: "users",
    roles: ["super_admin", "operations"],
    label: "Set publishing limit",
    description:
      "Set the nested adminLimits.maxPublishedEventsTotal consumed by publishEventWithPlanChecks.",
  },
  "venue.suspend": {
    resource: "venues",
    roles: ["super_admin", "operations"],
    label: "Suspend venue listing",
    description:
      "Hide a venue from the public catalog through its existing status field.",
  },
  "venue.approve": {
    resource: "venues",
    roles: ["super_admin", "operations"],
    label: "Approve venue listing",
    description: "Set venue status to approved.",
  },
  "skill.pause": {
    resource: "skillServices",
    roles: ["super_admin", "operations"],
    label: "Pause service listing",
    description:
      "Set an active listing to paused; leave bookings/payments unchanged.",
  },
  "pricing.update": {
    resource: "platformPricing",
    roles: ["super_admin"],
    label: "Update pricing version",
    description:
      "Version stored platform/pricing fields consumed by the backend. Local fee constants require a separate app/functions release.",
  },
};
