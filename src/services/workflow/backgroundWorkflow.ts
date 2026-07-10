import {NativeModules, Platform} from 'react-native';
import {WorkflowCheckResult} from '../../domain/workflow';
import {loadWorkflows} from '../../storage/workflowStorage';
import {
  getSystemNotificationEnabled,
  requestPermission,
} from '../notification/notificationService';
import {isWorkflowCheckerAvailable} from './WorkflowEngine';

export interface BackgroundWorkflowStatus {
  supported: boolean;
  notificationsEnabled: boolean;
  schedulerEnabled: boolean;
  intervalMinutes: number;
  lastScheduledAt?: string;
  lastStartedAt?: string;
  lastFinishedAt?: string;
  lastResultStatus?: string;
  lastTriggeredCount: number;
  lastCheckedCount: number;
  lastResultMessage?: string;
  lastError?: string;
}

interface NativeBackgroundStatus {
  notificationsEnabled?: boolean;
  schedulerEnabled?: boolean;
  intervalMinutes?: number;
  lastScheduledAt?: number;
  lastStartedAt?: number;
  lastFinishedAt?: number;
  lastResultStatus?: string;
  lastTriggeredCount?: number;
  lastCheckedCount?: number;
  lastResultMessage?: string;
  lastError?: string;
}

interface CampusNotificationsNativeModule {
  ensureNotificationChannel(): Promise<boolean>;
  scheduleWorkflowChecks(
    enabled: boolean,
    intervalMinutes: number,
  ): Promise<NativeBackgroundStatus>;
  enqueueWorkflowCheck(): Promise<boolean>;
  runHeadlessWorkflowNow(): Promise<boolean>;
  recordWorkflowRunResult(
    status: string,
    triggeredCount: number,
    checkedCount: number,
    message?: string,
  ): Promise<NativeBackgroundStatus>;
  getWorkflowBackgroundStatus(): Promise<NativeBackgroundStatus>;
}

const DEFAULT_INTERVAL_MINUTES = 180;

const NativeCampusNotifications = NativeModules.CampusNotifications as
  | CampusNotificationsNativeModule
  | undefined;

export function isBackgroundWorkflowSupported(): boolean {
  return Platform.OS === 'android' && Boolean(NativeCampusNotifications);
}

export async function syncBackgroundWorkflowScheduler(): Promise<BackgroundWorkflowStatus> {
  const supported = isBackgroundWorkflowSupported();
  if (!supported || !NativeCampusNotifications) {
    return emptyStatus(false);
  }
  const workflows = await loadWorkflows();
  const hasRunnableWorkflow = workflows.some(
    wf => wf.enabled && isWorkflowCheckerAvailable(wf.condition.type),
  );
  await NativeCampusNotifications.ensureNotificationChannel();
  const native = await NativeCampusNotifications.scheduleWorkflowChecks(
    hasRunnableWorkflow,
    DEFAULT_INTERVAL_MINUTES,
  );
  return normalizeStatus(native, true);
}

export async function requestWorkflowNotificationPermission(): Promise<boolean> {
  return requestPermission();
}

export async function getBackgroundWorkflowStatus(): Promise<BackgroundWorkflowStatus> {
  if (!isBackgroundWorkflowSupported() || !NativeCampusNotifications) {
    return emptyStatus(false);
  }
  const native = await NativeCampusNotifications.getWorkflowBackgroundStatus();
  return normalizeStatus(native, true);
}

export async function enqueueBackgroundWorkflowCheck(): Promise<boolean> {
  if (!isBackgroundWorkflowSupported() || !NativeCampusNotifications) {
    return false;
  }
  return NativeCampusNotifications.enqueueWorkflowCheck();
}

export async function runHeadlessWorkflowCheckNow(): Promise<boolean> {
  if (!isBackgroundWorkflowSupported() || !NativeCampusNotifications) {
    return false;
  }
  return NativeCampusNotifications.runHeadlessWorkflowNow();
}

export async function recordBackgroundWorkflowResult(
  results: WorkflowCheckResult[],
  error?: unknown,
): Promise<void> {
  if (!isBackgroundWorkflowSupported() || !NativeCampusNotifications) {
    return;
  }
  const triggered = results.filter(item => item.triggered);
  const status = error
    ? 'error'
    : triggered.length > 0
    ? 'triggered'
    : results.length > 0
    ? 'ok'
    : 'skipped';
  const message = error
    ? error instanceof Error
      ? error.message
      : 'Background workflow check failed'
    : triggered[0]?.detail ??
      triggered[0]?.message ??
      (results.length > 0 ? 'Background workflow check completed' : 'No enabled workflow checked');
  await NativeCampusNotifications.recordWorkflowRunResult(
    status,
    triggered.length,
    results.length,
    message,
  );
}

export async function getNotificationReadiness(): Promise<boolean> {
  return getSystemNotificationEnabled();
}

function normalizeStatus(
  native: NativeBackgroundStatus | undefined,
  supported: boolean,
): BackgroundWorkflowStatus {
  return {
    supported,
    notificationsEnabled: native?.notificationsEnabled ?? true,
    schedulerEnabled: native?.schedulerEnabled ?? false,
    intervalMinutes: Number(native?.intervalMinutes ?? 0),
    lastScheduledAt: isoFromMillis(native?.lastScheduledAt),
    lastStartedAt: isoFromMillis(native?.lastStartedAt),
    lastFinishedAt: isoFromMillis(native?.lastFinishedAt),
    lastResultStatus: native?.lastResultStatus || undefined,
    lastTriggeredCount: Number(native?.lastTriggeredCount ?? 0),
    lastCheckedCount: Number(native?.lastCheckedCount ?? 0),
    lastResultMessage: native?.lastResultMessage || undefined,
    lastError: native?.lastError || undefined,
  };
}

function emptyStatus(supported: boolean): BackgroundWorkflowStatus {
  return {
    supported,
    notificationsEnabled: true,
    schedulerEnabled: false,
    intervalMinutes: 0,
    lastTriggeredCount: 0,
    lastCheckedCount: 0,
  };
}

function isoFromMillis(value: unknown): string | undefined {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) {
    return undefined;
  }
  return new Date(n).toISOString();
}
