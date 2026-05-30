import AsyncStorage from '@react-native-async-storage/async-storage';
import {AIMemory} from '../domain/agent';

const KEY = '@campusos/ai_memory';

const EMPTY: AIMemory = {};

export async function loadAIMemory(): Promise<AIMemory> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) {
      return {...EMPTY};
    }
    return {...EMPTY, ...(JSON.parse(raw) as AIMemory)};
  } catch {
    return {...EMPTY};
  }
}

export async function saveAIMemory(memory: AIMemory): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(memory));
}

/** 合并式更新：仅覆盖传入字段，notes/watchedCourses 做去重追加 */
export async function patchAIMemory(patch: Partial<AIMemory>): Promise<AIMemory> {
  const current = await loadAIMemory();
  const next: AIMemory = {...current};

  if (patch.favoriteLibrary !== undefined) {
    next.favoriteLibrary = patch.favoriteLibrary;
  }
  if (patch.favoriteSection !== undefined) {
    next.favoriteSection = patch.favoriteSection;
  }
  if (patch.defaultRechargeAmount !== undefined) {
    next.defaultRechargeAmount = patch.defaultRechargeAmount;
  }
  if (patch.watchedCourses) {
    next.watchedCourses = Array.from(
      new Set([...(current.watchedCourses ?? []), ...patch.watchedCourses]),
    );
  }
  if (patch.notes) {
    next.notes = Array.from(
      new Set([...(current.notes ?? []), ...patch.notes]),
    ).slice(-20);
  }

  await saveAIMemory(next);
  return next;
}

/** 把记忆压成一段适合塞进 system prompt 的中文摘要 */
export function summarizeMemory(memory: AIMemory): string {
  const parts: string[] = [];
  if (memory.favoriteLibrary) {
    parts.push(
      `常用图书馆：${memory.favoriteLibrary}${
        memory.favoriteSection ? `（${memory.favoriteSection}）` : ''
      }`,
    );
  }
  if (memory.defaultRechargeAmount) {
    parts.push(`默认电费充值金额：${memory.defaultRechargeAmount} 元`);
  }
  if (memory.watchedCourses?.length) {
    parts.push(`重点关注课程：${memory.watchedCourses.join('、')}`);
  }
  if (memory.notes?.length) {
    parts.push(`其它偏好：${memory.notes.join('；')}`);
  }
  return parts.length ? parts.join('\n') : '（暂无个性化记忆）';
}
