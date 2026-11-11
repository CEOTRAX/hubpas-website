# Android download

The [website download card](https://www.hubpas.com/#get-hubpas) offers an ARM64 release APK supplied again on 11 November 2026, alongside the 11 November ARMv7 release APK. ARM64 is the default for most modern Android phones; ARMv7 is linked for older 32-bit phones.

| Release | Firebase Storage object | Size | SHA-256 |
| --- | --- | ---: | --- |
| ARM64 | `downloads/Hubpas-1.0.40-arm64-0f01e7ec.apk` | 70,586,409 bytes | `0f01e7ec128465c2a1b2b4b6a8dac98bf83e5c5df82d056646df9c4132408730` |
| ARMv7 | `downloads/Hubpas-1.0.40-armv7-718cac4b.apk` | 59,258,425 bytes | `718cac4bbc30888758f2e70a6c1bee65aca2820884c5736300eb369d9e95493b` |

Both files are non-debuggable release builds of `com.hubpasstudio.hubpas`, version 1.0.40 (version code 41), signed by the existing Hubpas certificate (`166d6ea0ca77c0ed8e9a5702047b363d148d7ed33cc4a1f7d72b2d266e3485bb`). APK signature verification passed for both builds. Public download HEAD requests returned HTTP 200 with the expected byte sizes, Android package content type, and architecture-specific attachment filenames. APKs are excluded from Git due to size.

For a later signed release, verify package, signature, version and supported architectures, then run `node server/upload-apk.cjs <release.apk> <version> <expected-sha256> [universal|arm64|armv7]` with the configured local Firebase account. Publish each URL only after checking its download headers and size.
