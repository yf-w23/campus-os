/**
 * 图书馆 / 研讨间 native 服务，严格对照 thu-info-lib `library.ts`。
 *
 * 接口层次：
 *   GET api.php/areas/1/tree/1                       → 全部图书馆（顶层）
 *   GET api.php/areas/{libraryId}/date/{YYYY-MM-DD}  → 楼层列表（childArea）
 *   GET api.php/areas/{floorId}/date/{YYYY-MM-DD}    → 分区列表（childArea + 含 TotalCount）
 *   GET api.php/areadays/{sectionId}                 → 该分区可预约日期 / 时段列表
 *   GET api.php/spaces_old?area=X&segment=Y&day=...  → 该分区在某时段的座位状态
 *
 * 关键坑：
 *   - 日期路径用 `YYYY-MM-DD`（带横杠），不是 `YYYYMMDD`
 *   - `spaces_old` 是 query string 而非 path，且必须先 `areadays` 拿 segment
 *   - response 外层 `{data: {list: ...}}` 里 `.list` 的形状依端点而异：
 *       areas → `{childArea: [...]}`；days / seats → 直接是数组
 *
 * 只读浏览。下单走清华师生大厅小程序。
 */
import {webvpnTransport} from '../webvpn/transport';
import {tsinghuaAuthService} from '../auth/tsinghuaAuth';
import {SUBSYSTEM_YYFWID} from '../webvpn/constants';

const WEBVPN_BASE = 'https://webvpn.tsinghua.edu.cn';

const LIB_TOKEN =
  '77726476706e69737468656265737421e3f24088693c6152301c9aa596522b204c02212b859d0a19';
const LIB_ROOM_TOKEN =
  '77726476706e69737468656265737421f3f643d22b396a1e6a1b80a29f5d363409e413829737d1';

export const LIBRARY_HOME_URL = `${WEBVPN_BASE}/https/${LIB_TOKEN}/home/web/f_second`;
export const LIBRARY_LIST_URL = `${WEBVPN_BASE}/https/${LIB_TOKEN}/api.php/areas/1/tree/1`;
export const LIBRARY_AREAS_URL_PREFIX = `${WEBVPN_BASE}/https/${LIB_TOKEN}/api.php/areas/`;
export const LIBRARY_DAYS_URL_PREFIX = `${WEBVPN_BASE}/https/${LIB_TOKEN}/api.php/areadays/`;
export const LIBRARY_SEATS_URL = `${WEBVPN_BASE}/https/${LIB_TOKEN}/api.php/spaces_old`;
export const LIBRARY_BOOK_URL_PREFIX = `${WEBVPN_BASE}/https/${LIB_TOKEN}/api.php/spaces/`;
export const LIBRARY_BOOK_URL_SUFFIX = '/book';
export const LIBRARY_CANCEL_BOOKING_URL_PREFIX = `${WEBVPN_BASE}/https/${LIB_TOKEN}/api.php/profile/books/`;
export const LIBRARY_BOOKING_RECORDS_URL = `${WEBVPN_BASE}/https/${LIB_TOKEN}/user/index/book`;

export const LIBRARY_ROOM_BOOKING_USER_INFO_URL = `${WEBVPN_BASE}/https/${LIB_ROOM_TOKEN}/ic-web/auth/userInfo`;
export const LIBRARY_ROOM_BOOKING_ROOM_INFO_URL = `${WEBVPN_BASE}/https/${LIB_ROOM_TOKEN}/ic-web/roomDevice/roomInfos`;
export const LIBRARY_ROOM_BOOKING_RESOURCE_LIST_URL = `${WEBVPN_BASE}/https/${LIB_ROOM_TOKEN}/ic-web/reserve?sysKind=1`;

// =============================================================
// 日期工具：路径上的格式是 YYYY-MM-DD
// =============================================================

export type DateChoice = 0 | 1;

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

export function dateForChoice(choice: DateChoice): string {
  const d = new Date();
  d.setDate(d.getDate() + choice);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function currentTimeOrLater(coerce: string): string {
  const d = new Date();
  const now = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return coerce > now ? coerce : now;
}

function qs(params: Record<string, string | number>): string {
  return Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
}

// =============================================================
// Data model
// =============================================================

export interface Library {
  id: number;
  zhName: string;
  enName: string;
  zhNameTrace: string;
  enNameTrace: string;
  valid: boolean;
}

/** 楼层：自身没有 TotalCount，需要遍历下属分区聚合 */
export interface LibraryFloor {
  id: number;
  parentId: number;
  zhName: string;
  enName: string;
  zhNameTrace: string;
  enNameTrace: string;
  valid: boolean;
  total: number;
  available: number;
}

/** 分区：实际有座位、可下单的最小单位 */
export interface LibrarySection {
  id: number;
  zhName: string;
  enName: string;
  zhNameTrace: string;
  enNameTrace: string;
  valid: boolean;
  total: number;
  available: number;
  reservedCount: number;
}

export interface LibrarySeat {
  id: number;
  zhName: string;
  enName: string;
  /** 1=可用; 6=已预约; 7=已被占用; 其他=不可用 */
  status: number;
  type: number;
}

interface LibraryDay {
  day: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  segmentId: string;
  today: boolean;
}

// =============================================================
// Session 保障
// =============================================================

let libraryAccessEnsured = false;

async function ensureLibraryAccess(force = false): Promise<void> {
  if (libraryAccessEnsured && !force) return;
  const creds = await tsinghuaAuthService.hydrateCredentials();
  if (!creds) {
    throw new Error('未登录，无法访问图书馆服务');
  }
  await tsinghuaAuthService.roamIdPolicy(creds, SUBSYSTEM_YYFWID.librarySeat);
  try {
    await webvpnTransport.fetchText(LIBRARY_HOME_URL);
  } catch {
    // home 偶尔 500，可忽略
  }
  libraryAccessEnsured = true;
}

async function libFetchJson<T = unknown>(url: string): Promise<T> {
  const text = await webvpnTransport.fetchText(url);
  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`图书馆接口响应非 JSON: ${text.slice(0, 80)}`);
  }
  if (parsed?.status === false || parsed?.status === 'false') {
    throw new Error(parsed?.msg ?? '图书馆接口返回失败');
  }
  return parsed as T;
}

/** 与上游 fetchJson 一致：返回 response.data.list */
async function libFetchList<T = any>(url: string): Promise<T> {
  const obj = await libFetchJson<{data?: {list?: T}}>(url);
  if (obj?.data?.list === undefined) {
    throw new Error(`图书馆接口缺少 data.list（URL: ${url.slice(-60)}）`);
  }
  return obj.data.list;
}

/**
 * 图书馆 API 的两层会话兜底：
 *   1. 失败 → 刷新 lib 子系统 session (roamIdPolicy librarySeat yyfwid) → 重试
 *   2. 还失败 → 完整重 login → 再刷新 lib session → 重试
 * 完全沿用 auth service 的 `withSessionRecovery`，只是 reroam 用 lib 自己的 yyfwid。
 */
async function withLibRetry<T>(fn: () => Promise<T>): Promise<T> {
  return tsinghuaAuthService.withSessionRecovery(
    fn,
    async () => {
      libraryAccessEnsured = false;
      await ensureLibraryAccess(true);
    },
    'lib',
  );
}

// =============================================================
// 图书馆 / 楼层 / 分区 / 座位
// =============================================================

export async function getLibraryList(): Promise<Library[]> {
  await ensureLibraryAccess();
  return withLibRetry(async () => {
    const list = await libFetchList<any[]>(LIBRARY_LIST_URL);
    if (!Array.isArray(list)) return [];
    return list.map(n => ({
      id: Number(n.id),
      zhName: String(n.name ?? ''),
      enName: String(n.enname ?? ''),
      zhNameTrace: String(n.nameMerge ?? n.name ?? ''),
      enNameTrace: String(n.ennameMerge ?? n.enname ?? ''),
      valid: n.isValid === 1,
    }));
  });
}

/**
 * 拉取某图书馆在 dateChoice 下的楼层 + 聚合使用率。
 * 跟上游一致：父调 `areas/{libraryId}/date/...` 拿 childArea；
 * 再为每个楼层并行 fetch 其下分区，sum 出 total / available。
 */
export async function getLibraryFloorList(
  libraryId: number,
  dateChoice: DateChoice = 0,
): Promise<LibraryFloor[]> {
  await ensureLibraryAccess();
  const date = dateForChoice(dateChoice);
  const url = `${LIBRARY_AREAS_URL_PREFIX}${libraryId}/date/${date}`;
  return withLibRetry(async () => {
    const root = await libFetchList<{childArea?: any[]}>(url);
    const rawFloors = root?.childArea ?? [];
    if (!Array.isArray(rawFloors)) return [];
    return await Promise.all(
      rawFloors.map(async (n: any): Promise<LibraryFloor> => {
        const floor: LibraryFloor = {
          id: Number(n.id),
          parentId: libraryId,
          zhName: String(n.name ?? ''),
          enName: String(n.enname ?? ''),
          zhNameTrace: String(n.nameMerge ?? n.name ?? ''),
          enNameTrace: String(n.ennameMerge ?? n.enname ?? ''),
          valid: n.isValid === 1,
          total: 0,
          available: 0,
        };
        // 不开放的楼层不再 fetch（避免 500 / 401）
        if (!floor.valid) return floor;
        try {
          const sections = await getLibrarySectionList(floor.id, dateChoice);
          for (const s of sections) {
            if (s.valid) {
              floor.total += s.total;
              floor.available += s.available;
            }
          }
        } catch {
          // 单个楼层聚合失败不阻塞
        }
        return floor;
      }),
    );
  });
}

/**
 * 拉取某楼层的分区列表（带各分区的 TotalCount / UnavailableSpace）。
 * URL 复用 areas/{id}/date/... — 此时 id 是 floor id。
 */
export async function getLibrarySectionList(
  floorId: number,
  dateChoice: DateChoice = 0,
): Promise<LibrarySection[]> {
  await ensureLibraryAccess();
  const date = dateForChoice(dateChoice);
  const url = `${LIBRARY_AREAS_URL_PREFIX}${floorId}/date/${date}`;
  return withLibRetry(async () => {
    const root = await libFetchList<{childArea?: any[]}>(url);
    const raw = root?.childArea ?? [];
    if (!Array.isArray(raw)) return [];
    return raw.map(n => {
      const total = Number(n.TotalCount ?? 0);
      const unavail = Number(n.UnavailableSpace ?? 0);
      return {
        id: Number(n.id),
        zhName: String(n.name ?? ''),
        enName: String(n.enname ?? ''),
        zhNameTrace: String(n.nameMerge ?? n.name ?? ''),
        enNameTrace: String(n.ennameMerge ?? n.enname ?? ''),
        valid: n.isValid === 1,
        total,
        available: Math.max(0, total - unavail),
        reservedCount: Number(n.area_reserve_count ?? 0),
      };
    });
  });
}

/**
 * 拉取某分区可预约的"日期 / 时段"列表，过滤出 dateChoice 对应那天。
 * URL: api.php/areadays/{sectionId}
 */
async function getLibraryDay(
  sectionId: number,
  dateChoice: DateChoice,
): Promise<LibraryDay> {
  await ensureLibraryAccess();
  const url = `${LIBRARY_DAYS_URL_PREFIX}${sectionId}`;
  const list = await libFetchList<any[]>(url);
  if (!Array.isArray(list)) {
    throw new Error('areadays 返回的不是数组');
  }
  const target = dateForChoice(dateChoice);
  const hit = list.find((it: any) => it?.day === target);
  if (!hit) {
    throw new Error(`未找到 ${target} 的预约时段`);
  }
  const transform = (s: string | undefined): string =>
    typeof s === 'string' && s.length >= 16 ? s.substring(11, 16) : (s ?? '');
  return {
    day: hit.day,
    startTime: transform(hit.startTime?.date ?? hit.startTime),
    endTime: transform(hit.endTime?.date ?? hit.endTime),
    segmentId: String(hit.id),
    today: dateChoice === 0,
  };
}

/**
 * 拉取某分区在 dateChoice 下的座位列表 + 状态。
 *   先 getLibraryDay 取 segmentId + 起止时间
 *   再 spaces_old?area=X&segment=Y&day=...&startTime=...&endTime=...
 */
export async function getLibrarySeatList(
  sectionId: number,
  dateChoice: DateChoice = 0,
): Promise<LibrarySeat[]> {
  await ensureLibraryAccess();
  return withLibRetry(async () => {
    const dayInfo = await getLibraryDay(sectionId, dateChoice);
    const url =
      `${LIBRARY_SEATS_URL}?` +
      qs({
        area: sectionId,
        segment: dayInfo.segmentId,
        day: dayInfo.day,
        startTime: dayInfo.today
          ? currentTimeOrLater(dayInfo.startTime)
          : dayInfo.startTime,
        endTime: dayInfo.endTime,
      });
    const list = await libFetchList<any[]>(url);
    if (!Array.isArray(list)) return [];
    return list.map((n: any) => ({
      id: Number(n.id ?? 0),
      zhName: String(n.name ?? `#${n.id ?? ''}`),
      enName: String(n.name ?? ''),
      // 接口的 status 字段：1=可用; 6=已预约; 7=已被占用; 其他=不可用
      status: Number(n.status ?? 0),
      type: Number(n.area_type ?? 0),
    }));
  });
}

// =============================================================
// 座位预约 / 取消（写操作）
// =============================================================

let cachedAccessToken: {value: string; ts: number} | null = null;

/**
 * 从 lib home 页 HTML 里抠 access_token —— 与上游 `getAccessToken` 完全一致：
 *   `response.indexOf("access_token")` → 后面第一对引号内的字符串。
 * Token 缓存 5 分钟，避免每次预约都重新拉一遍 home 页。
 */
export async function getLibraryAccessToken(force = false): Promise<string> {
  const now = Date.now();
  if (
    !force &&
    cachedAccessToken &&
    now - cachedAccessToken.ts < 5 * 60 * 1000
  ) {
    return cachedAccessToken.value;
  }
  await ensureLibraryAccess();
  const html = await webvpnTransport.fetchText(LIBRARY_HOME_URL);
  const left = html.indexOf('access_token');
  if (left < 0) {
    throw new Error('图书馆主页未包含 access_token 字段');
  }
  const quoteStart = html.indexOf('"', left);
  if (quoteStart < 0) {
    throw new Error('access_token 后未找到引号');
  }
  const quoteEnd = html.indexOf('"', quoteStart + 1);
  if (quoteEnd < 0) {
    throw new Error('access_token 引号未闭合');
  }
  const token = html.substring(quoteStart + 1, quoteEnd).trim();
  if (!token) {
    throw new Error('access_token 为空');
  }
  cachedAccessToken = {value: token, ts: now};
  return token;
}

export interface BookResult {
  status: number;
  msg: string;
}

/**
 * 预约座位。对照 thu-info-lib `bookLibrarySeat`：
 *   POST api.php/spaces/{seatId}/book
 *   body: {access_token, userid, segment, type, operateChannel=2}
 *
 * 返回 `{status: 0, msg: "ok"}` 表示成功；其他都按错误处理。
 */
export async function bookLibrarySeat(
  seat: {id: number; type: number},
  sectionId: number,
  dateChoice: DateChoice = 0,
): Promise<BookResult> {
  await ensureLibraryAccess();
  const creds = await tsinghuaAuthService.hydrateCredentials();
  if (!creds) throw new Error('未登录，无法预约座位');
  const dayInfo = await getLibraryDay(sectionId, dateChoice);
  const token = await getLibraryAccessToken();
  const url = `${LIBRARY_BOOK_URL_PREFIX}${seat.id}${LIBRARY_BOOK_URL_SUFFIX}`;
  const text = await webvpnTransport.fetchText(url, {
    body: {
      access_token: token,
      userid: creds.studentId,
      segment: dayInfo.segmentId,
      type: String(seat.type),
      operateChannel: '2',
    },
  });
  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`预约接口响应非 JSON: ${text.slice(0, 80)}`);
  }
  const status = Number(parsed?.status ?? -1);
  const msg = String(parsed?.msg ?? '');
  return {status, msg};
}

/**
 * 取消已预约。POST api.php/profile/books/{bookingId}
 *   body: {userid, access_token}
 */
export async function cancelLibraryBooking(
  bookingId: string,
): Promise<BookResult> {
  await ensureLibraryAccess();
  const creds = await tsinghuaAuthService.hydrateCredentials();
  if (!creds) throw new Error('未登录');
  const token = await getLibraryAccessToken();
  const url = `${LIBRARY_CANCEL_BOOKING_URL_PREFIX}${bookingId}`;
  const text = await webvpnTransport.fetchText(url, {
    body: {userid: creds.studentId, access_token: token},
  });
  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`取消接口响应非 JSON: ${text.slice(0, 80)}`);
  }
  return {
    status: Number(parsed?.status ?? -1),
    msg: String(parsed?.msg ?? ''),
  };
}

// =============================================================
// 研讨间
// =============================================================

export interface RoomKind {
  id: string;
  kindName: string;
  resvCount: number;
  totalCount: number;
}

let cabLoginEnsured = false;

async function ensureCabLogin(force = false): Promise<void> {
  if (cabLoginEnsured && !force) return;
  const creds = await tsinghuaAuthService.hydrateCredentials();
  if (!creds) {
    throw new Error('未登录，无法访问研讨间预约');
  }
  await tsinghuaAuthService.cabLogin(creds);
  cabLoginEnsured = true;
}

async function withCabRetry<T>(fn: () => Promise<T>): Promise<T> {
  return tsinghuaAuthService.withSessionRecovery(
    fn,
    async () => {
      cabLoginEnsured = false;
      await ensureCabLogin(true);
    },
    'cab',
  );
}

export async function getCabUserInfo(): Promise<{
  pid: string;
  accNo: number;
}> {
  await ensureCabLogin();
  return withCabRetry(async () => {
    const data = await libFetchJson<{data: {pid: string; accNo: number}}>(
      LIBRARY_ROOM_BOOKING_USER_INFO_URL,
    );
    return {pid: data?.data?.pid ?? '', accNo: data?.data?.accNo ?? 0};
  });
}

export async function getLibraryRoomKindList(): Promise<RoomKind[]> {
  await ensureCabLogin();
  return withCabRetry(async () => {
    const data = await libFetchJson<any>(LIBRARY_ROOM_BOOKING_ROOM_INFO_URL);
    const obj = data?.data ?? {};
    return Object.keys(obj).map(id => ({
      id,
      kindName: obj[id]?.kindName ?? '',
      resvCount: Number(obj[id]?.resvCount ?? 0),
      totalCount: Number(obj[id]?.totalCount ?? 0),
    }));
  });
}

export interface RoomResource {
  resourceId: number;
  resourceName: string;
  openStart: string;
  openEnd: string;
  maxUser: number;
  minUser: number;
  available: boolean;
}

export async function getLibraryRoomResourceList(): Promise<RoomResource[]> {
  await ensureCabLogin();
  return withCabRetry(async () => {
    const data = await libFetchJson<{data: any[]}>(
      LIBRARY_ROOM_BOOKING_RESOURCE_LIST_URL,
    );
    const list = data?.data ?? [];
    if (!Array.isArray(list)) return [];
    return list.map((n: any) => ({
      resourceId: n.resourceId,
      resourceName: n.resourceName ?? '',
      openStart: n.openStart ?? '',
      openEnd: n.openEnd ?? '',
      maxUser: Number(n.maxUser ?? 0),
      minUser: Number(n.minUser ?? 0),
      available: n.isValid === 1 || n.isValid === undefined,
    }));
  });
}

export function clearLibrarySessionCache(): void {
  libraryAccessEnsured = false;
  cabLoginEnsured = false;
}
