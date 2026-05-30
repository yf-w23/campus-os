import {ScheduleEvent} from '../domain/learning';
import {PersonalEvent} from '../domain/schedule';
import {normalizeDateString, todayLocalISO} from '../utils/weekDates';
import {RootState} from './store';

export const selectAuth = (state: RootState) => state.auth;
export const selectLearning = (state: RootState) => state.learning;
export const selectSchedule = (state: RootState) => state.schedule;
export const selectPersonalEvents = (state: RootState) =>
  state.schedule.personalEvents;

export const selectCampusSchedule = (state: RootState) => ({
  calendar: state.schedule.calendar,
  baseSchedule: state.schedule.baseSchedule,
  scheduleSyncedAt: state.schedule.scheduleSyncedAt,
  scheduleError: state.schedule.scheduleError,
});

export const selectScheduleError = (state: RootState) => state.schedule.scheduleError;
export const selectAI = (state: RootState) => state.ai;

export const selectConversations = (state: RootState) =>
  state.ai.conversations;

export const selectActiveConversationId = (state: RootState) =>
  state.ai.activeConversationId;

export const selectActiveConversation = (state: RootState) =>
  state.ai.conversations.find(c => c.id === state.ai.activeConversationId) ??
  null;

export const selectActiveMessages = (state: RootState) =>
  state.ai.conversations.find(c => c.id === state.ai.activeConversationId)
    ?.messages ?? [];
export const selectSettings = (state: RootState) => state.settings;

export const selectUpcomingHomework = (state: RootState) =>
  state.learning.snapshot?.homework.filter(item => !item.submitted) ?? [];

export type MergedScheduleItem =
  | {kind: 'course'; event: ScheduleEvent}
  | {kind: 'personal'; event: PersonalEvent};

/** 与首页「今日课表」相同的数据源 */
export const selectLearningSchedule = (state: RootState) =>
  state.learning.snapshot?.schedule ?? [];

/** 某自然周内的教务课表（筛选逻辑与 selectTodaySchedule 一致，仅日期范围不同） */
export function scheduleForWeekDates(
  items: ScheduleEvent[],
  weekDates: string[],
): ScheduleEvent[] {
  const weekSet = new Set(weekDates.map(d => normalizeDateString(d)));
  return items
    .filter(item => weekSet.has(normalizeDateString(item.date)))
    .sort((a, b) => {
      const dc = normalizeDateString(a.date).localeCompare(
        normalizeDateString(b.date),
      );
      if (dc !== 0) {
        return dc;
      }
      return (a.startTime ?? '').localeCompare(b.startTime ?? '');
    });
}

/** 当前自然周内的课表（与首页同源，按日期归一化筛选） */
export const selectWeekSchedule =
  (weekDates: string[]) => (state: RootState) =>
    scheduleForWeekDates(selectLearningSchedule(state), weekDates);

export const selectTodaySchedule = (state: RootState) => {
  const today = todayLocalISO();
  return selectLearningSchedule(state)
    .filter(item => normalizeDateString(item.date) === today)
    .sort((a, b) => (a.startTime ?? '').localeCompare(b.startTime ?? ''));
};

export const selectUnreadNotifications = (state: RootState) =>
  state.learning.snapshot?.notifications.filter(item => !item.hasRead && !item.expired) ??
  [];

export const selectIsDemoData = (state: RootState) =>
  state.learning.dataSource === 'demo';

export const selectLearningError = (state: RootState) => state.learning.error;
export const selectLearningLoading = (state: RootState) => state.learning.loading;
export const selectLearningDataSource = (state: RootState) => state.learning.dataSource;

/** 某日合并后的课表 + 个人日程，按开始时间排序 */
export function mergeScheduleForDate(
  dateISO: string,
  courses: ScheduleEvent[],
  personal: PersonalEvent[],
): MergedScheduleItem[] {
  const day = normalizeDateString(dateISO);
  const courseItems: MergedScheduleItem[] = (courses ?? [])
    .filter(c => normalizeDateString(c.date) === day)
    .map(event => ({kind: 'course' as const, event}));
  const personalItems: MergedScheduleItem[] = (personal ?? [])
    .filter(p => normalizeDateString(p.date) === day)
    .map(event => ({kind: 'personal' as const, event}));
  return [...courseItems, ...personalItems].sort((a, b) => {
    const ta =
      a.kind === 'course' ? a.event.startTime : a.event.startTime;
    const tb =
      b.kind === 'course' ? b.event.startTime : b.event.startTime;
    return (ta ?? '').localeCompare(tb ?? '');
  });
}

export const selectMergedScheduleForDate =
  (dateISO: string) => (state: RootState) =>
    mergeScheduleForDate(
      dateISO,
      state.learning.snapshot?.schedule ?? [],
      state.schedule.personalEvents,
    );
