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
import {store} from '../../state/store';
import {
  CLASSROOM_PERIODS,
  ClassroomStatus,
  PERIODS_PER_DAY,
  fetchClassroomList,
  fetchClassroomState,
} from '../campus/classroom';
import {fetchGradeReport} from '../campus/grades';
import {getEleRemainder, getEleRoomInfo} from '../campus/electricity';
import {
  DateChoice,
  bookLibraryRoom as bookLibraryRoomService,
  bookLibrarySeat,
  cancelLibraryBooking,
  cancelLibraryRoomBooking,
  fuzzySearchLibraryId,
  getLibraryBookingRecords,
  getLibraryFloorList,
  getLibraryRoomBookingInfoList,
  getLibraryRoomBookingRecord,
  getLibraryRoomBookingResourceList,
  getLibrarySeatList,
  getLibrarySectionList,
  getLibraryList,
} from '../campus/library';
import {
  getCampusCardInfo,
  getCampusCardTransactions,
  rechargeCampusCardAlipay,
} from '../campus/campusCard';
import {
  getNetworkAccountInfo,
  getNetworkBalance,
  getOnlineNetworkDevices,
  logoutNetworkDevice,
} from '../campus/network';
import {
  LaundryPlatform,
  getLaundryBuildings,
  getLaundryFloors,
} from '../campus/laundry';
import {
  getSportsReservationRecords,
  getSportsResources,
  sportsDateString,
  sportsIdInfoList,
} from '../campus/sports';
import {
  getCrAvailableSemesters,
  searchCrRemaining,
  selectCourse,
  deleteCourse,
  getSelectedCourses,
} from '../campus/courseRegistration';
import {
  getDegreeProgramCompletion,
  getFullDegreeProgram,
} from '../campus/program';
import {getNewsList, searchNewsList} from '../campus/news';
import {fetchHomeworkDetail} from '../campus/homeworkDetail';
import {patchAIMemory} from '../../storage/aiMemoryStorage';
import {
  appendPersonalEvent,
  deletePersonalEventById,
  findPersonalEvent,
  listPersonalEventsInRange,
} from '../schedule/personalEvents';
import {
  appendManualDeadline,
  deleteManualDeadlineById,
  findManualDeadline,
  listManualDeadlines,
} from '../learning/manualDeadlines';
import {
  normalizeDateString,
  todayLocalISO,
  weekDatesContaining,
} from '../../utils/weekDates';
import {
  ActionPreview,
  ConfirmationSpec,
  ToolRisk,
  UndoResult,
  VerificationResult,
} from '../../domain/actions';
import {Priority, Will} from '../../domain/courseRegistration';

export interface AgentTool {
  name: string;
  title: string;
  description: string;
  /** JSON Schema（OpenAI tools 格式的 parameters）*/
  parameters: Record<string, unknown>;
  /** Risk class for audit, confirmation, and future policy checks. */
  risk: ToolRisk;
  /** Permission key for future policy UI and per-tool consent. */
  permission: string;
  /** 写操作：执行前需 UI 二次确认 */
  requiresConfirmation?: boolean;
  dryRun?: (args: any) => Promise<ActionPreview>;
  verify?: (args: any, result: unknown) => Promise<VerificationResult>;
  undo?: (args: any, result: unknown) => Promise<UndoResult>;
  /** 过程状态行文案 */
  summarize?: (args: any) => string;
  /** 确认弹窗文案（写操作）*/
  confirmPrompt?: (args: any, preview?: ActionPreview) => ConfirmationSpec;
  run: (args: any) => Promise<unknown>;
}

// ============================================================
// 工具入参/工具内辅助
// ============================================================

function dateChoiceFromArg(value: unknown): DateChoice {
  if (
    value === 1 ||
    value === '1' ||
    value === 'tomorrow' ||
    value === '明天'
  ) {
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

function currentClassroomDayIndex(): number {
  const day = new Date().getDay();
  return day === 0 ? 7 : day;
}

function maskIdentifier(value?: string | number): string | undefined {
  const raw = value == null ? '' : String(value);
  if (!raw) {
    return undefined;
  }
  if (raw.length <= 4) {
    return '****';
  }
  return `${raw.slice(0, 2)}***${raw.slice(-2)}`;
}

function isoDateForOffset(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

function normalizeDateArg(value: unknown, fallbackOffset = 0): string {
  if (value === 'today' || value === '今天' || value == null || value === '') {
    return isoDateForOffset(fallbackOffset);
  }
  if (value === 'tomorrow' || value === '明天') {
    return isoDateForOffset(1);
  }
  const raw = String(value).trim();
  const normalized = normalizeDateString(raw);
  return normalized || isoDateForOffset(fallbackOffset);
}

function deadlineTime(value: string): number {
  const time = new Date(String(value ?? '').replace(' ', 'T')).getTime();
  return Number.isNaN(time) ? Number.MAX_SAFE_INTEGER : time;
}

function ymdFromIso(date: string): string {
  return date.replace(/-/g, '');
}

function toRoomTimestamp(date: string, time: string): string {
  const cleanTime = String(time).trim();
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(cleanTime);
  if (!match) {
    throw new Error('研读间时间必须是 HH:mm，例如 14:00');
  }
  const hour = match[1].padStart(2, '0');
  const minute = match[2];
  if (Number(minute) % 5 !== 0) {
    throw new Error('研读间预约分钟必须是 5 的倍数');
  }
  return `${date} ${hour}:${minute}:00`;
}

function parseLocalTime(date: string, time: string): Date {
  return new Date(`${date}T${time.slice(0, 5)}:00`);
}

function rangesOverlap(
  leftStart: Date,
  leftEnd: Date,
  rightStart: Date,
  rightEnd: Date,
): boolean {
  return leftStart < rightEnd && rightStart < leftEnd;
}

function sameMinute(left: Date, right: Date): boolean {
  return Math.abs(left.getTime() - right.getTime()) < 60 * 1000;
}

// ============================================================
// 读工具
// ============================================================

const getTodayTool: AgentTool = {
  name: 'get_today_overview',
  title: '今日概览',
  description:
    '获取今天的日期、星期，以及今天的课程安排和临近的待办作业（DDL）。当用户问"今天/最近有什么安排/作业"时使用。',
  parameters: {type: 'object', properties: {}},
  risk: 'read',
  permission: 'learning.overview.read',
  summarize: () => '读取今日概览',
  run: async () => {
    const snapshot = getSnapshot();
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
      2,
      '0',
    )}-${String(now.getDate()).padStart(2, '0')}`;
    const weekday = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][
      now.getDay()
    ];
    const todayClasses = (snapshot?.schedule ?? [])
      .filter(s => String(s.date).slice(0, 10) === today)
      .map(s => `${s.startTime}-${s.endTime} ${s.title} @ ${s.location}`);
    const ddls = (snapshot?.homework ?? [])
      .filter(h => !h.submitted)
      .slice(0, 10)
      .map(h => `[${h.courseName}] ${h.title} · 截止 ${h.deadline}`);
    const manualDdls = listManualDeadlines()
      .slice(0, 10)
      .map(
        h =>
          `[自建${h.courseName ? `/${h.courseName}` : ''}] ${h.title} · 截止 ${
            h.deadline
          }`,
      );
    return {
      date: today,
      weekday,
      todayClasses,
      upcomingHomework: [...ddls, ...manualDdls],
    };
  },
};

const listHomeworkTool: AgentTool = {
  name: 'list_homework',
  title: '作业列表',
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
  risk: 'read',
  permission: 'learning.homework.read',
  summarize: () => '查询作业列表',
  run: async (args: {status?: string}) => {
    const snapshot = getSnapshot();
    const status = args?.status ?? 'pending';
    let list = snapshot?.homework ?? [];
    if (status === 'pending') {
      list = list.filter(h => !h.submitted);
    } else if (status === 'submitted') {
      list = list.filter(h => h.submitted && !h.graded);
    } else if (status === 'graded') {
      list = list.filter(h => h.graded);
    }
    const homework = list.map(h => ({
      source: 'course',
      deletable: false,
      id: h.id,
      course: h.courseName,
      title: h.title,
      deadline: h.deadline,
      status: h.status,
      grade: h.grade,
    }));
    const manual =
      status === 'submitted' || status === 'graded'
        ? []
        : listManualDeadlines().map(h => ({
            source: 'manual',
            deletable: true,
            id: h.id,
            course: h.courseName,
            title: h.title,
            deadline: h.deadline,
            status: 'pending',
            note: h.note,
          }));
    const combined = [...homework, ...manual].sort(
      (a, b) => deadlineTime(a.deadline) - deadlineTime(b.deadline),
    );
    return {
      count: combined.length,
      homework: combined.slice(0, 30).map(h => ({
        ...h,
      })),
    };
  },
};

const addManualDeadlineTool: AgentTool = {
  name: 'add_manual_deadline',
  title: '添加自建 DDL',
  description:
    '添加一条用户自建 DDL/待办。只写入本地，不影响老师布置的网络学堂作业。需要明确标题和截止时间，执行前会请用户确认。',
  parameters: {
    type: 'object',
    properties: {
      title: {type: 'string', description: 'DDL 标题'},
      deadline: {
        type: 'string',
        description: '截止时间，如 2026-06-05 23:59 或 2026-06-05T23:59:00',
      },
      courseName: {type: 'string', description: '课程或分类，可选'},
      note: {type: 'string', description: '备注，可选'},
    },
    required: ['title', 'deadline'],
  },
  risk: 'write_reversible',
  permission: 'learning.deadline.write',
  requiresConfirmation: true,
  summarize: (a: any) => `添加 DDL：${a?.title ?? ''}`,
  dryRun: async (a: any) => ({
    title: '添加自建 DDL',
    summary: `${a?.deadline ?? ''} · ${a?.title ?? ''}`,
    affectedResource: a?.title,
    reversible: true,
  }),
  confirmPrompt: (a: any) => ({
    title: '确认添加自建 DDL',
    message: `${a?.deadline ?? ''}\n${a?.title ?? ''}${
      a?.courseName ? '\n' + a.courseName : ''
    }`,
  }),
  verify: async (_a: any, result: any) => {
    const id = result?.id;
    return id && findManualDeadline(String(id))
      ? {ok: true, message: '已在自建 DDL 中确认'}
      : {ok: false, message: '添加后未找到自建 DDL'};
  },
  undo: async (_a: any, result: any) => {
    const id = result?.id;
    if (!id) {
      return {ok: false, message: '缺少 DDL id，无法撤销'};
    }
    const ok = await deleteManualDeadlineById(String(id));
    return {ok, message: ok ? '已撤销新增 DDL' : '撤销失败'};
  },
  run: async (args: {
    title: string;
    deadline: string;
    courseName?: string;
    note?: string;
  }) => {
    if (!args.title?.trim() || !args.deadline?.trim()) {
      return {ok: false, message: '请提供标题和截止时间'};
    }
    const item = await appendManualDeadline({
      title: args.title,
      deadline: args.deadline,
      courseName: args.courseName,
      note: args.note,
    });
    return {ok: true, id: item.id, message: '已添加自建 DDL'};
  },
};

const removeManualDeadlineTool: AgentTool = {
  name: 'remove_manual_deadline',
  title: '删除自建 DDL',
  description:
    '删除用户自己添加的 DDL。只能删除 source=manual/deletable=true 的自建 DDL，不能删除老师布置的作业。执行前会请用户确认。',
  parameters: {
    type: 'object',
    properties: {
      idOrTitle: {type: 'string', description: '自建 DDL id 或标题关键词'},
    },
    required: ['idOrTitle'],
  },
  risk: 'write_reversible',
  permission: 'learning.deadline.write',
  requiresConfirmation: true,
  summarize: (a: any) => `删除自建 DDL：${a?.idOrTitle ?? ''}`,
  dryRun: async (a: any) => {
    const found = findManualDeadline(String(a?.idOrTitle ?? ''));
    if (!found) {
      throw new Error(`未找到匹配的自建 DDL：${a?.idOrTitle ?? ''}`);
    }
    return {
      title: '删除自建 DDL',
      summary: `${found.deadline} · ${found.title}`,
      affectedResource: found.title,
      reversible: true,
    };
  },
  confirmPrompt: (a: any) => ({
    title: '确认删除自建 DDL',
    message: `将删除：${a?.idOrTitle}\n（只能删除用户自建 DDL，不会删除老师布置的作业）`,
    destructive: true,
  }),
  verify: async (a: any) => {
    const found = findManualDeadline(String(a?.idOrTitle ?? ''));
    return found
      ? {ok: false, message: '删除后该自建 DDL 仍存在'}
      : {ok: true, message: '已确认自建 DDL 删除'};
  },
  undo: async (_a: any, result: any) => {
    const removed = result?.removed;
    if (!removed) {
      return {ok: false, message: '缺少原 DDL 内容，无法撤销'};
    }
    await appendManualDeadline({
      title: removed.title,
      deadline: removed.deadline,
      courseName: removed.courseName,
      note: removed.note,
    });
    return {ok: true, message: '已重新添加被删除的 DDL'};
  },
  run: async (args: {idOrTitle: string}) => {
    const found = findManualDeadline(args.idOrTitle);
    if (!found) {
      return {ok: false, message: `未找到匹配的自建 DDL：${args.idOrTitle}`};
    }
    const ok = await deleteManualDeadlineById(found.id);
    return ok
      ? {ok: true, message: `已删除「${found.title}」`, removed: found}
      : {ok: false, message: '删除失败'};
  },
};

const getHomeworkDetailTool: AgentTool = {
  name: 'get_homework_detail',
  title: '作业详情',
  description:
    '获取某条作业的完整详情（作业说明、附件、提交内容、批阅结果）。通过作业标题关键词或 list_homework 返回的 id 定位。',
  parameters: {
    type: 'object',
    properties: {
      titleOrId: {type: 'string', description: '作业标题关键词或作业 id'},
    },
    required: ['titleOrId'],
  },
  risk: 'read',
  permission: 'learning.homework.read',
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
  title: '成绩查询',
  description: '查询本人成绩单与学分绩（GPA）。返回各门课成绩与总体 GPA。',
  parameters: {type: 'object', properties: {}},
  risk: 'read',
  permission: 'campus.grades.read',
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
  title: '电费余额',
  description: '查询宿舍当前电费剩余电量、更新时间与房间信息。',
  parameters: {type: 'object', properties: {}},
  risk: 'read',
  permission: 'campus.electricity.read',
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

const listLaundryBuildingsTool: AgentTool = {
  name: 'list_laundry_buildings',
  title: '洗衣机楼宇列表',
  description:
    '列出可查询洗衣机状态的宿舍楼/位置。用户问哪里能查洗衣机、要选择楼栋、或未说明具体楼栋时使用。',
  parameters: {type: 'object', properties: {}},
  risk: 'read',
  permission: 'campus.laundry.read',
  summarize: () => '查询洗衣机楼宇列表',
  run: async () => {
    const groups = await getLaundryBuildings();
    return {
      groups: groups.map(group => ({
        name: group.name,
        buildings: group.buildings.map(building => ({
          id: building.id,
          name: building.name,
          platform: building.platform,
        })),
      })),
    };
  },
};

const getLaundryStatusTool: AgentTool = {
  name: 'get_laundry_status',
  title: '洗衣机状态',
  description:
    '查询某个宿舍楼/位置的洗衣机、洗鞋机、烘干机实时状态。需要 buildingId、buildingName、platform，优先来自 list_laundry_buildings 返回值。',
  parameters: {
    type: 'object',
    properties: {
      buildingId: {
        type: 'string',
        description: 'list_laundry_buildings 返回的楼宇 id',
      },
      buildingName: {
        type: 'string',
        description: '楼宇/位置名称，用于展示和二次确认来源',
      },
      platform: {
        type: 'string',
        enum: ['jieli', 'haile'],
        description: '洗衣平台，来自 list_laundry_buildings 返回值',
      },
    },
    required: ['buildingId', 'buildingName', 'platform'],
  },
  risk: 'read',
  permission: 'campus.laundry.read',
  summarize: (a: {buildingName?: string}) =>
    `查询洗衣机状态 ${a?.buildingName ?? ''}`,
  run: async (args: {
    buildingId: string;
    buildingName: string;
    platform: LaundryPlatform;
  }) => {
    const floors = await getLaundryFloors({
      id: args.buildingId,
      name: args.buildingName,
      platform: args.platform,
    });
    const machines = floors.flatMap(floor => floor.machines);
    return {
      building: {
        id: args.buildingId,
        name: args.buildingName,
        platform: args.platform,
      },
      summary: {
        total: machines.length,
        idle: machines.filter(item => item.status === 'idle').length,
        working: machines.filter(item => item.status === 'working').length,
        error: machines.filter(item => item.status === 'error').length,
      },
      floors: floors.map(floor => ({
        name: floor.name,
        machines: floor.machines.map(machine => ({
          name: machine.name,
          label: machine.location
            ? `${machine.location} ${machine.type}`
            : `${machine.name} ${machine.type}`,
          type: machine.type,
          status: machine.status,
          etaMinutes: machine.etaMinutes,
          updatedAt: machine.updatedAt,
        })),
      })),
    };
  },
};

const getCampusCardBalanceTool: AgentTool = {
  name: 'get_campus_card_balance',
  title: '校园卡余额',
  description:
    '查询校园卡余额、卡状态和最近交易时间。只读，不执行充值、挂失或密码类动作。',
  parameters: {type: 'object', properties: {}},
  risk: 'read',
  permission: 'campus.card.read',
  summarize: () => '查询校园卡余额',
  run: async () => {
    requireRealSession();
    const info = await getCampusCardInfo();
    return {
      balance: info.balance,
      unit: '元',
      cardStatus: info.cardStatus,
      departmentName: info.departmentName,
      userName: info.userName,
      cardId: maskIdentifier(info.cardId),
      lastTransactionTimestamp: info.lastTransactionTimestamp,
    };
  },
};

const getCampusCardTransactionsTool: AgentTool = {
  name: 'get_campus_card_transactions',
  title: '校园卡流水',
  description:
    '查询校园卡近期流水。start/end 为 YYYY-MM-DD；type 可选 any/consumption/recharge/subsidy。结果会限制条数。',
  parameters: {
    type: 'object',
    properties: {
      start: {type: 'string', description: '起始日期 YYYY-MM-DD，默认 7 天前'},
      end: {type: 'string', description: '结束日期 YYYY-MM-DD，默认今天'},
      type: {
        type: 'string',
        enum: ['any', 'consumption', 'recharge', 'subsidy'],
        description: '流水类型，默认 any',
      },
    },
  },
  risk: 'read',
  permission: 'campus.card.transactions.read',
  summarize: () => '查询校园卡流水',
  run: async (args: {start?: string; end?: string; type?: string}) => {
    requireRealSession();
    const typeMap: Record<string, -1 | 1 | 2 | 3> = {
      any: -1,
      consumption: 1,
      recharge: 2,
      subsidy: 3,
    };
    const end = normalizeDateArg(args.end, 0);
    const start = args.start
      ? normalizeDateArg(args.start)
      : isoDateForOffset(-7);
    const rows = await getCampusCardTransactions({
      start,
      end,
      type: typeMap[args.type ?? 'any'] ?? -1,
    });
    return {
      start,
      end,
      count: rows.length,
      transactions: rows.slice(0, 30).map(item => ({
        summary: item.summary,
        timestamp: item.timestamp,
        amount: item.amount,
        balance: item.balance,
        merchant: item.name,
        address: item.address,
        txName: item.txName,
      })),
    };
  },
};

const rechargeCampusCardTool: AgentTool = {
  name: 'recharge_campus_card',
  title: '校园卡充值',
  description:
    '用支付宝给校园卡充值。金额 10–200 元，需用户二次确认后唤起支付宝支付。先用 get_campus_card_balance 查余额再建议合适金额。',
  parameters: {
    type: 'object',
    properties: {
      amount: {type: 'number', description: '充值金额（元），10–200'},
    },
    required: ['amount'],
  },
  risk: 'write_reversible',
  permission: 'campus.card.recharge',
  requiresConfirmation: true,
  summarize: (a: any) => `校园卡充值 ${a?.amount ?? 0} 元`,
  dryRun: async (a: any) => {
    requireRealSession();
    const amount = Number(a?.amount ?? 0);
    if (amount < 10 || amount > 200) {
      throw new Error('充值金额需在 10–200 元之间');
    }
    const info = await getCampusCardInfo();
    return {
      title: '校园卡支付宝充值',
      summary: `充值 ${amount} 元（当前余额 ${info.balance.toFixed(2)} 元）`,
      affectedResource: `校园卡（${info.userName}）`,
      reversible: false,
    };
  },
  confirmPrompt: (a: any) => ({
    title: '确认校园卡充值',
    message: `将通过支付宝向校园卡充值 ${
      a?.amount ?? 0
    } 元。\n\n确认后将生成支付宝付款链接，请在支付宝 App 中完成支付。`,
  }),
  run: async (args: {amount: number}) => {
    requireRealSession();
    const amount = Number(args.amount ?? 0);
    if (amount < 10 || amount > 200) {
      return {ok: false, message: '充值金额需在 10–200 元之间'};
    }
    const result = await rechargeCampusCardAlipay(amount);
    if (result.ok && result.alipayUrl) {
      return {
        ok: true,
        message: `已生成校园卡充值 ${amount} 元的支付宝付款链接。请打开以下链接完成支付，或告诉我用其它方式付款。`,
        amount,
        alipayUrl: result.alipayUrl,
      };
    }
    return {ok: false, message: result.message};
  },
  verify: async () => {
    const info = await getCampusCardInfo();
    return {
      ok: true,
      message: `充值后校园卡余额为 ${info.balance.toFixed(2)} 元`,
    };
  },
};

const getNetworkBalanceTool: AgentTool = {
  name: 'get_network_balance',
  title: '校园网余额',
  description: '查询校园网套餐、已用流量/时长、账户余额和结算日期。',
  parameters: {type: 'object', properties: {}},
  risk: 'read',
  permission: 'campus.network.read',
  summarize: () => '查询校园网余额',
  run: async () => {
    requireRealSession();
    return getNetworkBalance();
  },
};

const getNetworkAccountInfoTool: AgentTool = {
  name: 'get_network_account_info',
  title: '校园网账号信息',
  description:
    '查询校园网账号状态、用户组、允许在线设备数等信息。手机号和邮箱会脱敏。',
  parameters: {type: 'object', properties: {}},
  risk: 'read',
  permission: 'campus.network.read',
  summarize: () => '查询校园网账号信息',
  run: async () => {
    requireRealSession();
    const info = await getNetworkAccountInfo();
    return {
      username: maskIdentifier(info.username),
      realName: info.realName,
      status: info.status,
      userGroup: info.userGroup,
      location: info.location,
      allowedDevices: info.allowedDevices,
      contactEmail: maskIdentifier(info.contactEmail),
      contactPhone: maskIdentifier(info.contactPhone),
      contactLandline: maskIdentifier(info.contactLandline),
    };
  },
};

const listNetworkDevicesTool: AgentTool = {
  name: 'list_network_devices',
  title: '校园网在线设备',
  description:
    '列出当前校园网在线设备。返回的 key 可用于 logout_network_device，IP/MAC 展示时会脱敏。',
  parameters: {type: 'object', properties: {}},
  risk: 'read',
  permission: 'campus.network.devices.read',
  summarize: () => '查询校园网在线设备',
  run: async () => {
    requireRealSession();
    const devices = await getOnlineNetworkDevices();
    return {
      count: devices.length,
      devices: devices.slice(0, 20).map(device => ({
        key: device.key,
        ip4: maskIdentifier(device.ip4),
        ip6: maskIdentifier(device.ip6),
        loggedAt: device.loggedAt,
        mac: maskIdentifier(device.mac),
        authPermission: device.authPermission,
      })),
    };
  },
};

const listSportsVenuesTool: AgentTool = {
  name: 'list_sports_venues',
  title: '体育场馆列表',
  description: '列出已接入的体育场馆项目，用于后续查询场地空闲时段。',
  parameters: {type: 'object', properties: {}},
  risk: 'read',
  permission: 'campus.sports.read',
  summarize: () => '查询体育场馆列表',
  run: async () => ({
    venues: sportsIdInfoList.map(v => ({
      name: v.name,
      gymId: v.gymId,
      itemId: v.itemId,
    })),
  }),
};

const searchSportsSlotsTool: AgentTool = {
  name: 'search_sports_slots',
  title: '体育场地空闲查询',
  description:
    '查询某体育项目某天可预约场地。可用 venueName 模糊匹配，或直接传 gymId/itemId。只查询，不预约、不支付。',
  parameters: {
    type: 'object',
    properties: {
      venueName: {type: 'string', description: '项目名，如 气膜馆羽毛球场'},
      gymId: {type: 'string'},
      itemId: {type: 'string'},
      date: {type: 'string', description: 'YYYY-MM-DD，默认今天'},
    },
  },
  risk: 'read',
  permission: 'campus.sports.read',
  summarize: (a: {venueName?: string}) => `查询体育场地：${a?.venueName ?? ''}`,
  run: async (args: {
    venueName?: string;
    gymId?: string;
    itemId?: string;
    date?: string;
  }) => {
    requireRealSession();
    const keyword = String(args.venueName ?? '').trim();
    const venue =
      args.gymId && args.itemId
        ? {
            name: keyword || '指定场馆',
            gymId: String(args.gymId),
            itemId: String(args.itemId),
          }
        : sportsIdInfoList.find(v => v.name.includes(keyword)) ??
          sportsIdInfoList.find(v => keyword.includes(v.name));
    if (!venue) {
      return {
        error: `未找到体育项目：${keyword}`,
        availableVenues: sportsIdInfoList.map(v => v.name),
      };
    }
    const date = args.date ? normalizeDateArg(args.date) : sportsDateString(0);
    const info = await getSportsResources(venue.gymId, venue.itemId, date);
    const slots = info.data
      .filter(item => item.canNetBook && !item.locked)
      .slice(0, 40)
      .map(item => ({
        resId: item.resId,
        timeSession: item.timeSession,
        fieldName: item.fieldName,
        cost: item.cost,
        overlaySize: item.overlaySize,
      }));
    return {
      venue: venue.name,
      date,
      limit: {count: info.count, init: info.init},
      availableCount: slots.length,
      slots,
    };
  },
};

const listSportsReservationRecordsTool: AgentTool = {
  name: 'list_sports_reservation_records',
  title: '体育预约记录',
  description: '查询当前账号的体育场馆预约/订单记录。只读，不执行取消或支付。',
  parameters: {type: 'object', properties: {}},
  risk: 'read',
  permission: 'campus.sports.reservation.read',
  summarize: () => '查询体育预约记录',
  run: async () => {
    requireRealSession();
    const records = await getSportsReservationRecords();
    return {
      count: records.length,
      records: records.slice(0, 20).map(item => ({
        name: item.name,
        field: item.field,
        time: item.time,
        price: item.price,
        method: item.method,
        canCancel: Boolean(item.bookId),
        hasPaymentAction: Boolean(item.payId),
      })),
    };
  },
};

const listClassroomBuildingsTool: AgentTool = {
  name: 'list_classroom_buildings',
  title: '教学楼列表',
  description:
    '列出可查询空教室状态的教学楼。用户想找空教室但没指定楼宇时，先调用此工具。',
  parameters: {type: 'object', properties: {}},
  risk: 'read',
  permission: 'campus.classroom.read',
  summarize: () => '查询教学楼列表',
  run: async () => {
    requireRealSession();
    const buildings = await fetchClassroomList();
    return {
      buildings: buildings.map(b => ({
        name: b.name,
        currentWeekNumber: b.weekNumber,
      })),
    };
  },
};

const findAvailableClassroomsTool: AgentTool = {
  name: 'find_available_classrooms',
  title: '查找空教室',
  description:
    '查询某教学楼的空教室。dayIndex 为周一=1 到周日=7；periods 为清华 6 个大节（1=08:00-09:35，2=09:50-12:15，3=13:30-15:05，4=15:20-16:55，5=17:10-18:45，6=19:20-21:45）。不传 dayIndex 默认今天，不传 periods 返回全天空闲节次数汇总。',
  parameters: {
    type: 'object',
    properties: {
      buildingName: {type: 'string', description: '教学楼名称，如 六教'},
      weekNumber: {
        type: 'number',
        description: '教学周，不传则使用教务系统当前周',
      },
      dayIndex: {type: 'number', description: '周一=1 到周日=7，默认今天'},
      periods: {
        type: 'array',
        items: {type: 'number'},
        description: '大节数组，1-6；例如下午 13:30-16:55 可传 [3,4]',
      },
    },
    required: ['buildingName'],
  },
  risk: 'read',
  permission: 'campus.classroom.read',
  summarize: (a: {buildingName?: string}) =>
    `查找空教室：${a?.buildingName ?? ''}`,
  run: async (args: {
    buildingName: string;
    weekNumber?: number;
    dayIndex?: number;
    periods?: number[];
  }) => {
    requireRealSession();
    const buildings = await fetchClassroomList();
    const keyword = String(args.buildingName ?? '').trim();
    const building =
      buildings.find(b => b.name === keyword) ??
      buildings.find(b => b.name.includes(keyword) || keyword.includes(b.name));
    if (!building) {
      return {
        error: `未找到教学楼：${keyword}`,
        availableBuildings: buildings.map(b => b.name),
      };
    }
    const weekNumber =
      args.weekNumber != null ? Number(args.weekNumber) : building.weekNumber;
    const state = await fetchClassroomState(building.searchName, weekNumber);
    const dayIndex = Math.min(
      7,
      Math.max(1, Number(args.dayIndex ?? currentClassroomDayIndex())),
    );
    const requestedPeriods = Array.isArray(args.periods)
      ? args.periods
          .map(Number)
          .filter(p => Number.isInteger(p) && p >= 1 && p <= PERIODS_PER_DAY)
      : [];
    const start = (dayIndex - 1) * PERIODS_PER_DAY;
    const slots =
      requestedPeriods.length > 0
        ? requestedPeriods.map(p => start + p - 1)
        : Array.from({length: PERIODS_PER_DAY}, (_, i) => start + i);
    const describePeriod = (period: number) =>
      CLASSROOM_PERIODS.find(p => p.period === period) ?? {
        period,
        label: `第${period}节`,
        timeRange: '',
      };
    const available = state.classroomStates
      .map(room => {
        const freePeriods = slots
          .map(slot => ({
            period: (slot % PERIODS_PER_DAY) + 1,
            free: room.status[slot] === ClassroomStatus.AVAILABLE,
          }))
          .filter(item => item.free)
          .map(item => item.period);
        const freePeriodDetails = freePeriods.map(describePeriod);
        return {
          name: room.name,
          freePeriods,
          freePeriodDetails,
          availableForRequestedRange:
            requestedPeriods.length > 0 &&
            freePeriods.length === requestedPeriods.length,
        };
      })
      .filter(room =>
        requestedPeriods.length > 0
          ? room.availableForRequestedRange
          : room.freePeriods.length > 0,
      );
    return {
      building: building.name,
      weekNumber: state.currentWeekNumber,
      dayIndex,
      date: state.datesOfCurrentWeek[dayIndex - 1],
      periodDefinitions: CLASSROOM_PERIODS,
      requestedPeriods:
        requestedPeriods.length > 0
          ? requestedPeriods.map(describePeriod)
          : '全天 1-6 大节',
      count: available.length,
      classrooms: available.slice(0, 40),
    };
  },
};

const listLibrariesTool: AgentTool = {
  name: 'list_libraries',
  title: '图书馆列表',
  description: '列出可预约座位的图书馆及其有效性。预约座位的第一步。',
  parameters: {type: 'object', properties: {}},
  risk: 'read',
  permission: 'campus.library.read',
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
  title: '图书馆楼层空位',
  description:
    '列出某图书馆各楼层及其空位数（available/total）。需先用 list_libraries 拿到 libraryId。',
  parameters: {
    type: 'object',
    properties: {
      libraryId: {type: 'number', description: '图书馆 id'},
      date: {
        type: 'string',
        enum: ['today', 'tomorrow'],
        description: '默认 today',
      },
    },
    required: ['libraryId'],
  },
  risk: 'read',
  permission: 'campus.library.read',
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
  title: '图书馆分区空位',
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
  risk: 'read',
  permission: 'campus.library.read',
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
  title: '可用座位查询',
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
  risk: 'read',
  permission: 'campus.library.read',
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
      seats: available.map(s => ({
        seatId: s.id,
        seatName: s.zhName,
        seatType: s.type,
        status: seatStatusLabel[s.status] ?? '未知',
      })),
    };
  },
};

const listLibraryBookingRecordsTool: AgentTool = {
  name: 'list_library_booking_records',
  title: '图书馆预约记录',
  description:
    '查询当前账号的图书馆座位预约记录。用户问“我预约了哪个座位/我的图书馆预约/能不能取消预约”时使用。',
  parameters: {type: 'object', properties: {}},
  risk: 'read',
  permission: 'campus.library.booking.read',
  summarize: () => '查询图书馆预约记录',
  run: async () => {
    requireRealSession();
    const records = await getLibraryBookingRecords();
    return {
      count: records.length,
      records: records.slice(0, 20),
    };
  },
};

const listLibraryRoomTypesTool: AgentTool = {
  name: 'list_library_room_types',
  title: '研读间类型列表',
  description:
    '列出可预约研读间类型及房间。查找或预约研读间前先调用它获取 kindId。',
  parameters: {type: 'object', properties: {}},
  risk: 'read',
  permission: 'campus.library.room.read',
  summarize: () => '查询研读间类型',
  run: async () => {
    requireRealSession();
    const list = await getLibraryRoomBookingInfoList();
    return {
      types: list.map(item => ({
        kindId: item.kindId,
        kindName: item.kindName,
        rooms: item.rooms.slice(0, 30).map(room => ({
          devId: room.devId,
          devName: room.devName,
          minReserveTime: room.minReserveTime,
        })),
      })),
    };
  },
};

const findLibraryRoomsTool: AgentTool = {
  name: 'find_library_rooms',
  title: '查找可用研读间',
  description:
    '查询某天某类型研读间资源。date 支持 today/tomorrow/YYYY-MM-DD；传 startTime/endTime 时会过滤出该时段可用房间。',
  parameters: {
    type: 'object',
    properties: {
      kindId: {type: 'number', description: '研读间类型 id'},
      kindName: {type: 'string', description: '类型名关键词，如 研讨间'},
      date: {
        type: 'string',
        description: 'today/tomorrow/YYYY-MM-DD，默认今天',
      },
      startTime: {type: 'string', description: 'HH:mm，可选'},
      endTime: {type: 'string', description: 'HH:mm，可选'},
    },
  },
  risk: 'read',
  permission: 'campus.library.room.read',
  summarize: () => '查找可用研读间',
  run: async (args: {
    kindId?: number;
    kindName?: string;
    date?: string;
    startTime?: string;
    endTime?: string;
  }) => {
    requireRealSession();
    const date = normalizeDateArg(args.date);
    const types = await getLibraryRoomBookingInfoList();
    const kind =
      args.kindId != null
        ? types.find(t => t.kindId === Number(args.kindId))
        : types.find(t =>
            t.kindName.includes(String(args.kindName ?? '').trim()),
          );
    if (!kind) {
      return {
        error: '未找到研读间类型',
        availableTypes: types.map(t => ({
          kindId: t.kindId,
          kindName: t.kindName,
        })),
      };
    }
    const resources = await getLibraryRoomBookingResourceList(
      ymdFromIso(date),
      kind.kindId,
    );
    const hasRange = Boolean(args.startTime && args.endTime);
    const start = hasRange
      ? parseLocalTime(date, String(args.startTime))
      : null;
    const end = hasRange ? parseLocalTime(date, String(args.endTime)) : null;
    const rooms = resources
      .filter(room => {
        if (!start || !end) {
          return true;
        }
        if (room.openStart && String(args.startTime) < room.openStart) {
          return false;
        }
        if (room.openEnd && String(args.endTime) > room.openEnd) {
          return false;
        }
        return !room.usage.some(usage =>
          rangesOverlap(start, end, usage.start, usage.end),
        );
      })
      .slice(0, 40)
      .map(room => ({
        devId: room.devId,
        devName: room.devName,
        kindId: room.kindId,
        kindName: room.kindName,
        labName: room.labName,
        roomName: room.roomName,
        minMinute: room.minMinute,
        maxMinute: room.maxMinute,
        minUser: room.minUser,
        maxUser: room.maxUser,
        openStart: room.openStart,
        openEnd: room.openEnd,
        occupied: room.usage.slice(0, 8).map(usage => ({
          start: usage.start.toISOString(),
          end: usage.end.toISOString(),
          title: usage.title,
          owner: usage.owner,
          ownerId: maskIdentifier(usage.ownerId),
        })),
      }));
    return {
      date,
      kindId: kind.kindId,
      kindName: kind.kindName,
      requestedRange: hasRange
        ? `${args.startTime}-${args.endTime}`
        : '未指定时段',
      count: rooms.length,
      rooms,
    };
  },
};

const searchLibraryRoomMembersTool: AgentTool = {
  name: 'search_library_room_members',
  title: '研读间成员搜索',
  description:
    '按姓名/学号关键词搜索研读间预约成员，返回 memberAccNo 供 book_library_room 使用。涉及他人信息，结果会脱敏。',
  parameters: {
    type: 'object',
    properties: {
      keyword: {type: 'string', description: '姓名或学号关键词'},
    },
    required: ['keyword'],
  },
  risk: 'read',
  permission: 'campus.library.room.member.read',
  summarize: () => '搜索研读间成员',
  run: async (args: {keyword: string}) => {
    requireRealSession();
    const records = await fuzzySearchLibraryId(
      String(args.keyword ?? '').trim(),
    );
    return {
      count: records.length,
      members: records.slice(0, 10).map(item => ({
        memberAccNo: item.id,
        label: maskIdentifier(item.label),
        department: item.department,
      })),
    };
  },
};

const listLibraryRoomBookingRecordsTool: AgentTool = {
  name: 'list_library_room_booking_records',
  title: '研读间预约记录',
  description: '查询未来 7 天研读间预约记录。取消预约前先调用它拿 uuid。',
  parameters: {type: 'object', properties: {}},
  risk: 'read',
  permission: 'campus.library.room.booking.read',
  summarize: () => '查询研读间预约记录',
  run: async () => {
    requireRealSession();
    const records = await getLibraryRoomBookingRecord();
    return {
      count: records.length,
      records: records.slice(0, 20).map(item => ({
        uuid: item.uuid,
        rsvId: item.rsvId,
        owner: item.owner,
        ownerId: maskIdentifier(item.ownerId),
        date: item.date,
        begin: item.begin.toISOString(),
        end: item.end.toISOString(),
        devName: item.devName,
        kindName: item.kindName,
        members: item.members.map(member => ({
          name: member.name,
          userId: maskIdentifier(member.userId),
        })),
      })),
    };
  },
};

// ============================================================
// 写工具（需确认）
// ============================================================

const bookSeatTool: AgentTool = {
  name: 'book_library_seat',
  title: '预约图书馆座位',
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
  risk: 'write_reversible',
  permission: 'campus.library.booking.write',
  requiresConfirmation: true,
  summarize: (a: any) => `预约座位 ${a?.seatName ?? a?.seatId ?? ''}`,
  dryRun: async (a: any) => {
    requireRealSession();
    const seats = await getLibrarySeatList(
      Number(a.sectionId),
      dateChoiceFromArg(a.date),
    );
    const seat = seats.find(item => item.id === Number(a.seatId));
    if (!seat) {
      throw new Error('未在该分区找到目标座位');
    }
    if (seat.status !== 1) {
      throw new Error(
        `目标座位当前状态不是可预约：${
          seatStatusLabel[seat.status] ?? seat.status
        }`,
      );
    }
    return {
      title: '预约图书馆座位',
      summary: `${a?.sectionName ? a.sectionName + ' · ' : ''}${
        a?.seatName ?? seat.zhName
      }（${a?.date === 'tomorrow' ? '明天' : '今天'}）`,
      affectedResource: a?.seatName ?? seat.zhName,
      reversible: true,
    };
  },
  confirmPrompt: (a: any) => ({
    title: '确认预约座位',
    message: `${a?.sectionName ? a.sectionName + ' · ' : ''}${
      a?.seatName ?? '座位 ' + a?.seatId
    }（${a?.date === 'tomorrow' ? '明天' : '今天'}）\n\n确认后将真实下单。`,
  }),
  verify: async (a: any, result: any) => {
    if (result?.ok === true && result?.booking) {
      return {ok: true, message: '已在预约记录中确认'};
    }
    if (result?.ok === true) {
      return {
        ok: true,
        message: '预约接口已返回成功，预约记录可能稍后刷新',
      };
    }
    const seatLabel = String(a?.seatName ?? a?.seatId ?? '');
    const records = await getLibraryBookingRecords();
    const hit = records.find(record =>
      seatLabel ? record.pos.includes(seatLabel) : Boolean(record.delId),
    );
    return hit
      ? {ok: true, message: '已在预约记录中确认'}
      : {ok: false, message: '预约后未在记录中找到该座位'};
  },
  undo: async (_a: any, result: any) => {
    const bookingId = result?.booking?.delId;
    if (!bookingId) {
      return {ok: false, message: '缺少预约取消 id，无法自动撤销'};
    }
    const cancel = await cancelLibraryBooking(String(bookingId));
    return {
      ok: cancel.status === 1,
      message: cancel.msg || '已尝试取消预约',
    };
  },
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
    if (result.status === 1) {
      const records = await getLibraryBookingRecords().catch(() => []);
      const seatLabel = String((args as any).seatName ?? args.seatId);
      const booking = records.find(record => record.pos.includes(seatLabel));
      return {ok: true, message: '预约成功', booking};
    }
    return {ok: false, message: result.msg || '预约失败'};
  },
};

const cancelLibrarySeatBookingTool: AgentTool = {
  name: 'cancel_library_seat_booking',
  title: '取消图书馆座位预约',
  description:
    '取消一个图书馆座位预约（真实操作）。bookingId 应优先使用 list_library_booking_records 返回的 delId。执行前会请用户确认。',
  parameters: {
    type: 'object',
    properties: {
      bookingId: {
        type: 'string',
        description: '预约取消 id，通常是记录里的 delId',
      },
      seatLabel: {type: 'string', description: '座位/位置描述，用于确认展示'},
      time: {type: 'string', description: '预约时间，用于确认展示'},
    },
    required: ['bookingId'],
  },
  risk: 'write_reversible',
  permission: 'campus.library.booking.write',
  requiresConfirmation: true,
  summarize: (a: any) => `取消座位预约 ${a?.seatLabel ?? a?.bookingId ?? ''}`,
  dryRun: async (a: any) => {
    requireRealSession();
    const records = await getLibraryBookingRecords();
    const bookingId = String(a.bookingId ?? '');
    const record = records.find(
      item => item.delId === bookingId || item.id === bookingId,
    );
    if (!record) {
      throw new Error('未找到要取消的图书馆座位预约');
    }
    return {
      title: '取消图书馆座位预约',
      summary: `${record.pos} · ${record.time}`,
      affectedResource: record.pos,
      reversible: false,
    };
  },
  confirmPrompt: (a: any) => ({
    title: '确认取消座位预约',
    message: `将取消图书馆座位预约：${a?.seatLabel ?? a?.bookingId}${
      a?.time ? '\n' + a.time : ''
    }\n\n取消后如需使用座位，需要重新预约。`,
    destructive: true,
  }),
  verify: async (a: any) => {
    const bookingId = String(a.bookingId ?? '');
    const records = await getLibraryBookingRecords();
    const exists = records.some(
      item => item.delId === bookingId || item.id === bookingId,
    );
    return exists
      ? {ok: false, message: '取消后该预约仍在记录中'}
      : {ok: true, message: '已确认预约记录消失'};
  },
  run: async (args: {bookingId: string}) => {
    requireRealSession();
    const result = await cancelLibraryBooking(String(args.bookingId));
    if (result.status === 1) {
      return {ok: true, message: result.msg || '已取消预约'};
    }
    return {ok: false, message: result.msg || '取消失败'};
  },
};

const logoutNetworkDeviceTool: AgentTool = {
  name: 'logout_network_device',
  title: '注销校园网设备',
  description:
    '注销一个校园网在线设备。先用 list_network_devices 获取 key，再确认执行。不会尝试重新登录设备。',
  parameters: {
    type: 'object',
    properties: {
      key: {type: 'number', description: 'list_network_devices 返回的设备 key'},
    },
    required: ['key'],
  },
  risk: 'write_reversible',
  permission: 'campus.network.devices.write',
  requiresConfirmation: true,
  summarize: (a: any) => `注销校园网设备 ${a?.key ?? ''}`,
  dryRun: async (a: any) => {
    requireRealSession();
    const devices = await getOnlineNetworkDevices();
    const device = devices.find(item => item.key === Number(a.key));
    if (!device) {
      throw new Error('未找到要注销的校园网设备');
    }
    return {
      title: '注销校园网设备',
      summary: `${device.authPermission} · ${maskIdentifier(
        device.ip4,
      )} · ${maskIdentifier(device.mac)}`,
      affectedResource: `${maskIdentifier(device.ip4)} / ${maskIdentifier(
        device.mac,
      )}`,
      reversible: false,
    };
  },
  confirmPrompt: (_a: any, preview?: ActionPreview) => ({
    title: '确认注销校园网设备',
    message:
      preview?.summary ??
      '将注销该在线设备。设备可能会立刻断网，需要用户自行重新认证。',
    destructive: true,
  }),
  verify: async (a: any) => {
    const devices = await getOnlineNetworkDevices();
    const exists = devices.some(item => item.key === Number(a.key));
    return exists
      ? {ok: false, message: '注销后设备仍在线'}
      : {ok: true, message: '已确认设备不在在线列表'};
  },
  run: async (args: {key: number}) => {
    requireRealSession();
    const devices = await getOnlineNetworkDevices();
    const device = devices.find(item => item.key === Number(args.key));
    if (!device) {
      return {ok: false, message: '未找到要注销的设备'};
    }
    return logoutNetworkDevice({key: device.key, mac: device.mac});
  },
};

const bookLibraryRoomTool: AgentTool = {
  name: 'book_library_room',
  title: '预约研读间',
  description:
    '预约一个研读间。必须来自 find_library_rooms 返回的 devId/kindId；startTime/endTime 为 HH:mm，date 为 today/tomorrow/YYYY-MM-DD。执行前会 dry-run 并确认。',
  parameters: {
    type: 'object',
    properties: {
      devId: {type: 'number'},
      kindId: {type: 'number'},
      date: {type: 'string', description: 'today/tomorrow/YYYY-MM-DD'},
      startTime: {type: 'string', description: 'HH:mm'},
      endTime: {type: 'string', description: 'HH:mm'},
      devName: {type: 'string', description: '房间名，用于确认和验证'},
      memberAccNos: {
        type: 'array',
        items: {type: 'number'},
        description: 'search_library_room_members 返回的 memberAccNo，可选',
      },
    },
    required: ['devId', 'kindId', 'date', 'startTime', 'endTime'],
  },
  risk: 'write_reversible',
  permission: 'campus.library.room.booking.write',
  requiresConfirmation: true,
  summarize: (a: any) => `预约研读间 ${a?.devName ?? a?.devId ?? ''}`,
  dryRun: async (a: any) => {
    requireRealSession();
    const date = normalizeDateArg(a.date);
    const startTs = toRoomTimestamp(date, String(a.startTime));
    const endTs = toRoomTimestamp(date, String(a.endTime));
    const start = new Date(startTs.replace(' ', 'T'));
    const end = new Date(endTs.replace(' ', 'T'));
    if (!(start < end)) {
      throw new Error('研读间预约结束时间必须晚于开始时间');
    }
    const resources = await getLibraryRoomBookingResourceList(
      ymdFromIso(date),
      Number(a.kindId),
    );
    const room = resources.find(item => item.devId === Number(a.devId));
    if (!room) {
      throw new Error('未找到目标研读间资源');
    }
    const minutes = Math.round((end.getTime() - start.getTime()) / 60000);
    if (room.minMinute && minutes < room.minMinute) {
      throw new Error(`预约时长不能少于 ${room.minMinute} 分钟`);
    }
    if (room.maxMinute && minutes > room.maxMinute) {
      throw new Error(`预约时长不能超过 ${room.maxMinute} 分钟`);
    }
    const userCount =
      1 + (Array.isArray(a.memberAccNos) ? a.memberAccNos.length : 0);
    if (room.minUser && userCount < room.minUser) {
      throw new Error(`该研读间至少需要 ${room.minUser} 人`);
    }
    if (room.maxUser && userCount > room.maxUser) {
      throw new Error(`该研读间最多允许 ${room.maxUser} 人`);
    }
    if (
      room.usage.some(usage =>
        rangesOverlap(start, end, usage.start, usage.end),
      )
    ) {
      throw new Error('该时段已被占用');
    }
    return {
      title: '预约研读间',
      summary: `${room.devName} · ${date} ${a.startTime}-${a.endTime} · ${userCount} 人`,
      affectedResource: room.devName,
      reversible: true,
    };
  },
  confirmPrompt: (_a: any, preview?: ActionPreview) => ({
    title: '确认预约研读间',
    message: `${
      preview?.summary ?? '将预约研读间'
    }\n\n预约占用公共资源，确认后会真实提交。`,
  }),
  verify: async (a: any, result: any) => {
    const date = normalizeDateArg(a.date);
    const start = new Date(
      toRoomTimestamp(date, String(a.startTime)).replace(' ', 'T'),
    );
    const end = new Date(
      toRoomTimestamp(date, String(a.endTime)).replace(' ', 'T'),
    );
    const records = await getLibraryRoomBookingRecord();
    const found = records.find(record => {
      if (result?.recordUuid && record.uuid === result.recordUuid) {
        return true;
      }
      return (
        (!a.devName || record.devName.includes(String(a.devName))) &&
        sameMinute(record.begin, start) &&
        sameMinute(record.end, end)
      );
    });
    return found
      ? {ok: true, message: '已在研读间预约记录中确认'}
      : {ok: false, message: '预约后未在研读间记录中找到该预约'};
  },
  undo: async (_a: any, result: any) => {
    const uuid = result?.recordUuid;
    if (!uuid) {
      return {ok: false, message: '缺少研读间预约 uuid，无法自动撤销'};
    }
    return cancelLibraryRoomBooking(String(uuid));
  },
  run: async (args: {
    devId: number;
    kindId: number;
    date: string;
    startTime: string;
    endTime: string;
    devName?: string;
    memberAccNos?: number[];
  }) => {
    requireRealSession();
    const date = normalizeDateArg(args.date);
    const start = toRoomTimestamp(date, args.startTime);
    const end = toRoomTimestamp(date, args.endTime);
    const result = await bookLibraryRoomService({
      devId: Number(args.devId),
      start,
      end,
      memberAccNos: Array.isArray(args.memberAccNos)
        ? args.memberAccNos.map(Number)
        : [],
    });
    const records = await getLibraryRoomBookingRecord().catch(() => []);
    const startDate = new Date(start.replace(' ', 'T'));
    const endDate = new Date(end.replace(' ', 'T'));
    const record = records.find(
      item =>
        (args.devName ? item.devName.includes(args.devName) : true) &&
        sameMinute(item.begin, startDate) &&
        sameMinute(item.end, endDate),
    );
    return {
      ...result,
      recordUuid: record?.uuid,
      recordDevName: record?.devName,
    };
  },
};

const cancelLibraryRoomBookingTool: AgentTool = {
  name: 'cancel_library_room_booking',
  title: '取消研读间预约',
  description:
    '取消研读间预约。先用 list_library_room_booking_records 获取 uuid，再确认执行。',
  parameters: {
    type: 'object',
    properties: {
      uuid: {type: 'string', description: '研读间预约 uuid'},
      roomLabel: {type: 'string', description: '房间/时间描述，用于确认展示'},
    },
    required: ['uuid'],
  },
  risk: 'write_reversible',
  permission: 'campus.library.room.booking.write',
  requiresConfirmation: true,
  summarize: (a: any) => `取消研读间预约 ${a?.roomLabel ?? a?.uuid ?? ''}`,
  dryRun: async (a: any) => {
    requireRealSession();
    const records = await getLibraryRoomBookingRecord();
    const record = records.find(item => item.uuid === String(a.uuid));
    if (!record) {
      throw new Error('未找到要取消的研读间预约');
    }
    return {
      title: '取消研读间预约',
      summary: `${
        record.devName
      } · ${record.begin.toLocaleString()}-${record.end.toLocaleTimeString()}`,
      affectedResource: record.devName,
      reversible: false,
    };
  },
  confirmPrompt: (_a: any, preview?: ActionPreview) => ({
    title: '确认取消研读间预约',
    message: `${
      preview?.summary ?? '将取消研读间预约'
    }\n\n取消后如需使用，需要重新预约。`,
    destructive: true,
  }),
  verify: async (a: any) => {
    const records = await getLibraryRoomBookingRecord();
    const exists = records.some(item => item.uuid === String(a.uuid));
    return exists
      ? {ok: false, message: '取消后该研读间预约仍在记录中'}
      : {ok: true, message: '已确认研读间预约记录消失'};
  },
  run: async (args: {uuid: string}) => {
    requireRealSession();
    return cancelLibraryRoomBooking(String(args.uuid));
  },
};

const listPersonalEventsTool: AgentTool = {
  name: 'list_personal_events',
  title: '个人备忘列表',
  description:
    '列出用户自建备忘日程（不含教务课表）。可按 startDate/endDate（YYYY-MM-DD）筛选；不传则默认本周。',
  parameters: {
    type: 'object',
    properties: {
      startDate: {type: 'string', description: '起始日期 YYYY-MM-DD'},
      endDate: {type: 'string', description: '结束日期 YYYY-MM-DD'},
    },
  },
  risk: 'read',
  permission: 'schedule.personal.read',
  summarize: () => '查询个人备忘日程',
  run: async (args: {startDate?: string; endDate?: string}) => {
    let start = args.startDate ? normalizeDateString(args.startDate) : '';
    let end = args.endDate ? normalizeDateString(args.endDate) : '';
    if (!start && !end) {
      const week = weekDatesContaining(todayLocalISO(), 0);
      start = week[0];
      end = week[6];
    }
    const events = listPersonalEventsInRange(
      start || undefined,
      end || undefined,
    );
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
  title: '周日程',
  description:
    '获取某周合并后的日程：教务课表 + 用户备忘。weekOffset：0=本周，1=下周，-1=上周。用于回答"这周/下周有什么安排"。',
  parameters: {
    type: 'object',
    properties: {
      weekOffset: {type: 'number', description: '相对本周偏移，默认 0'},
    },
  },
  risk: 'read',
  permission: 'schedule.read',
  summarize: (a: {weekOffset?: number}) =>
    `读取${
      a?.weekOffset === 0 || a?.weekOffset === undefined ? '本' : ''
    }周日程`,
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
  title: '添加个人备忘',
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
  risk: 'write_reversible',
  permission: 'schedule.personal.write',
  requiresConfirmation: true,
  summarize: (a: any) => `添加备忘：${a?.title ?? ''}`,
  dryRun: async (a: any) => ({
    title: '添加个人备忘',
    summary: `${normalizeDateString(a?.date)} ${a?.startTime}-${a?.endTime} · ${
      a?.title ?? ''
    }`,
    affectedResource: a?.title,
    reversible: true,
  }),
  confirmPrompt: (a: any) => ({
    title: '确认添加备忘',
    message: `${a?.date} ${a?.startTime}-${a?.endTime}\n${a?.title}${
      a?.location ? '\n' + a.location : ''
    }`,
  }),
  verify: async (_a: any, result: any) => {
    const id = result?.id;
    return id && findPersonalEvent(String(id))
      ? {ok: true, message: '已在个人备忘中确认'}
      : {ok: false, message: '添加后未找到个人备忘'};
  },
  undo: async (_a: any, result: any) => {
    const id = result?.id;
    if (!id) {
      return {ok: false, message: '缺少备忘 id，无法撤销'};
    }
    const ok = await deletePersonalEventById(String(id));
    return {ok, message: ok ? '已撤销新增备忘' : '撤销失败'};
  },
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
  title: '删除个人备忘',
  description:
    '删除一条用户自建备忘。用 list_personal_events 返回的 id，或标题关键词匹配。不能删除教务课表。执行前会请用户确认。',
  parameters: {
    type: 'object',
    properties: {
      idOrTitle: {type: 'string', description: '备忘 id 或标题关键词'},
    },
    required: ['idOrTitle'],
  },
  risk: 'write_reversible',
  permission: 'schedule.personal.write',
  requiresConfirmation: true,
  summarize: (a: any) => `删除备忘：${a?.idOrTitle ?? ''}`,
  dryRun: async (a: any) => {
    const found = findPersonalEvent(String(a?.idOrTitle ?? ''));
    if (!found) {
      throw new Error(`未找到匹配备忘：${a?.idOrTitle ?? ''}`);
    }
    return {
      title: '删除个人备忘',
      summary: `${found.date} ${found.startTime}-${found.endTime} · ${found.title}`,
      affectedResource: found.title,
      reversible: true,
    };
  },
  confirmPrompt: (a: any) => ({
    title: '确认删除备忘',
    message: `将删除：${a?.idOrTitle}\n（仅删除自建备忘，不影响教务课表）`,
  }),
  verify: async (a: any) => {
    const found = findPersonalEvent(String(a?.idOrTitle ?? ''));
    return found
      ? {ok: false, message: '删除后该备忘仍存在'}
      : {ok: true, message: '已确认备忘删除'};
  },
  undo: async (_a: any, result: any) => {
    const removed = result?.removed;
    if (!removed) {
      return {ok: false, message: '缺少原备忘内容，无法撤销'};
    }
    await appendPersonalEvent({
      date: removed.date,
      title: removed.title,
      startTime: removed.startTime,
      endTime: removed.endTime,
      location: removed.location,
      note: removed.note,
    });
    return {ok: true, message: '已重新添加被删除的备忘'};
  },
  run: async (args: {idOrTitle: string}) => {
    const found = findPersonalEvent(args.idOrTitle);
    if (!found) {
      return {ok: false, message: `未找到匹配备忘：${args.idOrTitle}`};
    }
    const ok = await deletePersonalEventById(found.id);
    return ok
      ? {ok: true, message: `已删除「${found.title}」`, removed: found}
      : {ok: false, message: '删除失败'};
  },
};

const rememberTool: AgentTool = {
  name: 'remember_preference',
  title: '更新长期偏好记忆',
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
  risk: 'write_reversible',
  permission: 'ai.memory.write',
  requiresConfirmation: true,
  summarize: () => '更新个性化记忆',
  dryRun: async (a: any) => ({
    title: '更新长期偏好记忆',
    summary: JSON.stringify(a ?? {}),
    affectedResource: '本机 AI 记忆',
    reversible: true,
  }),
  confirmPrompt: (a: any) => ({
    title: '确认更新记忆',
    message: `将记住这些长期偏好：${JSON.stringify(a ?? {})}`,
  }),
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

const getDegreeProgramCompletionTool: AgentTool = {
  name: 'get_degree_program_completion',
  title: '毕业进度查询',
  description:
    '查询培养方案完成进度，包括已修学分、必修/限选/选修完成情况、课程组状态等。回答"我还差多少学分毕业"之类的问题。',
  parameters: {type: 'object', properties: {}},
  risk: 'read',
  permission: 'campus.program.read',
  summarize: () => '查询培养方案完成进度',
  run: async () => {
    requireRealSession();
    const prog = await getDegreeProgramCompletion();
    return {
      completedCredit: prog.completedCredit,
      compulsoryCredit: prog.compulsoryCredit,
      restrictedCredit: prog.restrictedCredit,
      electiveCredit: prog.electiveCredit,
      courseSets: prog.courseSet.slice(0, 50).map(set => ({
        name: set.setName,
        type: set.type,
        requiredCredit: set.requiredCredit,
        completedCredit: set.completedCredit,
        fullCompleted: set.fullCompleted,
        courseCount: set.course.length,
      })),
    };
  },
};

const getFullDegreeProgramTool: AgentTool = {
  name: 'get_full_degree_program',
  title: '完整培养方案',
  description:
    '获取完整的培养方案课程列表，包括所有必修课组的课程清单。回答"我还需要选什么课"之类的问题。',
  parameters: {
    type: 'object',
    properties: {
      degreeId: {type: 'number', description: '可选，指定学位 ID'},
    },
  },
  risk: 'read',
  permission: 'campus.program.read',
  summarize: () => '获取完整培养方案',
  run: async (args: {degreeId?: number}) => {
    requireRealSession();
    const prog = await getFullDegreeProgram(args.degreeId);
    return {
      courseSets: prog.courseSet.slice(0, 50).map(set => ({
        name: set.setName,
        type: set.type,
        courses: set.course.map(c => ({
          id: c.id,
          name: c.name,
          credit: c.credit,
        })),
      })),
    };
  },
};

const getNewsListTool: AgentTool = {
  name: 'get_news_list',
  title: '校园新闻列表',
  description:
    '获取最新的校园新闻列表，支持按频道筛选。回答"最近有什么新闻"之类的问题。',
  parameters: {
    type: 'object',
    properties: {
      page: {type: 'number', description: '页码，默认 1'},
      length: {type: 'number', description: '每页条数，默认 20'},
      channel: {
        type: 'string',
        description: '频道标签，如 LM_JWGG（教务通知）',
      },
    },
  },
  risk: 'read',
  permission: 'campus.news.read',
  summarize: () => '获取校园新闻',
  run: async (args: {page?: number; length?: number; channel?: string}) => {
    requireRealSession();
    const list = await getNewsList(
      args.page || 1,
      args.length || 20,
      args.channel as any,
    );
    return {
      count: list.length,
      news: list.slice(0, 30).map(n => ({
        title: n.name,
        date: n.date,
        source: n.source,
        channel: n.channel,
        topped: n.topped,
      })),
    };
  },
};

const searchNewsTool: AgentTool = {
  name: 'search_news',
  title: '搜索新闻',
  description:
    '按关键词搜索校园新闻，支持按频道筛选。回答"找关于XX的新闻"之类的问题。',
  parameters: {
    type: 'object',
    properties: {
      key: {type: 'string', description: '搜索关键词'},
      page: {type: 'number', description: '页码，默认 1'},
      channel: {type: 'string', description: '频道标签，可选'},
      exactMatch: {type: 'boolean', description: '是否精确匹配，默认 false'},
    },
    required: ['key'],
  },
  risk: 'read',
  permission: 'campus.news.read',
  summarize: (a: {key?: string}) => `搜索新闻：${a?.key || ''}`,
  run: async (args: {
    key: string;
    page?: number;
    channel?: string;
    exactMatch?: boolean;
  }) => {
    requireRealSession();
    const list = await searchNewsList(
      args.page || 1,
      args.key,
      args.channel as any,
      args.exactMatch,
    );
    return {
      count: list.length,
      news: list.slice(0, 30).map(n => ({
        title: n.name,
        date: n.date,
        source: n.source,
      })),
    };
  },
};

const selectCourseTool: AgentTool = {
  name: 'select_course',
  title: '选课',
  description:
    '提交选课志愿。根据课余量查询结果选择课程，需指定选课类型和志愿等级。这是高风险操作，执行前必须经过用户确认。',
  parameters: {
    type: 'object',
    properties: {
      semesterId: {type: 'string', description: '学期 ID'},
      priority: {
        type: 'string',
        enum: ['bx', 'xx', 'rx', 'ty', 'xwk', 'fxwk', 'tyk', 'cx'],
        description:
          '选课类型：bx=必修, xx=限选, rx=任选, ty=体育, xwk=限选课PF, fxwk=非限选课PF, tyk=体育课PF, cx=重修',
      },
      courseId: {type: 'string', description: '课程号'},
      courseSeq: {type: 'string', description: '课序号'},
      will: {
        type: 'number',
        enum: [1, 2, 3],
        description: '志愿等级：1=第一志愿, 2=第二志愿, 3=第三志愿',
      },
    },
    required: ['semesterId', 'priority', 'courseId', 'courseSeq', 'will'],
  },
  risk: 'write_irreversible',
  permission: 'campus.course.write',
  requiresConfirmation: true,
  summarize: (a: {courseId?: string; courseSeq?: string}) =>
    `选课：${a?.courseId || ''}-${a?.courseSeq || ''}`,
  dryRun: async (a: {
    semesterId: string;
    priority: Priority;
    courseId: string;
    courseSeq: string;
    will: number;
  }) => {
    requireRealSession();
    const result = await searchCrRemaining({
      semester: a.semesterId,
      id: a.courseId,
    });
    const matched = result.courses.find(
      c => c.id === a.courseId && c.seq === Number(a.courseSeq),
    );
    if (!matched) {
      throw new Error('未找到该课程');
    }
    if (matched.remaining <= 0) {
      throw new Error('该课程已无课余量');
    }
    const priorityLabels: Record<string, string> = {
      bx: '必修',
      xx: '限选',
      rx: '任选',
      ty: '体育',
      xwk: '限选课PF',
      fxwk: '非限选课PF',
      tyk: '体育课PF',
      cx: '重修',
    };
    const willLabels: Record<number, string> = {
      1: '第一志愿',
      2: '第二志愿',
      3: '第三志愿',
    };
    return {
      title: '提交选课志愿',
      summary: `${matched.name} · ${
        priorityLabels[a.priority] || a.priority
      } · ${willLabels[a.will] || a.will}`,
      affectedResource: matched.name,
      reversible: false,
    };
  },
  confirmPrompt: (_a: any, preview?: ActionPreview) => ({
    title: '确认选课',
    message: `${
      preview?.summary || '该课程'
    }\n\n选课操作不可撤销，确认后将提交选课志愿。`,
  }),
  run: async (args: {
    semesterId: string;
    priority: Priority;
    courseId: string;
    courseSeq: string;
    will: number;
  }) => {
    requireRealSession();
    const msg = await selectCourse(
      args.semesterId,
      args.priority as Priority,
      args.courseId,
      args.courseSeq,
      args.will as Will,
    );
    return {ok: true, message: msg};
  },
};

const getSelectedCoursesTool: AgentTool = {
  name: 'get_selected_courses',
  title: '已选课程列表',
  description: '获取当前学期已选的所有课程列表。回答"我选了什么课"之类的问题。',
  parameters: {
    type: 'object',
    properties: {
      semesterId: {type: 'string', description: '学期 ID，可选，默认当前学期'},
    },
  },
  risk: 'read',
  permission: 'campus.course.read',
  summarize: () => '获取已选课程',
  run: async (args: {semesterId?: string}) => {
    requireRealSession();
    const semesters = await getCrAvailableSemesters();
    const targetSem = args.semesterId || semesters[0]?.id;
    if (!targetSem) {
      throw new Error('未找到可用学期');
    }
    const courses = await getSelectedCourses(targetSem);
    return {
      semesterId: targetSem,
      semesterName: semesters.find(s => s.id === targetSem)?.name,
      count: courses.length,
      courses: courses.map(c => ({
        type: c.type,
        will: c.will,
        id: c.id,
        seq: c.seq,
        name: c.name,
        teacher: c.teacher,
        time: c.time,
        credit: c.credit,
      })),
    };
  },
};

const dropCourseTool: AgentTool = {
  name: 'drop_course',
  title: '退课',
  description: '删除已选的课程。这是高风险操作，执行前必须经过用户确认。',
  parameters: {
    type: 'object',
    properties: {
      courseId: {type: 'string', description: '课程号'},
      courseSeq: {type: 'string', description: '课序号'},
      semesterId: {type: 'string', description: '学期 ID，可选，默认当前学期'},
    },
    required: ['courseId', 'courseSeq'],
  },
  risk: 'write_irreversible',
  permission: 'campus.course.write',
  requiresConfirmation: true,
  summarize: (a: {courseId?: string; courseSeq?: string; name?: string}) =>
    `退课：${a?.name || a?.courseId || ''}`,
  dryRun: async (a: {
    courseId: string;
    courseSeq: string;
    semesterId?: string;
  }) => {
    requireRealSession();
    const semesters = await getCrAvailableSemesters();
    const targetSem = a.semesterId || semesters[0]?.id;
    if (!targetSem) {
      throw new Error('未找到可用学期');
    }
    const courses = await getSelectedCourses(targetSem);
    const course = courses.find(
      c => c.id === a.courseId && c.seq === a.courseSeq,
    );
    if (!course) {
      throw new Error('未找到该已选课程');
    }
    return {
      title: '确认退课',
      summary: `${course.name} (${course.id} - ${course.seq})`,
      affectedResource: course.name,
      reversible: false,
    };
  },
  confirmPrompt: (_a: any, preview?: ActionPreview) => ({
    title: '确认退课',
    message: `${
      preview?.summary || '该课程'
    }\n\n退课操作不可撤销，请确认后再执行。`,
    destructive: true,
  }),
  verify: async (args: {
    courseId: string;
    courseSeq: string;
    semesterId?: string;
  }) => {
    requireRealSession();
    const semesters = await getCrAvailableSemesters();
    const targetSem = args.semesterId || semesters[0]?.id;
    if (!targetSem) {
      return {ok: false, message: '未找到可用学期'};
    }
    const courses = await getSelectedCourses(targetSem);
    const course = courses.find(
      c => c.id === args.courseId && c.seq === args.courseSeq,
    );
    return course
      ? {ok: false, message: '课程仍在已选列表中'}
      : {ok: true, message: '退课成功'};
  },
  run: async (args: {
    courseId: string;
    courseSeq: string;
    semesterId?: string;
  }) => {
    requireRealSession();
    const semesters = await getCrAvailableSemesters();
    const targetSem = args.semesterId || semesters[0]?.id;
    if (!targetSem) {
      throw new Error('未找到可用学期');
    }
    const result = await deleteCourse(targetSem, args.courseId, args.courseSeq);
    return {success: true, message: result};
  },
};

export const AGENT_TOOLS: AgentTool[] = [
  getTodayTool,
  getWeekScheduleTool,
  listPersonalEventsTool,
  addPersonalEventTool,
  removePersonalEventTool,
  listHomeworkTool,
  addManualDeadlineTool,
  removeManualDeadlineTool,
  getHomeworkDetailTool,
  getGradesTool,
  getElectricityTool,
  listLaundryBuildingsTool,
  getLaundryStatusTool,
  getCampusCardBalanceTool,
  getCampusCardTransactionsTool,
  rechargeCampusCardTool,
  getNetworkBalanceTool,
  getNetworkAccountInfoTool,
  listNetworkDevicesTool,
  logoutNetworkDeviceTool,
  listSportsVenuesTool,
  searchSportsSlotsTool,
  listSportsReservationRecordsTool,
  listClassroomBuildingsTool,
  findAvailableClassroomsTool,
  listLibrariesTool,
  listFloorsTool,
  listSectionsTool,
  findSeatsTool,
  listLibraryBookingRecordsTool,
  listLibraryRoomTypesTool,
  findLibraryRoomsTool,
  searchLibraryRoomMembersTool,
  listLibraryRoomBookingRecordsTool,
  bookSeatTool,
  cancelLibrarySeatBookingTool,
  bookLibraryRoomTool,
  cancelLibraryRoomBookingTool,
  rememberTool,
  getDegreeProgramCompletionTool,
  getFullDegreeProgramTool,
  getNewsListTool,
  searchNewsTool,
  getSelectedCoursesTool,
  selectCourseTool,
  dropCourseTool,
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
