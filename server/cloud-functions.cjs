const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret, defineString } = require("firebase-functions/params");
const { handleAdmin } = require("./admin-api.cjs");
const token = defineSecret("MONIME_ACCESS_TOKEN");
const space = defineSecret("MONIME_SPACE_ID");
const cursorSecret = defineSecret("ADMIN_CURSOR_SECRET");
const adminUid = defineString("ADMIN_UID", { default: "" });
const mainAccount = defineString("MONIME_MAIN_FINANCIAL_ACCOUNT_ID", {
  default: "",
});
const version = defineString("MONIME_VERSION", { default: "caph.2025-08-23" });
const environment = defineString("MONIME_ENV", { default: "" });
const actionsEnabled = defineString("ADMIN_ACTIONS_ENABLED", {
  default: "false",
});
const accessEnabled = defineString("ADMIN_ACCESS_MANAGEMENT_ENABLED", {
  default: "false",
});
exports.hubpasAdminApi = onRequest(
  {
    region: "us-central1",
    secrets: [token, space, cursorSecret],
    maxInstances: 3,
    cors: false,
  },
  async (req, res) => {
    process.env.ADMIN_UID = adminUid.value();
    process.env.MONIME_MAIN_FINANCIAL_ACCOUNT_ID = mainAccount.value();
    process.env.MONIME_VERSION = version.value();
    process.env.MONIME_ENV = environment.value();
    process.env.ADMIN_ACTIONS_ENABLED = actionsEnabled.value();
    process.env.ADMIN_ACCESS_MANAGEMENT_ENABLED = accessEnabled.value();
    return handleAdmin(req, res);
  },
);
