# Android download

The [website download card](https://www.hubpas.com/#get-hubpas) offers a signed 64-bit Android release for version 1.0.48 (version code 49). The older 32-bit download remains version 1.0.45.

| Release | Firebase Storage object | Size | SHA-256 |
| --- | --- | ---: | --- |
| arm64 | `downloads/Hubpas-1.0.48-arm64-ac72e78c.apk` | 73,344,600 bytes | `ac72e78c28c5d37c07e02708a1a4ace1cf05e0f858827d4ff6d9435da699901a` |
| armv7 | `downloads/Hubpas-1.0.45-armv7-a533830b.apk` | 59,310,541 bytes | `a533830b5ba0ec02f8106a62cb508e20556950b34b56377deb35ce23132462a8` |

Both are non-debuggable release builds of `com.hubpasstudio.hubpas`, signed by the existing Hubpas certificate. Signature, alignment, ABI, native class, and bundled web asset verification passed. The APKs are excluded from Git due to size.

For a later signed release, verify package, signature, version and supported architectures, then run `node server/upload-apk-resilient.cjs <release.apk> <version> <expected-sha256> [arm64|armv7]` with the configured local Firebase account. Publish each URL only after checking its download headers and size.
