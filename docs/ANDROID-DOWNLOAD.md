# Android download

The [website download card](https://www.hubpas.com/#get-hubpas) offers the 6 November 2026 ARM64 and ARMv7 release APKs. ARM64 is the default for most modern Android phones; ARMv7 is linked for older 32-bit phones.

| Release | Firebase Storage object | Size | SHA-256 |
| --- | --- | ---: | --- |
| ARM64 | `downloads/Hubpas-1.0.36-arm64-b9bd4664.apk` | 70,576,152 bytes | `b9bd4664a2cbae8ab83320a16248851e97105aeeda8f6973ba63dd3822f967b5` |
| ARMv7 | `downloads/Hubpas-1.0.36-armv7-31e62538.apk` | 59,246,952 bytes | `31e62538dec65236eb9c8381e453ffd02a07b30babf8e81826498adf705c96f5` |

Both files are non-debuggable release builds of `com.hubpasstudio.hubpas`, version 1.0.36 (version code 37), signed by the existing Hubpas certificate (`166d6ea0ca77c0ed8e9a5702047b363d148d7ed33cc4a1f7d72b2d266e3485bb`). The source export manifest verified signatures, alignment, web assets and native classes. Public download HEAD requests returned HTTP 200 with the expected byte sizes, Android package content type, and architecture-specific attachment filenames. APKs are excluded from Git due to size. Because the version code is still 37, Android will not necessarily offer an automatic update over another version-code-37 build.

For a later signed release, verify package, signature, version and supported architectures, then run `node server/upload-apk.cjs <release.apk> <version> <expected-sha256> [universal|arm64|armv7]` with the configured local Firebase account. Publish each URL only after checking its download headers and size.
