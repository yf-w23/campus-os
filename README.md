# Campus OS

> 面向清华大学学生的 AI-native 校园 App（React Native 0.76 + TypeScript）。

[![Release](https://img.shields.io/github/v/release/yf-w23/campus-os?label=APK)](https://github.com/yf-w23/campus-os/releases/latest)
[![License](https://img.shields.io/badge/license-MIT-blue)](#许可)
[![Platform](https://img.shields.io/badge/platform-Android%207%2B-success)](#安装)

把成绩、教室、电费、座位预约、AI 助手揉到一个 app 里。完全 native UI，不依赖任何业务后端 —— 你的账号密码和 API Key 只存在你手机的安全存储里。

---

## 安装

### 方式一：直接下 APK（最快）

[**Releases → 最新版本**](https://github.com/yf-w23/campus-os/releases/latest)

下载 `campus-os-v0.1.0-android-arm64.apk`（约 60 MB），传到 Android 手机安装即可。

- 系统要求：Android 7+（API 24+）
- 架构：arm64-v8a（2018 年后绝大多数手机都是；32 位 / x86 模拟器暂不支持）
- 首次安装可能需要在"设置 → 安全"里允许"未知来源"

### 方式二：从源码构建

```bash
git clone https://github.com/yf-w23/campus-os.git
cd campus-os
npm install               # 拉 RN / Redux / cheerio / iconv-lite 等依赖（约 800 MB）

# Android
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

**不想登真实账号？** 登录页右下角"演示模式"可以看全部 UI（数据是 mock 的）。

---

## 功能一览

### 首页 `home`

- 今日课表（按时间排序，本地时区，自动从 21 天日历中筛今天）
- 待办作业（按截止日排序）
- 未读通知统计
- 一键重新同步

### 学习 `learning`

直连 `learn.tsinghua.edu.cn`，对接网络学堂：

- 学期课程列表
- 课件浏览 + in-app PDF / DOCX 预览
- 作业列表（未交 / 待批 / 已批，含截止时间、补交时间、成绩）
- 通知列表（含 Base64 内容自动解码）
- 课表（通过教务系统 `zhjw.cic` 拉 JSONP 日历）

### 校园 `campus` — **全部 native**

| 模块 | 实现路径 | 说明 |
|---|---|---|
| 成绩查询 | `services/campus/grades.ts` | 本科生 / 研究生切换；学分绩**自动排除 P/F 等通过制课程**；按学期分组 |
| 教室查询 | `services/campus/classroom.ts` | 按教学楼 → 周次 → 周一–周日选日查节次占用；5 色图例：空闲 / 上课 / 考试 / 借用 / 停用 |
| 体测成绩 | `services/campus/petest.ts` | JSON 解析体测各项分数 + 自动算参考成绩 |
| 宿舍 | `services/campus/campusEndpoints.ts` | 电费余额（只读）+ 电费充值（WebView）+ 健康打卡 |
| 图书馆座位 | `services/campus/library.ts` | 4 层导航：馆 → 楼层（聚合可用数）→ 分区（具体使用率）→ 座位（一键预约）|
| 研讨间预约 | `services/campus/library.ts` | 浏览研讨间类型 + 全部资源 |

### AI `ai`

- 兼容 OpenAI 协议（DeepSeek / 智谱 / Kimi / Doubao 等都能直接配）
- 只读 Agent：可以问"我今天有什么作业 / 课"、"下周哪些 DDL"，但不会替你提交作业
- 内置上下文：把你的课表 / 作业 / 通知拼成 prompt

### 设置 `settings`

- AI Provider 配置（API Key 落 Keychain，永不出设备）
- 切换中文 / English
- 演示模式开关
- 退出登录（清掉 Keychain + Redux）

---

## 架构

### 目录结构

```
src/
├── app/                  # Provider、Navigation、主题、i18n
│   ├── i18n/             # 中英双语
│   ├── navigation/       # React Navigation 路由
│   └── theme/            # 颜色 / 字体 / 间距 / 阴影
├── features/             # UI 层（按业务领域分）
│   ├── auth/             # 登录 + 2FA
│   ├── home/             # 首页
│   ├── learning/         # 学习模块
│   ├── campus/           # 校园模块（成绩 / 教室 / 体测 / 宿舍 / 图书馆 / 研讨间）
│   ├── ai/               # AI Agent
│   └── settings/         # 设置
├── services/             # 数据层
│   ├── auth/             # SM2 + 清华统一身份认证
│   ├── webvpn/           # WebVPN transport + 编码处理
│   ├── campus/           # 校园各子系统 adapter（HTML / JSON 解析）
│   └── ai/               # AI provider adapter
├── domain/               # 领域模型 (TypeScript types)
├── state/                # Redux Toolkit slices + selectors
├── storage/              # Keychain（安全）+ AsyncStorage（偏好）
└── utils/                # 编码 / HTML 工具
```

### 认证流程（核心）

严格对照 [thu-info-app](https://github.com/thu-info-community/thu-info-app) `core.ts:login` 的**单次 OAuth 链**：

```
clearCookies
→ GET WEB_VPN_OAUTH_LOGIN_URL × 2      // webvpn → oauth → id 重定向链
→ 提取 sm2publicKey
→ POST id_login_check                  // SM2 加密密码
→ 2FA (按需)
→ XHR follow callback                  // 写入 wengine_vpn_ticket
→ roam("id", "10000ea0...")            // 建立 info.tsinghua 后端会话
→ activateLearn                        // 拿 _csrf token
```

### 会话自动恢复

清华 WebVPN session 约 30 分钟过期。`tsinghuaAuthService.withSessionRecovery()` 提供两层兜底（对应上游 `roamingWrapper` + `verifyAndReLogin`）：

```
operation() 第一次失败
  ↓ Layer 1: roamIdPolicy(INFO_PORTAL_YYFWID)  → 重试
    ↓ 还失败 ↓ Layer 2: ensureFullReLogin() (从 Keychain 拿密码完整重登)  → 重试
      ↓ 还失败 → 抛 originalError
```

App 重启后内存里凭证清空 —— `hydrateCredentials()` 在第一次需要时从 Keychain 懒加载。同一时刻只允许一个并发 login Promise（避免多操作同时挤兑）。

### 字符编码（GBK 子系统）

教务系统 / 电费 / 选课等老 ASP/Java 后端返回 **GBK** 编码，URL 里建筑名也要 GBK percent-encode：

- `transport.ts:fetchText` 按响应头 charset / URL token 自动选 GBK 解码，走 `FileReader.readAsText(blob, charset)` 利用 RN-Android 的 Java `new String(bytes, charset)`
- `utils/encoding.ts:gb2312PercentEncode` 用 `iconv-lite` 把中文转 GBK 字节流再 `%XX` —— 与上游 `arbitraryEncode(_, "gb2312")` 一致
- `polyfills.ts` 给 RN 提供 `Buffer` / `process` polyfill（iconv-lite 依赖）

---

## 设计约束

1. **无业务后端** —— 凭证、API Key、所有用户数据**永不上行**任何业务服务器；只与清华官方域名 + 你配置的 AI Provider 通讯
2. **WebVPN 强制** —— 所有校内 API 请求强制走 `webvpn.tsinghua.edu.cn` 转发，与官方 thu-info-app 完全一致；不会暴露你的 IP 给校内子系统
3. **解析层隔离** —— HTML / JSON 解析全部隔离在 `services/campus/*Adapter.ts`，UI 层不接触原始响应
4. **AI 只读** —— Agent 工具集**不包含任何写操作**（不会替你交作业、选课、约座位）

---

## 已知限制

- 仅支持 Android arm64-v8a；iOS 工程在仓库里但未在真机验证过
- 图书馆座位**预约**已实现；研讨间预约只读（下单仍走小程序）
- AI Agent 只能读你的课表 / 作业 / 通知；不能直接调 WebVPN 接口（设计如此）
- 课程评估、培养方案、选课等 thu-info-app 有的功能 v0.1 暂未做
- 设备指纹信任过期（罕见，约几个月一次）时 Layer 2 自动重登录会触发 2FA，此时需要手动重登录

---

## 开发

```bash
npm install
npm test              # 跑 Jest 单测（仅 __tests__/ 下）
npx tsc --noEmit      # 类型检查
npm run android       # debug 构建到连接的设备
```

发版：

```bash
cd android && ./gradlew assembleRelease
# APK 在 android/app/build/outputs/apk/release/app-release.apk
```

---

## 上游参考

接口行为严格对照：

- [thu-info-app](https://github.com/thu-info-community/thu-info-app) —— 校园子系统接口、`roamingWrapper` 兜底模式、SM2 SSO 流程
- [thu-learn-lib](https://github.com/Harry-Chen/thu-learn-lib) —— 网络学堂 API
- [learnX](https://github.com/robertying/learnX) —— WebView Cookie 同步、in-app PDF 预览

源码复用记录见 [`docs/SOURCE-REUSE-LOG.md`](docs/SOURCE-REUSE-LOG.md)。

---

## 许可

MIT。请遵循上游项目各自的许可证。
