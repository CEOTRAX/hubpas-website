export function readDate(value) {
  if (value == null || value === "") return null;
  const date =
    typeof value?.toDate === "function"
      ? value.toDate()
      : value instanceof Date
        ? value
        : typeof value === "number"
          ? new Date(value < 1e12 ? value * 1000 : value)
          : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function dateRange(period, now = new Date(), from = "", to = "") {
  const day = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const month = day.getUTCMonth(),
    year = day.getUTCFullYear();
  if (period === "all") return null;
  if (period === "custom") {
    const start = readDate(from),
      end = readDate(to);
    if (!start || !end || start > end)
      throw new Error("Choose a valid start and end date.");
    end.setUTCDate(end.getUTCDate() + 1);
    return { start, end };
  }
  if (period === "this-month")
    return {
      start: new Date(Date.UTC(year, month, 1)),
      end: new Date(Date.UTC(year, month + 1, 1)),
    };
  if (period === "last-month")
    return {
      start: new Date(Date.UTC(year, month - 1, 1)),
      end: new Date(Date.UTC(year, month, 1)),
    };
  if (period === "next-month")
    return {
      start: new Date(Date.UTC(year, month + 1, 1)),
      end: new Date(Date.UTC(year, month + 2, 1)),
    };
  const end = new Date(day);
  end.setUTCDate(end.getUTCDate() + 1);
  const start = new Date(day);
  start.setUTCDate(
    start.getUTCDate() -
      (period === "last-7" ? 6 : period === "last-30" ? 29 : 0),
  );
  return { start, end };
}

export const inRange = (value, range) => {
  if (!range) return true;
  const date = readDate(value);
  return !!date && date >= range.start && date < range.end;
};

export const leones = (value) =>
  Number.isFinite(value)
    ? "Le " +
      new Intl.NumberFormat("en-SL", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(value)
    : "—";

export function eventStats(rows, now = new Date(), field = "startDate") {
  const locations = new Map(),
    types = new Map();
  let past = 0,
    upcoming = 0,
    undated = 0,
    cancelled = 0,
    capacity = 0,
    sold = 0;
  for (const { data } of rows) {
    const date = readDate(data[field]);
    const isCancelled = ["cancelled", "canceled", "rejected"].includes(
      String(data.status).toLowerCase(),
    );
    if (isCancelled) cancelled++;
    else if (!date) undated++;
    else if (date < now) past++;
    else upcoming++;
    const locationValue =
      data.city || data.location || data.venue || "Not specified";
    const location =
      typeof locationValue === "object"
        ? locationValue.city ||
          locationValue.name ||
          locationValue.address ||
          "Not specified"
        : String(locationValue);
    const type = String(
      data.eventType || data.type || data.category || "Not specified",
    );
    locations.set(location, (locations.get(location) || 0) + 1);
    types.set(type, (types.get(type) || 0) + 1);
    capacity += Math.max(0, Number(data.capacity || data.maxAttendees) || 0);
    sold += Math.max(0, Number(data.ticketsSold || data.attendeeCount) || 0);
  }
  const rank = (map) => [...map].sort((a, b) => b[1] - a[1]);
  return {
    total: rows.length,
    past,
    upcoming,
    undated,
    cancelled,
    locations: rank(locations),
    types: rank(types),
    capacity,
    sold,
  };
}

export function recordedTotals(rows) {
  let gross = 0,
    commission = 0,
    amounts = 0,
    commissions = 0;
  for (const { data } of rows) {
    // Use stored values, including zero. Do not invent commission from a rate.
    const amount =
      data.amount ?? data.totalAmount ?? data.grossAmount ?? data.total;
    const fee = data.platformFee ?? data.commissionAmount ?? data.commission;
    if (amount != null && amount !== "" && Number.isFinite(Number(amount))) {
      gross += Number(amount);
      amounts++;
    }
    if (fee != null && fee !== "" && Number.isFinite(Number(fee))) {
      commission += Number(fee);
      commissions++;
    }
  }
  return {
    gross: amounts ? gross : NaN,
    commission: commissions ? commission : NaN,
    amounts,
    commissions,
  };
}

const facetsByResource = {
  users: [["Account type", ["accountType", "userPlan", "businessPlan", "subscription"]], ["Location", ["city", "location"]], ["Verification", ["verified"]]],
  adminRoleAssignments: [["Portal roles", ["roles"]], ["Access", ["active"]]],
  walletTransactions: [["Transaction type", ["type"]], ["Status", ["status"]]],
  walletTransfers: [["Status", ["status"]]],
  walletTopupTransactions: [["Funding status", ["status"]]],
  orders: [["Order status", ["status"]]],
  events: [["Event category", ["category"]], ["Location", ["location"]], ["Status", ["status"]]],
  tickets: [["Ticket status", ["status"]], ["Ticket type", ["ticketType"]]],
  ticketListings: [["Listing status", ["status"]]],
  boostCampaigns: [["Boost status", ["status"]]],
  venues: [["Location", ["city"]], ["Status", ["status"]]],
  venueBookings: [["Booking status", ["status"]], ["Payment status", ["paymentStatus"]]],
  skillServices: [["Service category", ["category"]], ["Status", ["status"]]],
  skillBookings: [["Booking status", ["status"]], ["Payment status", ["paymentStatus"]]],
  hostSubscriptions: [["Subscription status", ["status"]]],
  moderationCases: [["Case status", ["status"]], ["Target", ["targetResource"]]],
  supportCases: [["Case status", ["status"]], ["Target", ["targetResource"]]],
  privateChats: [["Conversation type", ["type"]]],
  calls: [["Call status", ["status"]], ["Media", ["media"]]],
  adminAuditLogs: [["Action", ["action"]]],
  monime_webhooks: [["Event type", ["eventName"]]],
  webhook: [["Status", ["status"]], ["Kind", ["kind"]]],
};

export function insightFieldsFor(name, resource) {
  const facets = facetsByResource[name] || [["Status", ["status"]], ["Type", ["type"]]];
  return [...new Set([resource.dateField, ...facets.flatMap(([, fields]) => fields)])]
    .filter((field) => resource.fields.includes(field));
}

export function resourceSummary(rows, name, dateField, total = null, limited = false) {
  const source = rows.map((row) => row.data || {});
  const facetSpecs = facetsByResource[name] || [["Status", ["status"]], ["Type", ["type"]]];
  const labelFor = (raw, key) => {
    if (key === "verified") return raw === true ? "Verified" : raw === false ? "Not verified" : "Not recorded";
    if (key === "active") return raw === true ? "Active" : raw === false ? "Disabled" : "Not recorded";
    if (raw == null || raw === "") return "Not recorded";
    const value = typeof raw === "object" ? raw.city || raw.name || "Not recorded" : String(raw);
    return String(value).slice(0, 48);
  };
  const facets = facetSpecs.map(([label, fields]) => {
    const groups = new Map();
    for (const data of source) {
      if (name === "users" && label === "Account type") {
        const status = String(data.subscription?.status || "").toLowerCase();
        const expiresAt = readDate(data.subscription?.expiresAt);
        const expired = ["expired", "cancelled", "canceled"].includes(status) ||
          (expiresAt && expiresAt.getTime() <= Date.now());
        const plans = [data.subscription?.plan, data.userPlan, data.businessPlan, data.accountType]
          .map((value) => String(value || "").toLowerCase());
        const tier = expired ? "Free" : plans.includes("business") ? "Business" :
          plans.some((value) => ["pro", "basic", "paid"].includes(value)) ? "Pro" : "Free";
        groups.set(tier, (groups.get(tier) || 0) + 1);
        continue;
      }
      const key = fields.find((field) => data[field] != null && data[field] !== "") || fields[0];
      const raw = data[key];
      const values = Array.isArray(raw) ? raw.length ? raw : [null] : [raw];
      for (const value of values) {
        const title = labelFor(value, key);
        groups.set(title, (groups.get(title) || 0) + 1);
      }
    }
    if (name === "users" && label === "Account type" && source.length)
      for (const tier of ["Free", "Pro", "Business"])
        if (!groups.has(tier)) groups.set(tier, 0);
    const sorted = [...groups].sort((a, b) => b[1] - a[1]);
    const top = sorted.slice(0, 5).map(([title, count]) => ({ label: title, count }));
    if (sorted.length > 5) top.push({ label: "Other", count: sorted.slice(5).reduce((sum, [, count]) => sum + count, 0) });
    return { label, values: top };
  }).filter((facet) => facet.values.length && facet.values.some((entry) => entry.label !== "Not recorded"));
  const byDay = new Map();
  for (const data of source) {
    const date = readDate(data[dateField]);
    if (!date) continue;
    const key = date.toISOString().slice(0, 10);
    byDay.set(key, (byDay.get(key) || 0) + 1);
  }
  const lastDay = [...byDay.keys()].sort().at(-1);
  const daily = lastDay ? Array.from({ length: 12 }, (_, index) => {
    const date = new Date(lastDay + "T00:00:00.000Z");
    date.setUTCDate(date.getUTCDate() - 11 + index);
    const day = date.toISOString().slice(0, 10);
    return { date: day, count: byDay.get(day) || 0 };
  }) : [];
  return { resource: name, total, sampleSize: rows.length, limited, facets, daily };
}
