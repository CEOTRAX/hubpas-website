import { MODULES, RESOURCES, ACTIONS, VERSION } from "./dashboard-schema.mjs";
import { dateRange, leones, eventStats, inRange } from "./admin-insights.mjs";
import {
  columnsFor,
  fieldLabel,
  readable,
  personFor,
  contactText,
  isPersonField,
  displayCell,
  recordTitle,
  activityLabel,
} from "./record-view.mjs";
export const escape = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
const titleCase = (value) =>
  value
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .replace(/^./, (letter) => letter.toUpperCase());
const resourceNames = {
  users: "Customers",
  adminRoleAssignments: "Staff dashboard access",
  wallet: "Customer wallets",
  walletTransactions: "Wallet activity",
  walletTransfers: "Transfers",
  walletTopupTransactions: "Wallet funding",
  orders: "Payment requests",
  vouchers: "Vouchers",
  events: "Events",
  tickets: "Admission tickets",
  ticketListings: "Ticket resale",
  venueBookings: "Venue bookings",
  skillBookings: "Service bookings",
  hostSubscriptions: "Host subscriptions",
  platformPricing: "Plans and prices",
  monime_webhooks: "Provider notifications",
  webhook: "Processed payments",
  eventChats: "Event conversations",
  privateChats: "Private conversations",
  calls: "Calls",
};
const wordsForResource = (resource) =>
  resourceNames[resource] || titleCase(resource);
const monetary =
  /amount|price|fee|balance|revenue|deduction|budget|cost|expense/i;
export const formatValue = (key, value) => readable(key, value);
const badge = (value) => {
  const s = String(value || "unknown");
  return (
    '<span class="badge ' +
    (/active|completed|paid|published|approved|succeeded|used|confirmed/.test(s)
      ? "good"
      : /failed|suspended|cancel|reversed|rejected/.test(s)
        ? "bad"
        : /pending|processing|draft|held/.test(s)
          ? "warn"
          : "") +
    '">' +
    escape(readable("status", s)) +
    "</span>"
  );
};
const $ = (id) => document.getElementById(id);
const currentMonth = () => new Date().toISOString().slice(0, 7);
const dayDate = (day) =>
  currentMonth() + "-" + String(day).padStart(2, "0") + "T12:00:00.000Z";
export function previewData() {
  return {
    users: [
      {
        id: "demo-mariama",
        data: {
          displayName: "Mariama Kamara",
          username: "mariama",
          email: "m***@example.com",
          accountType: "paid",
          userPlan: "pro",
          verified: true,
          createdAt: dayDate(3),
          contentAccess: { publicPublishingLocked: false },
          walletBalance: 2400,
          walletHeldBalance: 120,
        },
      },
      {
        id: "demo-ibrahim",
        data: {
          displayName: "Ibrahim Sesay",
          username: "ibrahim",
          userPlan: "basic",
          verified: false,
          createdAt: dayDate(5),
          walletBalance: 650,
        },
      },
    ],
    events: [
      {
        id: "lumley-sessions",
        data: {
          title: "Lumley Beach Sessions",
          hostId: "demo-mariama",
          dateTime: dayDate(18),
          category: "entertainment",
          location: "Lumley Beach, Freetown",
          status: "published",
          publicOrPrivate: "public",
          capacity: 300,
          ticketPrice: 120,
          ticketTiers: [
            { name: "Standard", price: 120, quantity: 300, sold: 182 },
          ],
          goingCount: 218,
          views: 1420,
          coHosts: [],
        },
      },
      {
        id: "bo-culture",
        data: {
          title: "Bo Culture Night",
          hostId: "demo-ibrahim",
          dateTime: dayDate(2),
          category: "community",
          location: "Bo City",
          status: "ended",
          publicOrPrivate: "public",
          capacity: 220,
          ticketPrice: 80,
          goingCount: 196,
          views: 840,
        },
      },
      {
        id: "business-forum",
        data: {
          title: "Business & Innovation Forum",
          hostId: "demo-mariama",
          dateTime: dayDate(24),
          category: "business",
          location: "Aberdeen, Freetown",
          status: "published",
          publicOrPrivate: "public",
          capacity: 150,
          ticketPrice: 250,
        },
      },
    ],
    walletTransactions: [
      {
        id: "demo-withdrawal",
        data: {
          userId: "demo-ibrahim",
          type: "withdrawal",
          amount: 56.65,
          grossAmount: 55,
          feeAmount: 1.65,
          netAmount: 55,
          status: "completed",
          timestamp: dayDate(5),
          audit: {
            platformFeeAmountMajor: 1.1,
            orangeProcessingFeeAmountMajor: 0.55,
            totalDeductionMajor: 56.65,
          },
          monime: { payout: { id: "po-example", status: "succeeded" } },
        },
      },
      {
        id: "demo-transfer",
        data: {
          userId: "demo-mariama",
          type: "transfer_out",
          amount: 204,
          grossAmount: 200,
          feeAmount: 4,
          netAmount: 200,
          status: "completed",
          timestamp: dayDate(4),
          transferId: "demo-transfer-1",
        },
      },
      {
        id: "demo-pending",
        data: {
          userId: "demo-ibrahim",
          type: "topup",
          amount: 500,
          status: "processing",
          timestamp: dayDate(3),
          orderId: "demo-order",
        },
      },
    ],
    wallet: [
      {
        id: "demo-mariama",
        data: {
          walletBalance: 2400,
          walletHeldBalance: 120,
          financialAccount: { accountId: "fac-example-user" },
          updatedAt: dayDate(5),
        },
      },
    ],
    tickets: [
      {
        id: "ticket-example",
        data: {
          eventId: "lumley-sessions",
          userId: "demo-ibrahim",
          status: "active",
          price: 120,
          createdAt: dayDate(5),
          totalPax: 1,
          usedPax: 0,
        },
      },
    ],
    venues: [
      {
        id: "venue-example",
        data: {
          name: "Aberdeen Conference Centre",
          ownerId: "demo-mariama",
          status: "approved",
          city: "Freetown",
          createdAt: dayDate(1),
          spaces: [
            {
              id: "hall-a",
              name: "Main Hall",
              capacity: 150,
              isAvailable: true,
              dailyPrice: 2500,
            },
          ],
        },
      },
    ],
    venueBookings: [
      {
        id: "venue-booking-example",
        data: {
          venueId: "venue-example",
          spaceId: "hall-a",
          requesterId: "demo-ibrahim",
          eventTitle: "Team Workshop",
          status: "accepted",
          totalPrice: 2500,
          startDateTime: dayDate(24),
          endDateTime: dayDate(25),
          requestedAt: dayDate(5),
        },
      },
    ],
    skillServices: [
      {
        id: "skill-example",
        data: {
          title: "Event Photography",
          providerId: "demo-mariama",
          providerName: "Mariama Kamara",
          category: "Photography",
          status: "active",
          serviceAreas: ["Freetown"],
          pricingTiers: [
            { id: "day", label: "Full day", price: 1500, billingUnit: "day" },
          ],
          createdAt: dayDate(1),
        },
      },
    ],
    skillBookings: [
      {
        id: "skill-booking-example",
        data: {
          skillId: "skill-example",
          skillTitle: "Event Photography",
          clientId: "demo-ibrahim",
          providerId: "demo-mariama",
          status: "confirmed",
          paymentStatus: "deposit_paid",
          totalAmount: 1500,
          depositAmount: 500,
          startDateTime: dayDate(18),
          requestedAt: dayDate(5),
        },
      },
    ],
    platformPricing: [
      {
        id: "pricing",
        data: {
          basicMonthlyPriceMajor: 59.99,
          proMonthlyPriceMajor: 249.99,
          businessMonthlyPriceMajor: 499,
          boostPricePerDayMajor: 50,
          adminVersion: 1,
        },
      },
    ],
    privateChats: [
      {
        id: "thread-example",
        data: {
          type: "private",
          participantIds: ["demo-mariama", "demo-ibrahim"],
          updatedAt: dayDate(5),
          unreadCount: { "demo-mariama": 2 },
        },
      },
    ],
    calls: [
      {
        id: "call-example",
        data: {
          callerId: "demo-mariama",
          calleeId: "demo-ibrahim",
          status: "ended",
          media: "audio",
          durationSec: 180,
          createdAt: dayDate(5),
        },
      },
    ],
    adminAuditLogs: [
      {
        id: "audit-example",
        data: {
          actor: "example-admin",
          action: "event.unpublish",
          target: "events/example",
          reason: "Organizer requested listing review",
          at: dayDate(5),
          correlationId: "example-correlation",
        },
      },
    ],
  };
}
export async function mountDashboard({
  forcePreview = false,
  fetcher = globalThis.fetch,
  authLoader,
} = {}) {
  const preview =
    forcePreview ||
    (["localhost", "127.0.0.1", "[::1]"].includes(location.hostname) &&
      new URLSearchParams(location.search).get("preview") === "1");
  const state = {
    module: "overview",
    resource: "users",
    session: null,
    user: null,
    auth: null,
    rows: [],
    cursor: null,
    previous: [],
    request: 0,
    treasury: null,
    treasuryStale: false,
    eventRows: [],
    eventDay: null,
    parent: null,
    nested: null,
    detail: null,
  };
  const examples = previewData();
  const examplePeople = (row) => ({
    ...row,
    people: Object.fromEntries(
      ["userId", "hostId", "clientId", "providerId", "fromUserId", "toUserId"]
        .map((key) => {
          const profile = examples.users.find(
            (user) => user.id === row.data[key],
          );
          return [
            key,
            profile
              ? {
                  name: profile.data.displayName || profile.data.name,
                  phone: profile.data.phone,
                  email: profile.data.email,
                }
              : null,
          ];
        })
        .filter(([, person]) => person),
    ),
  });
  $("login-form").onsubmit = (event) => event.preventDefault();
  const notice = (message, type = "") => {
    const node = $("notice");
    node.hidden = !message;
    node.className = "notice " + type;
    node.textContent = message;
  };
  const rangeParams = () => {
    const range = dateRange(
      $("period").value,
      new Date(),
      $("from").value,
      $("to").value,
    );
    const params = new URLSearchParams();
    if (range) {
      params.set("from", range.start.toISOString().slice(0, 10));
      params.set("to", new Date(+range.end - 1).toISOString().slice(0, 10));
    }
    $("period-label").textContent = range
      ? params.get("from") + " – " + params.get("to") + " · UTC"
      : "All dates · UTC";
    return params;
  };
  const demoApi = (path, params) => {
    if (path === 'website-insights') {
      const today = new Date().toISOString().slice(0,10), days = [];
      for(let i=6;i>=0;i--) {const day=new Date();day.setUTCDate(day.getUTCDate()-i);const date=day.toISOString().slice(0,10);if((!params.get('from')||date>=params.get('from'))&&(!params.get('to')||date<=params.get('to')))days.push({date,visits:25+i*3,pageViews:36+i*4,androidDownloads:5+i,websiteViews:30+i*4,privacyViews:6});}
      const totals={visits:0,pageViews:0,androidDownloads:0,websiteViews:0,privacyViews:0};for(const day of days)for(const key of Object.keys(totals))totals[key]+=day[key];
      return {days,totals,from:params.get('from')||today,to:params.get('to')||today,trackingStartedAt:(days[0]?.date||today)+'T00:00:00.000Z',asOf:new Date().toISOString(),cacheSeconds:60};
    }
    if (path === "user-summary") {
      const profile = examples.users.find((row) => row.id === params.get("id"));
      const transactions = examples.walletTransactions
        .filter(
          (row) =>
            row.data.userId === params.get("id") &&
            inRange(
              row.data.timestamp,
              params.get("from")
                ? {
                    start: new Date(params.get("from")),
                    end: new Date(
                      new Date(params.get("to")).getTime() + 86400000,
                    ),
                  }
                : null,
            ),
        )
        .map(examplePeople);
      return {
        profile,
        authStatus: "Active",
        financialAccess: true,
        transactions,
        finance: {
          transactionCount: transactions.length,
          funding: 0,
          withdrawalPrincipal: 0,
          transferPrincipal: 0,
          recordsWithUnconfirmedStatus: 0,
        },
        tickets: { count: 0 },
        limited: false,
        errors: [],
        asOf: new Date().toISOString(),
        period: "Example selected period",
      };
    }
    const demoRange = params.get("from")
      ? {
          start: new Date(params.get("from")),
          end: new Date(new Date(params.get("to")).getTime() + 86400000),
        }
      : null;
    if (path === "session")
      return {
        uid: "preview",
        roles: ["analyst"],
        resources: Object.keys(RESOURCES),
        actions: [],
        version: VERSION,
        deploymentRevision: "example",
        appDeploymentStatus: "unverified",
      };
    if (path === "records") {
      const resource = RESOURCES[params.get("resource")];
      let rows = examples[params.get("resource")] || [];
      const term = params.get("search");
      if (!resource.fixedId && !(term && params.get("searchField") === "id"))
        rows = rows.filter((row) =>
          inRange(row.data[resource.dateField], demoRange),
        );
      if (term)
        rows = rows.filter((row) =>
          params.get("searchField") === "id"
            ? row.id === term
            : String(row.data[params.get("searchField")]) === term,
        );
      const status = params.get("status");
      if (status && status !== "all")
        rows = rows.filter((row) => row.data.status === status);
      return {
        rows: rows.map(examplePeople),
        cursor: null,
        source: resource.collection,
        newSchema: resource.newSchema,
        metadataOnly: resource.privateMetadata,
      };
    }
    if (path === "record") {
      const row = (examples[params.get("resource")] || []).find(
        (row) => row.id === params.get("id"),
      );
      if (!row) throw new Error("No example detail for this record.");
      return { ...examplePeople(row), version: "example" };
    }
    if (path === "events-insights") {
      const rows = examples.events.filter((row) =>
        inRange(row.data.dateTime, demoRange),
      );
      return {
        rows,
        stats: eventStats(rows, new Date(), "dateTime"),
        limited: false,
        asOf: new Date().toISOString(),
      };
    }
    if (path === "overview")
      return {
        cards: [
          {
            label: "New registrations",
            value: 248,
            definition: "Illustrative registrations in selected period.",
          },
          {
            label: "Verified registrations",
            value: 58,
            definition: "Example verified registrations.",
          },
          {
            label: "Events",
            value: 23,
            definition: "Example events in period.",
          },
          {
            label: "Tickets issued",
            value: 1248,
            definition: "Example active/used ticket records.",
          },
          {
            label: "Redeemed tickets",
            value: 846,
            definition: "Example used tickets.",
          },
          {
            label: "Venue / skill bookings",
            value: 72,
            definition: "Example booking requests.",
          },
        ],
        finance: {
          funding: 18520,
          withdrawalPrincipal: 8540,
          transferPrincipal: 6400,
          subscriptionIncome: 4280,
          boostIncome: 1750,
          referralExpenses: 360,
          pending: 6,
          failed: 2,
          staleProcessing: 1,
        },
        errors: [],
        coverage:
          "Example figures only. Sign in to connect the authenticated backend.",
        limited: false,
        asOf: new Date().toISOString(),
        definitions: { finance: "Example data; not financial reporting." },
      };
    if (path === "treasury")
      return {
        ledger: {
          balanceMajor: 48520,
          currency: "SLE",
          path: "platform/treasury",
        },
        provider: {
          availableMajor: 47280,
          availableMinor: 4728000,
          currency: "SLE",
          verifiedAccountId: "fac-example-main",
          accountName: "Hubpas Example Main",
          uvan: "Example UVAN",
        },
        configuration: { references: [], warnings: [] },
        fetchedAt: new Date().toISOString(),
        example: true,
      };
    if (path === "accounts")
      return {
        accounts: [
          {
            id: "fac-example-main",
            name: "Hubpas Example Main",
            uvan: "Example UVAN",
            currency: "SLE",
          },
        ],
        notice: "Example selection only.",
      };
    if (path === "account")
      return {
        id: params.get("id"),
        name: "Hubpas Example Main",
        uvan: "Example UVAN",
        currency: "SLE",
        availableMajor: 47280,
        availableMinor: 4728000,
        verifiedAt: new Date().toISOString(),
        selectionOnly: true,
        environment: "example",
      };
    if (path === "health")
      return {
        adminApi: VERSION,
        revision: "example",
        appFunctions: "Live deployment not inspected.",
        firestoreEdition: "Unverified",
        features: { spaces: "App-local toggle", skills: "App-local toggle" },
        financialActions:
          "Financial corrections require an approved server reconciliation workflow.",
      };
    throw new Error("This workflow is not available in preview.");
  };
  const pendingReads = new Map();
  function api(path, params = new URLSearchParams(), method = "GET", body) {
    if (method !== "GET")
      return requestApi(path, params, method, body).then((value) => {
        pendingReads.clear();
        return value;
      });
    const query = new URLSearchParams(params);
    if (state.forceFresh) query.set("fresh", "1");
    query.sort();
    const key = JSON.stringify([state.user?.uid, path, query.toString()]);
    if (pendingReads.has(key)) return pendingReads.get(key);
    const controller = new AbortController();
    const promise = requestApi(
      path,
      query,
      method,
      body,
      controller.signal,
    ).finally(() => {
      if (pendingReads.get(key) === promise) pendingReads.delete(key);
    });
    promise.cancel = () => controller.abort();
    pendingReads.set(key, promise);
    return promise;
  }
  async function requestApi(
    path,
    params = new URLSearchParams(),
    method = "GET",
    body,
    signal,
  ) {
    if (preview) {
      if (method !== "GET") throw new Error("Preview actions are disabled.");
      return demoApi(path, params);
    }
    const token = await state.user.getIdToken();
    const response = await fetcher(
      "/api/admin/" + path + (params.size ? "?" + params : ""),
      {
        method,
        headers: {
          Authorization: "Bearer " + token,
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        cache: "no-store",
        signal: signal
          ? AbortSignal.any([signal, AbortSignal.timeout(20000)])
          : AbortSignal.timeout(20000),
      },
    ).catch((error) => {
      if (path === "session" && error.name === "TimeoutError") {
        throw Object.assign(
          new Error(
            "The server access check took too long. Select Retry dashboard to reconnect using your signed-in account.",
          ),
          { status: 503 },
        );
      }
      throw error;
    });
    let value;
    try {
      value = await response.json();
    } catch {
      throw new Error(
        "Authenticated dashboard API is unavailable. Check the backend deployment and Hosting route.",
      );
    }
    if (!response.ok) {
      const error = new Error(
        value.error || "Request failed (" + response.status + ").",
      );
      error.status = response.status;
      throw error;
    }
    return value;
  }
  function nav() {
    let section = "";
    $("navigation").innerHTML = MODULES.map((module) => {
      const permitted =
        module.id === 'website' ? (preview || !state.session.deniedResources?.includes('websiteInsights')) :
        preview || module.id === "overview" || module.id === "treasury"
          ? preview ||
            module.id === "overview" ||
            (!state.session.deniedResources?.includes("treasury") &&
              state.session.roles.some((role) =>
                ["super_admin", "finance"].includes(role),
              ))
          : module.resources.some((resource) =>
              state.session.resources.includes(resource),
            );
      let heading = "";
      if (module.section !== section) {
        section = module.section;
        heading = '<div class="nav-group">' + escape(section) + "</div>";
      }
      return (
        heading +
        '<button class="nav-button" data-module="' +
        module.id +
        '" ' +
        (!permitted ? "disabled" : "") +
        ' aria-current="' +
        (state.module === module.id ? "page" : "false") +
        '"><span class="nav-icon" aria-hidden="true">' +
        module.icon +
        "</span>" +
        escape(module.label) +
        "</button>"
      );
    }).join("");
    $("navigation")
      .querySelectorAll("[data-module]")
      .forEach(
        (button) => (button.onclick = () => openModule(button.dataset.module)),
      );
  }
  function showContent(view) {
    for (const id of [
      "overview",
      "website-insights",
      "records",
      "treasury",
      "health",
      "detail-page",
    ])
      $(id).hidden = id !== view;
  }
  async function openModule(id, selection = null) {
    pendingReads.forEach((promise) => promise.cancel?.());
    pendingReads.clear();
    state.userSummaryRequest = (state.userSummaryRequest || 0) + 1;
    state.relatedOrigin = null;
    state.relatedUserId = null;
    state.module = id;
    state.parent = null;
    state.nested = null;
    state.eventDay = null;
    state.previous = [];
    state.cursor = null;
    state.rows = [];
    state.request++;
    $("dialog").hidden = true;
    document.body.classList.remove("nav-open");
    $("mobile-nav").setAttribute("aria-expanded", "false");
    const module = MODULES.find((item) => item.id === id) || MODULES[0];
    $("page-title").textContent = module.label;
    $("page-description").textContent =
      id === "overview"
        ? "Activity for the selected period, with clear sources and accounting definitions."
        : "Review existing records and make controlled changes when needed.";
    nav();
    notice(
      preview
        ? "LOCAL PREVIEW · Example data · Backend disconnected · All changes disabled."
        : "",
    );
    $("event-panel").hidden = id !== "events";
    $("related-back").hidden = true;
    if (id === "overview") {
      showContent("overview");
      await loadOverview();
      return;
    }
    if (id === "treasury") {
      showContent("treasury");
      await loadTreasury();
      return;
    }
    if (id === 'website') {
      $("page-description").textContent = 'Website visits and Android download interest for the selected dates.';
      showContent('website-insights');
      await loadWebsiteInsights();
      return;
    }
    showContent("records");
    state.resource =
      selection?.resource ||
      module.resources.find((resource) =>
        state.session.resources.includes(resource),
      ) ||
      module.resources[0];
    renderTabs();
    if (selection) {
      $("search-field").value = selection.searchField || "userId";
      $("record-search").value = selection.search || "";
    }
    if (id === "operations") loadHealth();
    else $("health").hidden = true;
    await Promise.all([
      loadRecords(),
      id === "events" && !selection ? loadEvents() : Promise.resolve(),
    ]);
  }
  function renderTabs() {
    const module = MODULES.find((module) => module.id === state.module);
    $("resource-tabs").innerHTML = module.resources
      .filter((resource) => state.session.resources.includes(resource))
      .map(
        (resource) =>
          '<button type="button" class="' +
          (resource === state.resource ? "active" : "") +
          '" data-resource="' +
          resource +
          '">' +
          escape(wordsForResource(resource)) +
          "</button>",
      )
      .join("");
    $("resource-tabs")
      .querySelectorAll("[data-resource]")
      .forEach(
        (button) =>
          (button.onclick = () => {
            state.resource = button.dataset.resource;
            state.parent = null;
            state.nested = null;
            state.previous = [];
            state.cursor = null;
            renderTabs();
            loadRecords();
          }),
      );
    const resource = RESOURCES[state.resource];
    $("parent-wrap").hidden = !resource.parent;
    $("nested-wrap").hidden = !resource.grandchild;
    $("parent-label").textContent =
      resource.parent === "events" ? "Event ID" : "User ID";
    $("parent-id").value = state.parent || "";
    $("nested-id").value = state.nested || "";
    $("record-status").disabled = !resource.fields.includes("status");
    $("source-label").textContent =
      wordsForResource(state.resource) + " · " + fieldLabel(resource.dateField);
    $("workflow-note").textContent =
      resource.notice ||
      (resource.newSchema
        ? "New admin workflow schema. It must be provisioned through the server rollout; absence is not treated as existing app data."
        : resource.privateMetadata
          ? "Metadata only. Message content, precise location, attachments and credentials are excluded."
          : resource.financial
            ? "Review payments and customer activity. Contact details are masked. Recorded payments cannot be edited here."
            : "");
    const allowed = [
      "id",
      ...[
        "userId",
        "eventId",
        "transferId",
        "orderId",
        "requestId",
        "checkoutSessionId",
        "hostId",
        "providerId",
        "clientId",
        "username",
        "displayName",
        "name",
        "invoiceNumber",
      ].filter((field) => resource.fields.includes(field)),
    ];
    $("search-field").innerHTML = allowed
      .map(
        (field) =>
          '<option value="' +
          field +
          '">' +
          (field === "id" ? "Record ID" : escape(titleCase(field))) +
          "</option>",
      )
      .join("");
    $("record-search").value = "";
    $("record-status").value = "all";
    $("event-panel").hidden =
      state.module !== "events" || state.resource !== "events";
  }
  async function loadRecords(cursor = null) {
    if (cursor === null) state.currentCursor = null;
    if (RESOURCES[state.resource].parent && !state.parent) {
      $("table").innerHTML =
        '<div class="empty">Choose a parent event or user ID above to inspect this subcollection.</div>';
      $("page-label").textContent = "Parent record required";
      $("records-loading").hidden = true;
      return;
    }
    const request = ++state.request;
    $("records-error").hidden = true;
    $("records-loading").hidden = false;
    $("next").disabled = true;
    $("previous").disabled = true;
    try {
      const params = rangeParams();
      params.set("resource", state.resource);
      params.set("status", $("record-status").value);
      if (state.parent) params.set("parent", state.parent);
      if (state.nested) params.set("nested", state.nested);
      if ($("record-search").value.trim()) {
        params.set("search", $("record-search").value.trim());
        params.set("searchField", $("search-field").value);
      }
      if (cursor) params.set("cursor", cursor);
      const result = await api("records", params);
      if (request !== state.request) return;
      state.rows = result.rows;
      state.cursor = result.cursor;
      renderTable(state.rows);
      $("page-label").textContent =
        state.rows.length +
        " results · page " +
        (state.previous.length + 1) +
        "";
      $("next").disabled = !state.cursor;
      $("previous").disabled = !state.previous.length;
      $("last-refresh").textContent =
        "Loaded " +
        new Date().toLocaleTimeString() +
        " · results cached up to 5 seconds";
    } catch (error) {
      if (request !== state.request) return;
      if ([401, 403].includes(error.status)) state.rows = [];
      $("records-error").hidden = false;
      $("records-error").textContent = error.message;
      renderTable(state.rows);
      $("page-label").textContent = state.rows.length
        ? "Previous results shown; refresh failed."
        : "No successful read. Permission errors are not empty results.";
    } finally {
      if (request === state.request) $("records-loading").hidden = true;
    }
  }
  function renderTable(rows) {
    if (!rows.length) {
      $("table").innerHTML =
        '<div class="empty">No activity found for these filters.<p class="small">Try a different date period or clear the search.</p></div>';
      return;
    }
    const fields = columnsFor(state.resource).filter(
      (key) =>
        !["walletBalance", "walletHeldBalance"].includes(key) ||
        ((preview ||
          state.session.roles.some((role) =>
            ["super_admin", "finance"].includes(role),
          )) &&
          !state.session.deniedResources?.includes("wallet")),
    );
    $("table").innerHTML =
      "<table><thead><tr>" +
      fields
        .map((field) => "<th>" + escape(fieldLabel(field)) + "</th>")
        .join("") +
      "<th>Review</th></tr></thead><tbody>" +
      rows
        .map(
          (row, index) =>
            "<tr>" +
            fields
              .map(
                (field) =>
                  '<td><span class="cell" title="' +
                  escape(
                    isPersonField(field)
                      ? personFor(row, field).name
                      : displayCell(row, field),
                  ) +
                  '">' +
                  (field === "status"
                    ? badge(row.data[field] || "not recorded")
                    : isPersonField(field)
                      ? "<strong>" +
                        escape(personFor(row, field).name) +
                        '</strong><span class="customer-contact">' +
                        escape(contactText(personFor(row, field))) +
                        "</span>"
                      : escape(displayCell(row, field))) +
                  "</span></td>",
              )
              .join("") +
            '<td><button class="inspect" type="button" data-open="' +
            index +
            '">View details →</button></td></tr>',
        )
        .join("") +
      "</tbody></table>";
    $("table")
      .querySelectorAll("[data-open]")
      .forEach(
        (button) =>
          (button.onclick = () =>
            openDetail(rows[Number(button.dataset.open)])),
      );
  }
  async function openDetail(row) {
    const session = state.session,
      resource = state.resource;
    state.returnFocus = document.activeElement;
    $("user-profile-view").hidden = true;
    $("detail-fields").hidden = false;
    if (resource === "users") {
      $("detail-page").append($("dialog"));
      $("dialog").className = "detail-page-content";
      $("dialog").querySelector(".dialog-card").setAttribute("role", "region");
      $("dialog").querySelector(".dialog-card").removeAttribute("aria-modal");
      $("close-detail").textContent = "← Back to users";
    } else {
      document.body.append($("dialog"));
      $("dialog").className = "dialog";
      $("dialog").querySelector(".dialog-card").setAttribute("role", "dialog");
      $("dialog")
        .querySelector(".dialog-card")
        .setAttribute("aria-modal", "true");
      $("close-detail").textContent = "Close";
    }
    try {
      const params = new URLSearchParams({
        resource: state.resource,
        id: row.id,
      });
      if (state.parent) params.set("parent", state.parent);
      if (state.nested) params.set("nested", state.nested);
      const detail =
        resource === "users"
          ? { ...row, data: row.data || {}, version: null }
          : await api("record", params);
      if (session !== state.session || resource !== state.resource) return;
      state.detail = detail;
      $("dialog-title").textContent = recordTitle(state.resource, detail);
      $("detail-source").textContent =
        "Summary · " + wordsForResource(state.resource);
      const technicalKeys = (key) =>
        /Id$|Ids$|^metadata$|^monime$|^audit$|^wallet$|^financialAccount$|^contentAccess$|^adminLimits$|^participantIds$|^coHosts$/.test(
          key,
        );
      const summaryFields = [
        ...new Set([
          ...columnsFor(state.resource),
          ...Object.keys(detail.data).filter((key) => !technicalKeys(key)),
        ]),
      ];
      $("detail-fields").innerHTML = summaryFields
        .filter(
          (key) =>
            detail.data[key] != null ||
            detail.people?.[key] ||
            (state.resource === "users" && key === "userId"),
        )
        .map(
          (key) =>
            "<div><dt>" +
            escape(fieldLabel(key)) +
            "</dt><dd>" +
            (isPersonField(key)
              ? "<strong>" +
                escape(personFor(detail, key).name) +
                '</strong><span class="customer-contact">' +
                escape(contactText(personFor(detail, key))) +
                "</span>"
              : escape(displayCell(detail, key))) +
            "</dd></div>",
        )
        .join("");
      $("technical-info").innerHTML =
        '<summary>Technical references · optional</summary><p class="small muted">For investigating a specific record or contacting technical support.</p><dl class="detail-fields"><div><dt>Record reference</dt><dd>' +
        escape(detail.id) +
        "</dd></div>" +
        Object.entries(detail.data)
          .filter(([key]) => technicalKeys(key) && !isPersonField(key))
          .map(
            ([key, value]) =>
              "<div><dt>" +
              escape(fieldLabel(key)) +
              "</dt><dd>" +
              escape(readable(key, value)) +
              "</dd></div>",
          )
          .join("") +
        (detail.linkage
          ? "<div><dt>Wallet account checks</dt><dd>" +
            escape(readable("linkage", detail.linkage)) +
            "</dd></div>"
          : "") +
        "</dl>";
      $("technical-info").open = false;
      $("action-form").hidden = true;
      $("access-form").hidden = true;
      $("detail-actions").innerHTML = Object.entries(ACTIONS)
        .filter(
          ([name, action]) =>
            action.resource === state.resource &&
            state.session.actions.includes(name),
        )
        .map(
          ([name, action]) =>
            '<button data-action="' +
            name +
            '">' +
            escape(action.label) +
            "</button>",
        )
        .join("");
      if (
        ["users", "adminRoleAssignments"].includes(state.resource) &&
        (preview || state.session.canManageAccess)
      ) {
        const button = document.createElement("button");
        button.textContent = "Manage dashboard access";
        button.onclick = () => openAccess(detail.id);
        $("detail-actions").append(button);
      }
      $("detail-actions")
        .querySelectorAll("[data-action]")
        .forEach(
          (button) =>
            (button.onclick = () => showAction(button.dataset.action)),
        );
      $("action-notice").textContent = RESOURCES[state.resource].financial
        ? "Financial history is read-only. No balance edits, payment retries, refunds or releases are offered."
        : state.session.actions.length
          ? "Changes require a reason and are recorded atomically with an audit entry."
          : "Management actions are unavailable until authorised server rollout enables them.";
      renderRelated(detail.id);
      $("dialog").hidden = false;
      if (resource === "users") {
        $("detail-actions")
          .querySelectorAll("[data-action]")
          .forEach((button) => (button.disabled = true));
        state.userPeriod = "this-month";
        showContent("detail-page");
        $("page-title").textContent =
          detail.data.displayName || detail.data.name || "Customer account";
        $("page-description").textContent = "Profile, wallet and activity";
        $("detail-fields").hidden = true;
        $("user-profile-view").hidden = false;
        await renderUserProfile(detail.id);
      }
      $("close-detail").focus();
    } catch (error) {
      if (error.name !== "AbortError") notice(error.message, "error");
    }
  }
  async function renderUserProfile(id) {
    const session = state.session,
      request = (state.userSummaryRequest || 0) + 1;
    state.userSummaryRequest = request;
    $("user-profile-view").innerHTML =
      '<div class="loader">Loading customer wallet and activity…</div>';
    try {
      const range = dateRange(state.userPeriod || "this-month", new Date());
      const params = new URLSearchParams({ id });
      if (range) {
        params.set("from", range.start.toISOString().slice(0, 10));
        params.set("to", new Date(+range.end - 1).toISOString().slice(0, 10));
      }
      const result = await api("user-summary", params);
      if (
        request !== state.userSummaryRequest ||
        session !== state.session ||
        state.detail?.id !== id
      )
        return;
      const d = result.profile.data,
        name = d.displayName || d.name || d.username || "Customer";
      state.detail = result.profile;
      $("detail-actions")
        .querySelectorAll("[data-action]")
        .forEach((button) => (button.disabled = !result.profile.version));
      const item = (label, value) =>
        '<div class="profile-field"><span>' +
        escape(label) +
        "</span><strong>" +
        escape(value ?? "Not recorded") +
        "</strong></div>";
      const card = (label, value, note) =>
        '<div class="card"><div class="metric-label">' +
        escape(label) +
        '</div><div class="metric-value">' +
        escape(value) +
        '</div><p class="small muted">' +
        escape(note) +
        "</p></div>";
      const f = result.finance;
      $("user-profile-view").innerHTML =
        '<div class="user-layout"><aside class="user-sidebar card"><div class="user-avatar">' +
        escape(name[0].toUpperCase()) +
        "</div><h2>" +
        escape(name) +
        '</h2><p class="muted">' +
        escape(
          readable("accountType", d.accountType || d.userPlan || "Customer"),
        ) +
        "</p>" +
        item("Email", d.email) +
        item("Phone", d.phone) +
        item("Plan", readable("plan", d.userPlan || d.accountType || "Basic")) +
        item("Joined", readable("createdAt", d.createdAt)) +
        item("Account status", result.authStatus) +
        (result.financialAccess
          ? item("Current wallet balance", leones(d.walletBalance ?? NaN)) +
            item("Held funds", leones(d.walletHeldBalance ?? NaN))
          : '<p class="muted">Wallet details are restricted for your role.</p>') +
        '<button id="profile-permissions" ' +
        (!(preview || state.session.canManageAccess) ? "disabled" : "") +
        '>Dashboard permissions</button></aside><section><div class="profile-toolbar"><h2>Wallet & activity</h2><div class="profile-periods">' +
        [
          ["today", "Daily"],
          ["last-7", "Weekly"],
          ["this-month", "Monthly"],
          ["all", "All time"],
        ]
          .map(
            ([value, label]) =>
              '<button data-user-period="' +
              value +
              '" class="' +
              (state.userPeriod === value ? "active" : "") +
              '">' +
              label +
              "</button>",
          )
          .join("") +
        '</div></div><p class="muted small">Activity follows the selected period. Wallet balances are snapshots cached up to 5 seconds; account status up to 30 seconds.</p><div class="metric-grid user-metrics">' +
        (result.financialAccess
          ? card(
              "Current wallet balance",
              leones(d.walletBalance ?? NaN),
              "Internal wallet ledger · SLE",
            ) +
            card(
              "Held funds",
              leones(d.walletHeldBalance ?? NaN),
              "Shown separately; not added to balance",
            )
          : "") +
        card(
          "Wallet activity",
          f ? String(f.transactionCount ?? "—") : "—",
          "Recorded wallet entries in period",
        ) +
        card(
          "Tickets",
          result.tickets ? String(result.tickets.count) : "—",
          "Issued in selected period",
        ) +
        (f
          ? card(
              "Wallet funding",
              leones(f.funding),
              "Confirmed recorded funding",
            ) +
            card(
              "Withdrawals",
              leones(f.withdrawalPrincipal),
              "Confirmed principal · excludes charges",
            )
          : "") +
        "</div>" +
        (result.limited
          ? '<p class="notice">Amounts summarize up to 50 recent wallet entries. Narrow the period for complete figures. Counts use server aggregations.</p>'
          : "") +
        result.errors
          .map(
            (error) =>
              '<p class="notice">' +
              escape(error.source) +
              ": " +
              escape(error.message) +
              "</p>",
          )
          .join("") +
        '<div class="card user-history"><div class="profile-toolbar"><h3>Recent wallet activity</h3><div><button id="profile-all-transactions">All transactions</button><button id="profile-all-tickets">All tickets</button></div></div><div class="user-transaction-list">' +
        (result.transactions.length
          ? result.transactions
              .map(
                (row) =>
                  '<div class="user-transaction"><div><strong>' +
                  escape(activityLabel(row.data.type)) +
                  '</strong><span class="small muted">' +
                  escape(readable("timestamp", row.data.timestamp)) +
                  '</span></div><div><span class="muted small">Recorded amount</span><strong>' +
                  escape(displayCell(row, "amount")) +
                  "</strong></div><div>" +
                  badge(row.data.status || "not recorded") +
                  "</div></div>",
              )
              .join("")
          : '<p class="muted">No wallet activity available for this period.</p>') +
        '</div><p class="small muted">Missing payment status means unconfirmed; it is not assumed to be successful.</p></div></section></div>';
      $("user-profile-view")
        .querySelectorAll("[data-user-period]")
        .forEach(
          (button) =>
            (button.onclick = () => {
              state.userPeriod = button.dataset.userPeriod;
              renderUserProfile(id);
            }),
        );
      $("profile-permissions").onclick = () => {
        openAccess(id);
        $("access-form").scrollIntoView?.({
          block: "start",
          behavior: "smooth",
        });
      };
      const related = async (module, resource) => {
        $("dialog").hidden = true;
        $("period").value = "all";
        await openModule(module, {
          resource,
          searchField: "userId",
          search: id,
        });
        state.relatedOrigin = "users";
        state.relatedUserId = id;
        $("related-back").hidden = false;
        $("related-back").textContent = "← Back to user";
      };
      $("profile-all-transactions").disabled =
        !state.session.resources.includes("walletTransactions");
      $("profile-all-tickets").disabled =
        !state.session.resources.includes("tickets");
      $("profile-all-transactions").onclick = () =>
        related("wallets", "walletTransactions");
      $("profile-all-tickets").onclick = () => related("events", "tickets");
    } catch (error) {
      if (request === state.userSummaryRequest)
        $("user-profile-view").innerHTML =
          '<p class="notice error">' + escape(error.message) + "</p>";
    }
  }
  async function openAccess(id) {
    $("action-form").hidden = true;
    $("access-form").hidden = false;
    $("access-status").textContent = "Loading dashboard permissions…";
    $("save-access").disabled = true;
    try {
      const value = preview
        ? {
            id,
            active: false,
            roles: [],
            deniedResources: [],
            deniedActions: [],
            version: 0,
            status: "example",
            catalog: {
              roles: [
                "super_admin",
                "finance",
                "operations",
                "support",
                "analyst",
              ],
              resources: [
                ...Object.keys(RESOURCES),
                "treasury",
                "operationsHealth",
                "websiteInsights",
              ],
              actions: Object.keys(ACTIONS),
            },
          }
        : await api("dashboard-access", new URLSearchParams({ id }));
      if (state.detail?.id !== id || $("access-form").hidden) return;
      state.access = value;
      const descriptions = {
        super_admin:
          "Owner: manage dashboard access and all permitted operations",
        finance: "Finance: treasury and wallet records",
        operations:
          "Operations: events, venues, services and account moderation",
        support: "Support: account and community metadata",
        analyst: "Analyst: read-only reporting",
      };
      const checklist = (element, items, selected, kind) =>
        ($(element).innerHTML = items
          .map(
            (key) =>
              '<label class="permission-option"><input type="checkbox" data-permission="' +
              kind +
              '" value="' +
              escape(key) +
              '" ' +
              (selected.includes(key) ? "checked" : "") +
              "><span>" +
              escape(
                kind === "role"
                  ? descriptions[key]
                  : kind === "action"
                    ? ACTIONS[key].label
                    : titleCase(key),
              ) +
              "</span></label>",
          )
          .join(""));
      checklist("access-roles", value.catalog.roles, value.roles, "role");
      checklist(
        "access-resources",
        value.catalog.resources,
        value.deniedResources,
        "resource",
      );
      checklist(
        "access-actions",
        value.catalog.actions,
        value.deniedActions,
        "action",
      );
      $("access-active").checked = value.active;
      $("access-reason").value = "";
      $("access-status").textContent = preview
        ? "Preview only. Sign in to manage actual dashboard permissions."
        : !state.session.accessManagementEnabled
          ? "Server access management is not enabled."
          : value.status +
            " · version " +
            value.version +
            ". Saving requires the user to sign in again.";
      $("save-access").disabled =
        preview ||
        !state.session.accessManagementEnabled ||
        id === state.session.uid;
      if (!preview && id === state.session.uid)
        $("access-status").textContent =
          "Another dashboard owner must change your access; self-edits are blocked.";
    } catch (error) {
      $("access-status").textContent = error.message;
    }
  }
  $("cancel-access").onclick = () => {
    $("access-form").hidden = true;
  };
  $("access-form").onsubmit = async (event) => {
    event.preventDefault();
    const checked = (kind) =>
      [
        ...$("access-form").querySelectorAll(
          '[data-permission="' + kind + '"]:checked',
        ),
      ].map((input) => input.value);
    $("save-access").disabled = true;
    try {
      const result = await api(
        "dashboard-access",
        new URLSearchParams(),
        "POST",
        {
          id: state.access.id,
          active: $("access-active").checked,
          roles: checked("role"),
          deniedResources: checked("resource"),
          deniedActions: checked("action"),
          expectedVersion: state.access.version,
          reason: $("access-reason").value,
          correlationId: crypto.randomUUID(),
        },
      );
      $("access-status").textContent = result.notice;
      state.access.version = result.version;
      await loadRecords();
    } catch (error) {
      $("access-status").textContent = error.message;
    } finally {
      $("save-access").disabled = preview;
    }
  };
  function renderRelated(id) {
    let links = [];
    if (
      state.resource === "walletTransactions" &&
      state.session.roles.some((role) =>
        ["finance", "super_admin"].includes(role),
      )
    ) {
      $("related-links").innerHTML =
        '<button id="inspect-provider">Check payment status</button><div id="provider-inspection" class="small"></div>';
      $("inspect-provider").onclick = async () => {
        $("provider-inspection").textContent = "Checking the payment provider…";
        try {
          const result = await api("reconcile", new URLSearchParams({ id }));
          $("provider-inspection").innerHTML =
            (result.providerChecks || [])
              .map(
                (check) =>
                  '<div class="list-line"><span>' +
                  escape(
                    {
                      "principal payout": "Withdrawal",
                      "principal transfer": "Transfer",
                      "platform fee transfer": "Platform charge",
                    }[check.kind] || titleCase(check.kind),
                  ) +
                  "</span>" +
                  badge(check.status) +
                  "</div>" +
                  (check.error
                    ? '<p class="muted">' + escape(check.error) + "</p>"
                    : ""),
              )
              .join("") +
            '<p class="muted">' +
            escape(result.notice || "") +
            "</p>";
        } catch (error) {
          $("provider-inspection").textContent = error.message;
        }
      };
      return;
    }
    if (state.resource === "users")
      links = [
        "followers",
        "following",
        "savedEvents",
        "notifications",
        "devices",
      ];
    if (state.resource === "events")
      links = ["eventGoing", "eventPolls", "raffleEntries", "raffleTickets"];
    if (state.resource === "eventPolls") links = ["pollVotes"];
    $("related-links").innerHTML = links
      .filter((resource) => state.session.resources.includes(resource))
      .map(
        (resource) =>
          '<button data-related="' +
          resource +
          '">' +
          escape(titleCase(resource)) +
          "</button>",
      )
      .join("");
    $("related-links")
      .querySelectorAll("[data-related]")
      .forEach(
        (button) =>
          (button.onclick = () => {
            const next = button.dataset.related;
            if (next === "pollVotes") state.nested = id;
            else state.parent = id;
            state.relatedOrigin = state.resource;
            state.relatedId = id;
            state.resource = next;
            state.previous = [];
            renderTabs();
            $("dialog").hidden = true;
            showContent("records");
            if (state.relatedOrigin === "users") {
              state.relatedUserId = id;
              $("period").value = "all";
              $("related-back").textContent = "← Back to user";
              $("parent-wrap").hidden = true;
            }
            $("page-title").textContent = titleCase(next);
            $("page-description").textContent =
              "Related records for " +
              (state.detail?.data.displayName ||
                state.detail?.data.name ||
                "this account");
            $("related-back").hidden = false;
            $("source-label").textContent =
              titleCase(next) +
              " · " +
              (state.detail?.data.displayName ||
                state.detail?.data.name ||
                "Related records");
            loadRecords();
          }),
      );
  }
  function showAction(name) {
    $("action-form").hidden = false;
    $("action-title").textContent = ACTIONS[name].label;
    $("action-description").textContent = ACTIONS[name].description;
    $("action-form").dataset.action = name;
    $("reason").value = "";
    $("action-error").textContent = "";
    let extra = "";
    if (name === "user.setVerification")
      extra =
        '<label class="field"><span>Verification</span><select id="verified-value"><option value="true">Verified</option><option value="false">Not verified</option></select></label>';
    if (name === "user.publishLimit")
      extra =
        '<label class="field"><span>Maximum published events</span><input id="publishing-limit" type="number" min="1" max="10000" value="1" required></label>';
    if (name === "user.grantPlan")
      extra =
        '<label class="field"><span>Plan</span><select id="grant-plan"><option value="basic">Basic</option><option value="pro">Pro</option><option value="business">Business</option></select></label><label class="field"><span>Expires through (UTC)</span><input id="grant-expiry" type="date" required></label>';
    if (name === "event.removeCoHost")
      extra =
        '<label class="field"><span>Existing co-host user ID</span><select id="co-host-id">' +
        (state.detail.data.coHosts || [])
          .map(
            (member) =>
              '<option value="' +
              escape(member.userId) +
              '">' +
              escape(member.userId) +
              "</option>",
          )
          .join("") +
        "</select></label>";
    if (name === "pricing.update") {
      const fields = Object.fromEntries(
        Object.entries(state.detail.data).filter(([key]) =>
          /^(basic|pro|business).*(PriceMajor)$|^boostPricePerDayMajor$/.test(
            key,
          ),
        ),
      );
      extra =
        '<label class="field"><span>Stored pricing fields to update (JSON)</span><textarea id="pricing-values">' +
        escape(JSON.stringify(fields, null, 2)) +
        "</textarea></label>";
    }
    $("action-extra").innerHTML = extra;
    $("reason").focus();
  }
  $("action-form").onsubmit = async (event) => {
    event.preventDefault();
    $("confirm-action").disabled = true;
    try {
      const payload = {
        action: $("action-form").dataset.action,
        id: state.detail.id,
        expectedVersion: state.detail.version,
        reason: $("reason").value.trim(),
        correlationId: crypto.randomUUID(),
      };
      if (payload.action === "user.setVerification")
        payload.verified = $("verified-value").value === "true";
      if (payload.action === "user.publishLimit")
        payload.limit = Number($("publishing-limit").value);
      if (payload.action === "user.grantPlan") {
        payload.plan = $("grant-plan").value;
        payload.expiresAt = $("grant-expiry").value + "T23:59:59.999Z";
      }
      if (payload.action === "event.removeCoHost")
        payload.coHostId = $("co-host-id").value;
      if (payload.action === "pricing.update")
        payload.prices = JSON.parse($("pricing-values").value);
      await api("actions", new URLSearchParams(), "POST", payload);
      $("dialog").hidden = true;
      notice("Change saved with an audit record.", "success");
      await loadRecords();
    } catch (error) {
      $("action-error").textContent = error.message;
    } finally {
      $("confirm-action").disabled = false;
    }
  };
  async function loadWebsiteInsights() {
    const request=++state.request, target=$('website-insights');
    const card=(label,value,note)=>'<div class="card"><div class="metric-label">'+escape(label)+'</div><div class="metric-value">'+escape(value)+'</div><p class="small muted">'+escape(note)+'</p></div>';
    target.innerHTML='<div class="loader">Loading website activity…</div>';
    try {
      const params=rangeParams();if($('period').value==='all')params.set('all','1');
      const result=await api('website-insights',params);
      if(request!==state.request || state.module!=='website')return;
      const t=result.totals, number=value=>new Intl.NumberFormat('en-SL').format(value||0), trend=result.days.slice(-31), max=Math.max(1,...trend.map(day=>day.pageViews));
      target.innerHTML='<div class="metric-grid">'+card('Visits',number(t.visits),'Browser-tab sessions · resets after 30 minutes of inactivity')+card('Page views',number(t.pageViews),'Website and privacy page loads, including repeat views')+card('Android download clicks',number(t.androidDownloads),'Download button clicks · not completed downloads or installs')+card('Clicks per 100 visits',t.visits?(t.androidDownloads/t.visits*100).toFixed(1):'—','Interest indicator · a visitor can download more than once')+'</div><div class="card" style="margin-top:20px"><h2>Page views by day</h2><p class="muted small">Latest '+trend.length+' days shown · UTC · blue bars show page views</p><div class="website-trend" role="img" aria-label="Daily page views; exact counts are in the table below">'+trend.map(day=>'<div class="website-trend-day" title="'+escape(day.date+': '+day.pageViews+' views')+'"><span style="height:'+Math.max(1,Math.round(day.pageViews/max*100))+'%"></span><small>'+escape(day.date.slice(8))+'</small></div>').join('')+'</div></div><div class="two-col" style="margin-top:20px"><div class="card"><h2>Pages viewed</h2><div class="list-line"><span>Hubpas website</span><strong>'+number(t.websiteViews)+'</strong></div><div class="list-line"><span>Privacy policy</span><strong>'+number(t.privacyViews)+'</strong></div></div><div class="card"><h2>About these numbers</h2><p>Tracking started '+escape(result.trackingStartedAt?new Date(result.trackingStartedAt).toLocaleDateString('en-GB',{timeZone:'UTC'}):'when collection is enabled')+'. Earlier visits and downloads cannot be recovered.</p><p class="muted small">Aggregate counts, not unique people. Known bots and rapid repeated clicks are filtered where possible. Blocked tracking or storage can cause undercounts or repeat sessions. No visitor identities are stored.</p></div></div><div class="card" style="margin-top:20px"><h2>Daily activity</h2><p class="muted small">'+(result.allTime?'All-time totals above; daily rows cover the latest 366 days.':'Selected date range · UTC')+'</p><div class="website-table-wrap"><table class="website-table"><thead><tr><th>Date</th><th>Visits</th><th>Page views</th><th>Android download clicks</th></tr></thead><tbody>'+[...result.days].reverse().map(day=>'<tr><td>'+escape(day.date)+'</td><td>'+number(day.visits)+'</td><td>'+number(day.pageViews)+'</td><td>'+number(day.androidDownloads)+'</td></tr>').join('')+'</tbody></table></div></div><p class="muted small">Updated '+escape(new Date(result.asOf).toLocaleTimeString('en-GB',{timeZone:'UTC'}))+' UTC · reports cached for up to 60 seconds.</p>';
    } catch(error) {if(request===state.request)target.innerHTML='<div class="error-box">Website insights could not load: '+escape(error.message)+'</div>';}
  }
  async function loadOverview() {
    const request = ++state.request;
    $("overview").innerHTML =
      '<div class="loader">Loading period summary…</div>';
    try {
      const result = await api("overview", rangeParams());
      if (request !== state.request) return;
      $("overview").innerHTML =
        '<div id="finance-overview"></div><h2 class="overview-section-title">Platform activity</h2><div class="metric-grid">' +
        result.cards
          .map(
            (card) =>
              '<div class="card"><div class="metric-label">' +
              escape(card.label) +
              '</div><div class="metric-value">' +
              (card.value == null ? "—" : Number(card.value).toLocaleString()) +
              '</div><div class="metric-definition">' +
              escape(card.definition) +
              "</div></div>",
          )
          .join("") +
        '</div><div class="notice' +
        (result.limited ? "" : " success") +
        '">' +
        escape(result.coverage) +
        '</div><div class="two-col"><div class="card"><h2>Financial activity · SLE</h2><p class="muted small">Successful recorded operations. Refunds and reversal entries are separate.</p>' +
        (result.finance
          ? Object.entries(result.finance)
              .map(
                ([key, value]) =>
                  '<div class="list-line"><span>' +
                  escape(titleCase(key)) +
                  "</span><strong>" +
                  (/pending|failed|stale|records|Count|Transactions|reversed|partial/.test(
                    key,
                  )
                    ? value
                    : leones(value)) +
                  "</strong></div>",
              )
              .join("")
          : '<p class="muted">Financial metrics unavailable for this role or backend.</p>') +
        (result.customerLiabilities
          ? '<h3>Customer wallets · current snapshot</h3><div class="list-line"><span>Wallet liabilities</span><strong>' +
            leones(result.customerLiabilities.walletBalanceMajor) +
            '</strong></div><div class="list-line"><span>Held funds</span><strong>' +
            leones(result.customerLiabilities.heldBalanceMajor) +
            '</strong></div><p class="small muted">' +
            escape(result.customerLiabilities.source) +
            " Snapshot " +
            escape(result.customerLiabilities.asOf || result.asOf) +
            "; cached up to 60 seconds, independent of the period filter.</p>"
          : "") +
        '</div><div class="card"><h2>Operational alerts</h2>' +
        (result.errors.length
          ? result.errors
              .map(
                (error) =>
                  '<p class="notice error">' +
                  escape(error.resource) +
                  ": " +
                  escape(error.message) +
                  "</p>",
              )
              .join("")
          : '<p class="muted">No source errors in the current read.</p>') +
        '<p class="definition-list">' +
        escape(result.definitions?.finance || "") +
        '</p><button id="overview-events">Explore events →</button><button id="overview-wallets">Review wallet operations →</button></div></div><p class="muted small">As of ' +
        escape(result.asOf) +
        " · overview cached up to 30 seconds · backend version " +
        escape(state.session.version) +
        " · app deployment " +
        escape(state.session.appDeploymentStatus) +
        "</p>";
      $("overview-events").onclick = () => openModule("events");
      $("overview-wallets").onclick = () => openModule("wallets");
      renderFinanceOverview(result, request);
    } catch (error) {
      if (request === state.request)
        $("overview").innerHTML =
          '<div class="notice error">' + escape(error.message) + "</div>";
    }
  }
  async function renderFinanceOverview(summary, request) {
    if (!summary.finance && !summary.customerLiabilities) return;
    const card = (label, value, note) =>
      '<div class="card"><div class="metric-label">' +
      escape(label) +
      '</div><div class="metric-value">' +
      escape(value) +
      '</div><p class="small muted">' +
      escape(note) +
      "</p></div>";
    const render = (treasury) => {
      if (request !== state.request || state.module !== "overview") return;
      const f = summary.finance,
        c = summary.customerLiabilities,
        counters = treasury?.ledger?.counters || {};
      const entries = Object.entries(counters).filter(
        ([, v]) => typeof v === "number" && Number.isFinite(v),
      );
      const earnings = entries.length
        ? entries.reduce((sum, [, v]) => sum + v, 0)
        : null;
      $("finance-overview").innerHTML =
        '<h2 class="overview-section-title">Finance at a glance · SLE</h2><div class="metric-grid finance-primary">' +
        card(
          "Main account · available balance",
          leones(treasury?.provider?.availableMajor ?? NaN),
          treasury?.provider?.verifiedAccountId
            ? "Monime verified · internal ledger " +
                leones(treasury.ledger.balanceMajor ?? NaN)
            : treasury?.restricted
              ? "Main account access is restricted for your role."
              : treasury
                ? "Provider balance unavailable. Internal ledger " +
                  leones(treasury.ledger?.balanceMajor ?? NaN)
                : "Connecting to the main account…",
        ) +
        card(
          "Recorded charges & commission",
          leones(earnings ?? NaN),
          "Stored treasury counters · all time · " +
            entries.length +
            " of 5 categories recorded",
        ) +
        card(
          "Funds in customer wallets",
          leones(c?.walletBalanceMajor ?? NaN),
          "Current internal balances · Hubpas excluded",
        ) +
        card(
          "Held customer funds",
          leones(c?.heldBalanceMajor ?? NaN),
          "Separate held-fund snapshot; not added to wallet total",
        ) +
        card(
          "Confirmed transaction volume",
          leones(f?.transactionVolume ?? NaN),
          "Selected period · deduplicated confirmed principal",
        ) +
        card(
          "Wallet activity records",
          f ? String(f.transactionCount ?? "—") : "—",
          "Selected period · bounded summary" +
            (summary.limited ? " · incomplete" : ""),
        ) +
        '</div><div class="two-col finance-breakdown"><div class="card"><h3>What we have earned · stored counters</h3>' +
        [
          ["withdrawalFees", "Withdrawal charges"],
          ["ticketSalesFees", "Ticket commission"],
          ["raffleFees", "Raffle commission"],
          ["subscriptionRevenue", "Subscription revenue / fees"],
          ["boostRevenue", "Event promotion revenue"],
        ]
          .map(
            ([key, label]) =>
              '<div class="list-line"><span>' +
              label +
              "</span><strong>" +
              leones(counters[key] ?? NaN) +
              "</strong></div>",
          )
          .join("") +
        '<p class="small muted">Counters are all-time accounting records, not a period profit calculation. Provider fees are not counted as our income.</p></div><div class="card"><h3>Transactions in the selected period</h3>' +
        [
          ["successfulTransactions", "Confirmed entries"],
          ["pending", "Pending"],
          ["failed", "Failed"],
          ["recordsWithUnconfirmedStatus", "Status not recorded"],
        ]
          .map(
            ([key, label]) =>
              '<div class="list-line"><span>' +
              label +
              "</span><strong>" +
              escape(f?.[key] ?? "—") +
              "</strong></div>",
          )
          .join("") +
        '<p class="small muted">' +
        escape(summary.coverage) +
        " Unknown statuses, failed payments and reversals are excluded from confirmed volume. Main account reads are cached up to 15 seconds; customer wallet totals up to 60 seconds.</p></div></div>";
    };
    if (
      !state.session.roles.some((role) =>
        ["super_admin", "finance"].includes(role),
      ) ||
      state.session.deniedResources?.includes("treasury")
    ) {
      render({ restricted: true });
      return;
    }
    render(null);
    try {
      const treasury = await api("treasury");
      render(treasury);
    } catch (error) {
      if (request === state.request) {
        render({ provider: {}, ledger: {} });
        $("finance-overview").insertAdjacentHTML(
          "beforeend",
          '<p class="notice">Main account: ' + escape(error.message) + "</p>",
        );
      }
    }
  }
  async function loadTreasury() {
    const session = state.session;
    const old = state.treasury;
    try {
      const result = await api("treasury");
      if (state.session !== session || state.module !== "treasury") return;
      if (
        result.provider.availableMajor == null &&
        old?.provider.availableMajor != null
      ) {
        result.provider = old.provider;
        result.stale = true;
        result.providerLastSuccess = old.providerLastSuccess || old.fetchedAt;
      }
      state.treasury = result;
      renderTreasury(result);
      try {
        const accounts = await api("accounts");
        if (state.session !== session || state.module !== "treasury") return;
        $("main-account-select").innerHTML =
          '<option value="">Main configured account</option>' +
          accounts.accounts
            .map(
              (account) =>
                '<option value="' +
                escape(account.id) +
                '">' +
                escape((account.name || account.id) + " · " + account.id) +
                "</option>",
            )
            .join("");
      } catch (error) {
        $("account-selector-note").textContent = error.message;
      }
    } catch (error) {
      if (state.session !== session || state.module !== "treasury") return;
      if (old) {
        old.stale = true;
        renderTreasury(old);
        $("treasury-error").textContent = error.message;
      } else
        $("treasury").innerHTML =
          '<div class="notice error">' + escape(error.message) + "</div>";
    }
  }
  function renderTreasury(result) {
    const provider = result.provider;
    const delta =
      !result.stale &&
      provider.availableMajor != null &&
      result.ledger.balanceMajor != null
        ? provider.availableMajor - result.ledger.balanceMajor
        : null;
    $("treasury").innerHTML =
      '<div class="finance-grid"><div class="card"><div class="eyebrow">' +
      (preview
        ? "Example provider data"
        : "Monime · " +
          (result.stale
            ? "STALE"
            : provider.verifiedAccountId
              ? "verified account"
              : "UNAVAILABLE · not verified")) +
      '</div><h2>Available balance</h2><div class="metric-value">' +
      leones(provider.availableMajor ?? NaN) +
      '</div><div class="account-fields"><span class="code">' +
      escape(provider.verifiedAccountId || "Account not verified") +
      "</span><span>" +
      escape(provider.accountName || "") +
      '</span><span class="small muted">UVAN: ' +
      escape(provider.uvan || "Not returned") +
      '</span><span class="small muted">SLE · raw minor units: ' +
      escape(provider.availableMinor ?? "Unavailable") +
      '</span></div><p class="small ' +
      (result.stale ? "stale" : "muted") +
      '">Last successful provider refresh: ' +
      escape(
        provider.availableMajor != null
          ? result.providerLastSuccess || result.fetchedAt
          : "None",
      ) +
      '</p><label class="field"><span>Main account selector · verified accounts in configured Space</span><select id="main-account-select"><option>Loading verified accounts…</option></select></label><p id="account-selector-note" class="muted small">Selection changes inspection only. Payment routing is not modified.</p><div id="selected-account"></div></div><div class="card"><div class="eyebrow">Firestore · internal accounting ledger</div><h2>Treasury ledger</h2><div class="metric-value">' +
      leones(result.ledger.balanceMajor ?? NaN) +
      '</div><p class="code">platform/treasury.balance · major SLE units</p><p class="muted">This is not the authoritative provider balance or a complete revenue total.</p><div class="list-line"><span>Provider minus ledger</span><strong>' +
      leones(delta ?? NaN) +
      '</strong></div><p class="muted small">Discrepancies can reflect held funds, timing or missing ledger entries. They do not authorise a balance correction.</p><p class="muted">User/host/venue wallets and held funds are separate liabilities; overlapping platform mirrors are never added here.</p></div></div><div class="card" style="margin-top:16px"><h2>Configuration & reconciliation</h2><div id="treasury-error" class="stale"></div>' +
      (result.configuration.warnings.length
        ? result.configuration.warnings
            .map(
              (warning) =>
                '<div class="notice error">' + escape(warning) + "</div>",
            )
            .join("")
        : '<p class="muted">' +
          (preview
            ? "Example only: no live configuration was checked."
            : "No conflicting account IDs in this response.") +
          "</p>") +
      (result.configuration.notes || [])
        .map((note) => '<p class="notice">' + escape(note) + "</p>")
        .join("") +
      "<h3>Recorded treasury counters · all time</h3>" +
      Object.entries(result.ledger.counters || {})
        .map(
          ([key, value]) =>
            '<div class="list-line"><span>' +
            escape(titleCase(key)) +
            "</span><strong>" +
            leones(value ?? NaN) +
            "</strong></div>",
        )
        .join("") +
      '<p class="small muted">Counters are separate accounting fields, not amounts to add to the available balance.</p>' +
      result.configuration.references
        .map(
          (ref) =>
            '<div class="list-line"><span class="code">' +
            escape(ref.source) +
            '</span><span class="code">' +
            escape(ref.id) +
            "</span></div>",
        )
        .join("") +
      '<p class="small muted">Retries, refunds, payment routing changes and held-fund releases require an approved server reconciliation workflow.</p></div>';
    $("main-account-select").onchange = async () => {
      const id = $("main-account-select").value;
      if (!id) {
        $("selected-account").innerHTML = "";
        return;
      }
      try {
        const account = await api("account", new URLSearchParams({ id }));
        $("selected-account").innerHTML =
          "<p>" +
          escape(account.name || account.id) +
          " · " +
          escape(account.uvan || "UVAN not returned") +
          "</p><strong>" +
          leones(account.availableMajor) +
          '</strong><p class="small muted">' +
          escape(account.environment) +
          " · inspected " +
          escape(account.verifiedAt) +
          " · routing unchanged</p>";
      } catch (error) {
        $("selected-account").textContent = error.message;
      }
    };
  }
  let eventsRequest = 0;
  async function loadEvents() {
    const request = ++eventsRequest,
      session = state.session;
    try {
      const result = await api("events-insights", rangeParams());
      if (
        request !== eventsRequest ||
        session !== state.session ||
        state.module !== "events"
      )
        return;
      state.eventRows = result.rows;
      $("calendar-coverage").textContent = result.limited
        ? "Limited to 120 event summaries; narrow the period."
        : "Event metadata for selected period · dateTime in UTC";
      renderCalendar();
    } catch (error) {
      if (
        request !== eventsRequest ||
        session !== state.session ||
        state.module !== "events"
      )
        return;
      $("calendar-coverage").textContent = error.message;
      $("calendar-grid").innerHTML = "";
    }
  }
  function renderCalendar() {
    const location = $("event-location").value,
      type = $("event-type").value,
      timing = $("event-timing").value;
    const all = state.eventRows;
    for (const [id, field, label] of [
      ["event-location", "location", "All locations"],
      ["event-type", "category", "All categories"],
    ]) {
      const selected = $(id).value;
      $(id).innerHTML =
        '<option value="all">' +
        label +
        "</option>" +
        [...new Set(all.map((row) => row.data[field] || "Not specified"))]
          .map(
            (value) =>
              '<option value="' +
              escape(value) +
              '">' +
              escape(value) +
              "</option>",
          )
          .join("");
      $(id).value = selected || "all";
    }
    const rows = all.filter(
      (row) =>
        (!location || location === "all" || row.data.location === location) &&
        (!type || type === "all" || row.data.category === type) &&
        (timing === "all" ||
          (timing === "upcoming"
            ? new Date(row.data.dateTime) >= new Date()
            : new Date(row.data.dateTime) < new Date())),
    );
    const stats = eventStats(rows, new Date(), "dateTime");
    $("event-metrics").innerHTML = [
      ["Events", stats.total],
      ["Upcoming", stats.upcoming],
      ["Past", stats.past],
      ["Cancelled", stats.cancelled],
    ]
      .map(
        ([label, value]) =>
          '<div class="card"><span class="muted small">' +
          label +
          '</span><div class="metric-value">' +
          value +
          "</div></div>",
      )
      .join("");
    const breakdown = (pairs) =>
      pairs
        .map(
          ([label, count]) =>
            '<div class="breakdown"><span>' +
            escape(label) +
            '</span><div class="bar"><span style="width:' +
            Math.round((count / Math.max(1, stats.total)) * 100) +
            '%"></span></div><strong>' +
            count +
            "</strong></div>",
        )
        .join("") || '<p class="muted">No matching events.</p>';
    $("event-locations").innerHTML = breakdown(stats.locations);
    $("event-types").innerHTML = breakdown(stats.types);
    const [year, month] = $("calendar-month").value.split("-").map(Number),
      first = new Date(Date.UTC(year, month - 1, 1)),
      start = new Date(first);
    start.setUTCDate(1 - ((first.getUTCDay() + 6) % 7));
    let content = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
      .map((day) => '<div class="weekday">' + day + "</div>")
      .join("");
    for (let i = 0; i < 42; i++) {
      const date = new Date(+start + i * 86400000),
        key = date.toISOString().slice(0, 10);
      content +=
        '<div class="day ' +
        (date.getUTCMonth() !== month - 1 ? "outside" : "") +
        " " +
        (state.eventDay === key ? "selected" : "") +
        '"><button class="day-number" data-day="' +
        key +
        '" aria-label="Events on ' +
        key +
        '">' +
        date.getUTCDate() +
        "</button>" +
        rows
          .filter((row) => String(row.data.dateTime).slice(0, 10) === key)
          .map(
            (row) =>
              '<button class="calendar-event" data-event="' +
              escape(row.id) +
              '">' +
              escape(row.data.title || row.id) +
              "</button>",
          )
          .join("") +
        "</div>";
    }
    $("calendar-grid").innerHTML = content;
    $("calendar-grid")
      .querySelectorAll("[data-day]")
      .forEach(
        (button) =>
          (button.onclick = () => {
            state.eventDay = button.dataset.day;
            renderCalendar();
            state.resource = "events";
            renderTable(
              rows.filter(
                (row) => row.data.dateTime.slice(0, 10) === state.eventDay,
              ),
            );
            $("page-label").textContent =
              "Calendar day " + state.eventDay + " · bounded metadata results";
            $("previous").disabled = true;
            $("next").disabled = true;
          }),
      );
    $("calendar-grid")
      .querySelectorAll("[data-event]")
      .forEach(
        (button) =>
          (button.onclick = () => {
            state.resource = "events";
            openDetail(rows.find((row) => row.id === button.dataset.event));
          }),
      );
  }
  async function loadHealth() {
    try {
      const result = await api("health");
      if (state.module !== "operations") return;
      $("health").hidden = false;
      $("health").innerHTML =
        '<div class="card"><h2>Backend & service health</h2><ul>' +
        Object.entries(result)
          .map(
            ([key, value]) =>
              "<li>" +
              escape(titleCase(key)) +
              ": " +
              escape(
                typeof value === "object" ? JSON.stringify(value) : value,
              ) +
              "</li>",
          )
          .join("") +
        "</ul></div>";
    } catch (error) {
      notice(error.message, "error");
    }
  }
  function calendarMonth(offset) {
    const [year, month] = $("calendar-month").value.split("-").map(Number),
      start = new Date(Date.UTC(year, month - 1 + offset, 1)),
      end = new Date(Date.UTC(year, month + offset, 0));
    $("calendar-month").value = start.toISOString().slice(0, 7);
    $("period").value = "custom";
    $("from").value = start.toISOString().slice(0, 10);
    $("to").value = end.toISOString().slice(0, 10);
    $("custom-dates").hidden = false;
    state.previous = [];
    state.eventDay = null;
    loadRecords();
    loadEvents();
  }
  $("calendar-month").value = currentMonth();
  $("calendar-prev").onclick = () => calendarMonth(-1);
  $("calendar-next").onclick = () => calendarMonth(1);
  $("calendar-month").onchange = () => calendarMonth(0);
  for (const id of ["event-location", "event-type", "event-timing"])
    $(id).onchange = renderCalendar;
  $("calendar-clear").onclick = () => {
    state.eventDay = null;
    renderCalendar();
    loadRecords();
  };
  $("period").onchange = () => {
    $("custom-dates").hidden = $("period").value !== "custom";
    if ($("period").value !== "custom") $("apply-period").click();
  };
  $("apply-period").onclick = async () => {
    try {
      const params = rangeParams();
      state.previous = [];
      state.eventDay = null;
      if (params.get("from"))
        $("calendar-month").value = params.get("from").slice(0, 7);
      if (state.module === "overview") await loadOverview();
      else if (state.module === 'website') await loadWebsiteInsights();
      else if (state.module === "treasury") await loadTreasury();
      else {
        await Promise.all([
          loadRecords(),
          state.module === "events" ? loadEvents() : Promise.resolve(),
        ]);
      }
    } catch (error) {
      notice(error.message, "error");
    }
  };
  $("refresh").onclick = async () => {
    state.forceFresh = true;
    try {
      await $("apply-period").onclick();
    } finally {
      state.forceFresh = false;
    }
  };
  $("record-filter").onsubmit = (event) => {
    event.preventDefault();
    state.parent = $("parent-id").value.trim() || null;
    state.nested = $("nested-id").value.trim() || null;
    state.previous = [];
    loadRecords();
  };
  $("next").onclick = () => {
    state.previous.push(state.currentCursor || null);
    state.currentCursor = state.cursor;
    loadRecords(state.cursor);
  };
  $("previous").onclick = () => {
    state.currentCursor = state.previous.pop();
    loadRecords(state.currentCursor);
  };
  $("related-back").onclick = () => {
    if (state.relatedOrigin === "users" && state.relatedUserId) {
      const id = state.relatedUserId;
      state.module = "users";
      state.resource = "users";
      state.parent = null;
      state.nested = null;
      state.previous = [];
      renderTabs();
      $("related-back").hidden = true;
      openDetail({ id });
      return;
    }
    state.resource = state.relatedOrigin;
    state.parent = RESOURCES[state.resource].parent ? state.parent : null;
    state.nested = null;
    state.previous = [];
    $("related-back").hidden = true;
    renderTabs();
    loadRecords();
  };
  $("close-detail").onclick = () => {
    $("dialog").hidden = true;
    if ($("dialog").classList.contains("detail-page-content")) {
      openModule("users");
      return;
    }
    state.returnFocus?.focus();
  };
  $("cancel-action").onclick = () => {
    $("action-form").hidden = true;
  };
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if ($("dialog").classList.contains("dialog")) {
        $("dialog").hidden = true;
        state.returnFocus?.focus();
      }
      document.body.classList.remove("nav-open");
      $("mobile-nav").setAttribute("aria-expanded", "false");
    }
    if (
      event.key === "Tab" &&
      !$("dialog").hidden &&
      $("dialog").classList.contains("dialog")
    ) {
      const nodes = [
        ...$("dialog").querySelectorAll(
          "button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled])",
        ),
      ].filter((node) => !node.closest("[hidden]"));
      const first = nodes[0],
        last = nodes.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
  });
  $("mobile-nav").onclick = () => {
    document.body.classList.toggle("nav-open");
    $("mobile-nav").setAttribute(
      "aria-expanded",
      String(document.body.classList.contains("nav-open")),
    );
  };
  async function enter() {
    const user = state.user;
    const session = await api("session");
    if (!preview && state.user !== user) return;
    state.session = session;
    $("login").hidden = true;
    $("app").hidden = false;
    $("role").textContent =
      (preview ? "Preview · " : "") + state.session.roles.join(", ");
    $("identity").textContent = preview
      ? "Local design preview"
      : state.session.uid;
    $("version").textContent = VERSION;
    $("signout").hidden = preview;
    $("live-signin").hidden = !preview;
    if (!preview)
      $("identity").textContent = "Live Firestore · " + state.session.uid;
    await openModule("overview");
  }
  if (preview) {
    await enter();
  } else {
    const [
      { initializeApp },
      {
        getAuth,
        onAuthStateChanged,
        signInWithEmailAndPassword,
        signInWithCustomToken,
        signOut,
      },
    ] = await (authLoader
      ? authLoader()
      : Promise.all([
          import("https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js"),
          import("https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js"),
        ]));
    const firebase = initializeApp({
      apiKey: "AIzaSyCMTs10x-2tnzivvx5PW7d9r3KdfncUKpo",
      authDomain: "dmap-50136.firebaseapp.com",
      projectId: "dmap-50136",
      storageBucket: "dmap-50136.firebasestorage.app",
      messagingSenderId: "695873306591",
      appId: "1:695873306591:web:c51485253a7c7d9849ce6a",
    });
    state.auth = getAuth(firebase);
    let connecting = null;
    let explicitLogin = false;
    let retryDashboard = false;
    const signInLabel = () => (retryDashboard ? "Retry dashboard" : "Sign in");
    const showLoginFailure = (error, signedIn = !!state.user) => {
      retryDashboard = signedIn && !!state.user && error.status !== 401;
      $("app").hidden = true;
      $("login").hidden = false;
      $("login-error").textContent = signedIn
        ? "Signed in successfully, but dashboard access could not open. " +
          error.message
        : error.message;
      $("login-error").hidden = false;
      $("login-status").textContent = signedIn
        ? "Firebase sign-in succeeded. Dashboard connection failed."
        : "Sign-in did not complete.";
      $("login-signout").hidden = !state.user;
    };
    const connectUser = (user) => {
      if (connecting) return connecting;
      state.user = user;
      $("login-status").textContent =
        "Signed in. Checking dashboard access and connecting to Firestore…";
      $("login-submit").disabled = true;
      $("login-submit").textContent = "Opening dashboard…";
      connecting = enter()
        .then(() => {
          retryDashboard = false;
        })
        .catch((error) => {
          showLoginFailure(error);
          throw error;
        })
        .finally(() => {
          connecting = null;
          $("login-submit").disabled = false;
          $("login-submit").textContent = signInLabel();
        });
      return connecting;
    };
    $("login-method").onchange = () => {
      retryDashboard = false;
      $("login-submit").textContent = signInLabel();
      const phone = $("login-method").value === "phone";
      $("phone-login-wrap").hidden = !phone;
      $("email").closest("label").hidden = phone;
      $("email").required = !phone;
      $("login-phone").required = phone;
    };
    $("login-method").onchange();
    for (const id of ["email", "login-phone", "password"]) {
      $(id).addEventListener("input", () => {
        retryDashboard = false;
        if (!connecting) $("login-submit").textContent = signInLabel();
      });
    }
    $("login-submit").disabled = false;
    $("login-submit").textContent = "Sign in";
    $("login-status").textContent = "Ready to sign in to Hubpas.";
    $("login-form").onsubmit = async (event) => {
      event.preventDefault();
      explicitLogin = true;
      $("login-error").textContent = "";
      $("login-error").hidden = true;
      $("login-submit").disabled = true;
      $("login-submit").textContent = "Signing in…";
      $("login-status").textContent = "Checking your account with Firebase…";
      let signedIn = false;
      try {
        if (retryDashboard && state.user) {
          signedIn = true;
          await connectUser(state.user);
          return;
        }
        let credential;
        if ($("login-method").value === "phone") {
          const { getFunctions, httpsCallable } =
            await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-functions.js");
          const login = httpsCallable(
            getFunctions(firebase),
            "loginWithPhoneAndPassword",
          );
          const result = await login({
            phone: $("login-phone").value.trim(),
            password: $("password").value,
          });
          credential = await signInWithCustomToken(
            state.auth,
            result.data.customToken,
          );
        } else
          credential = await signInWithEmailAndPassword(
            state.auth,
            $("email").value.trim(),
            $("password").value,
          );
        signedIn = true;
        await connectUser(credential.user);
      } catch (error) {
        explicitLogin = false;
        showLoginFailure(error, signedIn);
      } finally {
        $("login-submit").disabled = false;
        $("login-submit").textContent = signInLabel();
      }
    };
    $("signout").onclick = () => signOut(state.auth);
    onAuthStateChanged(state.auth, async (user) => {
      state.user = user;
      if (!user) {
        retryDashboard = false;
        pendingReads.forEach((promise) => promise.cancel?.());
        pendingReads.clear();
        explicitLogin = false;
        state.request++;
        state.session = null;
        state.treasury = null;
        state.rows = [];
        state.detail = null;
        state.access = null;
        $("access-form").hidden = true;
        state.eventRows = [];
        $("overview").innerHTML = "";
        $("detail-fields").innerHTML = "";
        $("treasury").innerHTML = "";
        $("table").innerHTML = "";
        $("dialog").hidden = true;
        $("app").hidden = true;
        $("login").hidden = false;
        return;
      }
      if (!explicitLogin) {
        $("app").hidden = true;
        $("login").hidden = false;
        $("login-error").hidden = true;
        $("login-signout").hidden = false;
        $("login-status").textContent =
          "Enter your account details and select Sign in. Saved accounts do not open the dashboard automatically.";
        return;
      }
      try {
        await connectUser(user);
      } catch (error) {
        // connectUser displays the failure for restored and newly signed-in accounts.
      }
    });
    $("login-signout").onclick = () => signOut(state.auth);
  }
  return { state, api, openModule, loadRecords, loadTreasury, loadEvents };
}
if (typeof document !== "undefined" && !globalThis.__HUBPAS_TEST__)
  mountDashboard().catch((error) => {
    const node = document.getElementById("login-error");
    if (node) {
      node.textContent = error.message;
      node.hidden = false;
      document.getElementById("login-status").textContent =
        "Firebase sign-in could not initialize. Reload the page and check your connection.";
    }
  });
