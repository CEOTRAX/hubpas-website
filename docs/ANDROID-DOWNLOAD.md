# Android download

The [website download card](https://www.hubpas.com/#get-hubpas) offers separate signed 64-bit and 32-bit Android release APKs for version 1.0.41 (version code 42).

| Release | Firebase Storage object | Size | SHA-256 |
| --- | --- | ---: | --- |
| arm64 | `downloads/Hubpas-1.0.41-arm64-6e51938c.apk` | 70,631,453 bytes | `6e51938c7e6a1584f469c4902d8bbe27f87a98b686137d7b3c7ba719f67fb4d8` |
| armv7 | `downloads/Hubpas-1.0.41-armv7-c20e42e7.apk` | 59,302,253 bytes | `c20e42e79ae58261d8dbda91aa2f3a094987ab7ca310ab3d8de00e213921d753` |

Both are non-debuggable release builds of `com.hubpasstudio.hubpas`, signed by the existing Hubpas certificate. Signature, alignment, ABI, native class, and bundled web asset verification passed. The APKs are excluded from Git due to size.

For a later signed release, verify package, signature, version and supported architectures, then run `node server/upload-apk-resilient.cjs <release.apk> <version> <expected-sha256> [arm64|armv7]` with the configured local Firebase account. Publish each URL only after checking its download headers and size.
