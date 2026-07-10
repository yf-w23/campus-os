# Source Reuse Log

本文件记录 Campus OS 中参考上游代码、接口协议或行为的范围，服务于发布前的许可证复核。它不是法律意见，也不能替代逐文件比对、依赖清单审核或权利人授权。

**最后核对：2026-07-10 · 适用版本：v2.1.1**

## 记录范围

- 本表覆盖仓库中明确标注为参考、对齐或按上游行为重写的源码。
- 记录中的「独立实现」表示本项目未直接复制上游源码；它不自动排除接口文档、数据、商标、服务条款或其他权利限制。
- npm / Gradle 依赖的许可证由各自包的发布元数据和仓库 LICENSE 管理；它们不在本表逐一复述。

## 上游参考与复核重点

| 当前文件或范围 | 参考来源 | 上游许可 / 状态 | 当前实现与发布前动作 |
| --- | --- | --- | --- |
| `src/services/webvpn/constants.ts`、`src/services/campus/campusEndpoints.ts` | [thu-info-app](https://github.com/thu-info-community/thu-info-app) 的 endpoint、host map、yyfwid 约定 | BSL 1.1 | 仅整理公开服务地址和协议常量；发布 / 商用前仍应核对当前上游 BSL 条款。 |
| `src/services/webvpn/parseUrl.ts`、`src/services/auth/tsinghuaAuth.ts`、`src/services/auth/sm2.ts` | thu-info-app / `@thu-info-lib` 的 URL 包装、登录、2FA 和 roam 状态机 | BSL 1.1 | 按请求顺序与状态行为独立实现；需确认不存在受版权保护的逐行复制，并复核 BSL 的使用限制。 |
| `src/services/webvpn/transport.ts`、`src/utils/encoding.ts` | thu-info-app 与 thu-learn-lib 的 Cookie、响应编码和 GBK 参数处理行为 | BSL 1.1 / MIT | 当前 transport 与编码实现独立维护；发布时对照两份上游许可与本地差异。 |
| `src/domain/campusSchedule.ts`、`src/services/campus/scheduleModel.ts`、`scheduleParser.ts`、`scheduleService.ts`、`src/features/schedule/schedulePeriods.ts` | thu-info-app 的学期、JSONP 课表、周视图和节次约定 | BSL 1.1 | 参考数据字段和业务规则，未引入上游包；需保留本表和行为测试。 |
| `src/services/campus/campusCard.ts`、`classroom.ts`、`courseRegistration.ts`、`electricity.ts`、`grades.ts`、`htmlSelect.ts`、`library.ts`、`network.ts`、`petest.ts`、`sports.ts` | thu-info-app / `@thu-info-lib` 对应校园子系统的协议与字段 | BSL 1.1 | 依照本项目认证与 transport 重写；任何直接移植的段落都必须在发布前再次确认许可与归属。 |
| `src/services/campus/laundry.ts` | thu-info-app 的洗衣机接口语义与字段 | BSL 1.1 | 参考第三方服务 endpoint 和字段含义，服务层独立实现。 |
| `src/services/campus/learningAdapter.ts`、`homeworkDetail.ts`、`src/domain/learning.ts` | [thu-learn-lib](https://github.com/Harry-Chen/thu-learn-lib) 的网络学堂 endpoint、字段、作业状态 | MIT | 参考协议和解析行为，未直接依赖 npm 包；发布前保留 MIT 许可归属审查。 |
| `src/features/learning/InAppViewerScreen.tsx`、`src/features/common/components/HtmlContent.tsx`、`src/services/campus/learningAdapter.ts` | [learnX](https://github.com/robertying/learnX) 的 WebView Cookie 注入、自动高度富文本和预览 URL 行为 | MIT with additional restrictions | 按行为独立实现。learnX README 对特定清华相关主体附加限制；发布或再分发前必须确认不落入该限制，或取得授权。 |
| `src/features/campus/ClassroomScreen.tsx`、`LibraryNativeScreen.tsx`、`subscreens.tsx` | thu-info-app 的功能流程与页面能力范围 | BSL 1.1 | 原生 UI 和样式独立实现；只参考功能流程与服务行为。 |

## 发布前复核

1. 对每项表中范围执行 diff，确认没有复制上游的源码、资源、商标或受限文案。
2. 核对 `thu-info-app` 的 Business Source License 1.1；若用途不明确、涉及商用或仍在限制期，先取得权利人书面许可。
3. 核对 learnX README 中的额外限制；不满足条件时，不要发布包含其直接复制或衍生的代码。
4. 核对 `package-lock.json`、Gradle 依赖和所有新增资源的许可证；必要时补充第三方 notices。
5. 发布页、README 和应用内文案不得暗示与清华大学或上游项目存在官方关系或背书。

## 项目许可

Campus OS 自有源码以仓库根目录的 [MIT License](../LICENSE) 发布。该声明仅覆盖本项目拥有权利的部分；上游协议、第三方依赖和官方服务仍各自适用其许可证与条款。
