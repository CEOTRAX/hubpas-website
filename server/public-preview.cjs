const http = require('node:http'), fs = require('node:fs'), path = require('node:path');
const root = path.resolve(__dirname, '..'), port = Number(process.env.HUBPAS_PUBLIC_PORT || 8091);
const routes = {'/':'index.html','/website/':'index.html','/website/index.html':'index.html','/privacy.html':'privacy.html','/hubpas-site.css':'hubpas-site.css','/hubpas-site.js':'hubpas-site.js','/downloads/Hubpas.apk':'downloads/Hubpas.apk'};
const types = {'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.apk':'application/vnd.android.package-archive'};
http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if (pathname === '/admin.html') {
    res.writeHead(302, {Location:'http://127.0.0.1:8080/admin.html','Cache-Control':'no-store'}).end();
    return;
  }
  const file = routes[pathname];
  if (!file) { res.writeHead(404).end('Not found'); return; }
  const absolute = path.join(root, file);
  fs.stat(absolute, (error, stats) => {
    if (error || !stats.isFile()) { res.writeHead(404).end('Not found'); return; }
    res.setHeader('Content-Type', types[path.extname(file)]);
    res.setHeader('Content-Length', stats.size);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (file.endsWith('.apk')) res.setHeader('Content-Disposition', 'attachment; filename="Hubpas.apk"');
    if (req.method === 'HEAD') { res.end(); return; }
    fs.createReadStream(absolute).on('error', () => res.destroy()).pipe(res);
  });
}).listen(port, '127.0.0.1', () => console.log('Public website preview: http://127.0.0.1:' + port + '/website/'));
