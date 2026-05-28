import {LearningSnapshot} from '../domain/learning';

export function createEmptyLearningSnapshot(): LearningSnapshot {
  return {
    courses: [],
    schedule: [],
    notifications: [],
    homework: [],
    files: [],
    fetchedAt: new Date().toISOString(),
  };
}
