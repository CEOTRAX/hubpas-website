# Android download

The [website download card](https://www.hubpas.com/#get-hubpas) offers the 31 October 2026 ARM64 and ARMv7 release APKs. ARM64 suits most modern Android phones; ARMv7 is for older 32-bit phones. The previous universal APK remains a fallback for other architectures or uncertain devices.

| Release | Firebase Storage object | Size | SHA-256 |
| --- | --- | ---: | --- |
| ARM64 | `downloads/Hubpas-1.0.36-arm64-5345a60d.apk` | 70,567,645 bytes | `5345a60d4d306014e1faf3f73e1f8fea2e24759d3c4427b91e44e12f2c20bb0b` |
| ARMv7 | `downloads/Hubpas-1.0.36-armv7-715b4c1b.apk` | 59,238,445 bytes | `715b4c1b58b8ee8364c6825075225baffcebd7fe0315817d982660e2255647b7` |
| Previous universal fallback | `downloads/Hubpas-1.0.36-6431d426.apk` | 193,154,336 bytes | `6431d426e94730a64df341369737caeafb7f445d2643ed45aa160526a64b988c` |

Both new files are non-debuggable release builds of `com.hubpasstudio.hubpas`, version 1.0.36 (version code 37), signed by the existing Hubpas certificate (`166d6ea0ca77c0ed8e9a5702047b363d148d7ed33cc4a1f7d72b2d266e3485bb`). The source export manifest verified signatures, alignment, web assets and native classes. Public download HEAD requests returned HTTP 200 with the expected byte sizes, Android package content type, and architecture-specific attachment filenames. APKs are excluded from Git due to size. Because the version code is still 37, Android will not necessarily offer an automatic update over another version-code-37 build.

For a later signed release, verify package, signature, version and supported architectures, then run `node server/upload-apk.cjs <release.apk> <version> <expected-sha256> [universal|arm64|armv7]` with the configured local Firebase account. Publish each URL only after checking its download headers and size.
