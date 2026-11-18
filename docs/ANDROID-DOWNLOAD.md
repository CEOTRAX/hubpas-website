# Android download

The [website download card](https://www.hubpas.com/#get-hubpas) offers separate signed 64-bit and 32-bit Android release APKs for version 1.0.45 (version code 46).

| Release | Firebase Storage object | Size | SHA-256 |
| --- | --- | ---: | --- |
| arm64 | `downloads/Hubpas-1.0.45-arm64-347c00d0.apk` | 70,639,741 bytes | `347c00d0bc9a2cfb9777b2e786e1352e2a555a574bda435c8e9dc14a474f7127` |
| armv7 | `downloads/Hubpas-1.0.45-armv7-a533830b.apk` | 59,310,541 bytes | `a533830b5ba0ec02f8106a62cb508e20556950b34b56377deb35ce23132462a8` |

Both are non-debuggable release builds of `com.hubpasstudio.hubpas`, signed by the existing Hubpas certificate. Signature, alignment, ABI, native class, and bundled web asset verification passed. The APKs are excluded from Git due to size.

For a later signed release, verify package, signature, version and supported architectures, then run `node server/upload-apk-resilient.cjs <release.apk> <version> <expected-sha256> [arm64|armv7]` with the configured local Firebase account. Publish each URL only after checking its download headers and size.
