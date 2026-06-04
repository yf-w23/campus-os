import {Workflow, WorkflowCheckResult} from '../../domain/workflow';
import {loadWorkflows, updateWorkflow} from '../../storage/workflowStorage';
import {showLocalNotification} from '../notification/notificationService';
import {store} from '../../state/store';
import {selectTodaySchedule} from '../../state/selectors';
import {getEleRemainder} from '../campus/electricity';
import {getNetworkBalance} from '../campus/network';

type CheckFn = (wf: Workflow) => Promise<WorkflowCheckResult>;

async function checkElectricityBalance(wf: Workflow): Promise<WorkflowCheckResult> {
  try {
    const threshold = (wf.condition.params.threshold as number) ?? 20;
    const result = await getEleRemainder();
    const balance = result.remainder;
    if (balance < threshold) {
      return {
        workflowId: wf.id,
        triggered: true,
        message: wf.message,
        detail: `当前余额：${result.remainder} 度，阈值：${threshold} 度`,
      };
    }
  } catch {
    // 查询失败不触发
  }
  return {workflowId: wf.id, triggered: false, message: ''};
}

async function checkNetworkBalance(wf: Workflow): Promise<WorkflowCheckResult> {
  try {
    const threshold = (wf.condition.params.threshold as number) ?? 10;
    const result = await getNetworkBalance();
    const balance = parseFloat(result.accountBalance);
    if (!isNaN(balance) && balance < threshold) {
      return {
        workflowId: wf.id,
        triggered: true,
        message: wf.message,
        detail: `当前余额：${result.accountBalance} 元，阈值：${threshold} 元`,
      };
    }
  } catch {
    // 查询失败不触发
  }
  return {workflowId: wf.id, triggered: false, message: ''};
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
      return {
        workflowId: wf.id,
        triggered: true,
        message: wf.message,
        detail: `今日课程：${courseNames}${todayCourses.length > 3 ? ` 等 ${todayCourses.length} 节课` : ''}`,
      };
    }
  } catch {
    // ignore
  }
  return {workflowId: wf.id, triggered: false, message: ''};
}

async function checkDdlReminder(wf: Workflow): Promise<WorkflowCheckResult> {
  try {
    const daysAhead = (wf.condition.params.daysAhead as number) ?? 1;
    const snapshot = store.getState().learning.snapshot;
    const homeworkList = snapshot.homework ?? [];
    const now = Date.now();
    const threshold = now + daysAhead * 24 * 60 * 60 * 1000;
    const upcoming = homeworkList
      .filter((h: {deadline?: string; submitted: boolean}) => {
        if (!h.deadline || h.submitted) return false;
        const dl = new Date(h.deadline).getTime();
        return !isNaN(dl) && dl > now && dl < threshold;
      })
      .slice(0, 3);

    if (upcoming.length > 0) {
      const names = upcoming.map((d: {title: string}) => d.title).join('、');
      return {
        workflowId: wf.id,
        triggered: true,
        message: wf.message,
        detail: `即将到期：${names}`,
      };
    }
  } catch {
    // ignore
  }
  return {workflowId: wf.id, triggered: false, message: ''};
}

async function checkCourseCapacity(_wf: Workflow): Promise<WorkflowCheckResult> {
  return {workflowId: _wf.id, triggered: false, message: ''};
}

async function checkSportsSlot(_wf: Workflow): Promise<WorkflowCheckResult> {
  return {workflowId: _wf.id, triggered: false, message: ''};
}

async function checkLibraryRoom(_wf: Workflow): Promise<WorkflowCheckResult> {
  return {workflowId: _wf.id, triggered: false, message: ''};
}

async function checkLibrarySeat(_wf: Workflow): Promise<WorkflowCheckResult> {
  return {workflowId: _wf.id, triggered: false, message: ''};
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

      if (result.triggered) {
        if (wf.notifyOnce && wf.lastTriggeredAt) {
          continue;
        }
        if (triggeredCache.has(cacheKey)) {
          continue;
        }
        await showLocalNotification({
          title: wf.name,
          body: result.detail || result.message,
        });
        triggeredCache.add(cacheKey);
        setTimeout(() => triggeredCache.delete(cacheKey), CACHE_EXPIRE_MS);
        wf.lastTriggeredAt = new Date().toISOString();
      }
      wf.lastCheckedAt = new Date().toISOString();
      await updateWorkflow(wf);
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
