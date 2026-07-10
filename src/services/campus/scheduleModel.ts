import {
  CampusSchedule,
  CampusScheduleType,
  ScheduleTimeSlice,
  SemesterCalendar,
  SemesterInfo,
} from '../../domain/campusSchedule';
import {ScheduleEvent} from '../../domain/learning';

interface RawScheduleRow {
  nq: string;
  nr: string;
  dd: string;
  fl: string;
  kssj: string;
  jssj: string;
  grrlID?: string;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

export function formatYmd(date: Date): string {
  return `${date.getFullYear()}${pad2(date.getMonth() + 1)}${pad2(date.getDate())}`;
}

export function normalizeNq(nq: string): string {
  const s = String(nq).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    return s.slice(0, 10);
  }
  if (/^\d{8}$/.test(s)) {
    return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  }
  return s;
}

export function parseLocalDateTime(datePart: string, timePart: string): Date {
  const d = normalizeNq(datePart);
  const t = timePart.replace(/：/g, ':').trim();
  return new Date(`${d}T${t}:00`);
}

export function toLocalISO(date: Date): string {
  const y = date.getFullYear();
  const m = pad2(date.getMonth() + 1);
  const day = pad2(date.getDate());
  const h = pad2(date.getHours());
  const min = pad2(date.getMinutes());
  return `${y}-${m}-${day}T${h}:${min}:00`;
}

export function dayOfWeekFromDate(date: Date): number {
  const d = date.getDay();
  return d === 0 ? 7 : d;
}

/** 学期第一天（周一）— 对照 thu-info parseCalendarData */
export function parseSemesterRow(row: {
  kssj: string;
  jssj: string;
  id: string;
  xnxqmc: string;
}): SemesterInfo {
  const start = new Date(String(row.kssj).replace(' ', 'T'));
  const weekday = start.getDay();
  let delta = 0;
  if (weekday === 0) {
    delta = 1;
  } else if (weekday === 6) {
    delta = 2;
  } else {
    delta = 1 - weekday;
  }
  const first = new Date(start);
  first.setDate(start.getDate() + delta);
  const firstDay = `${first.getFullYear()}-${pad2(first.getMonth() + 1)}-${pad2(first.getDate())}`;
  const end = new Date(String(row.jssj).replace(' ', 'T'));
  const weekCount = Math.floor((end.getTime() - first.getTime()) / 604800000) + 1;
  return {
    firstDay,
    semesterId: row.id,
    semesterName: row.xnxqmc,
    weekCount: Math.max(1, weekCount),
  };
}

export function parseSemesterCalendar(json: {
  message?: string;
  result?: {kssj: string; jssj: string; id: string; xnxqmc: string};
  resultList?: {kssj: string; jssj: string; id: string; xnxqmc: string}[];
}): SemesterCalendar {
  if (json.message !== 'success' || !json.result) {
    throw new Error('未获取到学期信息');
  }
  const current = parseSemesterRow(json.result);
  const nextSemesterList = (json.resultList ?? []).map(parseSemesterRow);
  return {...current, currentSemester: current, nextSemesterList};
}

export function selectSemesterCalendar(
  calendar: SemesterCalendar,
  nextSemesterIndex?: number,
): SemesterCalendar {
  if (nextSemesterIndex === undefined || nextSemesterIndex < 0) {
    const current = calendar.currentSemester ?? {
      firstDay: calendar.firstDay,
      semesterId: calendar.semesterId,
      semesterName: calendar.semesterName,
      weekCount: calendar.weekCount,
    };
    return {
      ...current,
      currentSemester: current,
      nextSemesterList: calendar.nextSemesterList,
      selectedSemesterIndex: undefined,
    };
  }
  const selected = calendar.nextSemesterList[nextSemesterIndex];
  if (!selected) {
    return selectSemesterCalendar(calendar, undefined);
  }
  const current = calendar.currentSemester ?? {
    firstDay: calendar.firstDay,
    semesterId: calendar.semesterId,
    semesterName: calendar.semesterName,
    weekCount: calendar.weekCount,
  };
  return {
    ...selected,
    currentSemester: current,
    nextSemesterList: calendar.nextSemesterList,
    selectedSemesterIndex: nextSemesterIndex,
  };
}

export function getWeekFromTime(beginISO: string, firstDay: string): number {
  const start = new Date(`${firstDay}T00:00:00`);
  const time = new Date(beginISO.replace(' ', 'T'));
  const diffDays = Math.floor((time.getTime() - start.getTime()) / 86400000);
  return Math.floor(diffDays / 7) + 1;
}

function addSlice(
  schedule: CampusSchedule,
  slice: ScheduleTimeSlice,
  mergeAdjacent: boolean,
): void {
  if (mergeAdjacent) {
    for (const val of schedule.activeTime) {
      const begin = new Date(slice.beginISO);
      const end = new Date(slice.endISO);
      const vBegin = new Date(val.beginISO);
      const vEnd = new Date(val.endISO);
      if (begin > vEnd && begin.getTime() - vEnd.getTime() <= 15 * 60000) {
        val.endISO = slice.endISO;
        return;
      }
      if (vBegin > end && vBegin.getTime() - end.getTime() <= 15 * 60000) {
        val.beginISO = slice.beginISO;
        return;
      }
    }
  }
  schedule.activeTime.push(slice);
}

/** 对照 thu-info parseJSON */
export function parseScheduleJson(rows: RawScheduleRow[]): CampusSchedule[] {
  const scheduleList: CampusSchedule[] = [];
  for (const o of rows) {
    try {
      const date = parseLocalDateTime(o.nq, '00:00');
      const dayOfWeek = dayOfWeekFromDate(date);
      const existing = scheduleList.find(
        v =>
          v.name === o.nr &&
          v.location === (o.dd || '') &&
          v.category === o.fl,
      );
      let lesson: CampusSchedule;
      if (existing) {
        lesson = existing;
      } else {
        lesson = {
          name: o.nr,
          location: o.dd || '',
          hash: `${o.nr}@${o.dd || ''}`,
          type: CampusScheduleType.PRIMARY,
          category: o.fl,
          activeTime: [],
        };
        scheduleList.push(lesson);
      }
      const begin = parseLocalDateTime(o.nq, o.kssj);
      const end = parseLocalDateTime(o.nq, o.jssj);
      addSlice(
        lesson,
        {
          id: o.grrlID,
          dayOfWeek,
          beginISO: toLocalISO(begin),
          endISO: toLocalISO(end),
        },
        lesson.category !== '个人日历',
      );
    } catch {
      // skip bad row
    }
  }
  return scheduleList;
}

/** 对照 thu-info mergeSchedules */
export function mergeCampusSchedules(base: CampusSchedule[]): CampusSchedule[] {
  const existName: string[] = [];
  const out: CampusSchedule[] = [];
  for (const schedule of base) {
    const key = `${schedule.name}.${schedule.location}.${schedule.category ?? ''}`;
    const index = existName.indexOf(key);
    if (index === -1) {
      existName.push(key);
      out.push({
        ...schedule,
        activeTime: [...schedule.activeTime],
      });
    } else {
      for (const time of schedule.activeTime) {
        addSlice(out[index], time, schedule.category !== '个人日历');
      }
    }
  }
  return out;
}

export function addDaysYmd(firstDay: string, days: number): string {
  const d = new Date(`${firstDay}T00:00:00`);
  d.setDate(d.getDate() + days);
  return formatYmd(d);
}

export function dateForWeekDay(
  firstDay: string,
  weekIndex: number,
  dayOfWeek: number,
): string {
  const d = new Date(`${firstDay}T00:00:00`);
  d.setDate(d.getDate() + weekIndex * 7 + (dayOfWeek - 1));
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function weekDatesForIndex(firstDay: string, weekIndex: number): string[] {
  return Array.from({length: 7}, (_, i) => dateForWeekDay(firstDay, weekIndex, i + 1));
}

export function currentSemesterWeekIndex(firstDay: string, weekCount: number): number {
  const start = new Date(`${firstDay}T00:00:00`);
  const now = new Date();
  const weekNumber = Math.floor((now.getTime() - start.getTime()) / 604800000) + 1;
  if (weekNumber > weekCount) {
    return weekCount - 1;
  }
  if (weekNumber < 1) {
    return 0;
  }
  return weekNumber - 1;
}

/** 将旧版扁平课表转为网格用的 CampusSchedule（无学期 pack 时的回退） */
export function campusSchedulesFromEvents(events: ScheduleEvent[]): CampusSchedule[] {
  const rows = events.map(e => ({
    nq: e.date,
    nr: e.title,
    dd: e.location ?? '',
    fl: e.category ?? '',
    kssj: e.startTime,
    jssj: e.endTime,
    grrlID: e.id,
  }));
  return mergeCampusSchedules(parseScheduleJson(rows));
}

export function flattenSchedulesToEvents(
  schedules: CampusSchedule[],
): ScheduleEvent[] {
  const events: ScheduleEvent[] = [];
  for (const s of schedules) {
    for (const slice of s.activeTime) {
      const date = slice.beginISO.slice(0, 10);
      events.push({
        id: String(slice.id ?? `${date}-${s.name}-${slice.beginISO}`),
        date,
        title: s.name,
        location: s.location,
        startTime: slice.beginISO.slice(11, 16),
        endTime: slice.endISO.slice(11, 16),
        category: s.category ?? '',
      });
    }
  }
  return events;
}

export interface WeekSliceView {
  schedule: CampusSchedule;
  slice: ScheduleTimeSlice;
  week: number;
}

export function buildWeekSliceViews(
  schedules: CampusSchedule[],
  firstDay: string,
  weekCount: number,
  weekIndex: number,
): WeekSliceView[] {
  const week = weekIndex + 1;
  const views: WeekSliceView[] = [];
  for (const schedule of schedules) {
    for (const slice of schedule.activeTime) {
      const w = getWeekFromTime(slice.beginISO, firstDay);
      if (w === week && w >= 1 && w <= weekCount) {
        views.push({schedule, slice, week: w});
      }
    }
  }
  return views;
}
