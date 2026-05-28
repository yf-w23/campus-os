# Source Reuse Log

记录 Campus OS 中参考或移植上游开源项目的代码片段，便于许可证审查。

| 文件 | 参考来源 | 许可证 | 兼容性判断 |
| --- | --- | --- | --- |
| `src/services/webvpn/constants.ts` | thu-info-app `@thu-info/lib` `strings.ts` HOST_MAP / endpoint 常量 | BSL 1.1 | 仅复用公开接口行为与常量映射，未复制源码；商业使用需另行评估 |
| `src/services/webvpn/parseUrl.ts` | thu-info-app `core.ts` `parseUrl()` | BSL 1.1 | 按行为重写，非逐行复制 |
| `src/services/auth/sm2.ts` | thu-info-app `core.ts` SM2 加密流程 | BSL 1.1 | 使用相同算法约定（`04` 前缀 + `sm-crypto`），独立实现 |
| `src/services/auth/tsinghuaAuth.ts` | thu-info-app 登录 / 2FA / roam 流程 | BSL 1.1 | 参考请求字段与状态机，独立实现 |
| `src/services/campus/learningAdapter.ts` | learnX + thu-learn-lib 网络学堂 adapter | MIT | 参考 endpoint、字段映射与状态分类，独立实现 |
| `src/services/campus/learningAdapter.ts` | thu-info-app 课表 JSONP 解析 | BSL 1.1 | 参考 JSONP 格式与字段名，独立实现 |

## 说明

- 本项目**未直接依赖** `@thu-info/lib` 或 `thu-learn-lib` npm 包，而是在 adapter 层按行为重写。
- 基础设施（Redux、导航、UI、AI Agent）为 Campus OS 独立实现。
- 如需进一步降低 BSL 风险，可将 thu-info 相关 adapter 替换为运行时兼容层或获得上游授权。
