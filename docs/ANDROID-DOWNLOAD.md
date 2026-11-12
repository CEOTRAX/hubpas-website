# Android download

The [website download card](https://www.hubpas.com/#get-hubpas) offers the 12 November 2026 ARM64 and ARMv7 release APKs. ARM64 is the default for most modern Android phones; ARMv7 is linked for older 32-bit phones.

| Release | Firebase Storage object | Size | SHA-256 |
| --- | --- | ---: | --- |
| ARM64 | `downloads/Hubpas-1.0.40-arm64-54137036.apk` | 70,612,931 bytes | `5413703641b07e31f86fdb3029ab701c5947233da159de1120f34831d90dc4a3` |
| ARMv7 | `downloads/Hubpas-1.0.40-armv7-bfc0c995.apk` | 59,283,731 bytes | `bfc0c9951d0ef5d7bcb782c5c3543167ce6085f993ecbd61be6f7867945786ea` |

Both files are non-debuggable release builds of `com.hubpasstudio.hubpas`, version 1.0.40 (version code 41), signed by the existing Hubpas certificate (`166d6ea0ca77c0ed8e9a5702047b363d148d7ed33cc4a1f7d72b2d266e3485bb`). APK signature verification passed for both builds. Public download HEAD requests returned HTTP 200 with the expected byte sizes, Android package content type, and architecture-specific attachment filenames. APKs are excluded from Git due to size.

For a later signed release, verify package, signature, version and supported architectures, then run `node server/upload-apk.cjs <release.apk> <version> <expected-sha256> [universal|arm64|armv7]` with the configured local Firebase account. Publish each URL only after checking its download headers and size.
