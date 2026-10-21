# Hubpas public website

A responsive black and dark-blue website built around **Your pass to what’s happening.** It introduces
Hubpas events, communities, tickets and wallet features. The
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
- `downloads/Hubpas.apk`: the Android release download, hosted separately from
  Git source. APK binaries are ignored by Git. See `downloads/README.md`.

The download section checks the APK URL with a HEAD request and enables the
Android button only for an available binary. iPhone users open the existing
Hubpas PWA and can follow the Safari Home Screen instructions.

## Run locally

With Node.js installed, run from the repository root:

```text
node server/public-preview.cjs
```

Open `http://127.0.0.1:8091/website/` or
`http://127.0.0.1:8091/privacy.html`. Stop with Ctrl+C. Set
`HUBPAS_PUBLIC_PORT` to use another port.

The footer includes **Admin login**. In the local preview, `/admin.html` redirects
to the separate management portal at `http://127.0.0.1:8080/admin.html`.
That portal must be running locally (`node serve.cjs` in the full workspace).
Its Firebase sign-in and assigned dashboard permissions still apply. The admin
portal is separate from the public website files and needs its own protected
deployment before the link can work on a public host.

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
