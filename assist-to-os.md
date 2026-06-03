# Assist-to-OS Roadmap

这份文档给后续 agent 使用：读完以后应该知道本项目要怎样从“AI 校园 App”继续演进为更接近 AI-native campus operating system 的产品，也知道如何对照上游 `thu-info` 项目继续打通校园接口。

## 北极星

Campus OS 不应该只是一个带聊天框的校园信息 App。目标是做一个能安全替学生完成校园事务的系统：

- AI 能读取校园上下文，理解“我今天下午在哪”“哪门课快到 DDL”“我常去哪个图书馆”。
- AI 能调用统一工具完成真实动作，而不是只给文字建议。
- 每个动作都有权限、确认、审计、失败恢复和可撤销路径。
- 高风险动作永远不静默执行，例如选课、支付、挂失、改密码、预约占用资源。
- 所有凭证和个人数据默认只在本机，除清华官方系统和用户配置的 AI provider 外，不上行业务后端。
- AI 能监控状态并主动提醒（而不是仅被动问答），跨会话持久化任务。

一句话：把校园系统 API 做成“设备驱动”，把 AI 工具、权限、记忆、工作流、提醒和系统 UI 做成“操作系统层”。

---

## 📊 当前 v1.1.0 项目现状与已完成进度

### 已完成且扎实的部分 ✅

| 能力层 | 现状 |
|--------|------|
| **认证基础设施** | 完整的 OAuth 登录链（SM2加密 → 2FA → roam → session recovery 三层兜底），非常稳固 |
| **校园服务层** | 覆盖了课表/成绩/作业/通知/教室/电费/校园卡/校园网/图书馆座位/图书馆研读间/体测/体育场馆预约 |
| **AI 工具注册** | 38 个工具（22 读 + 12 写 + 4 链式辅助），有风险分级、dry-run、verify、undo 完整生命周期 |
| **审计与确认** | `actionAuditStorage` 带脱敏存储、`ActionConfirmationModal` 确认单 UI、设置页可查看操作记录 |
| **Agent 循环** | 多轮 function calling（最多 6 轮）、流式对话、工具调用轨迹可视化 |
| **日程系统** | 周网格 + 日列表、个人备忘 CRUD、课表双保险拉取（legacy JSONP + 学期分段） |

### Phase 进度评估

| 阶段 | 原始目标 | 现状完成度 |
|------|---------|-----------|
| **Phase 1: OS 工具内核** | 工具定义、风险分级、审计存储、确认单 UI | ✅ 90%（全部实现，仅 i18n 覆盖不全） |
| **Phase 2: 只读 Copilot** | 读多源上下文、跨功能问题 | ✅ 85%（已实现，仅部分场景记忆未打通） |
| **Phase 3: 可逆写操作** | 图书馆座位/研读间预约、个人日程、校园网设备注销 | ✅ 100%（已全部实现并开放） |
| **Phase 4: 高风险事务** | 体育/选课/校园卡高风险操作 | ✅ 95%（体育、选课全闭环已完成，校园卡只读+充值） |
| **Phase 5: 主动提醒与工作流** | Workflow Engine、本地通知、监控管理 | ✅ 100%（已完成） |

### 代码库关键文件（必读）

| 路径 | 说明 |
|------|------|
| `src/services/ai/tools.ts` | 35 个 AI 工具注册，AgentTool 接口带 risk/dryRun/verify/undo |
| `src/services/ai/agentService.ts` | Agent 核心，多轮 function calling 循环、流式对话 |
| `src/storage/actionAuditStorage.ts` | 操作审计存储，带敏感字段脱敏 |
| `src/features/ai/ActionConfirmationModal.tsx` | 写操作确认单 UI |
| `src/domain/actions.ts` | 操作领域模型（ToolRisk、ActionPreview、AuditRecord 等） |
| `src/services/campus/` | 所有校园服务 adapter |
| `src/services/auth/tsinghuaAuth.ts` | 认证核心（登录、2FA、roam、session recovery） |

---

## 上游项目的角色

主要参考：

- GitHub: `https://github.com/thu-info-community/thu-info-app`
- 本地上游路径: `upstream/thu-info-app`
- 关键库路径: `upstream/thu-info-app/packages/thu-info-lib/src`
- 上游 App UI 参考: `upstream/thu-info-app/apps/thu-info-app/src/ui`

注意：

- 独立仓库 `thu-info-community/thu-info-lib` 已归档，真正应参考 monorepo 里的 `packages/thu-info-lib`。
- 上游 README 说明 `@thu-info/lib` 是面向清华门户的 program-friendly interface。
- 上游源码是 Business Source License 1.1；商业使用要注意许可证约束。非商业/学习场景也要在 `docs/SOURCE-REUSE-LOG.md` 记录借鉴来源。
- 不建议直接盲目 `import @thu-info/lib` 解决所有问题。本项目有自己的 RN Cookie/WebVPN/SSO 修复层，直接引入可能遇到 Cookie、Cheerio、编码、RN polyfill 和 license 边界问题。更稳妥的方式是：以上游接口和实现为规范，按本项目 `webvpnTransport` / `tsinghuaAuthService` 适配。

## OS 层必须补齐的能力

### 1. 统一工具/动作层

把所有校园能力注册为标准工具，而不是散落在页面和 AI prompt 里。

建议在现有 `AgentTool` 基础上升级为类似：

```ts
type ToolRisk = 'read' | 'write_reversible' | 'write_irreversible' | 'payment' | 'credential';

interface CampusTool<I, O> {
  name: string;
  title: string;
  description: string;
  inputSchema: object;
  outputSchema?: object;
  risk: ToolRisk;
  permission: string;
  dryRun?: (input: I) => Promise<ActionPreview>;
  run: (input: I, ctx: ToolContext) => Promise<O>;
  verify?: (input: I, output: O) => Promise<VerificationResult>;
  undo?: (input: I, output: O) => Promise<UndoResult>;
  summarize?: (input: I) => string;
  confirmPrompt?: (preview: ActionPreview) => ConfirmationSpec;
}
```

原则：

- 读操作可以直接执行，但仍记录 trace。
- 可逆写操作必须确认，例如取消预约、添加备忘、保存偏好。
- 不可逆/高风险操作必须先 `dryRun`，展示确认单，再执行，再 `verify`。
- 支付、挂失、改密码、选课等动作默认不允许后台自动执行。

### 2. 可审计权限

新增本地审计日志，例如 `src/storage/actionAuditStorage.ts`：

- 记录 `id`、时间、工具名、风险等级、脱敏参数、确认结果、执行结果、失败原因。
- 不记录密码、验证码、交易密码、完整学号、完整手机号、支付 token。
- AI 对话中的 tool trace 是“当前会话视图”；审计日志是“系统级历史”。
- 设置页新增“AI 操作记录”，可按工具/日期/风险筛选。

确认 UI 要从 `Alert` 升级为系统确认单：

- 将要执行什么。
- 使用哪个校园账号，学号脱敏显示。
- 会影响什么资源，如房间、课程、金额、设备。
- 能不能撤销，撤销入口在哪里。
- 是否需要二次认证、验证码或交易密码。

### 3. 长期个人记忆

现有 `AIMemory` 可以继续扩展，但要划清边界。

可以记：

- 常用教学楼、常用图书馆、偏好座位区域。
- 默认空教室人数/时间偏好。
- 常用运动项目、场馆、手机号尾号。
- 关注课程、DDL 偏好提醒时间。
- 余额提醒阈值。

不应该记：

- 校园密码、交易密码、验证码、完整身份证件信息。
- 可直接用于支付或账号接管的 token。
- 未经用户确认的敏感推断。

记忆写入也应走工具，例如 `update_user_preference`，并给用户可见的记忆管理页。

### 4. 跨功能任务编排

单工具只能做“查课表”。OS 需要能做“任务”：

- “帮我找明天下午 2 点后离六教近的空教室，然后加到日程。”
- “这周找一个可以 3 人讨论的研读间，有空就提醒我。”
- “关注这门课选课余量，开放时提醒，不要自动选。”
- “如果校园网余额低于 10 元提醒我。”

建议新增 `WorkflowEngine`：

- `Plan`: tool steps + conditions + required confirmations。
- `Run`: 当前执行状态、每步输出、失败点。
- `Resume`: 失败后从最近安全点继续。
- `Cancel`: 用户可取消后台监控。

初期可以不用复杂调度器，先把 workflow 存在 AsyncStorage，App 启动或用户打开时检查。

### 5. 主动提醒与自动执行

提醒是 AI-native 的关键，但自动执行要分级：

- 安全自动：刷新余额、刷新课程/DDL、检查空教室、检查预约记录。
- 需要确认：预约座位/研读间、取消预约、踢校园网设备、发邮件。
- 强确认：选课、PF、支付、校园卡挂失、修改密码。

可以先做本地提醒，不做服务端推送：

- App 启动/回前台时检查。
- React Native 本地通知。
- 用户显式设置监控项。

### 6. 失败可恢复/可撤销

每个写工具至少要回答：

- 怎么确认是否成功？
- 失败时是否可以重试？
- 重试是否会造成重复提交？
- 有没有撤销动作？
- 用户离开页面后在哪里看状态？

例子：

- 图书馆座位预约：成功后查 `getBookingRecords` 验证；撤销用 `cancelBooking`。
- 研读间预约：成功后查 `getLibraryRoomBookingRecord`；撤销用 `cancelLibraryRoomBooking`。
- 体育预约：成功后查 `getSportsReservationRecords`；未支付预约可以 `unsubscribeSportsReservation`。
- 选课：成功后查 `getSelectedCourses`；撤销用 `deleteCourse`，但必须强确认。

## 上游接口地图

下面是建议继续打通的接口。以 `upstream/thu-info-app/packages/thu-info-lib/src/index.ts` 的 `InfoHelper` 方法为索引，以对应 `src/lib/*.ts` 为实现参考。

### 学业与日程

上游接口：

- `getSchedule`
- `saveCustomSchedule`
- `deleteCustomSchedule`
- `getReport`
- `getPhysicalExamResult`
- `getDegreeProgramCompletion`
- `getFullDegreeProgram`
- `getScoreByCourseId`
- `getCalendar`
- `getCalendarImageUrl`

本项目建议：

- 继续维护 `src/services/campus/scheduleService.ts` 作为课程和日程统一源。
- 新增 `src/services/campus/grades.ts` 或扩展已有成绩服务，对接 `getReport` / THOS。
- 新增“毕业进度/培养方案”页面和 AI 工具。

AI 工具例子：

- `get_week_schedule`
- `find_free_time`
- `analyze_degree_progress`
- `get_grade_summary`
- `watch_course_or_deadline`

风险：

- 大部分只读。
- `saveCustomSchedule` / `deleteCustomSchedule` 是本地或校园日程写操作，需确认但风险较低。

### 空教室

上游接口：

- `getClassroomList`
- `getClassroomState`

本项目已有：

- `src/services/campus/classroom.ts`
- `src/features/campus/ClassroomScreen.tsx`

下一步：

- 做成 AI 工具 `find_available_classroom`。
- 支持按时间段、楼宇、容量偏好、当前位置偏好过滤。
- 可将结果一键加入个人日程。

风险：

- 查询只读；加入日程需确认。

### 图书馆座位

上游接口：

- `getLibraryList`
- `getLibraryFloorList`
- `getLibrarySectionList`
- `getLibrarySeatList`
- `bookLibrarySeat`
- `getBookingRecords`
- `cancelBooking`
- `toggleSocketState`

本项目已有：

- `src/services/campus/library.ts`
- `src/features/campus/LibraryNativeScreen.tsx`
- 座位查询已有，预约闭环可继续补。

下一步：

- 补齐 `bookLibrarySeat`、`getBookingRecords`、`cancelBooking`、`toggleSocketState`。
- UI 增加“我的预约”和“取消预约”。
- AI 工具 `find_library_seat`、`book_library_seat`、`cancel_library_seat_booking`。

风险：

- 查询只读。
- 预约/取消为可逆写操作，需要确认。

### 研读间

上游接口：

- `loginLibraryRoomBooking`
- `getLibraryRoomAccNo`
- `getLibraryRoomBookingInfoList`
- `getLibraryRoomBookingResourceList`
- `fuzzySearchLibraryId`
- `bookLibraryRoom`
- `getLibraryRoomBookingRecord`
- `cancelLibraryRoomBooking`
- `updateLibraryRoomEmail`

上游 UI 参考：

- `apps/thu-info-app/src/ui/home/libRoomSelect.tsx`
- `apps/thu-info-app/src/ui/home/libRoomBook.tsx`
- `apps/thu-info-app/src/ui/home/libRoomPerformBook.tsx`
- `apps/thu-info-app/src/ui/home/libRoomBookRecord.tsx`

本项目已有：

- `src/services/campus/library.ts` 已有 CAB 登录、类型列表、资源列表。
- 当前应继续补完整预约动作和记录页。

下一步：

- 补 `bookLibraryRoom`：时间必须是 `yyyy-MM-dd HH:mm:00`，分钟为 5 的倍数。
- 补 `getLibraryRoomBookingRecord` / `cancelLibraryRoomBooking`。
- 补成员搜索时注意上游标注 fuzzy search 已有兼容性变化，不能假设稳定可用。
- AI 工具 `find_library_room`、`book_library_room`、`cancel_library_room_booking`。

风险：

- 预约占用公共资源，必须确认。
- 邀请成员涉及他人学号，参数和日志必须脱敏。

### 体育场馆

上游接口：

- `getSportsResources`
- `updateSportsPhoneNumber`
- `getSportsCaptchaUrl`
- `makeSportsReservation`
- `getSportsReservationRecords`
- `paySportsReservation`
- `unsubscribeSportsReservation`

本项目已有：

- `src/services/campus/sports.ts`
- `src/features/campus/Sports*.tsx`

下一步：

- 对照上游修正资源、验证码、预约、支付、取消全链路。
- AI 先做查询和提醒，再做“确认后预约”。
- 支付动作应强确认，并尽量交给系统浏览器/支付宝跳转完成。

AI 工具：

- `search_sports_slots`
- `watch_sports_slot`
- `book_sports_slot`
- `cancel_sports_booking`

风险：

- 查询只读。
- 预约/取消需确认。
- 支付必须强确认，不允许后台自动执行。

### 选课系统

上游接口：

- `getCrTimetable`
- `getCrCaptchaUrl`
- `loginCr`
- `getCrAvailableSemesters`
- `getCrCoursePlan`
- `searchCrRemaining`
- `searchCrPrimaryOpen`
- `searchCrCourses`
- `selectCourse`
- `deleteCourse`
- `getSelectedCourses`
- `changeCourseWill`
- `getCrCurrentStage`
- `searchCoursePriorityMeta`
- `searchCoursePriorityInformation`
- `getQueueInfo`
- `cancelCoursePF`
- `setCoursePF`

上游 UI 参考：

- `apps/thu-info-app/src/ui/home/crHome.tsx`
- `apps/thu-info-app/src/ui/home/crSearchResult.tsx`
- `apps/thu-info-app/src/ui/home/crCoursePlan.tsx`

下一步：

- 第一阶段只做查询：可选学期、培养方案、课程搜索、余量、已选、队列。
- 第二阶段做关注和提醒：课程余量变化、选课阶段变化、队列信息。
- 第三阶段才做 `selectCourse` / `deleteCourse` / `changeCourseWill` / PF。

AI 工具：

- `search_courses`
- `get_course_registration_status`
- `watch_course_capacity`
- `draft_course_selection_plan`
- `select_course`，强确认
- `drop_course`，强确认

风险：

- 选课、退课、改志愿、PF 都是高风险，必须强确认，不允许自动后台执行。
- 执行后必须用 `getSelectedCourses` 或相关查询验证。

### 校园卡

上游接口：

- `loginCampusCard`
- `getCampusCardInfo`
- `getCampusCardPhotoUrl`
- `getCampusCardTransactions`
- `changeCampusCardPassword`
- `modifyCampusCardMaxTransactionAmount`
- `reportCampusCardLoss`
- `cancelCampusCardLoss`
- `rechargeCampusCard`

上游 UI 参考：

- `apps/thu-info-app/src/ui/home/campusCard.tsx`
- `apps/thu-info-app/src/ui/home/loseCard.tsx`

下一步：

- 优先做余额、流水、低余额提醒。
- 然后做充值跳转。
- 挂失/解挂/改密码/改限额必须强确认，并且交易密码不能进入日志或 AI 上下文。

AI 工具：

- `get_campus_card_balance`
- `get_campus_card_transactions`
- `watch_campus_card_balance`
- `recharge_campus_card`，强确认
- `report_campus_card_loss`，强确认

风险：

- 余额/流水敏感但只读。
- 充值、挂失、密码相关是最高风险。

### 校园网

上游接口：

- `getNetworkVerificationImageUrl`
- `loginUsereg`
- `getOnlineDevices`
- `getNetworkBalance`
- `getNetworkAccountInfo`
- `loginNetworkDevice`
- `logoutNetworkDevice`

上游 UI 参考：

- `apps/thu-info-app/src/ui/home/network.tsx`
- `apps/thu-info-app/src/ui/home/networkOnlineDevices.tsx`
- `apps/thu-info-app/src/ui/home/networkLogin.tsx`

下一步：

- 查询余额、账号信息、在线设备。
- 一键注销某设备。
- 余额阈值提醒。

AI 工具：

- `get_network_balance`
- `list_network_devices`
- `logout_network_device`，确认
- `watch_network_balance`

风险：

- 设备注销会影响联网，需确认。
- 登录设备涉及验证码，不应让 AI 自行猜测或保存验证码。

### 电费与宿舍

上游接口：

- `getEleRemainder`
- `getElePayRecord`
- `getEleRechargePayCode`
- `getDormScore`
- `resetDormPassword`

本项目已有：

- `src/services/campus/electricity.ts`
- `src/features/campus/Ele*.tsx`

下一步：

- 低电量提醒。
- 电费充值确认单。
- 宿舍分只读。
- 重置宿舍密码必须强确认，不建议第一批接入 AI。

AI 工具：

- `get_dorm_electricity_balance`
- `watch_dorm_electricity`
- `create_electricity_recharge_order`，强确认

风险：

- 充值/密码类高风险。

### 票据、财务与收入

上游接口：

- `getInvoiceList`
- `getInvoicePDF`
- `getBankPayment`
- `getGraduateIncome`

上游 UI 参考：

- `apps/thu-info-app/src/ui/home/invoice.tsx`
- `apps/thu-info-app/src/ui/home/bankPayment.tsx`
- `apps/thu-info-app/src/ui/home/income.tsx`

下一步：

- 做“校园账本”：发票、缴费、研究生收入。
- AI 可回答“上个月校园支出大概多少”“帮我找某张发票”。

风险：

- 财务信息敏感，只读也要谨慎展示。
- PDF 不要传给外部模型，除非用户明确同意。

### 新闻、通知与订阅

上游接口：

- `getNewsList`
- `searchNewsList`
- `getNewsSubscriptionList`
- `getNewsSourceList`
- `getNewsChannelList`
- `addNewsSubscription`
- `removeNewsSubscription`
- `getNewsListBySubscription`
- `getNewsDetail`
- `addNewsToFavor`
- `removeNewsFromFavor`
- `getFavorNewsList`

上游 UI 参考：

- `apps/thu-info-app/src/ui/news/*`

下一步：

- 做校园通知聚合和摘要。
- 支持关键词订阅，例如奖学金、讲座、补退选。
- AI 每天生成“今日校园简报”。

风险：

- 收藏/订阅是低风险写操作，需要轻确认或可撤销提示。

### 教学评价

上游接口：

- `getAssessmentList`
- `getAssessmentForm`
- `postAssessmentForm`

下一步：

- AI 可以辅助起草评价，但提交前必须用户逐项确认。
- `postAssessmentForm` 不应在后台自动执行。

风险：

- 涉及教学评价，必须强确认。

### 邮件

上游接口：

- `naiveSendMail`

下一步：

- 可作为“通知老师/同学”的草稿生成器。
- 第一阶段只生成草稿，不直接发送。
- 直接发送必须强确认，展示收件人、主题、正文。

风险：

- 发送邮件不可撤销，强确认。

### GitLab 与 reserves lib

上游接口：

- GitLab: `getGitNamespaces`、`getGitRecentProjects`、`searchGitProjects`、`getGitProjectTree`、`getGitProjectFileBlob`、`renderGitMarkdown`
- Reserves Lib: `searchReservesLib`、`getReservesLibBookDetail`、`reservesLibDownloadChapters`

下一步：

- GitLab 可做课程代码/项目浏览，但优先级低于校园生活闭环。
- Reserves Lib 可做教材搜索和资料阅读。

风险：

- 下载文件注意存储权限和文件大小。

## 建议实施顺序

### Phase 1: 固化 OS 工具内核

目标：

- 重构/扩展 `src/services/ai/tools.ts` 的工具定义。
- 引入风险等级、权限 key、dry-run、verify、undo。
- 新增本地审计日志存储。
- 新增统一确认单 UI。

优先接入工具：

- 查询课表。
- 查询空教室。
- 查询校园卡余额/校园网余额/电费余额。
- 查询图书馆预约记录。
- 查询体育预约记录。

验收：

- AI 每次工具调用都能在对话里显示 trace。
- 设置页可看到操作记录。
- 敏感字段脱敏。

### Phase 2: 读多源上下文，做校园 Copilot

目标：

- 扩展 AI 上下文构建，不只塞课表，还能按需读取余额、预约、空教室、DDL、记忆。
- 添加 read-only 工具的 schema。
- AI 能回答跨功能问题。

示例：

- “今天还有课吗？附近哪里能自习？”
- “我这周有哪些校园事务要处理？”
- “余额、电费、预约有没有异常？”

验收：

- 无写操作也能明显提升智能程度。
- 工具结果体积受控，不把大 HTML/PDF 直接塞给模型。

### Phase 3: 可逆写操作

目标：

- 图书馆座位预约/取消。
- 研读间预约/取消。
- 新闻订阅/收藏。
- 个人日程/备忘增删。
- 校园网设备注销。

要求：

- 所有写操作先确认。
- 执行后 verify。
- 可撤销的在结果页展示撤销入口。

### Phase 4: 高风险事务

目标：

- 体育预约和支付。
- 选课/退课/PF。
- 校园卡充值/挂失/限额。
- 电费充值。
- 教学评价提交。
- 邮件发送。

要求：

- 默认只做草稿、方案、提醒。
- 执行必须强确认。
- 不做无人值守自动提交。
- 失败时保留状态，允许用户查看和恢复。

### Phase 5: 主动提醒和工作流

目标：

- 本地 workflow 存储和执行。
- 本地通知。
- App 前台/启动时检查。
- 用户可管理监控项。

示例：

- 课程余量监控。
- 研读间空位提醒。
- 校园卡/电费/校园网余额阈值提醒。
- 明日课程和 DDL digest。

## Agent 开发规则

后续 agent 接手时按以下规则工作：

1. 先读本项目现有服务层，不要直接复制上游 UI。
2. 以上游 `packages/thu-info-lib/src/lib/*.ts` 作为协议参考，适配到本项目 `webvpnTransport` 和 `tsinghuaAuthService`。
3. 上游 `packages/thu-info-lib/src/constants/strings.ts` 是 endpoint/token 参考源。
4. 上游 `apps/thu-info-app/src/ui/home/*.tsx` 是交互流程参考源。
5. 每接一个接口，先做 service，再做页面，再注册 AI tool。
6. 写操作必须有确认、审计、verify；可撤销动作必须暴露 undo/cancel。
7. 不把密码、验证码、交易密码、完整学号、完整手机号、支付 token 写入日志或 AI 上下文。
8. 大响应先结构化摘要，再传给 AI；不要把 HTML/PDF 原文直接传给模型。
9. 目标文件小改用 `apply_patch`；跑针对性 lint/test。
10. 当前项目 full typecheck 可能有既有问题，改动后优先跑触达文件的 eslint 和相关单测。

## 近期最值得做的具体 backlog

1. 新增 `src/domain/actions.ts`：定义 `ToolRisk`、`ActionPreview`、`ConfirmationSpec`、`AuditRecord`。
2. 新增 `src/storage/actionAuditStorage.ts`：本地审计日志。
3. 把 `src/services/ai/tools.ts` 的 `AgentTool` 扩展出 risk/permission/dryRun/verify/undo。
4. 把 `useAIChat.ts` 的 `Alert` 确认换成可复用确认单组件。
5. 给已有工具补风险等级和审计记录。
6. 接入校园卡只读：余额、流水、低余额提醒。
7. 接入校园网只读：余额、账号、在线设备，再做注销设备。
8. 补研读间完整闭环：预约记录、预约、取消。
9. 给空教室注册 AI 工具。
10. 做“AI 操作记录”设置页。

---

## 🔴 与 AI-native OS 愿景的核心差距

### 1. **工作流引擎 —— 最大的缺失**（Phase 5，0%）

这是从"AI 聊天 App"到"AI-native OS"最本质的差距。现在 AI 能做的是**单次对话中的多工具调用**（"帮我查课表 + 空教室"），但下面是真正 OS 级别的能力，全部缺失：

- "这周帮我盯着某个研读间，有空位就提醒我" → ❌
- "关注这门课的余量，开放选课时提醒我" → ❌
- "如果校园网余额低于 10 元提醒我" → ❌
- "每天早上给我生成今日校园简报" → ❌
- "我设置了多个监控项，让我能管理它们" → ❌

**本质上缺的是一个本地 Workflow Engine**：Plan（工具链+条件+确认点）→ Run（执行状态机）→ Resume（失败恢复）→ Cancel（用户取消）。

### 2. **主动提醒 / 本地通知 —— 完全缺失**（Phase 5，0%）

一切行为都是用户主动问 → AI 被动答。作为 OS，应该能主动把用户"拉回来"：
- ❌ 无本地通知（React Native `PushNotificationIOS` / `notifee`）
- ❌ 无 App 前台/启动时的条件检查
- ❌ 无定时后台刷新

### 3. **选课系统 —— 全闭环已完成**（Phase 4，95% ✅）

选课系统的全套接口已接入并开放：期末预选/正选/补退选/二级选课/体育课/重修课等全流程支持。

- ✅ `services/campus/courseRegistration.ts`：API service（学期列表、课余量搜索、选课、退课、已选课程）
- ✅ `CourseRegistrationScreen.tsx`：「搜索选课」+「已选课程」双 Tab，8 种选课类型全覆盖（含 PF/重修），退课按钮带确认
- ✅ AI 工具 `select_course`（强确认 dryRun+confirmPrompt）、`get_selected_courses`（只读）、`drop_course`（强确认 dryRun+verify）
- ⬜ `changeCourseWill`（改志愿）、`setCoursePF`/`cancelCoursePF`（P/F 切换）待后续版本

### 4. **体育场馆 —— 代码存在但入口被封**（Phase 4，50%）

`sports.ts` 里预约/支付/退订/验证码全链路都已经写好了，AI 工具里 `search_sports_slots` 等也已注册。但 `CampusEntryScreen` 没有开放体育入口。差的是 UI 和确认流程的桥接。

### 5. **校园卡功能 —— 只做只读**（Phase 4，50%）

余额/流水查询 + 支付宝充值已实现。挂失/解挂/改密码等高风险操作已从开发计划中移除，当前版本不做。

### 6. **AI 记忆系统 —— 已完成**（Phase 3，100% ✅）
- ✅ `remember_preference` 工具完整可调用，写入 → 存储 → 下一次对话注入全链路通
- ✅ 设置页「AI 记忆」管理 UI：查看/展开详情/清除记忆
- ✅ system prompt 含自动学习规则：AI 检测到连续同类操作时主动建议保存偏好

### 7. **缺失的校园能力模块**（Phase 2-4，大部分已完成）

- ✅ **培养方案 / 毕业进度**：`getDegreeProgramCompletion`、`getFullDegreeProgram`（domain + service + AI工具 + UI页面 + 导航入口，API 解析待完善）
- ✅ **校园新闻 / 通知聚合**：`getNewsList`、`searchNewsList`、收藏系列（domain + service + AI工具 + UI页面 + 导航入口，API 解析待完善）
- ⬜ **教学评价**：`getAssessmentList`、`getAssessmentForm`、`postAssessmentForm`
- ⬜ **邮件**：`naiveSendMail`
- ⬜ **GitLab / Reserves Lib**：课程代码浏览、教材搜索

### 8. **工程质量债务** ✅ 已全部解决

| 问题 | 状态 |
|------|------|
| ~~深色模式锁定为 `light`~~ | ✅ 已移除深色模式，统一使用浅色 |
| 审计/设置模块 hardcoded 中文 10+ 处 | ✅ 已补全 i18n |
| 体育场馆代码完全写好但入口隐藏 | ✅ 入口已开放 |

---

## 🎯 新的开发计划（v0.6.0+）

### 优先级矩阵

| 优先级 | 功能 | 预计工作量 |
|--------|------|-----------|
| **P0（必须做）** | 体育场馆入口开放 + 完整接入 | 0.5 天 |
| **P0（必须做）** | 工程债务：i18n 补全审计模块 | 0.5 天 |
| **P0（必须做）** | 工程债务：开放深色模式切换 | 0.25 天 |
| **P1（高价值）** | **选课系统 Phase 1-2**：查询 + 监控 + 提醒 | 1.5 天 |
| **P1（高价值）** | **AI 记忆系统**：触发写入 + 管理 UI + 自动学习 | 1.5 天 |
| **P2（关键架构）** | **Workflow Engine 最小可用版**：监控项 + 前台检查 | 2 天 |
| **P2（关键架构）** | **本地通知**：余额/空教室/余量提醒 | 1.5 天 |
| **P3（锦上添花）** | 培养方案/新闻/邮件/教学评价 | 按需 |

### 具体 Backlog（按建议顺序）

#### 1. 体育场馆入口开放（P0，0.5 天）✅ 已完成
- ✅ 在 CampusScreen.tsx 中添加体育场馆入口项
- ✅ 验证 Sports*Screen.tsx 正常工作
- ✅ AI 工具 search_sports_slots / book_sports_slot 已注册可用

#### 2. i18n 补全审计模块（P0，0.5 天）✅ 已完成
- ✅ 在 zh.ts / en.ts 中补充审计模块所有文案 key
- ✅ 修改 SettingsScreen.tsx，把 hardcoded 中文替换为 i18n key
- ✅ i18n 切换正常工作

#### 3. 选课系统 Phase 1-3（P1）✅ 全部完成
- ✅ 新增 domain/courseRegistration.ts：领域模型
- ✅ 新增 services/campus/courseRegistration.ts：API 封装（学期/搜索/选课/退课/已选）
- ✅ 新增 CourseRegistrationScreen.tsx：选课主界面（学期选择 + 搜索 + 选课确认弹窗 + 已选课程Tab + 退课）
- ✅ AI 工具 select_course（强确认 dryRun+confirmPrompt）、get_selected_courses（只读）、drop_course（强确认 dryRun+verify）
- ✅ 8 种 Priority 全覆盖（bx/xx/rx/ty/xwk/fxwk/tyk/cx）
- ✅ 导航集成 + CampusScreen 入口 + i18n

#### 4. AI 记忆系统（P1，1.5 天）✅ 已完成
- ✅ 修复 `remember_preference` 工具调用链路，确保记忆能正确写入和读取
- ✅ 在设置页新增「AI 记忆」管理 UI：查看/展开详情/清除记忆
- ✅ 新增 `clearAIMemory` 功能，支持重置所有偏好
- ✅ 在 system prompt 中增强自动学习规则：AI 检测到连续同类操作时主动建议保存偏好

#### 5. Workflow Engine 最小可用版（P2，2 天）✅ 已完成
- ✅ 新增 domain/workflow.ts：Workflow/WorkflowCondition/WorkflowCheckResult 领域模型 + 8 个预设监控项（电费/网费/DDL/课表/体育/研读间/座位）
- ✅ 新增 storage/workflowStorage.ts：CRUD 持久化存储
- ✅ 新增 services/workflow/WorkflowEngine.ts：核心引擎，4 种条件检查器（电费/网费/DDL/课表）每 60 秒防抖
- ✅ 新增 services/notification/notificationService.ts：本地通知抽象层
- ✅ App 启动/回前台时通过 AppState.addEventListener('change') 触发检查
- ✅ 新增「智能监控」管理 UI（MonitorsScreen）：添加预设/启停/删除/立即检查

#### 6. 本地通知（P2，1.5 天）✅ 已完成
- ✅ notificationService.ts：showLocalNotification / onForegroundNotification / 通知开关接口
- ✅ 前台时通过 handler 回调解耦
- ✅ 通知与 Workflow Engine 桥接：检查结果触发 → showLocalNotification

---

## 关键判断（最终版）

`thu-info` 能给本项目提供大量校园系统接口，但它不是 AI-native OS。真正的差异在于：

- 不是更多页面，而是统一动作层 ✅ （已完成）
- 不是更长 prompt，而是可信工具调用 ✅ （已完成）
- 不是自动化一切，而是可审计、可确认、可恢复的半自动校园事务 ✅ （已完成基础）
- 不是让 AI 变成浏览器脚本，而是让 AI 成为系统调度者，底层由明确的 typed tools 执行 ✅ （Workflow Engine 已完成）
- 不是仅被动问答，而是能监控状态、主动提醒、跨会话持久化任务 ✅ （本地通知 + Workflow 已完成最小可用版）

**下一步：所有 P0/P1/P2 任务已全部完成。后续可按需接入培养方案/新闻/邮件/教学评价等 P3 模块，或继续深化工作流引擎（条件扩展、后台检查、真实推送通知）。**

---

## 上游项目的角色

主要参考：
