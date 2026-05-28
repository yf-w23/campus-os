# Campus OS

面向清华大学学生的 AI-native 校园 App（React Native + TypeScript）。

## 功能概览

- 清华统一身份认证（SM2 密码加密 + 二次验证）
- WebVPN 封装，支持校外访问校园服务
- 课表、网络学堂通知/作业/资料读取
- 多厂商 AI Provider（OpenAI-compatible）与只读 Agent
- 凭证与 API Key 仅存设备安全存储（Keychain）

## 快速开始

```bash
npm install
npm start
npm run android   # 或 npm run ios
```

首次体验可直接在登录页进入**演示模式**，无需真实账号。

## 项目结构

```
src/
├── app/          # Provider、导航、主题、国际化
├── features/     # 首页、学习、AI、设置、登录
├── domain/       # 领域模型
├── services/     # WebVPN、认证、校园 adapter、AI
├── state/        # Redux store
├── storage/      # Keychain / AsyncStorage
└── assets/       # UI 资源
```

## 架构约束

1. 无业务后端 — 凭证与 API Key 不上传
2. 受保护请求必须走 WebVPN transport
3. HTML/API 解析隔离在 adapter 层
4. AI Agent 只读，不执行写操作

## 上游参考

接口行为参考 [thu-info-app](https://github.com/thu-info-community/thu-info-app) 与 [learnX](https://github.com/robertying/learnX)。源码复用记录见 [`docs/SOURCE-REUSE-LOG.md`](docs/SOURCE-REUSE-LOG.md)。

## 测试

```bash
npm test
```

## v1 范围

- [x] 登录 + WebVPN + 学习数据读取 + AI 理解闭环
- [ ] v2：图书馆预约、作业提交、日历同步、全局搜索

详细规划见 [`project_conclusion.md`](project_conclusion.md)。
