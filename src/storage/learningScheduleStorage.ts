import AsyncStorage from '@react-native-async-storage/async-storage';
import {ScheduleEvent} from '../domain/learning';
import {CampusSchedule, SemesterCalendar} from '../domain/campusSchedule';

const KEY = '@campusos/learning_schedule_cache';
const KEY_BY_SEMESTER = '@campusos/learning_schedule_cache_by_semester_v2';

export interface CachedSchedulePack {
  calendar: SemesterCalendar;
  schedules: CampusSchedule[];
}

export interface LearningScheduleCacheEntry {
  key: string;
  semesterIndex?: number;
  semesterId?: string;
  semesterName?: string;
  savedAt: string;
  events: ScheduleEvent[];
  pack?: CachedSchedulePack;
}

function cacheKeyForSemester(semesterIndex?: number): string {
  return semesterIndex === undefined || semesterIndex < 0
    ? 'current'
    : `next:${semesterIndex}`;
}

async function loadCacheMap(): Promise<Record<string, LearningScheduleCacheEntry>> {
  try {
    const raw = await AsyncStorage.getItem(KEY_BY_SEMESTER);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as Record<string, LearningScheduleCacheEntry>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

async function saveCacheMap(
  map: Record<string, LearningScheduleCacheEntry>,
): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY_BY_SEMESTER, JSON.stringify(map));
  } catch {
    // 缓存失败不影响主流程
  }
}

export async function loadLearningScheduleCacheEntry(
  semesterIndex?: number,
): Promise<LearningScheduleCacheEntry | null> {
  const key = cacheKeyForSemester(semesterIndex);
  const map = await loadCacheMap();
  const entry = map[key];
  if (entry && Array.isArray(entry.events)) {
    return entry;
  }
  if (key !== 'current') {
    return null;
  }
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as ScheduleEvent[];
    return Array.isArray(parsed)
      ? {
          key: 'current',
          savedAt: new Date(0).toISOString(),
          events: parsed,
        }
      : null;
  } catch {
    return null;
  }
}

export async function loadLearningScheduleCache(
  semesterIndex?: number,
): Promise<ScheduleEvent[]> {
  const entry = await loadLearningScheduleCacheEntry(semesterIndex);
  return entry?.events ?? [];
}

export async function listLearningScheduleCacheEntries(): Promise<
  LearningScheduleCacheEntry[]
> {
  const map = await loadCacheMap();
  return Object.values(map).sort((a, b) => a.key.localeCompare(b.key));
}

export async function saveLearningScheduleCache(
  events: ScheduleEvent[],
  semesterIndex?: number,
  pack?: CachedSchedulePack,
): Promise<void> {
  try {
    const key = cacheKeyForSemester(semesterIndex);
    const map = await loadCacheMap();
    if (events.length === 0 && !pack) {
      delete map[key];
      await saveCacheMap(map);
      if (key === 'current') {
        await AsyncStorage.removeItem(KEY);
      }
      return;
    }
    map[key] = {
      key,
      semesterIndex,
      semesterId: pack?.calendar.semesterId,
      semesterName: pack?.calendar.semesterName,
      savedAt: new Date().toISOString(),
      events,
      pack,
    };
    await saveCacheMap(map);

    if (key === 'current') {
      if (events.length === 0) {
        await AsyncStorage.removeItem(KEY);
        return;
      }
      await AsyncStorage.setItem(KEY, JSON.stringify(events));
    }
  } catch {
    // 缓存失败不影响主流程
  }
}

export async function clearLearningScheduleCache(
  semesterIndex?: number,
): Promise<void> {
  try {
    const key = cacheKeyForSemester(semesterIndex);
    const map = await loadCacheMap();
    delete map[key];
    await saveCacheMap(map);
    if (key === 'current') {
      await AsyncStorage.removeItem(KEY);
    }
  } catch {
    // 缓存失败不影响主流程
  }
}
