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
