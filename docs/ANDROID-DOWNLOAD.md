# Android download

The [website download card](https://www.hubpas.com/#get-hubpas) offers the 9 November 2026 ARM64 and ARMv7 release APKs. ARM64 is the default for most modern Android phones; ARMv7 is linked for older 32-bit phones.

| Release | Firebase Storage object | Size | SHA-256 |
| --- | --- | ---: | --- |
| ARM64 | `downloads/Hubpas-1.0.40-arm64-8a8725b0.apk` | 70,585,209 bytes | `8a8725b08fe6cb424444164b751178eea7bff5f5faae19e90b8a3715e4b8712a` |
| ARMv7 | `downloads/Hubpas-1.0.40-armv7-f771aad2.apk` | 59,256,009 bytes | `f771aad22a555c0265d8cf1f2035f885093f23ebc00fad2fa53313a0d5bed8f9` |

Both files are non-debuggable release builds of `com.hubpasstudio.hubpas`, version 1.0.40 (version code 41), signed by the existing Hubpas certificate (`166d6ea0ca77c0ed8e9a5702047b363d148d7ed33cc4a1f7d72b2d266e3485bb`). The source export manifest verified signatures, alignment, web assets and native classes. Public download HEAD requests returned HTTP 200 with the expected byte sizes, Android package content type, and architecture-specific attachment filenames. APKs are excluded from Git due to size.

For a later signed release, verify package, signature, version and supported architectures, then run `node server/upload-apk.cjs <release.apk> <version> <expected-sha256> [universal|arm64|armv7]` with the configured local Firebase account. Publish each URL only after checking its download headers and size.
