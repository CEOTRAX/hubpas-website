const {test}=require('node:test'),assert=require('node:assert/strict');
const {handleSiteMetrics,parseEvent,countersFor,range,readWebsiteInsights}=require('../server/site-metrics.cjs');
test('Android download links directly to the published APK without a disabled placeholder',()=>{
  const fs=require('node:fs'),path=require('node:path'),{JSDOM}=require('../server/node_modules/jsdom');
  const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
  const dom=new JSDOM(html);
  const link=dom.window.document.querySelector('[data-android-download]');
  assert.equal(link?.tagName,'A');
  const url=new URL(link.href);
  assert.equal(url.hostname,'firebasestorage.googleapis.com');
  assert.match(url.pathname,/Hubpas-1\.0\.36-02b0cd81\.apk$/);
  assert.equal(url.searchParams.get('alt'),'media');
  assert.match(url.searchParams.get('token'),/^[a-f0-9-]{36}$/);
  assert.doesNotMatch(html,/Android download unavailable/);
  dom.window.close();
});
const event=(extra={})=>({id:require('node:crypto').randomUUID(),type:'pageview',page:'website',visit:true,...extra});
async function ingest(body, overrides={}, write=async()=>{}) {
  const req={method:'POST',headers:{origin:'https://dmap-50136.web.app','user-agent':'Browser tests'},body,...overrides};
  const res={setHeader(){},writeHead(status){this.status=status;return this;},end(){}};
  await handleSiteMetrics(req,res,{writeCounters:write});return res.status;
}
test('atomic daily and lifetime increments use server UTC, not client dates or totals',()=>{
  const counters=countersFor(parseEvent(event()),new Date('2026-10-22T23:59:00Z'));
  assert.deepEqual(counters['days/2026-10-22/pageViews'],{'.sv':{increment:1}});
  assert.deepEqual(counters['totals/visits'],{'.sv':{increment:1}});
  assert.ok(!JSON.stringify(counters).includes('id'));
  assert.throws(()=>parseEvent(event({amount:100,date:'2025-01-01'})));
});
test('public ingestion accepts only allowed-origin bounded events and deduplicates retries',async()=>{
  let writes=0;const body=event();const write=async()=>writes++;
  assert.equal(await ingest(body,{},write),204);assert.equal(await ingest(body,{},write),204);assert.equal(writes,1);
  assert.equal(await ingest(event(),{headers:{origin:'https://attacker.example'}},write),403);
  assert.equal(await ingest(event(),{method:'GET'},write),405);
  assert.equal(await ingest({...event(),page:'users/private-data'}, {},write),400);
  assert.equal(await ingest('x'.repeat(1500),{},write),413);assert.equal(writes,1);
});
test('bot requests are ignored; failed counter updates can be retried without double-counting',async()=>{
  let writes=0;assert.equal(await ingest(event(),{headers:{origin:'https://dmap-50136.web.app','user-agent':'TestCrawler'}},async()=>writes++),204);assert.equal(writes,0);
  const body=event();assert.equal(await ingest(body,{},async()=>{throw Error('unavailable')}),503);
  assert.equal(await ingest(body,{},async()=>writes++),204);assert.equal(writes,1);
});
test('download counts do not inflate page views or visits',()=>{
  const delta=countersFor(parseEvent(event({type:'androidDownload'})));
  assert.ok(delta['totals/androidDownloads']);assert.ok(!delta['totals/visits']);assert.ok(!delta['totals/pageViews']);
});
test('report dates reject invalid and oversized scans',()=>{
  assert.throws(()=>range(new URLSearchParams({from:'2026-02-30',to:'2026-03-02'})));
  assert.throws(()=>range(new URLSearchParams({from:'2020-01-01',to:'2026-10-22'})));
  assert.equal(range(new URLSearchParams({from:'2026-10-01',to:'2026-10-22'})).from,'2026-10-01');
});
test('report reads only daily aggregates and metadata, never Firestore or individual visitors',async t=>{
  const urls=[];t.mock.method(global,'fetch',async url=>{urls.push(String(url));return {ok:true,status:200,json:async()=>String(url).includes('/days.json')?{'2026-10-22':{visits:2,pageViews:3,androidDownloads:1,websiteViews:3}}:{trackingStartedAt:'2026-10-22T00:00:00Z'}}});
  const result=await readWebsiteInsights(new URLSearchParams({from:'2026-10-21',to:'2026-10-22'}),{auth:{app:{options:{credential:{getAccessToken:async()=>({access_token:'test'})}}}}});
  assert.equal(result.totals.pageViews,3);assert.equal(result.days.length,2);assert.equal(urls.length,2);assert.ok(urls.every(url=>url.includes('site-metrics.firebaseio.com/metrics/')));assert.match(urls[0],/limitToFirst=366/);
});
test('admin endpoint requires authentication before exposing analytics',async()=>{
  const res={writeHead(status){this.status=status;return this},end(body){this.body=body}};
  await require('../server/admin-api.cjs').handleAdmin({method:'GET',url:'/api/admin/website-insights',headers:{}},res);
  assert.equal(res.status,401);
});
test('a staff resource restriction blocks analytics before any counter reads',async t=>{
  let calls=0;t.mock.method(global,'fetch',async()=>{calls++;throw Error('Must not read counters')});
  const services={auth:{verifyIdToken:async()=>({uid:'staff',hubpasAdminActive:true,hubpasAdminRoles:['analyst']})},db:{},readAssignment:async()=>({exists:true,data:()=>({active:true,roles:['analyst'],deniedResources:['websiteInsights']})})};
  const res={writeHead(status){this.status=status;return this},end(){}};
  await require('../server/admin-api.cjs').handleAdmin({method:'GET',url:'/api/admin/website-insights',headers:{authorization:'Bearer test'}},res,services);
  assert.equal(res.status,403);assert.equal(calls,0);
});
test('browser tracking counts one visible view and download click, excluding local previews and opt-outs',async()=>{
  const fs=require('node:fs'),{JSDOM}=require('../server/node_modules/jsdom'),script=fs.readFileSync(require('node:path').join(__dirname,'../hubpas-site.js'),'utf8');
  async function browser(url,optOut=false){
    const dom=new JSDOM('<a href="/downloads/Hubpas.apk" data-android-download>Download</a>',{url,runScripts:'outside-only',pretendToBeVisual:true});
    const messages=[];dom.window.Blob=Blob;dom.window.crypto.randomUUID=require('node:crypto').randomUUID;
    Object.defineProperty(dom.window.navigator,'doNotTrack',{value:optOut?'1':null});
    dom.window.navigator.sendBeacon=(_url,data)=>{messages.push(data);return true};dom.window.fetch=async()=>({ok:false,headers:{get(){return null}}});
    dom.window.eval(script);dom.window.document.dispatchEvent(new dom.window.Event('visibilitychange'));
    dom.window.document.addEventListener('click',e=>e.preventDefault());dom.window.document.querySelector('a').click();dom.window.document.querySelector('a').click();
    const results=await Promise.all(messages.map(async b=>JSON.parse(await b.text())));dom.window.close();return results;
  }
  const events=await browser('https://dmap-50136.web.app/website/');assert.deepEqual(events.map(e=>e.type),['pageview','androidDownload']);assert.equal(events[0].visit,true);assert.deepEqual(Object.keys(events[0]).sort(),['id','page','type','visit']);
  assert.equal((await browser('http://127.0.0.1:8081/website/')).length,0);assert.equal((await browser('https://dmap-50136.web.app/website/',true)).length,0);assert.equal((await browser('https://dmap-50136.web.app/auth/email')).length,0);
});
