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
import {childText, loadHtml} from './htmlSelect';

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
export const LIBRARY_FUZZY_SEARCH_ID_URL = `${WEBVPN_BASE}/https/${LIB_ROOM_TOKEN}/ic-web/account/getMembers?page=1&pageNum=10&key=`;
export const LIBRARY_ROOM_BOOKING_ACTION_URL = `${WEBVPN_BASE}/https/${LIB_ROOM_TOKEN}/ic-web/reserve`;
export const LIBRARY_ROOM_BOOKING_RECORD_URL = `${WEBVPN_BASE}/https/${LIB_ROOM_TOKEN}/ic-web/reserve/resvInfo?needStatus=8454&orderKey=gmt_create&orderModel=desc`;
export const LIBRARY_ROOM_CANCEL_BOOKING_URL = `${WEBVPN_BASE}/https/${LIB_ROOM_TOKEN}/ic-web/reserve/delete`;
export const LIBRARY_ROOM_UPDATE_EMAIL_URL = `${WEBVPN_BASE}/https/${LIB_ROOM_TOKEN}/ic-web/account/update`;

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

export interface LibraryBookingRecord {
  id: string;
  pos: string;
  time: string;
  status: string;
  delId?: string;
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
  if (libraryAccessEnsured && !force) {
    return;
  }
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
    if (!Array.isArray(list)) {
      return [];
    }
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
    if (!Array.isArray(rawFloors)) {
      return [];
    }
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
        if (!floor.valid) {
          return floor;
        }
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
    if (!Array.isArray(raw)) {
      return [];
    }
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
    if (!Array.isArray(list)) {
      return [];
    }
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
  tokenExpired?: boolean;
}

/**
 * 预约座位。对照 thu-info-lib `bookLibrarySeat`：
 *   POST api.php/spaces/{seatId}/book
 *   body: {access_token, userid, segment, type, operateChannel=2}
 *
 * 如果 access_token 过期，自动刷新 token 并重试一次。
 * 返回 `{status: 0, msg: "ok"}` 表示成功；其他都按错误处理。
 */
export async function bookLibrarySeat(
  seat: {id: number; type: number},
  sectionId: number,
  dateChoice: DateChoice = 0,
): Promise<BookResult> {
  await ensureLibraryAccess();
  const creds = await tsinghuaAuthService.hydrateCredentials();
  if (!creds) {
    throw new Error('未登录，无法预约座位');
  }
  const dayInfo = await getLibraryDay(sectionId, dateChoice);

  const doBook = async (token: string): Promise<BookResult> => {
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
    if (status !== 0 && /token|令牌|过期|invalid/i.test(msg)) {
      return {status, msg, tokenExpired: true};
    }
    return {status, msg};
  };

  const token = await getLibraryAccessToken();
  const result = await doBook(token);
  if ((result as any).tokenExpired) {
    const freshToken = await getLibraryAccessToken(true);
    return doBook(freshToken);
  }
  return result;
}

export async function getLibraryBookingRecords(): Promise<LibraryBookingRecord[]> {
  await ensureLibraryAccess();
  return withLibRetry(async () => {
    await getLibraryAccessToken();
    const html = await webvpnTransport.fetchText(LIBRARY_BOOKING_RECORDS_URL);
    const $ = loadHtml(html);
    const rows = $('tbody tr').toArray();
    const records = rows.map(row => {
      const delOnclick =
        row.querySelector('[onclick*="menuDel"]')?.getAttribute('onclick') ?? '';
      const delMatch = /menuDel\('(.+?)'/.exec(delOnclick);
      return {
        id: childText(row, 3),
        pos: childText(row, 5),
        time: childText(row, 7),
        status: childText(row, 11),
        delId: delMatch?.[1],
      };
    });
    if (records.length === 0 && !html.includes('tbody')) {
      throw new Error('未能加载图书馆预约记录');
    }
    return records;
  });
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
  if (!creds) {
    throw new Error('未登录');
  }

  const doCancel = async (token: string): Promise<BookResult> => {
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
    const status = Number(parsed?.status ?? -1);
    const msg = String(parsed?.msg ?? '');
    if (status !== 0 && /token|令牌|过期|invalid/i.test(msg)) {
      return {status, msg, tokenExpired: true};
    }
    return {status, msg};
  };

  const token = await getLibraryAccessToken();
  const result = await doCancel(token);
  if ((result as any).tokenExpired) {
    const freshToken = await getLibraryAccessToken(true);
    return doCancel(freshToken);
  }
  return result;
}

// =============================================================
// 研讨间（cab）— 对照 thu-info-lib library.ts cabFetch / cabLogin
// =============================================================

export interface LibRoomInfo {
  kindId: number;
  kindName: string;
  rooms: {devId: number; devName: string; minReserveTime: number}[];
}

export interface LibRoomUsage {
  id: number;
  start: Date;
  end: Date;
  title: string;
  owner: string;
  ownerId: string;
}

export interface LibRoomRes {
  devId: number;
  devName: string;
  kindId: number;
  kindName: string;
  labId: number;
  labName: string;
  roomId: number;
  roomName: string;
  limit: number;
  maxMinute: number;
  minMinute: number;
  cancelMinute: number;
  maxUser: number;
  minUser: number;
  openStart: string | null;
  openEnd: string | null;
  usage: LibRoomUsage[];
}

export interface LibFuzzySearchResult {
  id: number;
  label: string;
  department: string;
}

export interface LibRoomBookRecord {
  uuid: string;
  rsvId: number;
  owner: string;
  ownerId: string;
  date: string;
  begin: Date;
  end: Date;
  devName: string;
  kindName: string;
  members: {name: string; userId: string}[];
}

let cabAccNo = -1;
let cabLoginEnsured = false;

async function cabFetch(url: string, jsonBody?: Record<string, unknown>): Promise<unknown> {
  const text =
    jsonBody === undefined
      ? await webvpnTransport.fetchText(url)
      : await webvpnTransport.fetchText(url, {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify(jsonBody),
        });
  let parsed: {code?: number; message?: string; data?: unknown};
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`研读间接口响应非 JSON: ${text.slice(0, 80)}`);
  }
  if (parsed.code !== 0) {
    throw new Error(parsed.message ?? '研读间接口返回失败');
  }
  return parsed.data;
}

async function ensureCabLogin(force = false): Promise<void> {
  if (cabLoginEnsured && !force) {
    return;
  }
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

async function assureCabSession(): Promise<void> {
  const creds = await tsinghuaAuthService.hydrateCredentials();
  const studentId = creds?.studentId ?? '';
  if (!creds) {
    throw new Error('未登录，无法访问研讨间预约');
  }
  if (cabLoginEnsured && cabAccNo !== -1) {
    return;
  }

  const readUserInfo = async () =>
    (await cabFetch(LIBRARY_ROOM_BOOKING_USER_INFO_URL)) as {
      pid?: string;
      accNo?: number;
    };
  const maskId = (value?: string) =>
    value ? `${value.slice(0, 2)}***${value.slice(-2)}` : '(empty)';

  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await ensureCabLogin(attempt > 0);
      const info = await readUserInfo();
      if (info.pid === studentId) {
        cabAccNo = Number(info.accNo ?? -1);
        return;
      }
      throw new Error(
        `研读间账号不匹配：expected=${maskId(studentId)}, actual=${maskId(
          info.pid,
        )}`,
      );
    } catch (error) {
      lastError = error;
      // 与 upstream assureLoginValid 一致：userInfo 报未登录时，
      // 重新 cabLogin 后再读一次。
    }
    cabLoginEnsured = false;
    cabAccNo = -1;
  }

  const reason = lastError instanceof Error ? `：${lastError.message}` : '';
  throw new Error(`研读间会话校验失败${reason}`);
}

/** 研读间类型与下属房间（thu-info getLibraryRoomBookingInfoList） */
export async function getLibraryRoomBookingInfoList(): Promise<LibRoomInfo[]> {
  return withCabRetry(async () => {
    await assureCabSession();
    const data = (await cabFetch(LIBRARY_ROOM_BOOKING_ROOM_INFO_URL)) as any[];
    if (!Array.isArray(data)) {
      return [];
    }
    return data.map(item => ({
      kindId: Number(item.kindId),
      kindName: String(item.kindName ?? ''),
      rooms: (item.roomInfos ?? []).map((info: any) => ({
        devId: Number(info.devId),
        devName: String(info.devName ?? ''),
        minReserveTime: Number(info.minResvTime ?? 0),
      })),
    }));
  });
}

/** 某日某类型的可预约研讨间资源（date: yyyyMMdd） */
export async function getLibraryRoomBookingResourceList(
  dateYmd: string,
  kindId: number,
): Promise<LibRoomRes[]> {
  return withCabRetry(async () => {
    await assureCabSession();
    const data = (await cabFetch(
      `${LIBRARY_ROOM_BOOKING_RESOURCE_LIST_URL}&resvDates=${dateYmd}&kindIds=${kindId}`,
    )) as any[];
    if (!Array.isArray(data)) {
      return [];
    }
    return data.map(item => ({
      devId: Number(item.devId),
      devName: String(item.devName ?? ''),
      kindId: Number(item.kindId),
      kindName: String(item.kindName ?? ''),
      labId: Number(item.labId),
      labName: String(item.labName ?? ''),
      roomId: Number(item.roomId),
      roomName: String(item.roomName ?? ''),
      limit: Number(item.resvRule?.limit ?? 0),
      maxMinute: Number(item.resvRule?.maxResvTime ?? 0),
      minMinute: Number(item.resvRule?.minResvTime ?? 0),
      cancelMinute: Number(item.resvRule?.cancelTime ?? 0),
      maxUser: Number(item.maxUser ?? 0),
      minUser: Number(item.minUser ?? 0),
      openStart: item.openStart ?? null,
      openEnd: item.openEnd ?? null,
      usage: (item.resvInfo ?? []).map((info: any) => ({
        id: Number(info.resvId),
        start: new Date(info.startTime),
        end: new Date(info.endTime),
        title: String(info.title ?? ''),
        owner: String(info.trueName ?? ''),
        ownerId: String(info.logonName ?? ''),
      })),
    }));
  });
}

export async function fuzzySearchLibraryId(
  keyword: string,
): Promise<LibFuzzySearchResult[]> {
  return withCabRetry(async () => {
    await assureCabSession();
    const data = (await cabFetch(
      LIBRARY_FUZZY_SEARCH_ID_URL + encodeURIComponent(keyword),
    )) as any[];
    if (!Array.isArray(data)) {
      return [];
    }
    return data.map(item => ({
      id: Number(item.accNo),
      label: String(item.logonName ?? ''),
      department: String(item.deptName ?? ''),
    }));
  });
}

export async function bookLibraryRoom(input: {
  devId: number;
  start: string;
  end: string;
  memberAccNos?: number[];
}): Promise<{ok: boolean; message: string}> {
  return withCabRetry(async () => {
    await assureCabSession();
    await cabFetch(LIBRARY_ROOM_BOOKING_ACTION_URL, {
      sysKind: 1,
      appAccNo: cabAccNo,
      memberKind: 1,
      resvBeginTime: input.start,
      resvEndTime: input.end,
      testName: '',
      resvKind: 2,
      resvProperty: 0,
      appUrl: '',
      resvMember: input.memberAccNos ?? [],
      resvDev: [input.devId],
      memo: '',
      captcha: '',
      addServices: [],
    });
    return {ok: true, message: '研读间预约已提交'};
  });
}

export async function getLibraryRoomBookingRecord(): Promise<LibRoomBookRecord[]> {
  return withCabRetry(async () => {
    await assureCabSession();
    const begin = new Date();
    const end = new Date();
    end.setDate(begin.getDate() + 6);
    const beginDate = `${begin.getFullYear()}-${pad(begin.getMonth() + 1)}-${pad(
      begin.getDate(),
    )}`;
    const endDate = `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(
      end.getDate(),
    )}`;
    const data = (await cabFetch(
      `${LIBRARY_ROOM_BOOKING_RECORD_URL}&beginDate=${beginDate}&endDate=${endDate}`,
    )) as any[];
    if (!Array.isArray(data)) {
      return [];
    }
    return data.map(item => {
      const dev = item.resvDevInfoList?.[0] ?? {};
      return {
        uuid: String(item.uuid ?? ''),
        rsvId: Number(item.resvId ?? 0),
        owner: String(item.resvName ?? ''),
        ownerId: String(item.logonName ?? ''),
        date: String(item.resvDate ?? ''),
        begin: new Date(item.resvBeginTime),
        end: new Date(item.resvEndTime),
        devName: String(dev.devName ?? ''),
        kindName: String(dev.kindName ?? ''),
        members: (item.resvMemberInfoList ?? []).map((member: any) => ({
          name: String(member.trueName ?? ''),
          userId: String(member.logonName ?? ''),
        })),
      };
    });
  });
}

export async function cancelLibraryRoomBooking(
  uuid: string,
): Promise<{ok: boolean; message: string}> {
  return withCabRetry(async () => {
    await assureCabSession();
    await cabFetch(LIBRARY_ROOM_CANCEL_BOOKING_URL, {uuid});
    return {ok: true, message: '研读间预约已取消'};
  });
}

export function formatLibRoomDateYmd(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}

export function formatLibRoomDateIso(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function clearLibrarySessionCache(): void {
  libraryAccessEnsured = false;
  cabLoginEnsured = false;
  cabAccNo = -1;
}
