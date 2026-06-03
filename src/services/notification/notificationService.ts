/**
 * 本地通知服务 — 当前使用 in-app banner 实现。
 * 接口设计保持与 @notifee/react-native 兼容，方便后续替换。
 */
import {Alert} from 'react-native';

export interface NotificationPayload {
  title: string;
  body: string;
}

type NotificationHandler = (notification: NotificationPayload) => void;

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

export async function showLocalNotification(payload: NotificationPayload): Promise<void> {
  if (!notificationEnabled) {
    return;
  }
  if (foregroundHandler) {
    foregroundHandler(payload);
  } else {
    Alert.alert(payload.title, payload.body);
  }
}

export async function requestPermission(): Promise<boolean> {
  return true;
}
