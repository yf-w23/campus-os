import {createSlice, PayloadAction} from '@reduxjs/toolkit';
import {ManualDeadline} from '../../domain/deadline';

interface ManualDeadlineState {
  items: ManualDeadline[];
  hydrated: boolean;
}

const initialState: ManualDeadlineState = {
  items: [],
  hydrated: false,
};

function deadlineTime(value: string): number {
  const time = new Date(value.replace(' ', 'T')).getTime();
  return Number.isNaN(time) ? Number.MAX_SAFE_INTEGER : time;
}

const manualDeadlineSlice = createSlice({
  name: 'manualDeadlines',
  initialState,
  reducers: {
    hydrateManualDeadlines(state, action: PayloadAction<ManualDeadline[]>) {
      state.items = action.payload;
      state.hydrated = true;
    },
    addManualDeadline(state, action: PayloadAction<ManualDeadline>) {
      state.items = [...state.items, action.payload].sort(
        (a, b) => deadlineTime(a.deadline) - deadlineTime(b.deadline),
      );
    },
    removeManualDeadline(state, action: PayloadAction<string>) {
      state.items = state.items.filter(item => item.id !== action.payload);
    },
  },
});

export const {
  hydrateManualDeadlines,
  addManualDeadline,
  removeManualDeadline,
} = manualDeadlineSlice.actions;
export default manualDeadlineSlice.reducer;

