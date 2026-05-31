# Campus OS

> 面向清华大学学生的 AI-native 校园 App（React Native 0.76 + TypeScript）。

[![Release](https://img.shields.io/github/v/release/yf-w23/campus-os?label=APK)](https://github.com/yf-w23/campus-os/releases/latest)
[![License](https://img.shields.io/badge/license-MIT-blue)](#许可)
[![Platform](https://img.shields.io/badge/platform-Android%207%2B-success)](#安装)

把课表、作业、成绩、教室、电费、校园卡、校园网、图书馆座位和 AI 助手揉到一个 App 里。完全 native UI，不依赖任何业务后端 —— 你的账号密码和 API Key 只存在你手机的安全存储里。

**当前版本：v0.4.0** · [下载 APK](https://github.com/yf-w23/campus-os/releases/latest)

---

## 安装

### 方式一：直接下 APK（最快）

[**Releases → 最新版本**](https://github.com/yf-w23/campus-os/releases/latest)

下载 `campus-os-v0.4.0-android-arm64.apk`（约 78 MB），传到 Android 手机安装即可。

- 系统要求：Android 7+（API 24+）
- 架构：arm64-v8a（2018 年后绝大多数手机都是；32 位 / x86 模拟器暂不支持）
- 首次安装可能需要在「设置 → 安全」里允许「未知来源」

### 方式二：从源码构建

```bash
git clone https://github.com/yf-w23/campus-os.git
cd campus-os
npm install               # 拉 RN / Redux / cheerio / iconv-lite 等依赖（约 800 MB）

# Android（Windows 建议把 Gradle 缓存放到用户目录，避免路径过长）
# PowerShell: $env:GRADLE_USER_HOME = "$env:USERPROFILE\.gradle"
echo "sdk.dir=C:\\Users\\<你>\\AppData\\Local\\Android\\Sdk" > android/local.properties
cd android && ./gradlew assembleRelease
adb install -r app/build/outputs/apk/release/app-release.apk

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
- 待办作业（按截止日排序）
- 未读通知统计
- 一键重新同步校园数据

### 日程 `schedule`（v0.3.0 新增，v0.4.0 优化）

- **周视图**：自然周切换（周一–周日），有课日期带圆点提示
- **课表数据**：与首页「今日课表」相同，来自 `learning.snapshot.schedule`（教务 JSONP `bks_jxrl_all`）
- 周六/周日无课时，打开会自动选中本周内最近有课的一天（如周五）
- **个人备忘**：本地添加/长按删除；与教务课表合并展示
- **课表缓存**：成功同步后写入本地；同步失败时保留上次课表，避免「昨天有课今天全空」
- **手机可读性**：周网格支持横向滚动，课程块不再被 7 列硬挤压；下方当日详情跟随整页滚动
- 右上角「同步」= 与首页相同的 `syncCampusData`；也可「问 AI」跳转助手

### 学习 `learning`

直连 `learn.tsinghua.edu.cn`，对接网络学堂：

- 学期课程列表
- 课件浏览 + in-app PDF / DOCX 预览
- 作业列表（未交 / 待批 / 已批，含截止时间、补交时间、成绩）
- 通知列表（含 Base64 内容自动解码）
- 课表拉取：经 WebVPN 漫游教务 `zhjw.cic` 教学日历 JSONP，解析后写入 Redux（供首页 / 日程 / AI 共用）

### 校园 `campus` — **全部 native**

| 模块 | 实现路径 | 说明 |
|---|---|---|
| 成绩查询 | `services/campus/grades.ts` | 本科生 / 研究生切换；学分绩**自动排除 P/F 等通过制课程**；按学期分组 |
| 教室查询 | `services/campus/classroom.ts` | 按教学楼 → 周次 → 周一–周日选日查节次占用；5 色图例：空闲 / 上课 / 考试 / 借用 / 停用 |
| 体测成绩 | `services/campus/petest.ts` | JSON 解析体测各项分数 + 自动算参考成绩 |
| 宿舍 | `services/campus/electricity.ts` 等 | 电费余额（只读）+ 电费充值（需确认）+ 健康打卡 |
| 校园财务 | `services/campus/campusCard.ts` | 校园卡余额、卡状态与近期流水查询；加密响应解密后展示 |
| 校园网 | `services/campus/network.ts` | 校园网余额、账号信息、在线设备；验证码登录可在 App 内完成 |
| 图书馆座位 | `services/campus/library.ts` | 4 层导航：馆 → 楼层 → 分区 → 座位（可预约，需确认）|
| 研读间预约 | `services/campus/library.ts` | 浏览研讨间类型 + 全部资源 |

> 体育场馆预约相关代码在仓库中保留，当前校园入口未开放。

### AI `ai` — **Agent + 多会话**

- 兼容 OpenAI 协议（DeepSeek / 智谱 / Kimi / Doubao 等）
- **多会话**：列表、新建、继续历史、删除；对话与偏好存 AsyncStorage
- **工具调用（Function Calling）**：
  - **只读**：今日概览、作业列表/详情、成绩、电费、校园卡余额/流水、校园网余额/账号/在线设备、图书馆空位、**按周课表**（`get_week_schedule`）、个人备忘列表等
  - **需二次确认**：预约图书馆座位、电费充值、注销校园网设备、**添加/删除个人备忘**
- 系统提示注入真实当前日期；课表工具按 `YYYY-MM-DD` 与首页逻辑一致筛选
- Markdown 渲染；无流式时整体读取，保证有 Key 时稳定出结果

### 设置 `settings`

- AI Provider 配置（API Key 落 Keychain，永不出设备）
- 切换中文 / English、深色 / 浅色外观
- 演示模式开关
- 退出登录（清掉 Keychain + Redux + 持久化会话标记）

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
│   └── settings/         # 设置
├── services/             # 数据层
│   ├── auth/             # SM2 + 清华统一身份认证
│   ├── webvpn/           # WebVPN transport + 编码处理
│   ├── campus/           # 校园 adapter + scheduleService（JSONP 课表）
│   ├── schedule/         # 个人备忘 CRUD（Redux 联动）
│   └── ai/               # Agent + tools 注册表
├── domain/               # 领域模型
├── state/                # Redux Toolkit（learning / schedule / …）
├── storage/              # Keychain + AsyncStorage（会话 / AI / 课表缓存 / 备忘）
└── utils/                # weekDates、编码、HTML 工具
```

### 课表数据流

```
fetchScheduleRangeLegacy()     # 教务 JSONP，经 roamDefault + withSessionRecovery
        ↓
learning.snapshot.schedule     # 首页今日课表、AI get_week_schedule、日程 Tab 共用
        ↓
saveLearningScheduleCache()    # AsyncStorage 持久化，启动时 hydrate
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

1. **无业务后端** —— 凭证、API Key、课表与对话**永不上行**自建服务器；只与清华官方域名 + 你配置的 AI Provider 通讯
2. **WebVPN 强制** —— 校内 API 经 `webvpn.tsinghua.edu.cn` 转发
3. **解析层隔离** —— 原始 HTML/JSON 只在 `services/campus/*` 解析
4. **AI 写操作需确认** —— 预约座位、充值、增删备忘等会弹窗确认；不会静默改教务数据

---

## 已知限制

- 仅支持 Android arm64-v8a；iOS 工程在仓库里但未在真机验证
- 日程周网格依赖已同步的扁平课表；学期制 thu-info 分段课表为增强项，失败时仍可用 legacy 课表
- 图书馆**座位**预约已实现；研讨间只读；体育场馆入口暂未开放
- 校园卡动态「紫荆校园码」、充值、挂失、解挂、限额修改等高风险能力暂未接入；当前只做余额和流水查询
- 设备指纹信任过期时可能需重新 2FA
- 课程评估、培养方案、选课等 thu-info-app 有的功能暂未做

---

## 开发

```bash
npm install
npm test              # Jest（__tests__/）
npx tsc --noEmit      # 类型检查
npm run android       # debug 到已连接设备
```

发版（Release APK）：

```bash
# Windows PowerShell 示例
$env:GRADLE_USER_HOME = "$env:USERPROFILE\.gradle"
cd android
.\gradlew assembleRelease
# 产物: android/app/build/outputs/apk/release/app-release.apk
# 建议复制为 campus-os-v0.4.0-android-arm64.apk 再上传到 GitHub Release
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
