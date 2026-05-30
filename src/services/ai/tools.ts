/**
 * AI 工具注册表 —— 把校园能力暴露成 OpenAI function-calling 工具。
 *
 * 这是 Campus OS 从"AI 问答标签页"升级为"AI-native"的核心：
 * 模型不再只读注入的摘要，而是按需调用这些工具去**查询实时数据**、
 * 乃至**真正动手**（预约座位 / 电费充值）。
 *
 * 约定：
 *   - read 工具（requiresConfirmation falsy）：随时可调，返回精简后的结构化数据。
 *   - write 工具（requiresConfirmation true）：执行前必须经 UI 二次确认。
 *   - run() 返回的对象会被 JSON.stringify 后作为 tool 结果回灌给模型，注意控制体积。
 */
import {Linking} from 'react-native';
import {store} from '../../state/store';
import {fetchGradeReport} from '../campus/grades';
import {
  buildAlipayUrl,
  getEleRechargePayCode,
  getEleRemainder,
  getEleRoomInfo,
} from '../campus/electricity';
import {
  DateChoice,
  bookLibrarySeat,
  getLibraryFloorList,
  getLibrarySeatList,
  getLibrarySectionList,
  getLibraryList,
} from '../campus/library';
import {fetchHomeworkDetail} from '../campus/homeworkDetail';
import {patchAIMemory} from '../../storage/aiMemoryStorage';
import {
  appendPersonalEvent,
  deletePersonalEventById,
  findPersonalEvent,
  listPersonalEventsInRange,
} from '../schedule/personalEvents';
import {normalizeDateString, todayLocalISO, weekDatesContaining} from '../../utils/weekDates';

export interface AgentTool {
  name: string;
  description: string;
  /** JSON Schema（OpenAI tools 格式的 parameters）*/
  parameters: Record<string, unknown>;
  /** 写操作：执行前需 UI 二次确认 */
  requiresConfirmation?: boolean;
  /** 过程状态行文案 */
  summarize?: (args: any) => string;
  /** 确认弹窗文案（写操作）*/
  confirmPrompt?: (args: any) => {title: string; message: string};
  run: (args: any) => Promise<unknown>;
}

// ============================================================
// 工具入参/工具内辅助
// ============================================================

function dateChoiceFromArg(value: unknown): DateChoice {
  if (value === 1 || value === '1' || value === 'tomorrow' || value === '明天') {
    return 1;
  }
  return 0;
}

function requireRealSession(): void {
  if (store.getState().auth.demoMode) {
    throw new Error('当前是演示模式，无法访问真实校园数据或执行操作');
  }
}

function getSnapshot() {
  return store.getState().learning.snapshot;
}

const seatStatusLabel: Record<number, string> = {
  1: '可用',
  6: '已预约',
  7: '已占用',
};

// ============================================================
// 读工具
// ============================================================

const getTodayTool: AgentTool = {
  name: 'get_today_overview',
  description:
    '获取今天的日期、星期，以及今天的课程安排和临近的待办作业（DDL）。当用户问"今天/最近有什么安排/作业"时使用。',
  parameters: {type: 'object', properties: {}},
  summarize: () => '读取今日概览',
  run: async () => {
    const snapshot = getSnapshot();
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const weekday = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][now.getDay()];
    const todayClasses = (snapshot?.schedule ?? [])
      .filter(s => String(s.date).slice(0, 10) === today)
      .map(s => `${s.startTime}-${s.endTime} ${s.title} @ ${s.location}`);
    const ddls = (snapshot?.homework ?? [])
      .filter(h => !h.submitted)
      .slice(0, 10)
      .map(h => `[${h.courseName}] ${h.title} · 截止 ${h.deadline}`);
    return {date: today, weekday, todayClasses, upcomingHomework: ddls};
  },
};

const listHomeworkTool: AgentTool = {
  name: 'list_homework',
  description:
    '列出作业。可按状态筛选：pending=未提交，submitted=已提交未批改，graded=已批改，all=全部。',
  parameters: {
    type: 'object',
    properties: {
      status: {
        type: 'string',
        enum: ['pending', 'submitted', 'graded', 'all'],
        description: '筛选状态，默认 pending',
      },
    },
  },
  summarize: () => '查询作业列表',
  run: async (args: {status?: string}) => {
    const snapshot = getSnapshot();
    const status = args?.status ?? 'pending';
    let list = snapshot?.homework ?? [];
    if (status === 'pending') list = list.filter(h => !h.submitted);
    else if (status === 'submitted') list = list.filter(h => h.submitted && !h.graded);
    else if (status === 'graded') list = list.filter(h => h.graded);
    return {
      count: list.length,
      homework: list.slice(0, 30).map(h => ({
        id: h.id,
        course: h.courseName,
        title: h.title,
        deadline: h.deadline,
        status: h.status,
        grade: h.grade,
      })),
    };
  },
};

const getHomeworkDetailTool: AgentTool = {
  name: 'get_homework_detail',
  description:
    '获取某条作业的完整详情（作业说明、附件、提交内容、批阅结果）。通过作业标题关键词或 list_homework 返回的 id 定位。',
  parameters: {
    type: 'object',
    properties: {
      titleOrId: {type: 'string', description: '作业标题关键词或作业 id'},
    },
    required: ['titleOrId'],
  },
  summarize: (a: {titleOrId?: string}) => `读取作业详情：${a?.titleOrId ?? ''}`,
  run: async (args: {titleOrId: string}) => {
    requireRealSession();
    const snapshot = getSnapshot();
    const key = String(args.titleOrId ?? '').trim();
    const item =
      snapshot?.homework.find(h => h.id === key) ??
      snapshot?.homework.find(h => h.title.includes(key));
    if (!item) {
      return {error: `未找到匹配的作业：${key}`};
    }
    const detail = await fetchHomeworkDetail(item);
    return {
      title: item.title,
      course: item.courseName,
      deadline: item.deadline,
      completionType: item.completionType,
      submitTime: item.submitTime,
      grade: item.grade,
      graderName: item.graderName,
      gradeContent: item.gradeContent,
      publishTarget: detail.publishTarget,
      hasAttachment: Boolean(detail.attachment),
      attachmentName: detail.attachment?.name,
    };
  },
};

const getGradesTool: AgentTool = {
  name: 'get_grades',
  description: '查询本人成绩单与学分绩（GPA）。返回各门课成绩与总体 GPA。',
  parameters: {type: 'object', properties: {}},
  summarize: () => '查询成绩与 GPA',
  run: async () => {
    requireRealSession();
    const report = await fetchGradeReport();
    return {
      gpa: Number(report.gpa.toFixed(3)),
      totalCredit: report.totalCredit,
      courses: report.courses.slice(0, 60).map(c => ({
        name: c.name,
        credit: c.credit,
        grade: c.grade,
        point: isNaN(c.point) ? null : c.point,
        semester: c.semester,
      })),
    };
  },
};

const getElectricityTool: AgentTool = {
  name: 'get_electricity_balance',
  description: '查询宿舍当前电费剩余电量、更新时间与房间信息。',
  parameters: {type: 'object', properties: {}},
  summarize: () => '查询电费余额',
  run: async () => {
    requireRealSession();
    const [balance, room] = await Promise.all([
      getEleRemainder(),
      getEleRoomInfo().catch(() => null),
    ]);
    return {
      remainder: balance.remainder,
      unit: '度',
      updateTime: balance.updateTime,
      room: room
        ? {building: room.building, room: room.room, userName: room.userName}
        : undefined,
    };
  },
};

const listLibrariesTool: AgentTool = {
  name: 'list_libraries',
  description: '列出可预约座位的图书馆及其有效性。预约座位的第一步。',
  parameters: {type: 'object', properties: {}},
  summarize: () => '获取图书馆列表',
  run: async () => {
    requireRealSession();
    const list = await getLibraryList();
    return {
      libraries: list
        .filter(l => l.valid)
        .map(l => ({id: l.id, name: l.zhName})),
    };
  },
};

const listFloorsTool: AgentTool = {
  name: 'list_library_floors',
  description:
    '列出某图书馆各楼层及其空位数（available/total）。需先用 list_libraries 拿到 libraryId。',
  parameters: {
    type: 'object',
    properties: {
      libraryId: {type: 'number', description: '图书馆 id'},
      date: {type: 'string', enum: ['today', 'tomorrow'], description: '默认 today'},
    },
    required: ['libraryId'],
  },
  summarize: () => '查询楼层空位',
  run: async (args: {libraryId: number; date?: string}) => {
    requireRealSession();
    const floors = await getLibraryFloorList(
      Number(args.libraryId),
      dateChoiceFromArg(args.date),
    );
    return {
      floors: floors
        .filter(f => f.valid)
        .map(f => ({
          id: f.id,
          name: f.zhName,
          available: f.available,
          total: f.total,
        })),
    };
  },
};

const listSectionsTool: AgentTool = {
  name: 'list_library_sections',
  description:
    '列出某楼层下各分区及空位数。需先用 list_library_floors 拿到 floorId。',
  parameters: {
    type: 'object',
    properties: {
      floorId: {type: 'number', description: '楼层 id'},
      date: {type: 'string', enum: ['today', 'tomorrow']},
    },
    required: ['floorId'],
  },
  summarize: () => '查询分区空位',
  run: async (args: {floorId: number; date?: string}) => {
    requireRealSession();
    const sections = await getLibrarySectionList(
      Number(args.floorId),
      dateChoiceFromArg(args.date),
    );
    return {
      sections: sections
        .filter(s => s.valid)
        .map(s => ({
          id: s.id,
          name: s.zhName,
          available: s.available,
          total: s.total,
        })),
    };
  },
};

const findSeatsTool: AgentTool = {
  name: 'find_available_seats',
  description:
    '列出某分区当前可预约的座位（仅返回可用座位）。需先用 list_library_sections 拿到 sectionId。返回的 seatId + seatType 用于 book_library_seat。',
  parameters: {
    type: 'object',
    properties: {
      sectionId: {type: 'number', description: '分区 id'},
      date: {type: 'string', enum: ['today', 'tomorrow']},
    },
    required: ['sectionId'],
  },
  summarize: () => '查找可用座位',
  run: async (args: {sectionId: number; date?: string}) => {
    requireRealSession();
    const seats = await getLibrarySeatList(
      Number(args.sectionId),
      dateChoiceFromArg(args.date),
    );
    const available = seats.filter(s => s.status === 1);
    return {
      availableCount: available.length,
      seats: available.slice(0, 30).map(s => ({
        seatId: s.id,
        seatName: s.zhName,
        seatType: s.type,
        status: seatStatusLabel[s.status] ?? '未知',
      })),
    };
  },
};

// ============================================================
// 写工具（需确认）
// ============================================================

const bookSeatTool: AgentTool = {
  name: 'book_library_seat',
  description:
    '预约一个图书馆座位（真实下单）。参数来自 find_available_seats（seatId、seatType）与 list_library_sections（sectionId）。执行前会请用户确认。',
  parameters: {
    type: 'object',
    properties: {
      seatId: {type: 'number'},
      seatType: {type: 'number'},
      sectionId: {type: 'number'},
      seatName: {type: 'string', description: '座位名，用于确认展示'},
      sectionName: {type: 'string', description: '分区名，用于确认展示'},
      date: {type: 'string', enum: ['today', 'tomorrow']},
    },
    required: ['seatId', 'seatType', 'sectionId'],
  },
  requiresConfirmation: true,
  summarize: (a: any) => `预约座位 ${a?.seatName ?? a?.seatId ?? ''}`,
  confirmPrompt: (a: any) => ({
    title: '确认预约座位',
    message: `${a?.sectionName ? a.sectionName + ' · ' : ''}${
      a?.seatName ?? '座位 ' + a?.seatId
    }（${a?.date === 'tomorrow' ? '明天' : '今天'}）\n\n确认后将真实下单。`,
  }),
  run: async (args: {
    seatId: number;
    seatType: number;
    sectionId: number;
    date?: string;
  }) => {
    requireRealSession();
    const result = await bookLibrarySeat(
      {id: Number(args.seatId), type: Number(args.seatType)},
      Number(args.sectionId),
      dateChoiceFromArg(args.date),
    );
    if (result.status === 0) {
      return {ok: true, message: '预约成功'};
    }
    return {ok: false, message: result.msg || '预约失败'};
  },
};

const rechargeEleTool: AgentTool = {
  name: 'recharge_electricity',
  description:
    '给宿舍电费充值（真实支付）。amount 为充值金额（1–500 元整数）。执行前会请用户确认，确认后唤起支付宝完成支付。',
  parameters: {
    type: 'object',
    properties: {
      amount: {type: 'number', description: '充值金额（元），1–500 整数'},
    },
    required: ['amount'],
  },
  requiresConfirmation: true,
  summarize: (a: any) => `电费充值 ${a?.amount ?? ''} 元`,
  confirmPrompt: (a: any) => ({
    title: '确认电费充值',
    message: `将为宿舍充值 ${a?.amount} 元，确认后唤起支付宝完成支付。`,
  }),
  run: async (args: {amount: number}) => {
    requireRealSession();
    const amount = Number(args.amount);
    if (!Number.isInteger(amount) || amount <= 0 || amount > 500) {
      return {ok: false, message: '金额需为 1–500 的整数'};
    }
    const payCode = await getEleRechargePayCode(amount);
    const url = buildAlipayUrl(payCode);
    const canOpen = await Linking.canOpenURL(url);
    if (!canOpen) {
      return {ok: false, message: '未安装支付宝或无法唤起，请改用网页充值'};
    }
    await Linking.openURL(url);
    return {ok: true, message: `已唤起支付宝，请在支付宝内完成 ${amount} 元支付`};
  },
};

const listPersonalEventsTool: AgentTool = {
  name: 'list_personal_events',
  description:
    '列出用户自建备忘日程（不含教务课表）。可按 startDate/endDate（YYYY-MM-DD）筛选；不传则默认本周。',
  parameters: {
    type: 'object',
    properties: {
      startDate: {type: 'string', description: '起始日期 YYYY-MM-DD'},
      endDate: {type: 'string', description: '结束日期 YYYY-MM-DD'},
    },
  },
  summarize: () => '查询个人备忘日程',
  run: async (args: {startDate?: string; endDate?: string}) => {
    let start = args.startDate ? normalizeDateString(args.startDate) : '';
    let end = args.endDate ? normalizeDateString(args.endDate) : '';
    if (!start && !end) {
      const week = weekDatesContaining(todayLocalISO(), 0);
      start = week[0];
      end = week[6];
    }
    const events = listPersonalEventsInRange(start || undefined, end || undefined);
    return {
      count: events.length,
      events: events.map(e => ({
        id: e.id,
        date: e.date,
        title: e.title,
        time: `${e.startTime}-${e.endTime}`,
        location: e.location,
        note: e.note,
      })),
    };
  },
};

const getWeekScheduleTool: AgentTool = {
  name: 'get_week_schedule',
  description:
    '获取某周合并后的日程：教务课表 + 用户备忘。weekOffset：0=本周，1=下周，-1=上周。用于回答"这周/下周有什么安排"。',
  parameters: {
    type: 'object',
    properties: {
      weekOffset: {type: 'number', description: '相对本周偏移，默认 0'},
    },
  },
  summarize: (a: {weekOffset?: number}) =>
    `读取${a?.weekOffset === 0 || a?.weekOffset === undefined ? '本' : ''}周日程`,
  run: async (args: {weekOffset?: number}) => {
    const offset = Number(args?.weekOffset ?? 0);
    const dates = weekDatesContaining(todayLocalISO(), offset);
    const courses = getSnapshot()?.schedule ?? [];
    const personal = listPersonalEventsInRange(dates[0], dates[6]);
    const byDay: Record<string, unknown[]> = {};
    for (const date of dates) {
      const dayCourses = courses
        .filter(c => normalizeDateString(c.date) === date)
        .map(c => ({
          kind: 'course',
          title: c.title,
          time: `${c.startTime}-${c.endTime}`,
          location: c.location,
        }));
      const dayPersonal = personal
        .filter(p => normalizeDateString(p.date) === date)
        .map(p => ({
          kind: 'personal',
          id: p.id,
          title: p.title,
          time: `${p.startTime}-${p.endTime}`,
          location: p.location,
          note: p.note,
        }));
      byDay[date] = [...dayCourses, ...dayPersonal];
    }
    return {weekStart: dates[0], weekEnd: dates[6], days: byDay};
  },
};

const addPersonalEventTool: AgentTool = {
  name: 'add_personal_event',
  description:
    '为用户添加一条自建备忘日程（写入本地，与教务课表合并展示）。需明确日期、标题与时间段；执行前会请用户确认。',
  parameters: {
    type: 'object',
    properties: {
      date: {type: 'string', description: '日期 YYYY-MM-DD'},
      title: {type: 'string'},
      startTime: {type: 'string', description: '如 14:00'},
      endTime: {type: 'string', description: '如 16:00'},
      location: {type: 'string'},
      note: {type: 'string'},
    },
    required: ['date', 'title', 'startTime', 'endTime'],
  },
  requiresConfirmation: true,
  summarize: (a: any) => `添加备忘：${a?.title ?? ''}`,
  confirmPrompt: (a: any) => ({
    title: '确认添加备忘',
    message: `${a?.date} ${a?.startTime}-${a?.endTime}\n${a?.title}${
      a?.location ? '\n' + a.location : ''
    }`,
  }),
  run: async (args: {
    date: string;
    title: string;
    startTime: string;
    endTime: string;
    location?: string;
    note?: string;
  }) => {
    const date = normalizeDateString(args.date);
    if (!date || !args.title?.trim()) {
      return {ok: false, message: '请提供有效日期与标题'};
    }
    const event = await appendPersonalEvent({
      date,
      title: args.title.trim(),
      startTime: String(args.startTime).trim(),
      endTime: String(args.endTime).trim(),
      location: args.location?.trim() || undefined,
      note: args.note?.trim() || undefined,
    });
    return {ok: true, id: event.id, message: '已添加备忘'};
  },
};

const removePersonalEventTool: AgentTool = {
  name: 'remove_personal_event',
  description:
    '删除一条用户自建备忘。用 list_personal_events 返回的 id，或标题关键词匹配。不能删除教务课表。执行前会请用户确认。',
  parameters: {
    type: 'object',
    properties: {
      idOrTitle: {type: 'string', description: '备忘 id 或标题关键词'},
    },
    required: ['idOrTitle'],
  },
  requiresConfirmation: true,
  summarize: (a: any) => `删除备忘：${a?.idOrTitle ?? ''}`,
  confirmPrompt: (a: any) => ({
    title: '确认删除备忘',
    message: `将删除：${a?.idOrTitle}\n（仅删除自建备忘，不影响教务课表）`,
  }),
  run: async (args: {idOrTitle: string}) => {
    const found = findPersonalEvent(args.idOrTitle);
    if (!found) {
      return {ok: false, message: `未找到匹配备忘：${args.idOrTitle}`};
    }
    const ok = await deletePersonalEventById(found.id);
    return ok
      ? {ok: true, message: `已删除「${found.title}」`}
      : {ok: false, message: '删除失败'};
  },
};

const rememberTool: AgentTool = {
  name: 'remember_preference',
  description:
    '记住用户的长期偏好，便于后续个性化（如常用图书馆/分区、默认电费充值额、关注的课程）。当用户表达明确偏好时调用。',
  parameters: {
    type: 'object',
    properties: {
      favoriteLibrary: {type: 'string'},
      favoriteSection: {type: 'string'},
      defaultRechargeAmount: {type: 'number'},
      watchedCourses: {type: 'array', items: {type: 'string'}},
      note: {type: 'string', description: '其它要记住的自由偏好'},
    },
  },
  summarize: () => '更新个性化记忆',
  run: async (args: {
    favoriteLibrary?: string;
    favoriteSection?: string;
    defaultRechargeAmount?: number;
    watchedCourses?: string[];
    note?: string;
  }) => {
    const next = await patchAIMemory({
      favoriteLibrary: args.favoriteLibrary,
      favoriteSection: args.favoriteSection,
      defaultRechargeAmount: args.defaultRechargeAmount,
      watchedCourses: args.watchedCourses,
      notes: args.note ? [args.note] : undefined,
    });
    return {ok: true, memory: next};
  },
};

export const AGENT_TOOLS: AgentTool[] = [
  getTodayTool,
  getWeekScheduleTool,
  listPersonalEventsTool,
  addPersonalEventTool,
  removePersonalEventTool,
  listHomeworkTool,
  getHomeworkDetailTool,
  getGradesTool,
  getElectricityTool,
  listLibrariesTool,
  listFloorsTool,
  listSectionsTool,
  findSeatsTool,
  bookSeatTool,
  rechargeEleTool,
  rememberTool,
];

export function getToolByName(name: string): AgentTool | undefined {
  return AGENT_TOOLS.find(t => t.name === name);
}

/** 转成 OpenAI tools 数组 */
export function toolSpecs(): Array<Record<string, unknown>> {
  return AGENT_TOOLS.map(t => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));
}
