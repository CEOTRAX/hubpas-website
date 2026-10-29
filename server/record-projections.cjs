// Table and summary requests fetch only fields used in those views. Details
// retain the full allowlisted projection through the separate record endpoint.
const lists = {
  users:
    "displayName name username email phone city userPlan accountType verified walletBalance walletHeldBalance createdAt",
  wallet: "userId walletBalance walletHeldBalance createdAt updatedAt",
  walletTransactions:
    "userId type amount amountMajor grossAmount feeAmount netAmount status timestamp counterpartyUserId",
  walletTransfers:
    "fromUserId toUserId grossAmount feeAmount netAmount status timestamp",
  walletTopupTransactions:
    "userId amount amountNet processingFeeAmountMajor totalChargeAmountMajor currency status createdAt",
  orders: "userId amount amountMajor status paidAt createdAt",
  events:
    "title hostId hostName dateTime venueName category categories location status publicOrPrivate",
  tickets: "userId ticketLabel ticketType price status createdAt",
  venueBookings:
    "requesterId venueName spaceName startDateTime totalPrice paymentStatus status requestedAt",
  skillBookings:
    "clientId providerId skillTitle totalAmount paymentStatus status requestedAt",
  venues: "name ownerId city status createdAt",
  skillServices: "title providerId providerName category status createdAt",
};
const summary = {
  walletTransactions: [
    "userId",
    "type",
    "amount",
    "grossAmount",
    "feeAmount",
    "netAmount",
    "status",
    "timestamp",
    "transferId",
    "orderId",
    "currency",
    "metadata.platformFeeAmountMajor",
    "metadata.platformFeeMajor",
    "metadata.principalAmountMajor",
    "metadata.netAmountMajor",
    "metadata.currency",
    "metadata.kind",
  ],
  events: [
    "capacity",
    "title",
    "dateTime",
    "endDateTime",
    "category",
    "categories",
    "location",
    "venueName",
    "status",
  ],
};
function listFields(name, resource) {
  return lists[name]
    ? lists[name].split(" ").filter((field) => resource.fields.includes(field))
    : resource.fields;
}
function summaryFields(name, resource) {
  return summary[name] || resource.fields;
}
module.exports = { listFields, summaryFields };
