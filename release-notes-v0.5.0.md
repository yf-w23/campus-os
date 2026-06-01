# Campus OS v0.5.0

本次版本继续把校园高频事务往原生 App 和 AI Agent 里收拢，重点是校园卡充值、校园网数据稳定性，以及本地存储的可靠性。

## 亮点

- 校园财务页新增校园卡支付宝充值：支持 10–200 元金额输入、10/50/100 元快捷选择，并在生成支付链接后唤起支付宝。
- AI Agent 新增 `recharge_campus_card` 工具：充值属于需确认操作，会在执行前展示风险确认。
- 校园网快照改为从首页 HTML 统一解析余额、账号与在线设备，减少重复请求。
- 图书馆空位工具不再只返回前 30 个座位，便于 AI 给出更完整建议。

## 修复与稳定性

- AI 记忆写入改为串行化，降低并发 read-modify-write 丢数据的概率。
- AI API Key 改为按 provider 分开存储，切换服务商时更稳。
- Keychain、Base64、Buffer、GBK 编解码增加降级路径，避免 polyfill 缺失导致 App 崩溃。
- 日程个人备忘删除弹窗使用正确的本地化文案。
- 教务课表 roam 会话加入缓存，并在恢复失败时自动重置。

## APK

- Android: `campus-os-v0.5.0-android-arm64.apk`
- 版本号：`0.5.0`
- versionCode：`5`
