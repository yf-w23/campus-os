# Campus OS v0.5.1

这是 v0.5 系列的修复版，重点修复图书馆座位预约和支付宝支付唤起链路。

## 修复

- 图书馆座位预约成功状态改为按接口实际返回的 `status === 1` 判断。
- 图书馆取消预约补齐 `_method=delete`、`id`、`operateChannel=2` 等参数。
- AI 的预约/取消预约工具同步修正成功状态判断。
- 校园卡充值接口切换到 `/wx/rechard/qrcode`，匹配实际支付宝扫码充值路径。
- 校园卡充值和电费充值不再依赖 `canOpenURL` 预检查，直接唤起支付宝 deep link，并保留失败提示。
- Android Manifest 和 iOS Info.plist 增加 Alipay URL scheme 查询声明。

## APK

- Android: `campus-os-v0.5.1-android-arm64.apk`
- 版本号：`0.5.1`
- versionCode：`6`
