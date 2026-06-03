# Campus OS v1.1.1

v1.1.1 是 v1.1 系列的功能补充版，重点补齐自建 DDL、宿舍洗衣机查询、英文适配和 AI 工具覆盖范围。

## 新增

- 自建 DDL：学习页 DDL tab 支持手动新增/删除自建 DDL。
- 首页 DDL：合并展示老师布置的作业和用户自建 DDL，并支持从首页快捷添加。
- AI DDL 工具：AI 可在用户确认后添加/删除自建 DDL；老师布置的作业保持只读，不允许删除。
- 宿舍洗衣机查询：宿舍服务新增洗衣机入口，可查看楼宇、空闲/运行/异常状态与剩余时间。
- 英文适配：Campus 主入口、Home/Learning/AI 首层文案补齐英文适配，切换 English 后不再在主校园页显示中文入口。

## 改进

- AI 工具扩展至 46 个，覆盖课表、成绩、作业、自建 DDL、教室、电费、校园卡、校园网、洗衣机、图书馆、备忘和选课链路。
- README 同步更新至 v1.1.1，并保留 v1.1.0 更新记录。
- Android release 继续保持 arm64-v8a 单架构 APK。

## 验证

- `npm run typecheck`
- `npm test -- --runInBand`
- `npm run lint`
- Android release APK ABI 检查：仅包含 `lib/arm64-v8a/*`

## APK

- Android: `campus-os-v1.1.1-android-arm64.apk`
- 版本号：`1.1.1`
- versionCode：`11`
