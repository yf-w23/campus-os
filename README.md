# Campus OS

> 面向清华大学学生的 AI-native 校园操作系统（React Native 0.76 + TypeScript）。

[![Release](https://img.shields.io/github/v/release/yf-w23/campus-os?label=APK)](https://github.com/yf-w23/campus-os/releases/latest)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Android%207%2B-success)](#安装)

将课表、作业、成绩、教室、新闻动态、电费、校园卡、校园网、图书馆座位、AI 助手、AI 记忆、AI 工作流与主动监控整合到一个 App。主流程使用原生 UI；官方网页入口、富文本和附件预览使用 WebView。项目没有自建业务后端，账号凭证和 API Key 仅保存在设备安全存储中。

**当前版本：v2.1.1** · [下载 APK](https://github.com/yf-w23/campus-os/releases/latest)

---

## 安装

### 方式一：直接下 APK

[**Releases → 最新版本**](https://github.com/yf-w23/campus-os/releases/latest)

下载 `campus-os-v2.1.1-android-arm64.apk`（约 35 MiB），传到 Android 手机安装即可。

- 系统要求：Android 7+（API 24+）
- 架构：arm64-v8a；32 位设备和 x86 模拟器暂不支持
- 首次安装可能需要在「设置 → 安全」中允许来自此来源的应用

### 方式二：从源码构建

```bash
git clone https://github.com/yf-w23/campus-os.git
cd campus-os
npm ci

# 开发模式（两个终端）
npm start
npm run android

# 构建 arm64-v8a Release APK
cd android
.\gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a
# 产物：app/build/outputs/apk/release/app-release.apk
```

依赖前置：Node 18+、JDK 17、Android SDK 与 NDK。仓库当前只维护 Android 工程。

---

## 使用

打开应用 → 输入清华学号和密码 → 按需完成短信、微信或 TOTP 二次认证 → 进入主界面。

不想登录真实账号？登录页右下角的「演示模式」可浏览完整 UI，数据为 mock 数据。

首次使用建议在首页点击「同步校园数据」，再查看「日程」或向 AI 提问。

---

## 功能一览

底部六个 Tab：**首页 · 学习 · 日程 · 校园 · AI · 设置**。

### 首页 `home`

- 今日课表：与「日程」同源，按当天日期和上课时间展示
- 待办 DDL：合并老师布置的作业与自建 DDL，并支持快捷添加
- 未读通知统计和一键重新同步校园数据
- 海淀天气摘要、短时出行提示和可点击的天气详情
- 基于课程、DDL、通知和天气的「今日重点 / 建议操作」原生入口

### 日程 `schedule`

- 周视图：周一至周日切换；有课日期带圆点提示
- 教务 JSONP 课表与首页共用同一份数据
- 学期选择：按 `nextSemesterIndex` 逻辑切换当前或后续学期后重新同步
- 周末无课时自动选中本周最近有课的一天
- 本地个人备忘可添加、长按删除，并与教务课表合并展示
- 成功同步后缓存课表；失败时保留上次缓存

### 学习 `learning`

直连 `learn.tsinghua.edu.cn`，对接网络学堂：

- 学期课程列表、作业、通知与课程文件
- App 内 PDF、Office、图片和文本预览
- 老师作业与自建 DDL 合并排序；自建项可新增/删除，老师作业只读
- Base64 通知内容自动解码
- 课表经 SSO 激活教务会话后解析并写入 Redux，供首页、日程和 AI 共用

### 校园 `campus`

| 模块 | 说明 |
| --- | --- |
| 新闻动态 | 信息门户新闻列表、栏目筛选、关键词搜索与富文本详情；AI 可只读查询列表、搜索和详情摘要 |
| 成绩查询 | 本科生 / 研究生切换；学分绩自动排除 P/F 等通过制课程；按学期分组 |
| 教室查询 | 教学楼 → 周次 → 日期 → 节次占用查询，带 5 色图例 |
| 体测成绩 | 体测各项分数与自动计算的参考成绩 |
| 宿舍服务 | 电费余额、需确认的电费充值、洗衣机状态，以及官方健康打卡 / 报修网页入口 |
| 校园财务 | 校园卡余额、卡状态、近期流水和支付宝充值 |
| 校园网 | 校园网余额、账号信息、在线设备和 App 内验证码登录 |
| 图书馆座位 | 馆 → 楼层 → 分区 → 座位导航；原生座位页可确认预约，AI 也可在确认后预约 / 取消 |
| 研读间预约 | 浏览类型与资源；AI 在日期、时段和资源明确后可确认预约 / 取消 |
| 选课系统 | AI 可查询可选 / 已选课程，并在强确认后选课或退课 |
| 清华邮箱 | Android 原生 IMAP/SMTP；配置客户端专用密码后，可收发邮件、回复 / 转发、标未读、移动、删除和下载附件；AI 仅开放只读查询 |

### AI `ai`

- 兼容 OpenAI 协议；可配置 OpenAI、DeepSeek、通义、Kimi 或自定义兼容端点（如智谱、豆包）
- 多会话：列表、新建、继续历史与删除；对话及偏好存在 AsyncStorage
- AI 记忆：长期偏好跨会话保存；模型提出写入时需用户确认；设置中可查看与清除
- 51 个工具（v2.1.1）：
  - **只读**：天气、今日概览、作业、新闻、成绩、电费、校园卡、校园网、图书馆、课表、个人备忘、已选课程和邮箱查询等
  - **需确认**：预约 / 取消图书馆座位或研读间、电费或校园卡充值、注销校园网设备、增删个人备忘或自建 DDL
  - **高风险**：选课 / 退课均需强确认；退课包含 verify 校验
- Workflow Engine：预置 8 种监控。电费余额、校园网余额、DDL 提醒与今日课程提醒已接入检查；课程余量、体育场馆、研读间和图书馆座位提醒在 UI 中标为暂不可用
- Android WorkManager + Headless JS 可在后台复用同一检查逻辑；系统通知、免打扰时段、最近运行状态均可在设置中查看

### 设置 `settings`

- AI Provider 配置；API Key 保存在 Keychain
- 中文 / English 和演示模式切换
- 监控管理：添加预置项、开关、手动检查、删除、后台调度与通知权限状态
- AI 操作审计：查看最近的脱敏日志并清空
- AI 记忆：查看与清除
- AI 权限：按能力类别控制 AI 可调用的校园工具
- 缓存状态：查看本地缓存与最近同步时间，并按需刷新
- 退出登录：清掉 Keychain 凭证、Redux 状态和持久化会话标记

---

## 架构

### 目录结构

```
src/
├── app/                  # Provider、导航、主题、i18n、资源
├── features/             # UI 层：auth / home / learning / schedule / campus / ai / settings
├── services/             # 数据层
│   ├── auth/             # SM2、统一身份认证、2FA、会话恢复
│   ├── webvpn/           # Cookie、WebVPN transport、编码与端点
│   ├── campus/           # 校园 adapter、新闻、课表、邮箱、洗衣机等
│   ├── learning/         # 自建 DDL CRUD
│   ├── schedule/         # 个人备忘 CRUD
│   ├── notification/     # Android 本地通知桥接
│   ├── workflow/         # 前后台监控执行器
│   └── ai/               # Agent 与工具注册表
├── domain/               # 领域模型
├── state/                # Redux Toolkit 与同步 thunk
├── storage/              # Keychain 与 AsyncStorage
└── utils/                # 日期、编码、HTML 工具
```

### 核心设计：AI-native OS

```
┌─────────────────────────────────────────────┐
│                   UI 层                      │
│  Home / Learning / Schedule / Campus / AI   │
├─────────────────────────────────────────────┤
│                 Agent 循环                    │
│  系统提示 → 工具选择 → 执行 → 结果回灌 → 回答 │
├─────────────────────────────────────────────┤
│            工具注册表（51 个，v2.1.1）         │
│       read / confirmed write / high-risk      │
├─────────────────────────────────────────────┤
│               校园 API 适配层                 │
│  课表/新闻/成绩/作业/教室/电费/校园卡/校园网等 │
└─────────────────────────────────────────────┘
        ↑ WebVPN 与 SSO 会话
┌─────────────────────────────────────────────┐
│            清华官方系统与所选 AI Provider      │
└─────────────────────────────────────────────┘
```

### 认证与会话

认证使用单次 OAuth 链：清 Cookie → WebVPN OAuth 预热两次 → SM2 加密密码 → ID 登录与按需 2FA → 单次 XHR 跟随 callback → 信息门户 roam 与校验 → 尝试激活网络学堂。学习和教务在获得 SSO ticket 后直连官方域名。完整维护说明见 [`docs/login-to-thu.md`](docs/login-to-thu.md)。

会话掉线时，`withSessionRecovery()` 会先重建子系统会话，再在必要时从 Keychain 读取凭证完成一次去重的完整重登录。

---

## 数据与隐私

- 清华统一认证凭证、AI Provider API Key 和邮箱客户端专用密码保存在系统 Keychain；不会上传到 Campus OS 自建服务器。
- 课表缓存、个人备忘、对话、AI 记忆、工作流和脱敏操作审计保存在设备本地。可在设置中清除记忆和审计记录。
- 使用 AI 时，输入的对话以及为回答而调用工具返回的必要结果会发送到所选 AI Provider。配置前请阅读该 Provider 的隐私政策，并避免提交不必要的敏感信息。
- 本项目是非官方客户端，与清华大学及其信息化服务部门不存在隶属或授权关系；使用校园系统时仍须遵守相关服务条款和校园规定。

---

## 已知限制

- 仅支持 Android arm64-v8a
- 课程评估、培养方案详情和新闻收藏 / 订阅管理尚未完整接入
- 培养方案 adapter 仍是占位；新闻已在原生 UI 和 AI 只读工具中接入，但收藏、订阅与附件下载管理尚未开放
- 工作流预置 8 类监控，但仅电费、校园网、DDL 和今日课程提醒具有实际检查逻辑
- 后台监控受 WorkManager、省电策略、网络和 WebVPN / 2FA 会话影响，无法保证固定的触发时刻
- 邮箱仅 Android 原生 IMAP/SMTP 可用，需清华邮箱客户端专用密码；附件发送尚未接入系统文件选择器
- 设备指纹信任过期后可能需再次完成 2FA

---

## 开发与发布

```bash
npm ci
npm test
npm run typecheck
npm run android
```

构建可分发 APK：

```bash
npm run release:android

# 原始产物：android/app/build/outputs/apk/release/app-release.apk
# 分发产物：dist/campus-os-v<version>-android-arm64.apk
```

发版前请遵循 [`docs/RELEASE.md`](docs/RELEASE.md) 的版本、测试、校验和签名检查。当前 Release APK 使用 debug keystore：可用于 GitHub APK 分发和测试，**不能作为应用商店正式分发包**。

---

## 上游参考

- [thu-info-app](https://github.com/thu-info-community/thu-info-app) — 校园子系统、roaming、SM2 SSO
- [thu-learn-lib](https://github.com/Harry-Chen/thu-learn-lib) — 网络学堂 API
- [learnX](https://github.com/robertying/learnX) — WebView Cookie 与 App 内预览

来源、复用范围和许可证复核清单见 [`docs/SOURCE-REUSE-LOG.md`](docs/SOURCE-REUSE-LOG.md)。

## 许可与来源

本项目以 [MIT License](LICENSE) 发布。涉及 `thu-info-app` 与 learnX 的参考实现，发布或商用前应按 [`docs/SOURCE-REUSE-LOG.md`](docs/SOURCE-REUSE-LOG.md) 完成许可证复核。
