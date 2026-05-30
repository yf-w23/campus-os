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

export function parseJsonpSchedule(raw: string): RawScheduleRow[] {
  // jsoncallback=m 返回形如 `m([...])`；与 thu-info 一致只取首个 '[' 到末个 ']'。
  // 不强校验 'm' 前缀（可能有 BOM / 空白 / 包装差异），取不到数组就返回空。
  const start = raw.indexOf('[');
  const end = raw.lastIndexOf(']');
  if (start < 0 || end < 0 || end <= start) {
    return [];
  }
  try {
    return JSON.parse(raw.slice(start, end + 1)) as RawScheduleRow[];
  } catch {
    return [];
  }
}

export function normalizeScheduleTime(value: string): string {
  return value.replace(/：/g, ':');
}

/**
 * 把 `nq` 字段（教务系统可能返回 `2026-05-28` 或 `20260528` 或带空格的形式）归一为 YYYY-MM-DD。
 * UI 各处 selectTodaySchedule / 周课表全都按 YYYY-MM-DD 比较。
 */
export function normalizeScheduleDate(value: string | undefined | null): string {
  if (!value) return '';
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  if (/^\d{8}$/.test(s)) {
    return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  }
  const d = new Date(
    s.replace(/[年/.]/g, '-').replace(/[月]/g, '-').replace(/[日]/g, ''),
  );
  if (!isNaN(d.getTime())) {
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
  }
  return s;
}

/** 稳定去重键：日期 + grrlID（或内容指纹），避免跨天共用同一 id 被误删 */
export function scheduleEventDedupeKey(event: ScheduleEvent): string {
  const date = normalizeScheduleDate(event.date);
  const id = (event.id ?? '').trim();
  if (id) {
    return `${date}|id:${id}`;
  }
  return [
    date,
    event.title,
    event.startTime,
    event.endTime,
    event.location ?? '',
  ].join('|');
}

export function dedupeScheduleEvents(events: ScheduleEvent[]): ScheduleEvent[] {
  const seen = new Set<string>();
  const out: ScheduleEvent[] = [];
  for (const event of events) {
    const key = scheduleEventDedupeKey(event);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(event);
  }
  return out;
}

export function mapScheduleRows(rows: RawScheduleRow[]): ScheduleEvent[] {
  const mapped = rows.map(row => {
    const date = normalizeScheduleDate(row.nq);
    return {
      id: row.grrlID ?? `${date}-${row.nr}-${row.kssj}`,
      date,
      title: row.nr,
      location: row.dd,
      startTime: normalizeScheduleTime(row.kssj),
      endTime: normalizeScheduleTime(row.jssj),
      category: row.fl,
    };
  });
  return dedupeScheduleEvents(mapped);
}
