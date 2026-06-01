import AsyncStorage from '@react-native-async-storage/async-storage';
import {AIProviderConfig} from '../domain/agent';
import type {ColorScheme} from '../app/theme';

const KEYS = {
  locale: '@campusos/locale',
  aiProvider: '@campusos/ai_provider',
  demoMode: '@campusos/demo_mode',
  trustDevice: '@campusos/trust_device',
  colorScheme: '@campusos/color_scheme',
  sessionStudentId: '@campusos/session_student_id',
} as const;

/**
 * 持久化登录态（与 THU Info 一致的「记住登录」）。
 * 仅存学号作为「上次登录过」的标记；真正的密码 / fingerprint 在 Keychain。
 * 启动时若该值存在且 Keychain 有凭证，则乐观进入主界面并后台静默续期。
 */
export async function getSessionStudentId(): Promise<string | null> {
  return AsyncStorage.getItem(KEYS.sessionStudentId);
}

export async function setSessionStudentId(studentId: string): Promise<void> {
  await AsyncStorage.setItem(KEYS.sessionStudentId, studentId);
}

export async function clearSessionStudentId(): Promise<void> {
  await AsyncStorage.removeItem(KEYS.sessionStudentId);
}

export async function getLocale(): Promise<'zh' | 'en'> {
  const value = await AsyncStorage.getItem(KEYS.locale);
  return value === 'en' ? 'en' : 'zh';
}

export async function setLocale(locale: 'zh' | 'en'): Promise<void> {
  await AsyncStorage.setItem(KEYS.locale, locale);
}

export async function getAIProviderConfig(): Promise<Omit<AIProviderConfig, 'apiKey'> | null> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.aiProvider);
    return raw ? (JSON.parse(raw) as Omit<AIProviderConfig, 'apiKey'>) : null;
  } catch {
    return null;
  }
}

export async function setAIProviderConfig(
  config: Omit<AIProviderConfig, 'apiKey'>,
): Promise<void> {
  await AsyncStorage.setItem(KEYS.aiProvider, JSON.stringify(config));
}

export async function isDemoMode(): Promise<boolean> {
  const value = await AsyncStorage.getItem(KEYS.demoMode);
  return value === 'true';
}

export async function setDemoMode(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(KEYS.demoMode, enabled ? 'true' : 'false');
}

export async function getTrustDevice(): Promise<boolean> {
  const value = await AsyncStorage.getItem(KEYS.trustDevice);
  return value !== 'false';
}

export async function setTrustDevice(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(KEYS.trustDevice, enabled ? 'true' : 'false');
}

// App 仅保留浅色模式：始终返回 'light'（保留函数签名以兼容历史调用）。
export async function getColorScheme(): Promise<ColorScheme> {
  return 'light';
}

export async function setColorScheme(_scheme: ColorScheme): Promise<void> {
  await AsyncStorage.setItem(KEYS.colorScheme, 'light');
}
