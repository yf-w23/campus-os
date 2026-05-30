import {createAsyncThunk} from '@reduxjs/toolkit';
import {
  fetchLearningCoreSnapshot,
  fetchLearningExtras,
} from '../../services/campus/learningAdapter';
import {
  beginLearningSync,
  mergeLearningExtras,
  setLearningError,
  setLearningSnapshot,
} from '../slices/learningSlice';
import {clearScheduleError, setCampusSchedule} from '../slices/scheduleSlice';
import {
  loadLearningScheduleCache,
  saveLearningScheduleCache,
} from '../../storage/learningScheduleStorage';
import {AppDispatch, RootState} from '../store';

let activeSync: Promise<void> | null = null;

export const syncCampusData = createAsyncThunk<
  void,
  void,
  {dispatch: AppDispatch; state: RootState; rejectValue: string}
>('learning/syncCampusData', async (_, {dispatch, getState, rejectWithValue}) => {
  const {auth} = getState();
  if (auth.demoMode) {
    return;
  }

  if (activeSync) {
    try {
      await activeSync;
      return;
    } catch {
      // 上一次失败，允许重新同步
    }
  }

  dispatch(beginLearningSync());

  const run = async () => {
    const {learning} = getState();
    const prevSchedule = learning.snapshot?.schedule ?? [];
    const cachedSchedule = await loadLearningScheduleCache();

    const {snapshot, schedulePack} = await fetchLearningCoreSnapshot();

    let schedule = snapshot.schedule;
    if (schedule.length === 0) {
      schedule =
        prevSchedule.length > 0
          ? prevSchedule
          : cachedSchedule.length > 0
            ? cachedSchedule
            : [];
    }

    const merged: typeof snapshot = {...snapshot, schedule};

    if (
      merged.courses.length === 0 &&
      merged.schedule.length === 0 &&
      merged.homework.length === 0
    ) {
      throw new Error('未拉取到课程、课表或作业，请确认 WebVPN 已登录且当前学期有课');
    }

    dispatch(setLearningSnapshot(merged));
    if (schedulePack) {
      dispatch(
        setCampusSchedule({
          calendar: schedulePack.calendar,
          baseSchedule: schedulePack.schedules,
        }),
      );
    }
    if (merged.schedule.length > 0) {
      dispatch(clearScheduleError());
      await saveLearningScheduleCache(merged.schedule);
    }

    fetchLearningExtras(snapshot.courses)
      .then(extras => dispatch(mergeLearningExtras(extras)))
      .catch(() => undefined);
  };

  activeSync = run()
    .catch(error => {
      const message = error instanceof Error ? error.message : '同步校园数据失败';
      dispatch(setLearningError(message));
      throw error;
    })
    .finally(() => {
      activeSync = null;
    });

  try {
    await activeSync;
  } catch (error) {
    const message = error instanceof Error ? error.message : '同步校园数据失败';
    return rejectWithValue(message);
  }
});
