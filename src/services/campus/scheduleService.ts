/**
 * 课表拉取：
 * - **legacy**（增添日程 Tab 之前的路径）：单段 JSONP + roamDefault，供 AI / 首页使用
 * - **pack**（thu-info getPrimary）：学期 + 分段 JSONP，供日程网格（失败时回退 legacy）
 */
import {ScheduleEvent} from '../../domain/learning';
import {CampusSchedule, SemesterCalendar, SemesterInfo} from '../../domain/campusSchedule';
import {tsinghuaAuthService} from '../auth/tsinghuaAuth';
import {ENDPOINTS, withCsrf} from '../webvpn/constants';
import {webvpnTransport} from '../webvpn/transport';
import {mapScheduleRows, parseJsonpSchedule} from './scheduleParser';
import {
  addDaysYmd,
  campusSchedulesFromEvents,
  flattenSchedulesToEvents,
  mergeCampusSchedules,
  parseScheduleJson,
  parseSemesterCalendar,
  selectSemesterCalendar,
} from './scheduleModel';

const GROUP_SIZE = 3;
const REGISTRAR_ROAM_PAYLOAD = '287C0C6D90ABB364CD5FDF1495199962';

const JXRL_BKS_PREFIX =
  'https://webvpn.tsinghua.edu.cn/http/77726476706e69737468656265737421eaff4b8b69336153301c9aa596522b20bc86e6e559a9b290/jxmh_out.do?m=bks_jxrl_all&p_start_date=';
const JXRL_MIDDLE = '&p_end_date=';
const JXRL_SUFFIX = '&jsoncallback=m';

function formatYmdDate(d: Date): string {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

let registrarRoamEnsured = false;

async function ensureRegistrarRoam(): Promise<void> {
  if (registrarRoamEnsured) {
    return;
  }
  await tsinghuaAuthService.roamDefault(REGISTRAR_ROAM_PAYLOAD);
  registrarRoamEnsured = true;
}

export function clearRegistrarSessionCache(): void {
  registrarRoamEnsured = false;
}

function legacyRangeDates(): {start: string; end: string} {
  const today = new Date();
  const start = new Date(today);
  start.setDate(start.getDate() - 21);
  const end = new Date(today);
  end.setDate(end.getDate() + 56);
  return {start: formatYmdDate(start), end: formatYmdDate(end)};
}

function legacyJsonpUrl(start: string, end: string): string {
  return `${JXRL_BKS_PREFIX}${start}${JXRL_MIDDLE}${end}${JXRL_SUFFIX}`;
}

/**
 * 旧版课表拉取（AI 此前能读到课表就是走这条链路）。
 */
export async function fetchScheduleRangeLegacy(): Promise<ScheduleEvent[]> {
  const {start, end} = legacyRangeDates();
  const url = legacyJsonpUrl(start, end);
  return tsinghuaAuthService.withSessionRecovery(
    async () => {
      const raw = await webvpnTransport.fetchText(url);
      const rows = parseJsonpSchedule(raw);
      if (rows.length === 0 && raw.indexOf('[') < 0) {
        throw new Error(`课表 JSONP 无效: ${raw.slice(0, 80)}`);
      }
      return mapScheduleRows(rows);
    },
    () => {
      registrarRoamEnsured = false;
      return ensureRegistrarRoam();
    },
    'schedule-legacy',
  );
}

export async function fetchSemesterCalendar(
  nextSemesterIndex?: number,
): Promise<SemesterCalendar> {
  const csrf = tsinghuaAuthService.getCsrfToken();
  if (!csrf) {
    throw new Error('未登录，无法获取学期');
  }
  const url = withCsrf(ENDPOINTS.learnCurrentSemester, csrf);
  const json = (await webvpnTransport.fetchJson(url)) as Parameters<
    typeof parseSemesterCalendar
  >[0];
  return selectSemesterCalendar(parseSemesterCalendar(json), nextSemesterIndex);
}

async function fetchPrimaryChunk(
  semester: SemesterInfo,
  chunkId: number,
): Promise<string> {
  const start = addDaysYmd(semester.firstDay, chunkId * GROUP_SIZE * 7);
  const end = addDaysYmd(
    semester.firstDay,
    ((chunkId + 1) * GROUP_SIZE - 1) * 7 + 6,
  );
  return webvpnTransport.fetchText(legacyJsonpUrl(start, end));
}

async function fetchPrimarySchedule(
  semester: SemesterInfo,
): Promise<CampusSchedule[]> {
  const chunkCount = Math.ceil(semester.weekCount / GROUP_SIZE);
  const parts: string[] = [];
  for (let id = 0; id < chunkCount; id++) {
    const raw = await fetchPrimaryChunk(semester, id);
    if (raw.indexOf('[') < 0) {
      continue;
    }
    const inner = raw.substring(raw.indexOf('[') + 1, raw.lastIndexOf(']'));
    if (inner.trim().length > 0) {
      parts.push(inner);
    }
  }
  if (parts.length === 0) {
    return [];
  }
  const rows = JSON.parse(`[${parts.join(',')}]`) as unknown[];
  return mergeCampusSchedules(
    parseScheduleJson(rows as Parameters<typeof parseScheduleJson>[0]),
  );
}

export interface CampusSchedulePack {
  calendar: SemesterCalendar;
  schedules: CampusSchedule[];
}

export interface ScheduleSyncResult {
  events: ScheduleEvent[];
  pack?: CampusSchedulePack;
}

/**
 * 统一同步：先保证 legacy 扁平课表（AI 依赖），再尽力拉 thu-info 学期课表供网格。
 */
export async function fetchScheduleSync(
  nextSemesterIndex?: number,
): Promise<ScheduleSyncResult> {
  let events: ScheduleEvent[] = [];
  let legacyError: unknown;
  const useCurrentSemester =
    nextSemesterIndex === undefined || nextSemesterIndex < 0;
  if (useCurrentSemester) {
    try {
      events = await fetchScheduleRangeLegacy();
    } catch (e) {
      legacyError = e;
    }
  }

  let pack: CampusSchedulePack | undefined;
  try {
    await ensureRegistrarRoam();
    const calendar = await fetchSemesterCalendar(nextSemesterIndex);
    let schedules = await fetchPrimarySchedule(calendar);
    if (useCurrentSemester && schedules.length === 0 && events.length > 0) {
      schedules = campusSchedulesFromEvents(events);
    }
    pack = {calendar, schedules};
    const fullSemesterEvents = flattenSchedulesToEvents(schedules);
    if (fullSemesterEvents.length > 0) {
      events = fullSemesterEvents;
    }
  } catch {
    pack = undefined;
  }

  if (events.length === 0 && legacyError) {
    const msg = legacyError instanceof Error ? legacyError.message : '课表拉取失败';
    throw new Error(msg);
  }

  return {events, pack};
}

/** @deprecated 使用 fetchScheduleSync */
export async function fetchCampusSchedulePack(): Promise<CampusSchedulePack> {
  const {events, pack} = await fetchScheduleSync();
  if (pack) {
    return pack;
  }
  const calendar = await fetchSemesterCalendar().catch(() => ({
    firstDay: events[0]?.date?.slice(0, 10) ?? '2026-01-01',
    semesterId: '',
    semesterName: '当前学期',
    weekCount: 20,
    nextSemesterList: [],
  }));
  return {
    calendar,
    schedules: campusSchedulesFromEvents(events),
  };
}
