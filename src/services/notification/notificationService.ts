/**
 * 本地通知服务。
 *
 * Foreground: keep the existing in-app/Alert behavior.
 * Background on Android: delegate to the native notification channel so
 * WorkManager/Headless JS checks can alert without a visible React tree.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Alert,
  AppState,
  NativeModules,
  PermissionsAndroid,
  Platform,
} from 'react-native';

export interface NotificationPayload {
  title: string;
  body: string;
}

export interface QuietHoursConfig {
  enabled: boolean;
  startMinute: number;
  endMinute: number;
}

interface CampusNotificationsNativeModule {
  ensureNotificationChannel(): Promise<boolean>;
  areNotificationsEnabled(): Promise<boolean>;
  showWorkflowNotification(title: string, body: string): Promise<boolean>;
}

type NotificationHandler = (notification: NotificationPayload) => void;

const QUIET_HOURS_KEY = '@campusos/notification_quiet_hours';
const DEFAULT_QUIET_HOURS: QuietHoursConfig = {
  enabled: true,
  startMinute: 23 * 60,
  endMinute: 7 * 60,
};

const NativeCampusNotifications = NativeModules.CampusNotifications as
  | CampusNotificationsNativeModule
  | undefined;

let foregroundHandler: NotificationHandler | null = null;
let notificationEnabled = true;

export function setNotificationEnabled(enabled: boolean): void {
  notificationEnabled = enabled;
}

export function isNotificationEnabled(): boolean {
  return notificationEnabled;
}

export function onForegroundNotification(handler: NotificationHandler): () => void {
  foregroundHandler = handler;
  return () => {
    foregroundHandler = null;
  };
}

export async function loadQuietHoursConfig(): Promise<QuietHoursConfig> {
  try {
    const raw = await AsyncStorage.getItem(QUIET_HOURS_KEY);
    if (!raw) {
      return DEFAULT_QUIET_HOURS;
    }
    const parsed = JSON.parse(raw) as Partial<QuietHoursConfig>;
    return {
      enabled: parsed.enabled ?? DEFAULT_QUIET_HOURS.enabled,
      startMinute: clampMinute(parsed.startMinute),
      endMinute: clampMinute(parsed.endMinute),
    };
  } catch {
    return DEFAULT_QUIET_HOURS;
  }
}

export async function saveQuietHoursConfig(
  config: QuietHoursConfig,
): Promise<void> {
  await AsyncStorage.setItem(
    QUIET_HOURS_KEY,
    JSON.stringify({
      enabled: config.enabled,
      startMinute: clampMinute(config.startMinute),
      endMinute: clampMinute(config.endMinute),
    }),
  );
}

export function isInQuietHours(
  config: QuietHoursConfig,
  date = new Date(),
): boolean {
  if (!config.enabled) {
    return false;
  }
  const start = clampMinute(config.startMinute);
  const end = clampMinute(config.endMinute);
  const now = date.getHours() * 60 + date.getMinutes();
  if (start === end) {
    return true;
  }
  if (start < end) {
    return now >= start && now < end;
  }
  return now >= start || now < end;
}

export function formatQuietHours(config: QuietHoursConfig): string {
  return `${minuteLabel(config.startMinute)}-${minuteLabel(config.endMinute)}`;
}

export async function showLocalNotification(payload: NotificationPayload): Promise<void> {
  if (!notificationEnabled) {
    return;
  }
  const quietHours = await loadQuietHoursConfig();
  if (isInQuietHours(quietHours)) {
    return;
  }
  const shouldUseNative =
    Platform.OS === 'android' &&
    Boolean(NativeCampusNotifications) &&
    AppState.currentState !== 'active';
  if (shouldUseNative) {
    await NativeCampusNotifications?.showWorkflowNotification(
      payload.title,
      payload.body,
    );
    return;
  }
  if (foregroundHandler) {
    foregroundHandler(payload);
  } else {
    Alert.alert(payload.title, payload.body);
  }
}

export async function requestPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return true;
  }
  await NativeCampusNotifications?.ensureNotificationChannel();
  const version =
    typeof Platform.Version === 'number'
      ? Platform.Version
      : Number(Platform.Version);
  if (Number.isFinite(version) && version >= 33) {
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    );
    return result === PermissionsAndroid.RESULTS.GRANTED;
  }
  return (await NativeCampusNotifications?.areNotificationsEnabled()) ?? true;
}

export async function getSystemNotificationEnabled(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return true;
  }
  await NativeCampusNotifications?.ensureNotificationChannel();
  return (await NativeCampusNotifications?.areNotificationsEnabled()) ?? true;
}

function clampMinute(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return 0;
  }
  return Math.min(24 * 60 - 1, Math.max(0, Math.round(n)));
}

function minuteLabel(value: number): string {
  const minute = clampMinute(value);
  const h = Math.floor(minute / 60);
  const m = minute % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
