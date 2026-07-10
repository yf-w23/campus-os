# Campus OS Design System V1

本文件描述当前实现的设计系统，而不是另起一套视觉框架。目标是让后续页面在信息密度、状态表达和写操作安全提示上保持一致。

**适用版本：v2.1.1**

## 原则

- **Android first**：使用可预测的移动端控件、稳定的点击区域和紧凑的信息密度。
- **安静的操作界面**：页面应像校园控制台，而非营销落地页。
- **一页一个表面层级**：卡片用于记录、工具、模态框和成组数据；避免无意义的卡片嵌套。
- **状态可见**：加载、空、警告、失败、不可用与重试使用共享状态组件。
- **写操作可解释**：AI 和原生写操作均应清晰呈现目标、风险、确认与结果。
- **优先复用**：先组合已有 primitives；只有确有新的交互语义时才新建组件。

## Tokens

仅使用 `src/app/theme` 导出的 token，除非业务场景确实需要新的语义色。

### 颜色

- `background`：页面画布。
- `surface` / `surfaceAlt` / `surfaceElevated`：卡片、分段控件、次级面板。
- `primary` / `primaryMuted`：选中状态、主操作与轻提示。
- `success`、`warning`、`error` 及对应 `*Muted`：仅用于语义状态。
- `borderSubtle`、`divider`：建立结构，避免厚重描边。

当前浅色调以紫色 `primary` 为主。新页面应通过语义色、信息层级和布局增加对比，而不是堆叠紫色渐变。

### 间距与圆角

| Token | 值 | 用途 |
| --- | ---: | --- |
| `xs` | 4 | 微小内部间距 |
| `sm` | 8 | 行间距、紧凑内边距 |
| `md` | 16 | 默认卡片内边距 |
| `lg` | 24 | 页面左右边距、区块间距 |
| `xl` | 32 | 大区块间隔 |
| `xxl` | 48 | 底部留白、完整空状态 |

`radii` 的 `sm`、`md`、`lg`、`xl` 和 `pill` 分别用于小单元格、控件、默认卡片、大面板和徽标。不要手写近似圆角值。

### 字体

- `display`：少量 hero 数字或核心指标。
- `h1`：详情页标题。
- `h2`：重要摘要与卡片标题。
- `h3`：紧凑区块标题。
- `label`：按钮、徽标、表头。
- `body`：默认正文。
- `caption` / `micro`：元数据、辅助文本与密集标签。

不要按视口宽度缩放字号。紧凑新页面也不要新增负字距；标题 token 现有的字距调整保留即可。

## 组件清单

### 操作与导航

| 组件 | 位置 | 使用方式 |
| --- | --- | --- |
| `PrimaryButton` | `features/common/components/Buttons.tsx` | 主操作或次级 `ghost` 操作；按钮内加载使用 `loading`。`accent` 目前沿用主操作样式，不应用于表达新的风险等级。 |
| `ScreenHeader` | `features/common/components/Ui.tsx` | Tab 根页和紧凑仪表盘；副标题只写同步状态、数量或当前范围。 |
| `DetailHeader` | 同上 | 推入的详情页；右侧文本操作应简短，如「刷新」「发送」。 |
| `SectionHeader` | 同上 | 数据组之间的标题；仅当操作归属该组时提供右侧 action。 |
| `SegmentedControl` | 同上 | 互斥的页面内范围切换；`disabled` 项必须保持不可用含义。 |

### 数据展示

| 组件 | 位置 | 使用方式 |
| --- | --- | --- |
| `HeroMetricCard` | `Ui.tsx` | 单个核心指标；使用内建 loading / error，避免各页面复制 hero 状态。 |
| `MetricPill` | `Ui.tsx` | 两到四个并列统计，不作为按钮。 |
| `SurfaceGroup` + `RowItem` | `Ui.tsx` | 同质设置项或信息行；使用 `divider` 形成组内结构。 |
| `ListCard` | `Ui.tsx` | 可导航或独立记录；左侧 accent 仅传达状态 / 类别。 |
| `InfoRow` | `Ui.tsx` | 标签—值详情；缺失值由组件显示 `—`，ID / 日期等可用 `mono`。 |
| `Badge` | `Ui.tsx` | 短状态标签；有效 tone 为 `default`、`success`、`warning`、`error`，不作为按钮。 |
| `GradientCard` | `Ui.tsx` | 少量 hero 强调。普通运营页优先用 `surface`。 |

### 状态

| 组件 | 位置 | 使用方式 |
| --- | --- | --- |
| `StateBlock` | `features/common/components/Status.tsx` | 错误、警告、阻塞与可恢复状态；`actionLabel` 必须重试同一加载或操作路径。 |
| `InlineLoader` | 同上 | 页面、区块和覆盖层加载；按钮局部加载交给 `PrimaryButton`。 |
| `EmptyHint` | 同上 | 无数据、未同步或实体缺失；给出下一步提示。 |

## 页面密度规则

### Dashboard 与 Tab 根页

- 使用 `ScreenHeader`。
- 顶部优先放今日状态、关键事项或主要指标，再放长列表。
- 只有一个真正主导的指标时才使用大 hero。
- 多个同质记录优先放进一个紧凑列表组，不拆成连续浮卡。

### 详情页与列表

- 详情页使用 `DetailHeader`；首个面板可以是摘要卡或 `HeroMetricCard`。
- 同质行优先用 `SurfaceGroup` + `RowItem`；独立可导航记录使用 `ListCard`。
- 行高在元数据变化时应尽量稳定；状态 `Badge` 不应挤压标题换行，除非该状态本身至关重要。

### 表单与写操作

- 输入字段放在 `surface` 卡片或成组输入中，不使用散落的底线。
- 主操作置于表单之后；外部影响或不可逆后果在操作前以辅助说明呈现。
- AI 触发的写操作必须提供 affected resource、风险、确认和执行结果；失败状态必须可重试或明确说明恢复方式。

## 当前落地范围

共享状态组件已用于高频校园、首页、日程、天气、邮箱、图书馆、教室、成绩、监控和学习页面。`HeroMetricCard`、`SegmentedControl`、`MetricPill`、`SurfaceGroup` 与 `RowItem` 已实现；后续工作应优先扩大它们的采用范围，而不是重复实现同类样式。

允许的局部例外：

- `PrimaryButton` 内的局部 spinner。
- 个别既有 hero 卡为保持布局稳定而保留的局部 spinner。
- 校园网验证码块的验证码图片加载状态。

## Review Checklist

- 异步数据是否具备合适的加载、空、失败和重试状态？
- 颜色、间距、字体、圆角是否来自主题 token？
- 是否出现没有语义收益的嵌套卡片？
- 小尺寸 Android 屏幕上文本和按钮是否完整可用？
- 主操作是否清晰，但没有过度抢占页面？
- 写操作是否说明目标、影响和确认结果？
- 是否通过 `npm run typecheck` 与 `npm test -- --runInBand`？

## 参考目标

仅作为比较参考，不复制视觉或代码：Material Design 3（Android 控件和 top bar）、Google Calendar / Notion Calendar（日程密度）、ChatGPT / Claude mobile（聊天和工具结果层级）、Linear / Notion mobile（运营面板与设置）、thu-info-app（功能覆盖与校园 API 行为）。
