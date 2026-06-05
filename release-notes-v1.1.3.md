# Campus OS v1.1.3

v1.1.3 是 v1.1 系列的清华邮箱功能版，新增原生邮箱入口，并修复 Coremail 会话、列表读取和文件夹切换体验问题。

## 新增

- 清华邮箱：校园页新增「清华邮箱」入口，支持收件箱、草稿箱、已发送、已删除、垃圾邮件切换。
- 原生读信：支持在 App 内查看邮件列表与邮件详情，列表沿用 Campus OS 原生视觉风格。
- 原生写信：支持填写收件人、抄送、密送、主题和正文，并在确认后通过清华 Coremail 官方会话投递。

## 修复

- Coremail 会话：改为通过官方 Coremail 页面同源 WebView 桥接真实会话，规避直接 RPC 调用触发的 `Cookie not matched` 安全校验。
- 邮件列表：列表数据从真实 Coremail DOM 抽取，解决登录成功但原生收件箱为空的问题。
- 页面跳动：隐藏 WebView 显式离屏隔离并取消默认 flex，修复邮箱文件夹切换时页面下滑后回弹的问题。

## 体验调整

- 校园页功能排序：清华邮箱入口放到校园功能列表底部。
- 首屏加载后，邮箱文件夹切换不再替换整页布局为居中 loading，减少视觉抖动。

## 验证

- `npm run typecheck`
- `.\gradlew.bat assembleRelease`

## APK

- Android: `campus-os-v1.1.3-android-arm64.apk`
- 版本号：`1.1.3`
- versionCode：`13`
