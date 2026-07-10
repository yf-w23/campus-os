import {createAsyncThunk} from '@reduxjs/toolkit';
import {fetchScheduleSync} from '../../services/campus/scheduleService';
import {setLearningSnapshot} from '../slices/learningSlice';
import {
  clearScheduleError,
  setCampusSchedule,
  setCampusScheduleError,
} from '../slices/scheduleSlice';
import {
  loadLearningScheduleCacheEntry,
  saveLearningScheduleCache,
} from '../../storage/learningScheduleStorage';
import {AppDispatch, RootState} from '../store';

/** 仅刷新 learning.snapshot.schedule（与首页今日课表同源） */
export const syncSchedule = createAsyncThunk<
  void,
  {semesterIndex?: number} | undefined,
  {dispatch: AppDispatch; state: RootState; rejectValue: string}
>('schedule/syncSchedule', async (args, {dispatch, getState, rejectWithValue}) => {
  const {auth, learning} = getState();
  if (auth.demoMode || !learning.snapshot) {
    return;
  }
  try {
    const cachedEntry = await loadLearningScheduleCacheEntry(
      args?.semesterIndex,
    );
    const prev = learning.snapshot.schedule ?? [];
    const {events: fetchedEvents, pack} = await fetchScheduleSync(
      args?.semesterIndex,
    );
    let events = fetchedEvents;
    if (events.length === 0) {
      const isCurrentSemester =
        args?.semesterIndex === undefined || args.semesterIndex < 0;
      events = cachedEntry?.events?.length
        ? cachedEntry.events
        : isCurrentSemester
          ? prev
          : [];
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
    } else if (cachedEntry?.pack) {
      dispatch(
        setCampusSchedule({
          calendar: cachedEntry.pack.calendar,
          baseSchedule: cachedEntry.pack.schedules,
        }),
      );
    }
    if (events.length > 0) {
      dispatch(clearScheduleError());
    }
    await saveLearningScheduleCache(
      events,
      args?.semesterIndex,
      pack ?? cachedEntry?.pack,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : '课表同步失败';
    dispatch(setCampusScheduleError(message));
    return rejectWithValue(message);
  }
});
