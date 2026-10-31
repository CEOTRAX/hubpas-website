# Website insights

Open **Website insights** in the admin portal. The existing date selector supports
today, recent periods, months and custom periods of up to 366 days. All dates
shows lifetime totals with the latest 366 daily rows. Dates use UTC. Reports
are loaded only when opened and cached for 60 seconds, after fresh authorization.
Owners can restrict staff using the `websiteInsights` dashboard resource.

## What is counted

- Visits: browser-tab sessions, renewed after 30 minutes without a page load or
  download click. This is not a count of unique people across devices or tabs.
- Page views: visible marketing homepage and privacy page views, including repeat
  views. The application itself and local previews are excluded.
- Android download clicks: clicks on the verified APK download button. This
  cannot prove a complete file transfer, installation or active app usage.
- Clicks per 100 visits: an interest indicator, not a unique-user conversion rate.

The public `www.hubpas.com` homepage and privacy page send the same aggregate
events as the Firebase-hosted `/website/` copy. Vercel forwards
`/api/site-metrics` to the metrics function; the receiver accepts only these
known production origins. Collection begins for each site when its tracking
route is live. Old traffic is not backfilled. Browser
tracking opt-outs, blockers and network failures can reduce measured traffic;
blocked session storage can also result in repeated session counts. Common bots,
fast double clicks and retried request IDs are filtered on a best-effort basis.
These are operational insights, not fraud-proof or financial records.

## Storage and cost

The isolated `dmap-50136-site-metrics` Realtime Database stores only small UTC
daily and lifetime numeric counters, with tracking-start metadata. Database
rules deny all direct client reads and writes. No visitor identity, IP address,
referrer, query string, user profile or raw visitor-event history is stored there.
The ingestion function uses short-lived in-memory hashes for rate limiting and
random per-event request IDs for retry suppression; neither is persisted.

Analytics ingestion does **not** read or write Firestore. Each accepted event
invokes one small function and one atomic multi-path counter update. Admin
reports read daily aggregates (maximum 366 days), metadata and, for all dates,
the lifetime totals. Existing dashboard authorization still uses its normal
trusted Firestore role checks. No analytics polling or database listeners run.
Function invocations and Realtime Database bandwidth/storage remain billable
under the project's existing plan; these counters do not make them free.

## Deployment

`site-functions` is separate from the admin and payment function codebases:

```text
npm --prefix site-functions ci --ignore-scripts
firebase deploy --config firebase.metrics.json --only functions:hubpas-website-metrics:hubpasSiteMetrics --project dmap-50136
```

The build copies the shared server counter module into the function bundle.
Public website publication preserves the live application's manifest and adds
only `/api/site-metrics` ahead of catch-all rewrites. The Vercel site uses the
external rewrite in `vercel.json`. Do not run a full root
Hosting deployment, which could replace unrelated live application files.

For the local portal, install its dependencies (`npm --prefix server ci`) and
run `node serve.cjs` with authorized server credentials. Open
`http://127.0.0.1:8080/admin.html`. Old `?preview=1` links now open the same authenticated dashboard; website insights never use sample counters.

APK binaries, local credential configuration and local profile indexes are
excluded from Git. No payment-provider secrets are required by analytics.
