import AsyncStorage from '@react-native-async-storage/async-storage';
import {Workflow} from '../domain/workflow';

const KEY = '@campusos/workflows';

export async function loadWorkflows(): Promise<Workflow[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) {
      return [];
    }
    return JSON.parse(raw) as Workflow[];
  } catch {
    return [];
  }
}

export async function saveWorkflows(workflows: Workflow[]): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(workflows));
  } catch {
    // 持久化失败不致命
  }
}

export async function addWorkflow(workflow: Workflow): Promise<void> {
  const workflows = await loadWorkflows();
  workflows.push(workflow);
  await saveWorkflows(workflows);
}

export async function updateWorkflow(updated: Workflow): Promise<void> {
  const workflows = await loadWorkflows();
  const index = workflows.findIndex(w => w.id === updated.id);
  if (index !== -1) {
    workflows[index] = updated;
    await saveWorkflows(workflows);
  }
}

export async function removeWorkflow(id: string): Promise<void> {
  const workflows = await loadWorkflows();
  await saveWorkflows(workflows.filter(w => w.id !== id));
}

export async function toggleWorkflow(id: string, enabled: boolean): Promise<void> {
  const workflows = await loadWorkflows();
  const wf = workflows.find(w => w.id === id);
  if (wf) {
    wf.enabled = enabled;
    wf.updatedAt = new Date().toISOString();
    await saveWorkflows(workflows);
  }
}
