const http = require('node:http')
const fs = require('node:fs')
const path = require('node:path')
process.env.HUBPAS_LOCAL_SERVER = 'true'
const localConfigPath = path.join(__dirname, 'server', 'local-config.json')
if (fs.existsSync(localConfigPath)) {
  const local = JSON.parse(fs.readFileSync(localConfigPath, 'utf8'))
  process.env.FIREBASE_CLI_ACCOUNT ||= local.firebaseAccount || ''
  process.env.FIREBASE_TOOLS_DIR ||= local.firebaseToolsDir || (process.env.APPDATA ? path.join(process.env.APPDATA, 'npm', 'node_modules', 'firebase-tools') : '')
  process.env.ADMIN_ACCESS_MANAGEMENT_ENABLED ||= local.accessManagementEnabled === true ? 'true' : 'false'
}

const allowed = new Set(['index.html', 'admin.html', 'events.html', 'organizer-preview.html', 'styles.css', 'script.js', 'admin-insights.mjs', 'dashboard-schema.mjs', 'admin-console.mjs', 'admin-console.css', 'admin-redesign.css', 'record-view.mjs'])
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8' }
const port = Number(process.env.PORT || 8080)
const server = http.createServer((req, res) => {
  let file
  let requested
  try { requested = new URL(req.url, 'http://localhost'); file = decodeURIComponent(requested.pathname).slice(1) || 'admin.html' }
  catch { res.writeHead(400).end('Bad request'); return }
  if (file === 'admin.html' && requested.searchParams.has('preview')) {
    res.writeHead(302, { Location: '/admin.html', 'Cache-Control': 'no-store' }).end()
    return
  }
  if (file.startsWith('api/admin/')) { require('./server/admin-api.cjs').handleAdmin(req, res); return }
  if (!allowed.has(file)) { res.writeHead(404).end('Not found'); return }
  fs.readFile(path.join(__dirname, file), (err, data) => {
    if (err) { res.writeHead(404).end('Not found'); return }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)], 'Cache-Control': 'no-store' })
    res.end(data)
  })
})
server.on('error', err => { console.error(err.message); process.exitCode = 1 })
server.listen(port, '127.0.0.1', () => {
  console.log(`Admin login: http://127.0.0.1:${port}/admin.html`)
  require('./server/warm-local-runtime.cjs').warmLocalRuntime()
    .then(() => console.log('Local Firebase connection ready. Sign-in still verifies each user and their current permissions.'))
    .catch(() => console.error('Local Firebase warm-up unavailable. Sign-in will retry the configured server connection.'))
})
