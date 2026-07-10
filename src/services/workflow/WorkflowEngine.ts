import {
  Workflow,
  WorkflowCheckResult,
  WorkflowConditionType,
  WorkflowCheckStatus,
} from '../../domain/workflow';
import {loadWorkflows, updateWorkflow} from '../../storage/workflowStorage';
import {showLocalNotification} from '../notification/notificationService';
import {store} from '../../state/store';
import {selectTodaySchedule} from '../../state/selectors';
import {getEleRemainder} from '../campus/electricity';
import {getNetworkBalance} from '../campus/network';

type CheckFn = (wf: Workflow) => Promise<WorkflowCheckResult>;

const AVAILABLE_CHECKERS = new Set<WorkflowConditionType>([
  'electricity_balance',
  'network_balance',
  'schedule_reminder',
  'ddl_reminder',
]);

const UNAVAILABLE_REASONS: Partial<Record<WorkflowConditionType, string>> = {
  course_capacity: '课程余量监控需要先持久化关注课程与选课系统查询条件。',
  sports_slot: '体育场馆空位监控需要先补齐关注场馆、日期和时段配置。',
  library_room: '研读间监控需要先补齐成员、日期和资源偏好配置。',
  library_seat: '座位监控需要先补齐关注馆区、楼层和时段配置。',
};

export function isWorkflowCheckerAvailable(type: WorkflowConditionType | string): boolean {
  return AVAILABLE_CHECKERS.has(type as WorkflowConditionType);
}

export function getWorkflowUnavailableReason(type: WorkflowConditionType | string): string {
  return (
    UNAVAILABLE_REASONS[type as WorkflowConditionType] ??
    '该监控条件暂未接入实时检查。'
  );
}

function workflowResult(
  wf: Workflow,
  status: WorkflowCheckStatus,
  triggered: boolean,
  message: string,
  detail?: string,
): WorkflowCheckResult {
  return {
    workflowId: wf.id,
    triggered,
    status,
    checkedAt: new Date().toISOString(),
    message,
    detail,
  };
}

function okResult(wf: Workflow, detail?: string): WorkflowCheckResult {
  return workflowResult(wf, 'ok', false, '状态正常', detail);
}

function triggeredResult(wf: Workflow, detail?: string): WorkflowCheckResult {
  return workflowResult(wf, 'triggered', true, wf.message, detail);
}

function errorResult(wf: Workflow, error: unknown): WorkflowCheckResult {
  const detail = error instanceof Error ? error.message : '检查失败';
  return workflowResult(wf, 'error', false, '检查失败', detail);
}

function unavailableResult(wf: Workflow): WorkflowCheckResult {
  return workflowResult(
    wf,
    'unavailable',
    false,
    '暂不可用',
    getWorkflowUnavailableReason(wf.condition.type),
  );
}

async function checkElectricityBalance(wf: Workflow): Promise<WorkflowCheckResult> {
  try {
    const threshold = (wf.condition.params.threshold as number) ?? 20;
    const result = await getEleRemainder();
    const balance = result.remainder;
    if (balance < threshold) {
      return triggeredResult(
        wf,
        `当前余额：${result.remainder} 度，阈值：${threshold} 度`,
      );
    }
    return okResult(wf, `当前余额：${result.remainder} 度，阈值：${threshold} 度`);
  } catch (error) {
    return errorResult(wf, error);
  }
}

async function checkNetworkBalance(wf: Workflow): Promise<WorkflowCheckResult> {
  try {
    const threshold = (wf.condition.params.threshold as number) ?? 10;
    const result = await getNetworkBalance();
    const balance = parseFloat(result.accountBalance);
    if (!isNaN(balance) && balance < threshold) {
      return triggeredResult(
        wf,
        `当前余额：${result.accountBalance} 元，阈值：${threshold} 元`,
      );
    }
    return okResult(wf, `当前余额：${result.accountBalance} 元，阈值：${threshold} 元`);
  } catch (error) {
    return errorResult(wf, error);
  }
}

async function checkScheduleReminder(wf: Workflow): Promise<WorkflowCheckResult> {
  try {
    const seen = new Set<string>();
    const todayCourses = selectTodaySchedule(store.getState()).filter(course => {
      const key = [
        course.title,
        course.startTime,
        course.endTime,
        course.location,
      ].join('|');
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });

    if (todayCourses.length > 0) {
      const courseNames = todayCourses.map(c => c.title).slice(0, 3).join('、');
      return triggeredResult(
        wf,
        `今日课程：${courseNames}${
          todayCourses.length > 3 ? ` 等 ${todayCourses.length} 节课` : ''
        }`,
      );
    }
    return okResult(wf, '今日暂无课程。');
  } catch (error) {
    return errorResult(wf, error);
  }
}

async function checkDdlReminder(wf: Workflow): Promise<WorkflowCheckResult> {
  try {
    const daysAhead = (wf.condition.params.daysAhead as number) ?? 1;
    const snapshot = store.getState().learning.snapshot;
    const manualDeadlines = store.getState().manualDeadlines.items;
    const homeworkList = [
      ...(snapshot.homework ?? []).map(item => ({
        title: item.title,
        deadline: item.deadline,
        submitted: item.submitted,
      })),
      ...manualDeadlines.map(item => ({
        title: item.title,
        deadline: item.deadline,
        submitted: false,
      })),
    ];
    const now = Date.now();
    const threshold = now + daysAhead * 24 * 60 * 60 * 1000;
    const upcoming = homeworkList
      .filter(h => {
        if (!h.deadline || h.submitted) return false;
        const dl = new Date(h.deadline).getTime();
        return !isNaN(dl) && dl > now && dl < threshold;
      })
      .slice(0, 3);

    if (upcoming.length > 0) {
      const names = upcoming.map(d => d.title).join('、');
      return triggeredResult(wf, `即将到期：${names}`);
    }
    return okResult(wf, `未来 ${daysAhead} 天暂无即将到期的作业。`);
  } catch (error) {
    return errorResult(wf, error);
  }
}

async function checkCourseCapacity(wf: Workflow): Promise<WorkflowCheckResult> {
  return unavailableResult(wf);
}

async function checkSportsSlot(wf: Workflow): Promise<WorkflowCheckResult> {
  return unavailableResult(wf);
}

async function checkLibraryRoom(wf: Workflow): Promise<WorkflowCheckResult> {
  return unavailableResult(wf);
}

async function checkLibrarySeat(wf: Workflow): Promise<WorkflowCheckResult> {
  return unavailableResult(wf);
}

const CHECKERS: Record<string, CheckFn> = {
  electricity_balance: checkElectricityBalance,
  network_balance: checkNetworkBalance,
  schedule_reminder: checkScheduleReminder,
  ddl_reminder: checkDdlReminder,
  course_capacity: checkCourseCapacity,
  sports_slot: checkSportsSlot,
  library_room: checkLibraryRoom,
  library_seat: checkLibrarySeat,
};

let lastCheckTime: number = 0;
const MIN_CHECK_INTERVAL_MS = 30000;
let isRunning = false;
const triggeredCache = new Set<string>();
const CACHE_EXPIRE_MS = 5 * 60 * 1000;

function getWorkflowCacheKey(wf: Workflow): string {
  return `${wf.id}_${wf.condition.type}`;
}

export async function runWorkflowChecks(): Promise<WorkflowCheckResult[]> {
  const now = Date.now();
  if (isRunning || now - lastCheckTime < MIN_CHECK_INTERVAL_MS) {
    return [];
  }
  isRunning = true;
  lastCheckTime = now;

  try {
    const workflows = await loadWorkflows();
    const enabled = workflows.filter(w => w.enabled);

    if (enabled.length === 0) {
      return [];
    }

    const results: WorkflowCheckResult[] = [];
    setLastRunTimestamp(Date.now());

    for (const wf of enabled) {
      const checker = CHECKERS[wf.condition.type];
      if (!checker) {
        continue;
      }
      const cacheKey = getWorkflowCacheKey(wf);
      const result = await checker(wf);
      const nextWorkflow: Workflow = {
        ...wf,
        lastCheckedAt: result.checkedAt,
        lastResult: {
          status: result.status,
          checkedAt: result.checkedAt,
          message: result.message,
          detail: result.detail,
        },
        updatedAt: result.checkedAt,
      };

      if (result.triggered) {
        const shouldNotify =
          !(wf.notifyOnce && wf.lastTriggeredAt) && !triggeredCache.has(cacheKey);
        if (shouldNotify) {
          await showLocalNotification({
            title: wf.name,
            body: result.detail || result.message,
          });
          triggeredCache.add(cacheKey);
          setTimeout(() => triggeredCache.delete(cacheKey), CACHE_EXPIRE_MS);
          nextWorkflow.lastTriggeredAt = result.checkedAt;
        }
      }
      await updateWorkflow(nextWorkflow);
      results.push(result);
    }

    return results;
  } finally {
    isRunning = false;
  }
}

let lastRunTimestamp: number | null = null;

function setLastRunTimestamp(ts: number): void {
  lastRunTimestamp = ts;
}

export function getLastRunTimestamp(): number | null {
  return lastRunTimestamp;
}
