# Android download

The public Android download is stored in Firebase Storage at `downloads/Hubpas-1.0.36-6431d426.apk`. The [website download button](https://www.hubpas.com/#get-hubpas) points to this universal release. An ARM64-only release is stored separately at `downloads/Hubpas-1.0.36-arm64-502a008f.apk` and is not the default website download.

| Release | Value |
| --- | --- |
| App version | 1.0.36 (version code 37) |
| Package | `com.hubpasstudio.hubpas` |
| Universal APK SHA-256 | `6431d426e94730a64df341369737caeafb7f445d2643ed45aa160526a64b988c` |
| ARM64 APK SHA-256 | `502a008f093d948134f050a6ea11f717c1df47dd6ab0f214e0fa5e2174d1ec19` |
| Signing certificate SHA-256 | `166d6ea0ca77c0ed8e9a5702047b363d148d7ed33cc4a1f7d72b2d266e3485bb` |
| Architectures | ARM64, ARMv7, x86, x86-64 |
| Universal object size | 193,154,336 bytes |
| ARM64 object size | 70,565,912 bytes |

Both are non-debuggable release builds signed with the same Hubpas key as the previous public APK. Firebase Storage serves them as attachments with the Android package content type. The binaries are excluded from Git because they exceed GitHub's regular file size limit. The earlier Firebase Hosting `/downloads/Hubpas.apk` file remains the prior 1.0.35 release; use the website button for the current universal APK. Both new builds still report version code 37, so stores and update tools that require a higher version code will not treat them as a newer release.

For a later signed release, verify its package, signature, version and supported architectures, then run `node server/upload-apk.cjs <release.apk> <version> <expected-sha256> [universal|arm64]` with the configured local Firebase account. Publish the universal URL in `index.html` only after checking its download headers and size.
