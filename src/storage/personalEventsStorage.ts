import AsyncStorage from '@react-native-async-storage/async-storage';
import {PersonalEvent} from '../domain/schedule';

const KEY = '@campusos/personal_events';

export async function loadPersonalEvents(): Promise<PersonalEvent[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as PersonalEvent[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function savePersonalEvents(events: PersonalEvent[]): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(events));
  } catch {
    // 持久化失败不致命
  }
}
