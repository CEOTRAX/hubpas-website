# Hubpas public website

A responsive black website built around **Your access pass to all.** It introduces
Hubpas events, communities, spaces, services, tickets and wallet features. The
access-pass artwork is illustrative CSS, with no image-generation service or
database connection required to load the marketing pages.

## Files

- `index.html`: public homepage.
- `hubpas-site.css`: dark theme, responsive layout and print styles.
- `hubpas-site.js`: accessible mobile navigation, current year and policy printing.
- `privacy.html`: the supplied privacy policy with section navigation. Policy
  wording, contacts and dates are preserved.
- `server/public-preview.cjs`: a dependency-free local server that serves only
  these public files.

## Run locally

With Node.js installed, run from the repository root:

```text
node server/public-preview.cjs
```

Open `http://127.0.0.1:8091/website/` or
`http://127.0.0.1:8091/privacy.html`. Stop with Ctrl+C. Set
`HUBPAS_PUBLIC_PORT` to use another port.

## Hosting

The public website's Firebase location is
`https://dmap-50136.web.app/website/`; the policy is at
`https://dmap-50136.web.app/privacy.html`. The main domain also serves the working
Hubpas application. Publishing this marketing site must preserve the application's
existing files, checkout and event rewrites, service worker and Android association.
Do not replace the live Hosting manifest with only this repository's public files.

Pushing source to GitHub does not itself deploy a new Firebase Hosting release.
The GitHub source includes the latest black access-pass design; its deployment is
a separate operation.
