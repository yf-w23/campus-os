const WEEKDAY_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'] as const;

export function todayLocalISO(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function normalizeDateString(s: string | undefined | null): string {
  if (!s) return '';
  const str = String(s).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
  if (/^\d{8}$/.test(str)) {
    return `${str.slice(0, 4)}-${str.slice(4, 6)}-${str.slice(6, 8)}`;
  }
  const d = new Date(str.replace(/[年/.]/g, '-').replace(/[月]/g, '-').replace(/[日]/g, ''));
  if (!isNaN(d.getTime())) {
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
  }
  return str;
}

/** 以周一为一周起点，返回该周 7 天的 YYYY-MM-DD */
export function weekDatesContaining(dateISO: string, weekOffset = 0): string[] {
  const [y, m, d] = dateISO.split('-').map(Number);
  const anchor = new Date(y, m - 1, d);
  const dow = anchor.getDay();
  const mondayDelta = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(anchor);
  monday.setDate(anchor.getDate() + mondayDelta + weekOffset * 7);
  const out: string[] = [];
  for (let i = 0; i < 7; i++) {
    const cur = new Date(monday);
    cur.setDate(monday.getDate() + i);
    const mm = String(cur.getMonth() + 1).padStart(2, '0');
    const dd = String(cur.getDate()).padStart(2, '0');
    out.push(`${cur.getFullYear()}-${mm}-${dd}`);
  }
  return out;
}

export function weekdayLabelForDate(dateISO: string): string {
  const [y, m, d] = dateISO.split('-').map(Number);
  const dow = new Date(y, m - 1, d).getDay();
  const idx = dow === 0 ? 6 : dow - 1;
  return WEEKDAY_LABELS[idx];
}

export function formatWeekRange(dates: string[]): string {
  if (!dates.length) return '';
  const start = dates[0].slice(5).replace('-', '/');
  const end = dates[dates.length - 1].slice(5).replace('-', '/');
  return `${start} – ${end}`;
}

/**
 * 周视图默认选中：今天有课选今天；否则选本周内最近一天有课的日期（如周六默认跳到周五）。
 */
export function defaultScheduleDateInWeek(
  weekDates: string[],
  hasItemsOnDate: (dateISO: string) => boolean,
): string {
  const today = todayLocalISO();
  if (weekDates.includes(today) && hasItemsOnDate(today)) {
    return today;
  }
  for (let i = weekDates.length - 1; i >= 0; i--) {
    if (hasItemsOnDate(weekDates[i])) {
      return weekDates[i];
    }
  }
  return weekDates.includes(today) ? today : (weekDates[0] ?? today);
}

export {WEEKDAY_LABELS};
