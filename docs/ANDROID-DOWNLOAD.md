# Android download

The [website download card](https://www.hubpas.com/#get-hubpas) offers the 13 November 2026 universal release APK for 32-bit and 64-bit Android phones.

| Release | Firebase Storage object | Size | SHA-256 |
| --- | --- | ---: | --- |
| Universal | `downloads/Hubpas-1.0.40-a42be903.apk` | 193,204,686 bytes | `a42be903796f1ce10c3a81f00d72d964b0dfe481e6317b5afaa13e03325f2dad` |

This is a non-debuggable release build of `com.hubpasstudio.hubpas`, version 1.0.40 (version code 41), signed by the existing Hubpas certificate (`166d6ea0ca77c0ed8e9a5702047b363d148d7ed33cc4a1f7d72b2d266e3485bb`). APK signature verification passed. The public download HEAD request returned HTTP 200 with the expected byte size, Android package content type, and attachment filename. The APK is excluded from Git due to size.

For a later signed release, verify package, signature, version and supported architectures, then run `node server/upload-apk-resilient.cjs <release.apk> <version> <expected-sha256> [universal|arm64|armv7]` with the configured local Firebase account. Publish each URL only after checking its download headers and size.
