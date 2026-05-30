import {createSlice, PayloadAction} from '@reduxjs/toolkit';
import {LearningSnapshot, ScheduleEvent} from '../../domain/learning';
import {demoLearningSnapshot} from '../../fixtures/demoData';
import {createEmptyLearningSnapshot} from '../../fixtures/emptyData';

export type LearningDataSource = 'none' | 'demo' | 'campus';

interface LearningSliceState {
  snapshot: LearningSnapshot;
  dataSource: LearningDataSource;
  loading: boolean;
  error?: string;
  lastSyncedAt?: string;
}

const initialState: LearningSliceState = {
  snapshot: createEmptyLearningSnapshot(),
  dataSource: 'none',
  loading: false,
};

const learningSlice = createSlice({
  name: 'learning',
  initialState,
  reducers: {
    setLearningLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload;
      if (action.payload) {
        state.error = undefined;
      }
    },
    beginLearningSync(state) {
      state.loading = true;
      state.error = undefined;
    },
    setLearningSnapshot(state, action: PayloadAction<LearningSnapshot>) {
      state.snapshot = action.payload;
      state.dataSource = 'campus';
      state.loading = false;
      state.error = undefined;
      state.lastSyncedAt = action.payload.fetchedAt;
    },
    mergeLearningExtras(
      state,
      action: PayloadAction<Pick<LearningSnapshot, 'notifications' | 'files'>>,
    ) {
      state.snapshot.notifications = action.payload.notifications;
      state.snapshot.files = action.payload.files;
      state.snapshot.fetchedAt = new Date().toISOString();
      state.lastSyncedAt = state.snapshot.fetchedAt;
    },
    setLearningError(state, action: PayloadAction<string>) {
      state.loading = false;
      state.error = action.payload;
      // 同步失败时保留已有课表/课程，避免「昨日有课、今日全空」
    },
    hydrateLearningSchedule(state, action: PayloadAction<ScheduleEvent[]>) {
      if (action.payload.length === 0) {
        return;
      }
      state.snapshot.schedule = action.payload;
      if (state.dataSource === 'none') {
        state.dataSource = 'campus';
      }
    },
    resetLearningEmpty(state) {
      state.snapshot = createEmptyLearningSnapshot();
      state.dataSource = 'none';
      state.loading = false;
      state.error = undefined;
      state.lastSyncedAt = undefined;
    },
    resetLearningDemo(state) {
      state.snapshot = demoLearningSnapshot;
      state.dataSource = 'demo';
      state.loading = false;
      state.error = undefined;
      state.lastSyncedAt = demoLearningSnapshot.fetchedAt;
    },
  },
});

export const {
  setLearningLoading,
  beginLearningSync,
  setLearningSnapshot,
  mergeLearningExtras,
  setLearningError,
  hydrateLearningSchedule,
  resetLearningEmpty,
  resetLearningDemo,
} = learningSlice.actions;

export default learningSlice.reducer;
