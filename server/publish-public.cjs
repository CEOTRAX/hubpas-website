// Publish only the public site/policy while retaining every live app file and rewrite.
const fs=require('node:fs'), path=require('node:path'), crypto=require('node:crypto'), zlib=require('node:zlib');
const root=path.resolve(__dirname,'..'), statePath=path.join(root,'docs/hosting-public-pending.json');
const filesToPublish={'/website/index.html':'index.html','/privacy.html':'privacy.html','/hubpas-site.css':'hubpas-site.css','/hubpas-site.js':'hubpas-site.js'};
// Ordinary website edits retain the existing APK hash; replacing it is explicit.
if(process.argv.includes('--include-apk'))filesToPublish['/downloads/Hubpas.apk']='downloads/Hubpas.apk';
async function main(){
 const services=require('./admin-runtime.cjs').runtime();
 try {
  const token=(await services.auth.app.options.credential.getAccessToken()).access_token;
  const api=async(route,method='GET',body)=>{
   const response=await fetch('https://firebasehosting.googleapis.com/v1beta1/'+route,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,redirect:'error',signal:AbortSignal.timeout(30000)});
   if(!response.ok)throw Error('Hosting '+method+' failed: HTTP '+response.status);
   return response.json();
  };
  const live=await api('sites/dmap-50136/channels/live');
  if(process.argv.includes('--publish')){
   const state=JSON.parse(fs.readFileSync(statePath,'utf8'));
   if(live.release.version.name!==state.baseVersion)throw Error('Live app changed since preparation. Prepare again to preserve the latest release.');
   for(const [route,file] of Object.entries(filesToPublish))if(crypto.createHash('sha256').update(zlib.gzipSync(fs.readFileSync(path.join(root,file)),{level:9})).digest('hex')!==state.changedFiles[route])throw Error('Public source changed after preparation. Prepare again.');
   const release=await api('sites/dmap-50136/releases?versionName='+encodeURIComponent(state.version),'POST',{message:'Redesign public Hubpas website and privacy page; preserve existing application'});
   fs.writeFileSync(path.join(root,'docs/hosting-public-release.json'),JSON.stringify({release:release.name,version:state.version,previousVersion:state.baseVersion,website:'https://dmap-50136.web.app/website/',privacy:'https://dmap-50136.web.app/privacy.html'},null,2));
   console.log('Published: https://dmap-50136.web.app/website/');console.log('Privacy policy: https://dmap-50136.web.app/privacy.html');return;
  }
  const manifest={};let page;
  do{const listed=await api(live.release.version.name+'/files?pageSize=1000'+(page?'&pageToken='+encodeURIComponent(page):''));for(const file of listed.files||[])manifest[file.path]=file.hash;page=listed.nextPageToken;}while(page);
  const originalCount=Object.keys(manifest).length;
  if(!manifest['/index.html']||!manifest['/.well-known/assetlinks.json']||!manifest['/checkout-return/index.html'])throw Error('Unexpected live app manifest; refusing to replace it.');
  const changedFiles={},uploads=new Map();
  for(const [route,file] of Object.entries(filesToPublish)){const compressed=zlib.gzipSync(fs.readFileSync(path.join(root,file)),{level:9});const hash=crypto.createHash('sha256').update(compressed).digest('hex');manifest[route]=hash;changedFiles[route]=hash;uploads.set(hash,compressed);}
  const config=structuredClone(live.release.version.config);
  config.rewrites=[{glob:'/api/site-metrics',function:'hubpasSiteMetrics',functionRegion:'us-central1'},...(config.rewrites||[]).filter(entry=>entry.glob!=='/api/site-metrics')];
  config.headers=(config.headers||[]).filter(entry=>entry.glob!=='/downloads/Hubpas.apk');
  config.headers.push({glob:'/downloads/Hubpas.apk',headers:{'Content-Type':'application/vnd.android.package-archive','Content-Disposition':'attachment; filename="Hubpas.apk"','Cache-Control':'public, max-age=300','X-Content-Type-Options':'nosniff'}});
  const version=await api('sites/dmap-50136/versions','POST',{config,labels:{'deployment-tool':'hubpas-public-site'}});
  const populated=await api(version.name+':populateFiles','POST',{files:manifest});
  const target=new URL(populated.uploadUrl);
  if(target.origin!=='https://upload-firebasehosting.googleapis.com')throw Error('Unexpected upload origin.');
  for(const hash of populated.uploadRequiredHashes||[]){if(!uploads.has(hash))throw Error('An existing app file requires upload; refusing an incomplete release.');console.log('Uploading public asset ('+Math.round(uploads.get(hash).length/1024/1024)+' MB compressed)');const response=await fetch(target.href+'/'+hash,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/octet-stream'},body:uploads.get(hash),redirect:'error',signal:AbortSignal.timeout(600000)});if(!response.ok)throw Error('Public asset upload failed: HTTP '+response.status);}
  await api(version.name+'?updateMask=status','PATCH',{status:'FINALIZED'});
  fs.writeFileSync(statePath,JSON.stringify({version:version.name,baseVersion:live.release.version.name,changedFiles,preservedAppFiles:originalCount-1,fileCount:Object.keys(manifest).length},null,2));
  console.log(JSON.stringify({prepared:version.name,preservedAppFiles:originalCount-1,changedPaths:Object.keys(changedFiles),fileCount:Object.keys(manifest).length}));
 }finally{await services.db.terminate();}
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
