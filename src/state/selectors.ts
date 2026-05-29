import {RootState} from './store';

export const selectAuth = (state: RootState) => state.auth;
export const selectLearning = (state: RootState) => state.learning;
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

/** 返回本地时区下的 YYYY-MM-DD（不是 UTC，避免凌晨 0-8 点变"昨天"） */
function todayLocalISO(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** 把 row.nq 字段可能的多种格式归一为 YYYY-MM-DD */
function normalizeDateString(s: string | undefined | null): string {
  if (!s) return '';
  const str = String(s).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
  if (/^\d{8}$/.test(str)) {
    return `${str.slice(0, 4)}-${str.slice(4, 6)}-${str.slice(6, 8)}`;
  }
  // 中文 / 斜杠分隔等等：丢给 Date 试一下
  const d = new Date(str.replace(/[年/.]/g, '-').replace(/[月]/g, '-').replace(/[日]/g, ''));
  if (!isNaN(d.getTime())) {
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
  }
  return str;
}

export const selectTodaySchedule = (state: RootState) => {
  const today = todayLocalISO();
  const items = state.learning.snapshot?.schedule ?? [];
  return items
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
