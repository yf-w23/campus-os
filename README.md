# Campus OS

> 面向清华大学学生的 AI-native 校园操作系统（React Native 0.76 + TypeScript）。

[![Release](https://img.shields.io/github/v/release/yf-w23/campus-os?label=APK)](https://github.com/yf-w23/campus-os/releases/latest)
[![License](https://img.shields.io/badge/license-MIT-blue)](#许可)
[![Platform](https://img.shields.io/badge/platform-Android%207%2B-success)](#安装)

把课表、作业、成绩、教室、电费、校园卡、校园网、图书馆座位、AI 助手、AI 记忆、AI 工作流与主动监控揉到一个 App 里。完全 native UI，不依赖任何业务后端 —— 你的账号密码和 API Key 只存在你手机的安全存储里。

**当前版本：v1.1.3** · [下载 APK](https://github.com/yf-w23/campus-os/releases/latest)

---

## 安装

### 方式一：直接下 APK（最快）

[**Releases → 最新版本**](https://github.com/yf-w23/campus-os/releases/latest)

下载 `campus-os-v1.1.3-android-arm64.apk`（约 34 MB），传到 Android 手机安装即可。

- 系统要求：Android 7+（API 24+）
- 架构：arm64-v8a（2018 年后绝大多数手机都是；32 位 / x86 模拟器暂不支持）
- 首次安装可能需要在「设置 → 安全」里允许「未知来源」

### 方式二：从源码构建

```bash
git clone https://github.com/yf-w23/campus-os.git
cd campus-os
npm ci                    # 按 package-lock.json 安装依赖

# Android 构建 Release APK（arm64-v8a）
cd android
.\gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a
# 产物: app/build/outputs/apk/release/app-release.apk

# 或者跑 dev 模式（热重载）
npm start                 # 启动 Metro
npm run android           # 另开终端编译 debug 包
```

依赖前置：Node 18+、JDK 17、Android SDK（包含 NDK），iOS 还需要 macOS + Xcode + CocoaPods。

---

## 使用

打开应用 → 输入清华学号 + 密码 → 验证短信 / 微信 / TOTP 二次认证 → 进入主界面。

**不想登真实账号？** 登录页右下角「演示模式」可以看全部 UI（数据是 mock 的）。

**首次使用建议：** 在首页点「同步校园数据」，拉取课表、课程与作业后再看「日程」或问 AI。

---

## 功能一览

底部六个 Tab：**首页 · 学习 · 日程 · 校园 · AI · 设置**

### 首页 `home`

- **今日课表**：与「日程」同源数据，按当天日期筛选、按上课时间排序
- **待办 DDL**：合并展示老师布置的作业 + 用户自建 DDL，支持从首页快捷添加
- 未读通知统计
- 一键重新同步校园数据

### 日程 `schedule`

- **周视图**：自然周切换（周一–周日），有课日期带圆点提示
- **课表数据**：与首页「今日课表」相同，来自教务 JSONP
- 周六/周日无课时，打开会自动选中本周内最近有课的一天（如周五）
- **个人备忘**：本地添加/长按删除；与教务课表合并展示
- **课表缓存**：成功同步后写入本地；同步失败时保留上次课表
- 右上角「同步」= 与首页相同的 `syncCampusData`；也可「问 AI」跳转助手

### 学习 `learning`

直连 `learn.tsinghua.edu.cn`，对接网络学堂：

- 学期课程列表
- 课件浏览 + in-app PDF / DOCX 预览
- DDL 列表：老师布置的作业 + 用户自建 DDL 合并排序；自建 DDL 可新增/删除，老师作业只读不可删
- 通知列表（含 Base64 内容自动解码）
- 课表拉取：经 WebVPN 漫游教务 `zhjw.cic` 教学日历 JSONP，解析后写入 Redux（供首页 / 日程 / AI 共用）

### 校园 `campus`

| 模块 | 说明 |
|---|---|
| 成绩查询 | 本科生 / 研究生切换；学分绩自动排除 P/F 等通过制课程；按学期分组 |
| 教室查询 | 按教学楼 → 周次 → 周一–周日选日查节次占用；5 色图例 |
| 体测成绩 | 体测各项分数 + 自动算参考成绩 |
| 宿舍服务 | 电费余额（只读）+ 电费充值（需确认）+ 洗衣机状态 + 健康打卡 |
| 校园财务 | 校园卡余额、卡状态、近期流水查询；支持支付宝充值 |
| 校园网 | 校园网余额、账号信息、在线设备；App 内验证码登录 |
| 图书馆座位 | 馆 → 楼层 → 分区 → 座位全导航；可预约，需确认 |
| 研读间预约 | 浏览研讨间类型 + 全部资源 |
| 选课系统 | AI 可查询可选/已选课程，并在强确认后选课或退课 |
| 清华邮箱 | 原生收件箱/草稿箱/已发送/已删除/垃圾邮件列表、读信与写信；通过官方 Coremail 会话桥接，避免重复登录 |

### AI `ai` — **Agent + 多会话 + 记忆 + 工作流**

- 兼容 OpenAI 协议（DeepSeek / 智谱 / Kimi / Doubao 等）
- **多会话**：列表、新建、继续历史、删除；对话与偏好存 AsyncStorage
- **AI 记忆系统**：跨会话持久化用户偏好；自动学习对话中的偏好（姓名、称呼风格、提醒方式等）；支持手动查看/编辑/清除记忆
- **工具调用（Function Calling）**：
  - **只读**（无风险）：今日概览、作业列表/详情、成绩、电费、校园卡余额/流水、校园网余额/账号/在线设备、图书馆空位、按周课表、个人备忘、已选课程等
  - **需确认**（中等风险）：预约图书馆座位/研读间、电费充值、校园卡充值、注销校园网设备、添加/删除个人备忘、添加/删除自建 DDL、选课
  - **高风险**（不可逆）：退课含强确认 + verify 校验
- **Workflow Engine**：支持 8 种主动监控条件（电费余额、校园网余额、DDL 提醒、课程提醒等）；App 打开时自动触发检查；有结果时 Alert 弹窗通知
- 系统提示注入真实当前日期；Markdown 渲染

### 设置 `settings`

- AI Provider 配置（API Key 落 Keychain，永不出设备）
- 切换中文 / English
- 演示模式开关
- **监控管理**：查看/开启/关闭/新建工作流监控项
- **操作审计**：查看全部 AI 操作的脱敏日志
- **AI 记忆**：查看/编辑/清除 AI 记忆
- 退出登录（清掉 Keychain + Redux + 持久化会话标记）

---

## v1.1.3 更新摘要（2026-06）

| 项目 | 说明 |
|---|---|
| 清华邮箱 | 新增清华邮箱原生入口，支持收件箱、草稿箱、已发送、已删除、垃圾邮件切换、读信与写信 |
| 邮箱会话 | 通过信息门户进入官方 Coremail，并使用隐藏同源 WebView 桥接真实邮箱会话，解决直接调用 Coremail RPC 的安全 Cookie 校验问题 |
| 邮箱体验 | 修复邮箱文件夹切换时页面被隐藏 WebView 顶开后回弹的布局跳动问题 |
| 邮箱日期 | 显式解析 Coremail 列表日期，避免将 `05-27`、中文发送时间误显示成错误月份日期 |
| 邮件详情 | 优先读取官方阅读页正文 DOM/iframe，并用列表摘要兜底，避免详情页空白或误显示“锁屏” |
| 教室时间 | 教室查询和 AI 空教室工具统一按清华 6 个大节展示，时间段为 08:00-09:35、09:50-12:15、13:30-15:05、15:20-16:55、17:10-18:45、19:20-21:45 |
| 校园页 | 调整校园 tag 顺序，将清华邮箱放到校园功能列表底部 |
| 版本号 | 从 v1.1.2 升级至 v1.1.3，Android versionCode 升至 13 |
| Release | [v1.1.3](https://github.com/yf-w23/campus-os/releases/tag/v1.1.3) 附 arm64 APK |

---

## v1.1.2 更新摘要（2026-06）

| 项目 | 说明 |
|---|---|
| 课程提醒 | 修复「今日课程提醒」误把整张课表/日程都统计为今日课程的问题，只按今天日期筛选，并对重复课程片段去重 |
| 版本号 | 从 v1.1.1 升级至 v1.1.2，Android versionCode 升至 12 |
| Release | [v1.1.2](https://github.com/yf-w23/campus-os/releases/tag/v1.1.2) 附 arm64 APK |

---

## v1.1.1 更新摘要（2026-06）

| 项目 | 说明 |
|---|---|
| 自建 DDL | 学习页 DDL tab 支持手动新增/删除自建 DDL；首页 DDL 区块合并展示老师作业与自建 DDL；AI 可在确认后增删自建 DDL，但不能删除老师布置的作业 |
| 宿舍洗衣机 | 宿舍服务新增洗衣机查询入口，可查看楼宇、空闲/运行/异常状态与剩余时间 |
| 英文适配 | Campus 主入口、Home/Learning/AI 首层文案补齐英文适配，切换 English 后不再在主校园页显示中文入口 |
| 工具生态 | AI 工具扩展至 46 个，覆盖课表/成绩/作业/自建 DDL/教室/电费/校园卡/校园网/洗衣机/图书馆/备忘/选课链路 |
| 版本号 | 从 v1.1.0 升级至 v1.1.1 |
| Release | [v1.1.1](https://github.com/yf-w23/campus-os/releases/tag/v1.1.1) 附 arm64 APK |

---

## v1.1.0 更新摘要（2026-06）

| 项目 | 说明 |
|---|---|
| AI-native OS 核心 | 新增 Workflow Engine（8 种主动监控条件 + 前台触发检查）、AI 记忆系统（跨会话偏好持久化 + 自动学习）、监控管理 UI |
| 高风险操作安全 | 所有写操作有 dry-run → 确认弹窗 → 执行 → verify 校验完整链路；不可逆操作有强确认 |
| 架构升级 | 领域模型（domain/）+ 服务层（services/）+ UI 层（features/）三层分离 |
| 版本号 | 从 v0.5.2 升级至 v1.1.0 |
| Release | [v1.1.0](https://github.com/yf-w23/campus-os/releases/tag/v1.1.0) 附 arm64 APK |

---

## v0.5.2 更新摘要

| 项目 | 说明 |
|---|---|
| 校园卡流水 | 修正交易金额方向：食堂/商户消费显示为支出，充值、补贴、退款等显示为收入 |
| 图书馆预约 | AI 预约成功后优先使用接口结果展示，避免预约记录延迟刷新时误报失败 |
| 测试 | 新增校园卡流水金额归一化用例，锁定消费、充值与交易类型判断 |
| Release | [v0.5.2](https://github.com/yf-w23/campus-os/releases/tag/v0.5.2) 附 arm64 APK |

---

## v0.5.1 更新摘要

| 项目 | 说明 |
|---|---|
| 图书馆预约 | 修正座位预约成功状态判断；取消预约补齐删除参数，AI 工具与原生页面保持一致 |
| 支付宝唤起 | Android/iOS 增加 Alipay scheme 查询声明；校园卡和电费充值直接唤起支付宝 deep link |
| 校园卡充值 | 校园卡充值接口改用 `/wx/rechard/qrcode`，匹配实际扫码充值链路 |
| Release | [v0.5.1](https://github.com/yf-w23/campus-os/releases/tag/v0.5.1) 附 arm64 APK |

---

## v0.5.0 更新摘要

| 项目 | 说明 |
|---|---|
| 校园卡充值 | 校园财务页新增金额输入、快捷金额与支付宝充值跳转；AI 也可在用户确认后发起充值 |
| AI 工具 | 新增 `recharge_campus_card`，放宽图书馆空位返回数量，并修复教室查询默认周次 |
| 校园网 | 首页快照改为复用同一页面解析余额和在线设备，减少请求次数并提升稳定性 |
| 存储稳定性 | AI 记忆写入串行化；API Key 按 provider 分服务存储，读取失败时更稳健 |
| 日程 | 修复个人备忘删除弹窗文案，课表 roam 会话增加缓存与失败重置 |
| Release | [v0.5.0](https://github.com/yf-w23/campus-os/releases/tag/v0.5.0) 附 arm64 APK |

---

## v0.4.0 更新摘要

| 项目 | 说明 |
|---|---|
| 校园入口 | 新增「校园财务」「校园网」原生入口，并统一 `campusOS_ui` 图片资源路径 |
| 校园卡 | 修复余额接口加密响应解析；支持余额、卡状态、近期流水查询 |
| 校园网 | 余额 / 账号 / 在线设备查询接入 App 内验证码登录，不再要求跳网页重登 |
| 日程 | 手机端周课表横向滚动与高度优化，课程标题和地点更容易读全 |
| AI | 校园卡、校园网能力纳入工具调用；高风险事务仍受限制或需二次确认 |
| Release | [v0.4.0](https://github.com/yf-w23/campus-os/releases/tag/v0.4.0) 附 arm64 APK |

---

## 架构

### 目录结构

```
src/
├── app/                  # Provider、Navigation、主题、i18n
│   ├── i18n/             # 中英双语
│   ├── navigation/       # React Navigation（含 Schedule Tab）
│   └── theme/            # 颜色 / 字体 / 间距 / 阴影
├── features/             # UI 层（按业务领域分）
│   ├── auth/             # 登录 + 2FA
│   ├── home/             # 首页
│   ├── learning/         # 学习模块
│   ├── schedule/         # 日程（周网格 + 日列表 + 备忘）
│   ├── campus/           # 校园模块
│   ├── ai/               # AI Agent
│   └── settings/         # 设置（监控管理/审计/AI记忆）
├── services/             # 数据层
│   ├── auth/             # SM2 + 清华统一身份认证
│   ├── webvpn/           # WebVPN transport + 编码处理
│   ├── campus/           # 校园 adapter + scheduleService（JSONP 课表）+ 洗衣机等服务
│   ├── learning/         # 自建 DDL CRUD（Redux 联动）
│   ├── schedule/         # 个人备忘 CRUD（Redux 联动）
│   └── ai/               # Agent + tools 注册表
├── domain/               # 领域模型（workflow/learning/news 等）
├── state/                # Redux Toolkit
├── storage/              # Keychain + AsyncStorage
└── utils/                # weekDates、编码、HTML 工具
```

### 核心设计：AI-native OS

本项目将校园 API 视为"设备驱动"，AI 视为"系统内核调度者"：

```
┌─────────────────────────────────────────────┐
│                   UI 层                     │
│  Home / Learning / Schedule / Campus / AI   │
├─────────────────────────────────────────────┤
│                 Agent 循环                   │
│  系统提示词 → 工具选择 → 执行 → 结果回灌 → 回答 │
├─────────────────────────────────────────────┤
│              工具注册表 (46个)                │
│  read / confirmed write / high-risk verify  │
├─────────────────────────────────────────────┤
│               校园 API 适配层                 │
│   课表/成绩/作业/教室/电费/校园卡/校园网/图书馆 │
└─────────────────────────────────────────────┘
         ↑ WebVPN 转发
┌─────────────────────────────────────────────┐
│           清华官方后端 (tsinghua.edu.cn)       │
└─────────────────────────────────────────────┘
```

### 认证流程（核心）

严格对照 [thu-info-app](https://github.com/thu-info-community/thu-info-app) `core.ts:login` 的**单次 OAuth 链**：

```
clearCookies
→ GET WEB_VPN_OAUTH_LOGIN_URL × 2
→ 提取 sm2publicKey
→ POST id_login_check                  # SM2 加密密码
→ 2FA (按需)
→ XHR follow callback
→ roam("id", "10000ea0...")            # 建立 info.tsinghua 后端会话
→ activateLearn                        # 拿 _csrf token
```

### 会话自动恢复

`tsinghuaAuthService.withSessionRecovery()` 两层兜底：子系统 roam → 完整重登（Keychain 凭证）。启动时若有会话标记则乐观进主界面并后台 `syncCampusData`。

### 字符编码（GBK 子系统）

教务 / 电费 / 选课等返回 **GBK**；`transport.ts` 按 charset 解码，`utils/encoding.ts` 做 GBK percent-encode。

---

## 设计约束

1. **无业务后端** —— 凭证、API Key、课表与对话永不上行自建服务器
2. **WebVPN 强制** —— 校内 API 经 `webvpn.tsinghua.edu.cn` 转发
3. **AI 写操作需确认** —— 预约座位、充值、增删备忘等会弹窗确认；高风险操作有 verify 校验
4. **跨会话持久化** —— AI 记忆和工作流配置存在设备本地

---

## 已知限制

- 仅支持 Android arm64-v8a；iOS 工程在仓库里但未在真机验证
- 课程评估、培养方案详情、校园新闻收藏/订阅等 thu-info-app 有但本项目尚未完整接入的功能暂未实现
- AI 中的新闻与培养方案工具目前保留为接口占位，返回空结果；选课工具已接入 WebVPN 选课系统
- 监控目前在前台触发；真正的后台常驻需要移动端原生模块
- 设备指纹信任过期时可能需重新 2FA

---

## 开发

```bash
npm ci
npm test              # Jest（__tests__/）
npx tsc --noEmit      # 类型检查
npm run android       # debug 到已连接设备
```

发版（Release APK）：

```bash
# Windows PowerShell
$env:GRADLE_USER_HOME = "$env:USERPROFILE\.gradle"
cd android
.\gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a
# 产物: app/build/outputs/apk/release/app-release.apk
```

---

## 上游参考

- [thu-info-app](https://github.com/thu-info-community/thu-info-app) — 校园子系统、roaming、SM2 SSO
- [thu-learn-lib](https://github.com/Harry-Chen/thu-learn-lib) — 网络学堂 API
- [learnX](https://github.com/robertying/learnX) — WebView Cookie、in-app 预览

源码复用记录见 [`docs/SOURCE-REUSE-LOG.md`](docs/SOURCE-REUSE-LOG.md)。

---

## 许可

MIT。请遵循上游项目各自的许可证。
