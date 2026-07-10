import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@campusos/ai_disabled_permissions';

export async function loadDisabledAIPermissions(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed)
      ? parsed.filter(item => typeof item === 'string')
      : [];
  } catch {
    return [];
  }
}

export async function saveDisabledAIPermissions(
  permissions: string[],
): Promise<void> {
  try {
    const unique = Array.from(new Set(permissions)).sort();
    await AsyncStorage.setItem(KEY, JSON.stringify(unique));
  } catch {
    // 权限偏好保存失败不影响 Agent 主流程
  }
}

export async function setAIPermissionEnabled(
  permission: string,
  enabled: boolean,
): Promise<string[]> {
  const disabled = new Set(await loadDisabledAIPermissions());
  if (enabled) {
    disabled.delete(permission);
  } else {
    disabled.add(permission);
  }
  const next = Array.from(disabled);
  await saveDisabledAIPermissions(next);
  return next;
}
