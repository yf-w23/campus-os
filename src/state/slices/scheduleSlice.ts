import {createSlice, PayloadAction} from '@reduxjs/toolkit';
import {CampusSchedule, SemesterCalendar} from '../../domain/campusSchedule';
import {PersonalEvent} from '../../domain/schedule';

interface ScheduleSliceState {
  personalEvents: PersonalEvent[];
  hydrated: boolean;
  calendar: SemesterCalendar | null;
  baseSchedule: CampusSchedule[];
  scheduleSyncedAt?: string;
  scheduleError?: string;
}

const initialState: ScheduleSliceState = {
  personalEvents: [],
  hydrated: false,
  calendar: null,
  baseSchedule: [],
};

const scheduleSlice = createSlice({
  name: 'schedule',
  initialState,
  reducers: {
    hydratePersonalEvents(state, action: PayloadAction<PersonalEvent[]>) {
      state.personalEvents = action.payload;
      state.hydrated = true;
    },
    addPersonalEvent(state, action: PayloadAction<PersonalEvent>) {
      state.personalEvents = [...state.personalEvents, action.payload].sort((a, b) => {
        const dc = a.date.localeCompare(b.date);
        if (dc !== 0) return dc;
        return (a.startTime ?? '').localeCompare(b.startTime ?? '');
      });
    },
    removePersonalEvent(state, action: PayloadAction<string>) {
      state.personalEvents = state.personalEvents.filter(e => e.id !== action.payload);
    },
    setCampusSchedule(
      state,
      action: PayloadAction<{
        calendar?: SemesterCalendar | null;
        baseSchedule: CampusSchedule[];
      }>,
    ) {
      if (action.payload.calendar !== undefined) {
        state.calendar = action.payload.calendar;
      }
      state.baseSchedule = action.payload.baseSchedule;
      state.scheduleSyncedAt = new Date().toISOString();
      state.scheduleError = undefined;
    },
    setCampusScheduleError(state, action: PayloadAction<string>) {
      state.scheduleError = action.payload;
    },
    clearScheduleError(state) {
      state.scheduleError = undefined;
    },
    clearCampusSchedule(state) {
      state.calendar = null;
      state.baseSchedule = [];
      state.scheduleSyncedAt = undefined;
      state.scheduleError = undefined;
    },
  },
});

export const {
  hydratePersonalEvents,
  addPersonalEvent,
  removePersonalEvent,
  setCampusSchedule,
  setCampusScheduleError,
  clearScheduleError,
  clearCampusSchedule,
} = scheduleSlice.actions;
export default scheduleSlice.reducer;
