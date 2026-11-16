# Android download

The [website download card](https://www.hubpas.com/#get-hubpas) offers separate signed 64-bit and 32-bit Android release APKs for version 1.0.41 (version code 42).

| Release | Firebase Storage object | Size | SHA-256 |
| --- | --- | ---: | --- |
| arm64 | `downloads/Hubpas-1.0.41-arm64-06d0c991.apk` | 70,626,607 bytes | `06d0c9910a9d6fabbf9e08cdf3428129552fb7364fa8509a52ac10b7e852ae8c` |
| armv7 | `downloads/Hubpas-1.0.41-armv7-656e4eaf.apk` | 59,297,407 bytes | `656e4eaf1c091eb1644acdaa535c1f61688f325ad9554a895e90c969bdb2aaf9` |

Both are non-debuggable release builds of `com.hubpasstudio.hubpas`, signed by the existing Hubpas certificate. Signature, alignment, ABI, native class, and bundled web asset verification passed. The APKs are excluded from Git due to size.

For a later signed release, verify package, signature, version and supported architectures, then run `node server/upload-apk-resilient.cjs <release.apk> <version> <expected-sha256> [arm64|armv7]` with the configured local Firebase account. Publish each URL only after checking its download headers and size.
