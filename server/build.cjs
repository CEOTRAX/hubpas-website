const fs = require("node:fs"),
  path = require("node:path");
const root = path.join(__dirname, ".."),
  target = path.join(__dirname, "shared");
fs.mkdirSync(target, { recursive: true });
for (const file of ["dashboard-schema.mjs", "admin-insights.mjs"])
  fs.copyFileSync(path.join(root, file), path.join(target, file));
console.log(
  "Admin schema and pure accounting helpers copied into the server deployment bundle.",
);
