import {ScheduleEvent} from '../../domain/learning';
import {PersonalEvent} from '../../domain/schedule';
import {normalizeScheduleDate} from '../../services/campus/scheduleParser';
import {WeekSliceView} from '../../services/campus/scheduleModel';
import {normalizeDateString} from '../../utils/weekDates';
import {DEFAULT_DISPLAY_START_HOUR} from './schedulePeriods';

export type GridBlockKind = 'course' | 'personal';

export interface GridBlock {
  key: string;
  kind: GridBlockKind;
  dayIndex: number;
  dateISO: string;
  begin: number;
  end: number;
  title: string;
  location: string;
  startTime: string;
  endTime: string;
  color: string;
  eventId: string;
  note?: string;
}

const BLOCK_COLORS = [
  '#6B5CE7',
  '#5B8C7C',
  '#C97B63',
  '#7A9E9F',
  '#9B7BB8',
  '#D4A574',
  '#6C8EBF',
  '#B87DA8',
];

function hashTitle(title: string): number {
  let h = 0;
  for (let i = 0; i < title.length; i++) {
    h = (h * 31 + title.charCodeAt(i)) >>> 0;
  }
  return h;
}

export function colorForScheduleTitle(title: string, kind: GridBlockKind): string {
  if (kind === 'personal') {
    return '#D4A017';
  }
  return BLOCK_COLORS[hashTitle(title) % BLOCK_COLORS.length];
}

function minutesFromISO(iso: string): number {
  const m = /T(\d{2}):(\d{2})/.exec(iso);
  if (!m) {
    return 8 * 60;
  }
  return Number(m[1]) * 60 + Number(m[2]);
}

export function computeDisplayStartHour(
  views: WeekSliceView[],
  personal: PersonalEvent[],
  weekDates: string[],
): number {
  const eightAm = DEFAULT_DISPLAY_START_HOUR * 60;
  let earliest: number | null = null;
  const inWeek = (d: string) => weekDates.includes(d);

  for (const v of views) {
    const m = minutesFromISO(v.slice.beginISO);
    if (earliest === null || m < earliest) {
      earliest = m;
    }
  }
  for (const p of personal) {
    if (!inWeek(p.date)) {
      continue;
    }
    const [h, min] = p.startTime.split(':').map(Number);
    const m = h * 60 + min;
    if (earliest === null || m < earliest) {
      earliest = m;
    }
  }
  if (earliest === null) {
    return DEFAULT_DISPLAY_START_HOUR;
  }
  return Math.min(DEFAULT_DISPLAY_START_HOUR, Math.floor(Math.min(earliest, eightAm) / 60));
}

export function buildGridBlocksForWeek(
  views: WeekSliceView[],
  personal: PersonalEvent[],
  weekDates: string[],
  displayStartHour: number,
): GridBlock[] {
  const startBase = displayStartHour * 60;
  const blocks: GridBlock[] = [];

  for (const v of views) {
    const dayIndex = v.slice.dayOfWeek - 1;
    if (dayIndex < 0 || dayIndex > 6) {
      continue;
    }
    const dateISO = weekDates[dayIndex] ?? v.slice.beginISO.slice(0, 10);
    const beginAbs = minutesFromISO(v.slice.beginISO);
    const endAbs = minutesFromISO(v.slice.endISO);
    if (endAbs <= beginAbs) {
      continue;
    }
    blocks.push({
      key: `c-${v.slice.id ?? v.schedule.hash}-${v.slice.beginISO}`,
      kind: 'course',
      dayIndex,
      dateISO,
      begin: beginAbs - startBase,
      end: endAbs - startBase,
      title: v.schedule.name,
      location: v.schedule.location,
      startTime: v.slice.beginISO.slice(11, 16),
      endTime: v.slice.endISO.slice(11, 16),
      color: colorForScheduleTitle(v.schedule.name, 'course'),
      eventId: String(v.slice.id ?? v.schedule.hash),
    });
  }

  for (const pe of personal) {
    const dayIndex = weekDates.indexOf(pe.date);
    if (dayIndex < 0) {
      continue;
    }
    const [sh, sm] = pe.startTime.split(':').map(Number);
    const [eh, em] = pe.endTime.split(':').map(Number);
    const beginAbs = sh * 60 + sm;
    const endAbs = eh * 60 + em;
    if (endAbs <= beginAbs) {
      continue;
    }
    blocks.push({
      key: `p-${pe.id}`,
      kind: 'personal',
      dayIndex,
      dateISO: pe.date,
      begin: beginAbs - startBase,
      end: endAbs - startBase,
      title: pe.title,
      location: pe.location ?? '',
      startTime: pe.startTime,
      endTime: pe.endTime,
      color: colorForScheduleTitle(pe.title, 'personal'),
      eventId: pe.id,
      note: pe.note,
    });
  }

  return blocks.sort((a, b) => a.begin - b.begin);
}

/** 无学期 pack 时：直接用 learning.snapshot 扁平课表渲染周网格 */
export function buildGridBlocksFromFlatEvents(
  events: ScheduleEvent[],
  weekDates: string[],
  personal: PersonalEvent[],
  displayStartHour: number,
): GridBlock[] {
  const startBase = displayStartHour * 60;
  const blocks: GridBlock[] = [];

  for (const e of events) {
    const dateISO = normalizeDateString(normalizeScheduleDate(e.date));
    const dayIndex = weekDates.indexOf(dateISO);
    if (dayIndex < 0) {
      continue;
    }
    const [sh, sm] = (e.startTime ?? '09:00').split(':').map(Number);
    const [eh, em] = (e.endTime ?? '10:00').split(':').map(Number);
    const beginAbs = sh * 60 + sm;
    const endAbs = eh * 60 + em;
    if (endAbs <= beginAbs) {
      continue;
    }
    blocks.push({
      key: `c-${e.id}-${dateISO}`,
      kind: 'course',
      dayIndex,
      dateISO,
      begin: beginAbs - startBase,
      end: endAbs - startBase,
      title: e.title,
      location: e.location ?? '',
      startTime: e.startTime,
      endTime: e.endTime,
      color: colorForScheduleTitle(e.title, 'course'),
      eventId: e.id,
    });
  }

  for (const pe of personal) {
    const dayIndex = weekDates.indexOf(normalizeDateString(pe.date));
    if (dayIndex < 0) {
      continue;
    }
    const [sh, sm] = pe.startTime.split(':').map(Number);
    const [eh, em] = pe.endTime.split(':').map(Number);
    const beginAbs = sh * 60 + sm;
    const endAbs = eh * 60 + em;
    if (endAbs <= beginAbs) {
      continue;
    }
    blocks.push({
      key: `p-${pe.id}`,
      kind: 'personal',
      dayIndex,
      dateISO: pe.date,
      begin: beginAbs - startBase,
      end: endAbs - startBase,
      title: pe.title,
      location: pe.location ?? '',
      startTime: pe.startTime,
      endTime: pe.endTime,
      color: colorForScheduleTitle(pe.title, 'personal'),
      eventId: pe.id,
      note: pe.note,
    });
  }

  return blocks.sort((a, b) => a.begin - b.begin);
}

export function computeDisplayStartHourFlat(
  events: ScheduleEvent[],
  personal: PersonalEvent[],
  weekDates: string[],
): number {
  const eightAm = DEFAULT_DISPLAY_START_HOUR * 60;
  let earliest: number | null = null;
  const inWeek = (d: string) => weekDates.includes(normalizeDateString(d));

  for (const e of events) {
    if (!inWeek(normalizeScheduleDate(e.date))) {
      continue;
    }
    const [h, m] = (e.startTime ?? '09:00').split(':').map(Number);
    const mins = h * 60 + m;
    if (earliest === null || mins < earliest) {
      earliest = mins;
    }
  }
  for (const p of personal) {
    if (!inWeek(p.date)) {
      continue;
    }
    const [h, m] = p.startTime.split(':').map(Number);
    const mins = h * 60 + m;
    if (earliest === null || mins < earliest) {
      earliest = mins;
    }
  }
  if (earliest === null) {
    return DEFAULT_DISPLAY_START_HOUR;
  }
  return Math.min(DEFAULT_DISPLAY_START_HOUR, Math.floor(Math.min(earliest, eightAm) / 60));
}
