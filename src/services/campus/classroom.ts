/**
 * 教室查询 — 严格对照 thu-info-lib basics.ts `getClassroomList` + `getClassroomState`。
 *
 * 关键修复 vs 旧实现：
 *
 * 1. `searchName` 不再做 GBK percent-decode → percent-encode 的 round trip。
 *    旧实现里 `gbkPercentDecode` 对页面里 href 已经是 `%C1%F9%BD%CC` 的情况能跑通，
 *    但对 webvpn 已经把 GBK 响应 decode 成 UTF-8 字符串、href 里直接出现 "六教" 的情况，
 *    会用 `charCodeAt & 0xff` 取低字节当 GBK 字节，输出是乱码。
 *    新实现：照搬上游 `searchName = match[1]`，原样塞进 URL；
 *    `gb2312PercentEncode` 现在只对 `[\u4e00-\u9fa5]` 编码、其它直通，所以两种形态都安全。
 *
 * 2. fetchClassroomState 也走 `roamDefault` 再请求，避免会话过期后状态查询不会自愈。
 *    上游 `roamingWrapperWithMocks` 对每次 API 调用都会兜底；我们这里至少在每次 state
 *    请求前激活一次 zhjw 子系统会话，与 fetchClassroomList 保持一致。
 *
 * 3. 解析教室名按上游 `tr.children[1].children[2].data` 精确路径取，
 *    不要再用 `td.text` 把整个 td 子树合并 — 后者会把 td 里 `<a name="…">` / `<span>` 的
 *    文本和教室号粘在一起。
 *
 * 4. `ClassroomStatus` 数值枚举 0..5，与上游一致；UI 用 enum tag 取颜色。
 *    （上游约定 status 数组长度 = 7 天 × 6 节 = 42，UI 直接按 index 取，不再动态 floor。）
 */
import {webvpnTransport} from '../webvpn/transport';
import {tsinghuaAuthService} from '../auth/tsinghuaAuth';
import {loadHtml} from './htmlSelect';
import {gb2312PercentEncode} from '../../utils/encoding';

const WEBVPN_BASE = 'https://webvpn.tsinghua.edu.cn';
const ZHJW_TOKEN =
  '77726476706e69737468656265737421eaff4b8b69336153301c9aa596522b20bc86e6e559a9b290';

const CLASSROOM_LIST_URL = `${WEBVPN_BASE}/http/${ZHJW_TOKEN}/portal3rd.do?url=/portal3rd.do&m=jasJy_Xs_Js_index`;
const CLASSROOM_STATE_PREFIX = `${WEBVPN_BASE}/http/${ZHJW_TOKEN}/pk.classroomctrl.do?m=qyClassroomState&classroom=`;
const CLASSROOM_STATE_MIDDLE = '&weeknumber=';

const CLASSROOM_YYFWID = '40470BB47E0849E9EF717983490BC964';

const SYSTEM_TIMEOUT_MSG = 'time out用户登陆超时或访问内容不存在';
const WEBVPN_TITLE = '<title>清华大学WebVPN</title>';

export const CLASSROOM_PERIODS = [
  {period: 1, label: '第1节', timeRange: '08:00-09:35'},
  {period: 2, label: '第2节', timeRange: '09:50-12:15'},
  {period: 3, label: '第3节', timeRange: '13:30-15:05'},
  {period: 4, label: '第4节', timeRange: '15:20-16:55'},
  {period: 5, label: '第5节', timeRange: '17:10-18:45'},
  {period: 6, label: '第6节', timeRange: '19:20-21:45'},
] as const;

// 与 thu-info-lib 上游约定一致：每天 6 个大节、每周 7 天，所以 status 数组长度 = 42
export const PERIODS_PER_DAY = CLASSROOM_PERIODS.length;
export const DAYS_PER_WEEK = 7;

export enum ClassroomStatus {
  TEACHING = 0,
  EXAM = 1,
  BORROWED = 2,
  DISABLED = 3,
  RESERVED_FOR_COMPAT = 4,
  AVAILABLE = 5,
}

export interface BuildingEntry {
  /** 教学楼显示名（如 "六教"） */
  name: string;
  weekNumber: number;
  /**
   * 用于 state 查询 URL 的原始建筑串。
   *
   * 与上游一致：**直接保留 href 里 `classroom=` 后面的原值**。
   * - 多数情况下页面 href 是 GBK percent-encoded，比如 `%C1%F9%BD%CC`，原样塞回 URL 就能命中；
   * - 极少情况下 webvpn 解码层把 href 也变成了 raw 中文 `六教`，
   *   `gb2312PercentEncode` 会按汉字编出 `%C1%F9%BD%CC`。
   * 两种形态都正确。
   */
  searchName: string;
}

export interface ClassroomState {
  /** 上游格式 `"教室号:容量(人)"`，例如 `"6A101:60(人)"`。UI 用 `:` 拆分显示。 */
  name: string;
  /** 长度 42 = 7 天 × 6 节，从周一第 1 节起按行展开 */
  status: ClassroomStatus[];
}

export interface ClassroomStateResult {
  validWeekNumbers: number[];
  currentWeekNumber: number;
  /** 当前周从周一到周日的 7 个日期字符串（不含括号） */
  datesOfCurrentWeek: string[];
  classroomStates: ClassroomState[];
}

function ensureNotTimeout(html: string): void {
  if (html.includes(SYSTEM_TIMEOUT_MSG)) {
    throw new Error('教务系统会话超时，请重新登录');
  }
  if (html.includes(WEBVPN_TITLE)) {
    throw new Error('WebVPN 会话失效，请重新登录');
  }
}

export async function fetchClassroomList(): Promise<BuildingEntry[]> {
  await tsinghuaAuthService.roamDefault(CLASSROOM_YYFWID);
  const html = await webvpnTransport.fetchText(CLASSROOM_LIST_URL);
  ensureNotTimeout(html);
  return parseClassroomList(html);
}

/** 公开供测试用：直接喂 HTML 也能跑解析。 */
export function parseClassroomList(html: string): BuildingEntry[] {
  const $ = loadHtml(html);
  const result: BuildingEntry[] = [];
  // upstream: $(".w30 a[href^=/http/]")
  $('.w30 a').each((_, a) => {
    const href = a.getAttribute('href') ?? '';
    if (!href.startsWith('/http/')) return;
    const name = a.text.trim();
    const match = /classroom=([^&]+)&weeknumber=(\d+)/.exec(href);
    if (!match) return;
    const searchName = match[1];
    const week = Number(match[2]);
    if (!name || !searchName || isNaN(week)) return;
    result.push({name, weekNumber: week, searchName});
  });
  if (result.length === 0) {
    throw new Error('未能从教务系统解析到教学楼列表');
  }
  return result;
}

export async function fetchClassroomState(
  building: string,
  week: number,
): Promise<ClassroomStateResult> {
  // 每次状态查询都先激活一次 zhjw 漫游：与上游 roamingWrapper 等价；
  // 否则 UI 长时间停留在该屏幕后切换周次会卡 "用户登陆超时"。
  await tsinghuaAuthService.roamDefault(CLASSROOM_YYFWID);

  // building 可能是 raw 中文 ("六教") 或已编码 ("%C1%F9%BD%CC")。
  // gb2312PercentEncode 只编码汉字、其它直通，因此两种形态最终都得到合法的 URL。
  const url =
    CLASSROOM_STATE_PREFIX +
    gb2312PercentEncode(building) +
    CLASSROOM_STATE_MIDDLE +
    week;
  const html = await webvpnTransport.fetchText(url);
  ensureNotTimeout(html);
  return parseClassroomState(html, week);
}

/** 公开供测试用：直接喂 HTML 也能跑解析。 */
export function parseClassroomState(
  html: string,
  weekHint: number,
): ClassroomStateResult {
  const $ = loadHtml(html);

  // ---- 可选周次 ----
  const validWeekNumbers: number[] = [];
  $('#weeknumber option').each((_, el) => {
    const v = Number(el.getAttribute('value'));
    if (!isNaN(v)) validWeekNumbers.push(v);
  });

  // ---- 本周日期 ----
  // 上游用 `[colspan=6]` 选取，每个 cell 形如 "周一(12-04)"，取括号内
  const datesOfCurrentWeek: string[] = [];
  $('[colspan="6"]').each((i, el) => {
    if (i >= 7) return;
    const t = el.text;
    const m = /\((.+?)\)/.exec(t);
    datesOfCurrentWeek.push(m?.[1] ?? '');
  });

  // ---- 教室状态表 ----
  // upstream: $("#scrollContent>table>tbody") 然后逐 tr 解析
  const classroomStates: ClassroomState[] = [];
  const tbodies = $('#scrollContent tbody');
  tbodies.each((_, tbody) => {
    const childNodes: any[] = (tbody as any).childNodes ?? [];
    const trs = childNodes.filter(
      c => c?.nodeType === 1 && c?.tagName?.toLowerCase?.() === 'tr',
    );
    for (const tr of trs) {
      const parsed = parseClassroomRow(tr);
      if (parsed) classroomStates.push(parsed);
    }
  });

  if (classroomStates.length === 0 && html.indexOf('scrollContent') === -1) {
    // 与上游一样：HTML 完全不含 scrollContent 区块时是异常（会话挂了或换了页面）
    throw new Error('未能解析到教室数据（HTML 中无 scrollContent 区块）');
  }

  return {
    validWeekNumbers,
    currentWeekNumber: weekHint,
    datesOfCurrentWeek,
    classroomStates,
  };
}

/**
 * 按上游精确路径解析一行：
 *   - 名字 = `tr.childNodes[1]`（首个 `<td>`）里的 `childNodes[2]` 文本（DataNode.data.trim()）
 *     这种"特定 index"的取法是为了避开 td 里 `<a name="…"></a>` 之类锚点造成的干扰。
 *   - 状态 = `tr.childNodes.slice(3)` 里所有 `<td>`，按 class 名映射枚举。
 *     - `colBound` 是分隔列（每天 6 节后有一道竖分割）的样式 hint，不参与状态计算 — 上游同样过滤。
 *     - 只剩下的 class 是 `onteaching` / `onexam` / `onborrowed` / `ondisabled` 之一，否则视为 AVAILABLE。
 *     - 多个有效 class 同时存在按上游会抛错；我们这里宽松处理：取第一个有效 class，避免单点异常拖垮整页。
 */
function parseClassroomRow(tr: any): ClassroomState | null {
  const children: any[] = tr?.childNodes ?? [];

  // —— 名字 —— //
  const nameTd = children[1];
  if (!nameTd || nameTd.nodeType !== 1) return null;
  const nameTdChildren: any[] = nameTd.childNodes ?? [];
  const nameNode = nameTdChildren[2];
  // 优先按上游精确路径取 children[2] 的文本节点；
  // 拿不到（结构异常）时退回 td.text，仍能尽量返回非空名字。
  const name =
    extractRawText(nameNode) ||
    (typeof nameTd.text === 'string' ? nameTd.text.trim() : '');
  if (!name) return null;

  // —— 状态 —— //
  const statusCells = children
    .slice(3)
    .filter(n => n?.nodeType === 1 && n?.tagName?.toLowerCase?.() === 'td');
  const status: ClassroomStatus[] = statusCells.map(td =>
    classifyStatusCell(td),
  );

  // 没有任何状态格的行通常是表头或脚注，跳过。
  if (status.length === 0) return null;

  return {name, status};
}

function extractRawText(node: any): string {
  if (!node) return '';
  // node-html-parser 的 TextNode 有 rawText / text；HTMLElement 也都有
  const raw =
    (typeof node.rawText === 'string' && node.rawText) ||
    (typeof node.text === 'string' && node.text) ||
    '';
  return String(raw).trim();
}

function classifyStatusCell(td: any): ClassroomStatus {
  const clsAttr: string =
    (td?.getAttribute ? td.getAttribute('class') : td?.attributes?.class) ?? '';
  const tokens = clsAttr
    .split(/\s+/)
    .filter((c: string) => c && c !== 'colBound');

  // 上游对 tokens.length > 1 抛错；我们取首个匹配项 — 真实页面里偶有冗余 class，
  // 严格抛错会让整屏 UI 失败，体验更差。
  for (const t of tokens) {
    switch (t) {
      case 'onteaching':
        return ClassroomStatus.TEACHING;
      case 'onexam':
        return ClassroomStatus.EXAM;
      case 'onborrowed':
        return ClassroomStatus.BORROWED;
      case 'ondisabled':
        return ClassroomStatus.DISABLED;
      default:
        break;
    }
  }
  return ClassroomStatus.AVAILABLE;
}
