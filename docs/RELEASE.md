# Android Release Guide

本指南用于准备 Campus OS 的 GitHub APK 发布，不代表应用商店上架流程。

## 发布范围

v2.1.1 的版本来源必须一致：

| 位置 | 预期值 |
| --- | --- |
| `package.json` | `2.1.1` |
| `android/app/build.gradle` `versionName` | `2.1.1` |
| `android/app/build.gradle` `versionCode` | `211` |
| 分发文件名 | `campus-os-v2.1.1-android-arm64.apk` |
| ABI | `arm64-v8a` |
| 最低系统版本 | Android 7 / API 24 |

不要将旧 `dist/` 中的文件作为当前工作树的发布证明。每次冻结发布内容后都应重新构建并重新生成 SHA256 与 build info。

## 发布前检查

在 Windows PowerShell、冻结的工作树中执行：

```powershell
npm ci
npm run lint
npm run typecheck
npm test -- --runInBand
npm run release:android
Get-FileHash .\dist\campus-os-v2.1.1-android-arm64.apk -Algorithm SHA256
```

确认：

- `package.json` 与 Gradle 的版本完全相同。
- `dist/` 中同时生成 APK、同名 `.sha256` 文件和 `campus-os-v2.1.1-build-info.json`。
- build info 内的 `version`、`androidVersionName`、`androidVersionCode`、`architectures` 与上表一致。
- 输出 SHA256 与 `.sha256` 文件内容一致。
- 在一台 arm64 Android 7+ 实机完成安装、启动、演示模式、登录 / 2FA、同步和通知权限的最小冒烟验证。
- README、`SOURCE-REUSE-LOG.md`、`login-to-thu.md` 和 `LICENSE` 已随当前代码审阅。

## GitHub Release

创建 tag `v2.1.1` 的 Release，并上传：

1. `campus-os-v2.1.1-android-arm64.apk`
2. `campus-os-v2.1.1-android-arm64.apk.sha256`
3. `campus-os-v2.1.1-build-info.json`

发布说明应至少写明 Android 7+、仅 arm64-v8a、版本号和 SHA256 校验文件的位置。发布完成后，确认 README 的 `releases/latest` 链接已指向该版本，再对外分发。

## 签名边界

当前 `release` build type 使用仓库中的 debug keystore。它可以安装并适合 GitHub APK 测试 / 分发，但**不能用于 Google Play 或其他应用商店的正式发布**。

在应用商店上架前，必须先完成独立的代码与密钥管理改造：创建受保护的正式签名密钥、将密钥和密码移出仓库、配置 release signingConfig，并用最终签名重新构建和验证。不要在文档或 Release 页面把 debug-signed APK 表述为应用商店正式版。
