# Android download

Place the official Hubpas release APK here as `Hubpas.apk`.

The public preview serves it as an Android package attachment at
`/downloads/Hubpas.apk`. After a refresh, the website's Android download button
enables only when that URL returns a non-empty APK/binary response, not an HTML
fallback. Until a package is supplied, it stays clearly marked unavailable.

APK binaries are ignored by Git. Publishing the website source to GitHub does
not upload the package to Firebase Hosting. The public Hosting release includes
the package separately at `https://dmap-50136.web.app/downloads/Hubpas.apk`.
iPhone users open the existing Hubpas PWA and
can add it to their Home Screen from Safari.
