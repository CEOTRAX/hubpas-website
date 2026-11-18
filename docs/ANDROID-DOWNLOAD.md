# Android download

The [website download card](https://www.hubpas.com/#get-hubpas) offers separate signed 64-bit and 32-bit Android release APKs for version 1.0.44 (version code 45).

| Release | Firebase Storage object | Size | SHA-256 |
| --- | --- | ---: | --- |
| arm64 | `downloads/Hubpas-1.0.44-arm64-dde38aca.apk` | 70,639,513 bytes | `dde38aca6d3b87824bf0b8975e2ef79a0af9476334a70656b3126a324fe60cde` |
| armv7 | `downloads/Hubpas-1.0.44-armv7-f5de7c92.apk` | 59,310,313 bytes | `f5de7c9284db0f9af248db0e9d54e398b6f79d3a3b06e330a3dbd90ae3c34217` |

Both are non-debuggable release builds of `com.hubpasstudio.hubpas`, signed by the existing Hubpas certificate. Signature, alignment, ABI, native class, and bundled web asset verification passed. The APKs are excluded from Git due to size.

For a later signed release, verify package, signature, version and supported architectures, then run `node server/upload-apk-resilient.cjs <release.apk> <version> <expected-sha256> [arm64|armv7]` with the configured local Firebase account. Publish each URL only after checking its download headers and size.
