# Campus OS v0.4.0

本次版本继续推进 assist-to-os 规划里的原生校园能力，并完成真机验证。

## 更新内容

- 新增「校园财务」「校园网」原生入口，校园页功能覆盖更完整。
- 校园卡余额接口支持加密响应解析，可查询余额、卡状态和近期流水。
- 校园网余额、账号信息、在线设备接入 App 内验证码登录，不再要求跳转网页重新登录。
- AI 工具新增校园卡、校园网能力；注销校园网设备等写操作仍需二次确认。
- 日程页手机端周课表改为横向滚动并加大课程块显示空间，下方当日详情随整页滚动。
- 新增校园财务、校园网图标，图片资源统一从 `campusOS_ui` 引用。

## 安装

- APK：`campus-os-v0.4.0-android-arm64.apk`
- 系统要求：Android 7+，arm64-v8a

## 验证

- `npm run typecheck`
- `npm test -- --runInBand`
- `./gradlew app:installRelease -PreactNativeArchitectures=arm64-v8a`
- 已在连接的 Android 真机上启动并检查校园网验证码页、日程页布局。
