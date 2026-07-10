export type WorkflowConditionType =
  | 'electricity_balance'
  | 'network_balance'
  | 'course_capacity'
  | 'ddl_reminder'
  | 'schedule_reminder'
  | 'sports_slot'
  | 'library_room'
  | 'library_seat';

export interface WorkflowCondition {
  type: WorkflowConditionType;
  params: Record<string, unknown>;
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  condition: WorkflowCondition;
  message: string;
  createdAt: string;
  updatedAt: string;
  lastCheckedAt?: string;
  lastTriggeredAt?: string;
  lastResult?: WorkflowLastResult;
  notifyOnce: boolean;
}

export type WorkflowCheckStatus = 'ok' | 'triggered' | 'unavailable' | 'error';

export interface WorkflowLastResult {
  status: WorkflowCheckStatus;
  checkedAt: string;
  message?: string;
  detail?: string;
}

export type WorkflowCheckResult = {
  workflowId: string;
  triggered: boolean;
  status: WorkflowCheckStatus;
  checkedAt: string;
  message: string;
  detail?: string;
};

export function generateWorkflowId(): string {
  return `wf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export const PRESET_WORKFLOWS: Omit<Workflow, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: '电费余额预警',
    description: '当宿舍电费余额低于 20 元时提醒充值',
    enabled: false,
    condition: {type: 'electricity_balance', params: {threshold: 20}},
    message: '宿舍电费余额不足，建议尽快充值',
    notifyOnce: true,
  },
  {
    name: '校园网余额预警',
    description: '当校园网余额低于 10 元时提醒',
    enabled: false,
    condition: {type: 'network_balance', params: {threshold: 10}},
    message: '校园网余额不足，建议尽快充值',
    notifyOnce: true,
  },
  {
    name: '课程余量关注',
    description: '当关注课程的课余量发生变化时提醒',
    enabled: false,
    condition: {type: 'course_capacity', params: {}},
    message: '你关注的课程课余量有变化，请检查选课系统',
    notifyOnce: false,
  },
  {
    name: '今日课程提醒',
    description: '每天早上提醒今日课程安排',
    enabled: false,
    condition: {type: 'schedule_reminder', params: {time: '08:00'}},
    message: '新的一天！打开 Campus OS 查看今日课程和待办事项',
    notifyOnce: false,
  },
  {
    name: 'DDL 预警',
    description: '当有即将到期的作业时提醒',
    enabled: false,
    condition: {type: 'ddl_reminder', params: {daysAhead: 1}},
    message: '你有即将到期的作业，请及时提交',
    notifyOnce: true,
  },
  {
    name: '体育场馆空位提醒',
    description: '当体育场馆有空位时提醒',
    enabled: false,
    condition: {type: 'sports_slot', params: {}},
    message: '你关注的体育场馆有空位了！',
    notifyOnce: false,
  },
  {
    name: '研读间预约提醒',
    description: '当有研读间可预约时提醒',
    enabled: false,
    condition: {type: 'library_room', params: {}},
    message: '有研读间可预约了！',
    notifyOnce: false,
  },
  {
    name: '图书馆座位提醒',
    description: '当图书馆有可用座位时提醒',
    enabled: false,
    condition: {type: 'library_seat', params: {}},
    message: '图书馆有可用座位了！',
    notifyOnce: false,
  },
];
