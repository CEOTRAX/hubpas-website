const {onRequest}=require('firebase-functions/v2/https');
const {initializeApp,getApps,applicationDefault}=require('firebase-admin/app');
const {getAuth}=require('firebase-admin/auth');
const app=getApps()[0] || initializeApp({credential:applicationDefault(),projectId:'dmap-50136'});
const services={auth:getAuth(app)};
exports.hubpasSiteMetrics=onRequest(
  {region:'us-central1',maxInstances:2,concurrency:40,timeoutSeconds:15,memory:'256MiB',cors:false,invoker:'public'},
  (req,res)=>require('./site-metrics.cjs').handleSiteMetrics(req,res,services),
);
