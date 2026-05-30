import {PersonalEvent} from '../../domain/schedule';
import {store} from '../../state/store';
import {
  addPersonalEvent,
  removePersonalEvent,
} from '../../state/slices/scheduleSlice';
import {savePersonalEvents} from '../../storage/personalEventsStorage';
import {normalizeDateString} from '../../utils/weekDates';

function newEventId(): string {
  return `pe-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function appendPersonalEvent(
  input: Omit<PersonalEvent, 'id' | 'createdAt'>,
): Promise<PersonalEvent> {
  const event: PersonalEvent = {
    ...input,
    date: normalizeDateString(input.date) || input.date,
    id: newEventId(),
    createdAt: new Date().toISOString(),
  };
  store.dispatch(addPersonalEvent(event));
  const next = [...store.getState().schedule.personalEvents];
  await savePersonalEvents(next);
  return event;
}

export async function deletePersonalEventById(id: string): Promise<boolean> {
  const events = store.getState().schedule.personalEvents;
  if (!events.some(e => e.id === id)) {
    return false;
  }
  store.dispatch(removePersonalEvent(id));
  await savePersonalEvents(events.filter(e => e.id !== id));
  return true;
}

export function findPersonalEvent(key: string): PersonalEvent | undefined {
  const events = store.getState().schedule.personalEvents;
  const trimmed = key.trim();
  return (
    events.find(e => e.id === trimmed) ??
    events.find(e => e.title === trimmed) ??
    events.find(e => e.title.includes(trimmed))
  );
}

export function listPersonalEventsInRange(
  startDate?: string,
  endDate?: string,
): PersonalEvent[] {
  const events = store.getState().schedule.personalEvents;
  const start = startDate ? normalizeDateString(startDate) : '';
  const end = endDate ? normalizeDateString(endDate) : '';
  return events
    .filter(e => {
      const d = normalizeDateString(e.date);
      if (start && d < start) return false;
      if (end && d > end) return false;
      return true;
    })
    .sort((a, b) => {
      const dc = a.date.localeCompare(b.date);
      return dc !== 0 ? dc : a.startTime.localeCompare(b.startTime);
    });
}
