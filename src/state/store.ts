import {configureStore} from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import learningReducer from './slices/learningSlice';
import scheduleReducer from './slices/scheduleSlice';
import manualDeadlineReducer from './slices/manualDeadlineSlice';
import aiReducer from './slices/aiSlice';
import settingsReducer from './slices/settingsSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    learning: learningReducer,
    schedule: scheduleReducer,
    manualDeadlines: manualDeadlineReducer,
    ai: aiReducer,
    settings: settingsReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
