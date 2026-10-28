# Android download

The public Android download is stored in Firebase Storage at `downloads/Hubpas-1.0.36-cf2fc1ce.apk`. The [website download button](https://dmap-50136.web.app/website/#get-hubpas) points to its tokenized Firebase Storage download URL.

| Release | Value |
| --- | --- |
| App version | 1.0.36 (version code 37) |
| Package | `com.hubpasstudio.hubpas` |
| APK SHA-256 | `cf2fc1cea4f2f5b10dfcd63e5b671cff7734e85b2524029242019a6e73a3445e` |
| Signing certificate SHA-256 | `166d6ea0ca77c0ed8e9a5702047b363d148d7ed33cc4a1f7d72b2d266e3485bb` |
| Architectures | ARM64, ARMv7, x86, x86-64 |
| Storage object size | 193,145,073 bytes |

This is a non-debuggable, universal release build signed with the same Hubpas key as the previous public APK. Firebase Storage serves it as an attachment with the Android package content type. The binary is excluded from Git because it exceeds GitHub's regular file size limit. The earlier Firebase Hosting `/downloads/Hubpas.apk` file remains the prior 1.0.35 release; use the website button for the current APK.

For a later signed release, verify its package, signature, version and supported architectures, then run `node server/upload-apk.cjs <release.apk> <version> <expected-sha256>` with the configured local Firebase account. Publish the returned Storage URL in `index.html` only after checking its download headers and size.
