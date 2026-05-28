# Campus OS 项目

## 一、项目目标

Campus OS 是一个面向清华大学学生的 **AI-native 校园 App**，基于 React Native + TypeScript 构建，同时支持 iOS 和 Android。

**核心价值：** 学生可以通过自然语言向一个能理解校园上下文的 AI 查询课表、DDL 和课程资料，而不需要在多个校园 App 或页面之间跳转。

### v1 目标

v1 聚焦于 **"真实登录 + WebVPN + 学习数据读取 + AI 理解"** 这一闭环的可靠性验证：

1. **真实身份认证** — 通过清华统一身份认证 (`id.tsinghua.edu.cn`) 登录，包含 SM2 密码加密
2. **校外访问** — 所有校园服务请求经 `webvpn.tsinghua.edu.cn` 封装，支持校外使用
3. **学习数据** — 获取课表、课程列表、DDL、通知、附件和课程资料，并以标准化领域模型呈现
4. **多厂商 AI** — 用户可配置多种 AI provider（预设 + OpenAI-compatible 自定义），API key 仅存设备安全存储
5. **只读 AI Agent** — AI 可基于课表、DDL、课程资料回答问题、总结课程内容；**不执行任何写操作**

### v2 规划

- 图书馆座位预约
- 作业提交/取消
- 课程日历同步
- 全局历史资料搜索

### 非目标（明确排除）

- 非清华用户的通用校园 App
- 完整商业化或机构部署

---

## 二、项目结构

### 技术栈


| 层面      | 技术选择                                                  |
| ------- | ----------------------------------------------------- |
| 框架      | React Native CLI（非 Expo），TypeScript                   |
| 状态管理    | Redux Toolkit                                         |
| 导航      | React Navigation（Tab + Stack）                         |
| 安全存储    | react-native-keychain（凭证/API key），AsyncStorage（非敏感偏好） |
| 网络      | 自定义 WebVPN transport 层封装                              |
| 测试      | Jest + React Native Testing Library                   |
| 包管理     | pnpm                                                  |
| HTML 解析 | cheerio（服务端风格，用于 adapter 层）                           |
| AI 通信   | SSE streaming，OpenAI-compatible 协议                    |


### 代码分层

```
src/
├── app/            # 应用组合层：Provider、导航、主题、国际化
│   ├── i18n/       # 简体中文为主，英文为辅
│   ├── navigation/ # AppNavigator、AuthGateNavigator
│   └── theme/      # 主题基元（颜色、间距、字体）
├── features/       # 功能界面：首页、学习、AI 对话、设置
├── domain/         # 领域模型：learning.ts、campus.ts、agent.ts、session.ts
├── services/       # 服务层：campus adapters、AI provider clients、WebVPN transport
├── state/          # Redux store、slices、selectors
├── storage/        # 安全存储（Keychain）与非敏感本地存储
├── types/          # 共享 TypeScript 类型
├── assets/         # 图标、插图、tab 图标
└── polyfills.ts    # React Native 环境 polyfill
```

### 架构边界（不可妥协）

1. **无业务后端** — 校园凭证、cookie、API key、课程内容不上传任何业务后端
2. **安全存储** — 校园凭证、cookie、AI API key 仅存在于设备安全存储
3. **WebVPN 封装** — 受保护校园请求必须经过 WebVPN transport 层
4. **解析隔离** — 校园 HTML/API 解析在 adapter 层，UI 组件只消费领域模型

---

## 三、上游项目

本项目在接口行为、认证流程、HTML 解析逻辑上深度参考了两个上游清华校园开源项目：

### 1. thu-info-app


| 属性   | 内容                                                                                                       |
| ---- | -------------------------------------------------------------------------------------------------------- |
| 仓库   | [https://github.com/thu-info-community/thu-info-app](https://github.com/thu-info-community/thu-info-app) |
| 类型   | React Native monorepo（`@thu-info/app` + `@thu-info/lib`）                                                 |
| 覆盖范围 | 校园信息聚合、WebVPN、信息门户、图书馆预约、成绩查询等                                                                           |
| 许可证  | Business Source License 1.1（商业使用受限）                                                                      |


**在本项目中的参考点：**

- 统一身份认证登录清华大学信息门户流程（`id.tsinghua.edu.cn` 的表单字段、SM2 密码加密方式、2FA 处理）
- 尤其注意验证码流程与信任浏览器设置等部分内容
- WebVPN URL 映射与 cookie 注入模式
- 信息门户课表 JSONP 接口的请求/响应格式
- 上游 `roamingWrapper` 模式（服务不可用时的降级策略）

### 2. learnX


| 属性   | 内容                                                                           |
| ---- | ---------------------------------------------------------------------------- |
| 仓库   | [https://github.com/robertying/learnX](https://github.com/robertying/learnX) |
| 类型   | React Native App                                                             |
| 覆盖范围 | 清华网络学堂：通知、附件、课程文件、作业 deadline、提交/批改状态、课程日历同步                                 |
| 许可证  | MIT（附清华相关额外限制条款）                                                             |


**在本项目中的参考点：**

- 网络学堂 HTML 页面解析（cheerio selector 选取逻辑）
- 课程通知、附件列表、课程资料的结构化提取方式
- 作业/DDL 的状态分类（已提交/未提交/已过期）
- 文件下载端点推测（如 `downloadKjxxb` 接口）

### 3. thu-learn-lib


| 属性  | 内容                            |
| --- | ----------------------------- |
| 说明  | learnX 的数据层库，封装网络学堂 API 调用和解析 |
| 许可证 | 继承 learnX 的 MIT 许可            |


**在本项目中的参考点：**

- 网络学堂各接口的请求构造与响应归一化
- 课程/通知/附件/DDL 的类型定义

### 上游集成策略

- **接口行为参考** — 认证流程、API 端点、参数格式必须与上游行为一致，否则无法正确获取校园数据
- **源码复用审查** — 每个直接复制或改写的源码片段在 `docs/SOURCE-REUSE-LOG.md` 中有记录，包含来源文件和许可证兼容性判断
- **基础设施可重写** — 状态管理、导航、UI 组件等项目骨架按本项目需求独立构建，不依赖上游架构
- **混合策略** — 成熟的接口和解析逻辑参考或移植上游；应用架构和用户体验独立设计

---

*最后更新: 2026-05-26*