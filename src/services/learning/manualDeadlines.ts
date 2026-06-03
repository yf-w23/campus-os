import {ManualDeadline} from '../../domain/deadline';
import {addManualDeadline, removeManualDeadline} from '../../state/slices/manualDeadlineSlice';
import {store} from '../../state/store';
import {saveManualDeadlines} from '../../storage/manualDeadlinesStorage';

function newDeadlineId(): string {
  return `md-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeDeadline(value: string): string {
  const raw = String(value ?? '').trim();
  if (!raw) {
    return '';
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return `${raw}T23:59:00`;
  }
  if (/^\d{4}-\d{2}-\d{2}\s+\d{1,2}:\d{2}/.test(raw)) {
    const [date, time] = raw.split(/\s+/);
    return `${date}T${time.slice(0, 5)}:00`;
  }
  if (/^\d{4}-\d{2}-\d{2}T\d{1,2}:\d{2}/.test(raw)) {
    const [date, time] = raw.split('T');
    return `${date}T${time.slice(0, 5)}:00`;
  }
  return raw;
}

export async function appendManualDeadline(
  input: Omit<ManualDeadline, 'id' | 'createdAt'>,
): Promise<ManualDeadline> {
  const item: ManualDeadline = {
    ...input,
    deadline: normalizeDeadline(input.deadline),
    title: input.title.trim(),
    courseName: input.courseName?.trim() || undefined,
    note: input.note?.trim() || undefined,
    id: newDeadlineId(),
    createdAt: new Date().toISOString(),
  };
  store.dispatch(addManualDeadline(item));
  await saveManualDeadlines(store.getState().manualDeadlines.items);
  return item;
}

export async function deleteManualDeadlineById(id: string): Promise<boolean> {
  const trimmed = String(id ?? '').trim();
  if (!trimmed) {
    return false;
  }
  const before = store.getState().manualDeadlines.items;
  if (!before.some(item => item.id === trimmed)) {
    return false;
  }
  store.dispatch(removeManualDeadline(trimmed));
  await saveManualDeadlines(store.getState().manualDeadlines.items);
  return true;
}

export function findManualDeadline(key: string): ManualDeadline | undefined {
  const trimmed = String(key ?? '').trim();
  if (!trimmed) {
    return undefined;
  }
  const items = store.getState().manualDeadlines.items;
  return (
    items.find(item => item.id === trimmed) ??
    items.find(item => item.title === trimmed) ??
    items.find(item => item.title.includes(trimmed))
  );
}

export function listManualDeadlines(): ManualDeadline[] {
  return [...store.getState().manualDeadlines.items].sort((a, b) =>
    a.deadline.localeCompare(b.deadline),
  );
}

