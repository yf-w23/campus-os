import {AgentUIBlock, AgentUITaskPlanItem} from '../../domain/agentUi';
import {DeadlineListItem} from '../../domain/deadline';
import {NotificationItem, ScheduleEvent} from '../../domain/learning';
import {CampusWeather} from '../../services/campus/weather';
import {todayLocalISO} from '../../utils/weekDates';

type Locale = 'zh' | 'en';

export interface HomeWorkbenchInput {
  schedule: ScheduleEvent[];
  deadlines: DeadlineListItem[];
  unread: NotificationItem[];
  weather?: CampusWeather | null;
  weatherLoading?: boolean;
  weatherError?: string | null;
  locale: Locale;
}

function isZh(locale: Locale): boolean {
  return locale === 'zh';
}

function parseDeadline(value?: string): number {
  const time = new Date(String(value ?? '').replace(' ', 'T')).getTime();
  return Number.isNaN(time) ? Number.MAX_SAFE_INTEGER : time;
}

function formatDeadlineDistance(
  deadline: DeadlineListItem,
  locale: Locale,
): string {
  const time = parseDeadline(deadline.deadline);
  if (time === Number.MAX_SAFE_INTEGER) {
    return isZh(locale) ? '截止时间未识别' : 'Deadline not recognized';
  }
  const diffMs = time - Date.now();
  const diffDays = Math.ceil(diffMs / (24 * 60 * 60 * 1000));
  if (diffDays < 0) {
    return isZh(locale) ? '已经逾期' : 'Overdue';
  }
  if (diffDays === 0) {
    return isZh(locale) ? '今天截止' : 'Due today';
  }
  if (diffDays === 1) {
    return isZh(locale) ? '明天截止' : 'Due tomorrow';
  }
  return isZh(locale) ? `${diffDays} 天后截止` : `Due in ${diffDays} days`;
}

function findNextClass(schedule: ScheduleEvent[]): ScheduleEvent | undefined {
  const now = new Date();
  const today = todayLocalISO();
  const minutes = now.getHours() * 60 + now.getMinutes();
  return schedule.find(item => {
    if (String(item.date).slice(0, 10) !== today) {
      return true;
    }
    const [h, m] = String(item.startTime ?? '')
      .split(':')
      .map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) {
      return true;
    }
    return h * 60 + m >= minutes;
  });
}

function weatherContextLine(input: HomeWorkbenchInput): string | undefined {
  const zh = isZh(input.locale);
  if (input.weather) {
    const temp =
      typeof input.weather.temperature === 'number'
        ? `${Math.round(input.weather.temperature)}°`
        : '--';
    const rain =
      typeof input.weather.precipitationProbability === 'number'
        ? ` · ${zh ? '近3h降水' : '3h rain'} ${Math.round(
            input.weather.precipitationProbability,
          )}%`
        : '';
    const advice = input.weather.advice[0]
      ? ` · ${input.weather.advice[0]}`
      : '';
    return `${zh ? '海淀' : 'Haidian'} ${temp} · ${
      input.weather.condition
    }${rain}${advice}`;
  }
  if (input.weatherLoading) {
    return zh ? '海淀天气更新中' : 'Updating Haidian weather';
  }
  if (input.weatherError) {
    return zh ? '海淀天气暂不可用' : 'Haidian weather unavailable';
  }
  return undefined;
}

function buildTaskPlanItems(input: HomeWorkbenchInput): AgentUITaskPlanItem[] {
  const zh = isZh(input.locale);
  const items: AgentUITaskPlanItem[] = [];
  const nextClass = findNextClass(input.schedule);
  const nextDeadline = [...input.deadlines].sort(
    (a, b) => parseDeadline(a.deadline) - parseDeadline(b.deadline),
  )[0];

  if (nextClass) {
    items.push({
      id: 'next-class',
      title: zh ? `下一节：${nextClass.title}` : `Next: ${nextClass.title}`,
      detail: [nextClass.startTime, nextClass.endTime, nextClass.location]
        .filter(Boolean)
        .join(' · '),
      action: {
        id: 'open-schedule',
        type: 'navigate',
        label: zh ? '看日程' : 'Schedule',
        routeName: 'Schedule',
      },
    });
  }

  if (nextDeadline) {
    const distance = formatDeadlineDistance(nextDeadline, input.locale);
    const deadlineMs = parseDeadline(nextDeadline.deadline);
    const urgent =
      deadlineMs !== Number.MAX_SAFE_INTEGER &&
      deadlineMs - Date.now() < 2 * 24 * 60 * 60 * 1000;
    items.push({
      id: 'next-deadline',
      title: zh
        ? `优先处理：${nextDeadline.title}`
        : `Prioritize: ${nextDeadline.title}`,
      detail: [nextDeadline.courseName, distance].filter(Boolean).join(' · '),
      tone: urgent ? 'warning' : 'default',
      action: {
        id: 'open-deadline',
        type: 'navigate',
        label: zh ? '查看' : 'Open',
        routeName:
          nextDeadline.kind === 'homework' ? 'HomeworkDetail' : 'Learning',
        params:
          nextDeadline.kind === 'homework'
            ? {id: nextDeadline.id}
            : {initialTab: 'homework'},
      },
    });
  }

  if (input.unread.length > 0) {
    items.push({
      id: 'unread-notifications',
      title: zh
        ? `${input.unread.length} 条未读课程通知`
        : `${input.unread.length} unread course notices`,
      detail: zh
        ? '先看课程通知，再决定是否添加 DDL 或日程。'
        : 'Review notices first, then add deadlines or events if needed.',
      action: {
        id: 'open-notifications',
        type: 'navigate',
        label: zh ? '看通知' : 'Open',
        routeName: 'Learning',
        params: {initialTab: 'notifications'},
      },
    });
  }

  if (items.length === 0) {
    items.push({
      id: 'quiet-day',
      title: zh ? '今天节奏比较轻' : 'A lighter day',
      detail: zh
        ? '可以安排复习、整理资料，或让 AI 帮你规划下一阶段。'
        : 'Good time to review, organize files, or plan the next block.',
      action: {
        id: 'open-schedule',
        type: 'navigate',
        label: zh ? '看日程' : 'Schedule',
        routeName: 'Schedule',
      },
    });
  }

  return items.slice(0, 4);
}

export function buildHomeWorkbenchBlocks(
  input: HomeWorkbenchInput,
): AgentUIBlock[] {
  const zh = isZh(input.locale);
  const urgentDeadline = input.deadlines.find(item => {
    const time = parseDeadline(item.deadline);
    return (
      time !== Number.MAX_SAFE_INTEGER &&
      time - Date.now() < 2 * 24 * 60 * 60 * 1000
    );
  });

  return [
    {
      id: 'home-briefing',
      type: 'briefing',
      title: zh ? '今日重点' : "Today's Focus",
      subtitle:
        weatherContextLine(input) ??
        (zh
          ? '根据课程、DDL 和通知生成'
          : 'Built from classes, tasks, and notices'),
      summary: urgentDeadline
        ? zh
          ? `优先处理「${urgentDeadline.title}」，同时留意天气和课程移动时间。`
          : `Prioritize "${urgentDeadline.title}" and account for weather and transit time.`
        : zh
        ? '今天可以按课程节奏推进，空档适合处理 DDL 或找学习空间。'
        : 'Follow your class rhythm; gaps are good for deadlines or study space planning.',
      metrics: [
        {
          label: zh ? '课程' : 'Classes',
          value: input.schedule.length,
          tone: input.schedule.length > 0 ? 'default' : 'success',
        },
        {
          label: zh ? '待办' : 'Tasks',
          value: input.deadlines.length,
          tone: urgentDeadline ? 'warning' : 'default',
        },
        {
          label: zh ? '未读' : 'Unread',
          value: input.unread.length,
          tone: input.unread.length > 0 ? 'warning' : 'success',
        },
      ],
      priority: 10,
    },
    {
      id: 'home-task-plan',
      type: 'task_plan',
      title: zh ? '建议操作' : 'Suggested Actions',
      subtitle: zh ? '按紧急度和上下文排序' : 'Sorted by urgency and context',
      items: buildTaskPlanItems(input),
      actions: [
        {
          id: 'open-classroom',
          type: 'navigate',
          label: zh ? '查空教室' : 'Classrooms',
          routeName: 'CampusClassroom',
        },
        {
          id: 'open-library',
          type: 'navigate',
          label: zh ? '图书馆座位' : 'Library',
          routeName: 'CampusLibrary',
        },
        {
          id: 'add-deadline',
          type: 'add_deadline',
          label: zh ? '添加 DDL' : 'Add DDL',
        },
      ],
      priority: 30,
    },
  ];
}
