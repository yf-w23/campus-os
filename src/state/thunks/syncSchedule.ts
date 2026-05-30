import {createAsyncThunk} from '@reduxjs/toolkit';
import {fetchScheduleSync} from '../../services/campus/scheduleService';
import {setLearningSnapshot} from '../slices/learningSlice';
import {
  clearScheduleError,
  setCampusSchedule,
  setCampusScheduleError,
} from '../slices/scheduleSlice';
import {saveLearningScheduleCache} from '../../storage/learningScheduleStorage';
import {AppDispatch, RootState} from '../store';

/** 仅刷新 learning.snapshot.schedule（与首页今日课表同源） */
export const syncSchedule = createAsyncThunk<
  void,
  void,
  {dispatch: AppDispatch; state: RootState; rejectValue: string}
>('schedule/syncSchedule', async (_, {dispatch, getState, rejectWithValue}) => {
  const {auth, learning} = getState();
  if (auth.demoMode || !learning.snapshot) {
    return;
  }
  try {
    const prev = learning.snapshot.schedule ?? [];
    const {events: fetchedEvents, pack} = await fetchScheduleSync();
    let events = fetchedEvents;
    if (events.length === 0 && prev.length > 0) {
      events = prev;
    }
    dispatch(
      setLearningSnapshot({
        ...learning.snapshot,
        schedule: events,
        fetchedAt: new Date().toISOString(),
      }),
    );
    if (pack) {
      dispatch(
        setCampusSchedule({
          calendar: pack.calendar,
          baseSchedule: pack.schedules,
        }),
      );
    }
    if (events.length > 0) {
      dispatch(clearScheduleError());
      await saveLearningScheduleCache(events);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : '课表同步失败';
    dispatch(setCampusScheduleError(message));
    return rejectWithValue(message);
  }
});
