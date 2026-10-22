const { within } = require("./access-check.cjs");
let warming;
function warmLocalRuntime() {
  if (process.env.HUBPAS_LOCAL_SERVER !== "true") return Promise.resolve();
  if (!warming)
    warming = within(
      Promise.resolve().then(async () => {
        const services = require("./admin-runtime.cjs").runtime();
        await Promise.all([
          services.auth.app.options.credential.getAccessToken(),
          services.db
            .collection("adminRoleAssignments")
            .select("active")
            .limit(1)
            .get(),
        ]);
      }),
      15000,
      "Local Firebase connection warm-up timed out.",
    ).finally(() => {
      warming = null;
    });
  return warming;
}
module.exports = { warmLocalRuntime };
