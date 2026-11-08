# Android download

The [website download card](https://www.hubpas.com/#get-hubpas) offers the 7 November 2026 ARM64 and ARMv7 release APKs. ARM64 is the default for most modern Android phones; ARMv7 is linked for older 32-bit phones.

| Release | Firebase Storage object | Size | SHA-256 |
| --- | --- | ---: | --- |
| ARM64 | `downloads/Hubpas-1.0.39-arm64-665e3c81.apk` | 70,579,104 bytes | `665e3c81bf8d78afbf73d8d4c04a7e5b8d1b064de6802218b56ee66ba9e84120` |
| ARMv7 | `downloads/Hubpas-1.0.39-armv7-9ccd4e9f.apk` | 59,249,904 bytes | `9ccd4e9f58a03df8205532cfb40f29683c6a681b26807dec96079036c18ba216` |

Both files are non-debuggable release builds of `com.hubpasstudio.hubpas`, version 1.0.39 (version code 40), signed by the existing Hubpas certificate (`166d6ea0ca77c0ed8e9a5702047b363d148d7ed33cc4a1f7d72b2d266e3485bb`). The source export manifest verified signatures, alignment, web assets and native classes. Public download HEAD requests returned HTTP 200 with the expected byte sizes, Android package content type, and architecture-specific attachment filenames. APKs are excluded from Git due to size.

For a later signed release, verify package, signature, version and supported architectures, then run `node server/upload-apk.cjs <release.apk> <version> <expected-sha256> [universal|arm64|armv7]` with the configured local Firebase account. Publish each URL only after checking its download headers and size.
