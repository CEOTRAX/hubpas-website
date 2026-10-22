const fields = [
  "active",
  "roles",
  "accessVersion",
  "deniedResources",
  "deniedActions",
];
function decode(value) {
  if ("booleanValue" in value) return value.booleanValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("stringValue" in value) return value.stringValue;
  if ("arrayValue" in value) return (value.arrayValue.values || []).map(decode);
  return undefined;
}
function assignmentReader(services, fetcher = fetch) {
  return async (uid) => {
    if (typeof uid !== "string" || !/^[A-Za-z0-9_:@.-]{1,128}$/.test(uid))
      throw Object.assign(new Error("Invalid signed account reference."), {
        status: 401,
      });
    const token = await services.auth.app.options.credential.getAccessToken();
    const query = new URLSearchParams(
      fields.map((field) => ["mask.fieldPaths", field]),
    );
    const response = await fetcher(
      `https://firestore.googleapis.com/v1/projects/${services.config.firebaseProjectId}/databases/(default)/documents/adminRoleAssignments/${encodeURIComponent(uid)}?${query}`,
      {
        headers: { Authorization: "Bearer " + token.access_token },
        redirect: "error",
        signal: AbortSignal.timeout(8000),
      },
    );
    if (response.status === 404)
      return { exists: false, data: () => undefined };
    if (!response.ok)
      throw Object.assign(
        new Error(
          "Current dashboard permissions could not be read. Retry dashboard access.",
        ),
        { status: 503 },
      );
    const document = await response.json();
    if (!document.fields || typeof document.fields !== "object")
      throw Object.assign(
        new Error("Dashboard permission response is invalid."),
        { status: 503 },
      );
    const data = Object.fromEntries(
      fields
        .filter((field) => document.fields[field])
        .map((field) => [field, decode(document.fields[field])]),
    );
    return { exists: true, data: () => data };
  };
}
module.exports = { assignmentReader };
