require('node:fs').copyFileSync(require('node:path').join(__dirname,'../server/site-metrics.cjs'),require('node:path').join(__dirname,'site-metrics.cjs'));
require('node:fs').copyFileSync(require('node:path').join(__dirname,'../server/featured-events.cjs'),require('node:path').join(__dirname,'featured-events.cjs'));
