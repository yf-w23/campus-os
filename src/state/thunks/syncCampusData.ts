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
  loadLearningScheduleCacheEntry,
  saveLearningScheduleCache,
} from '../../storage/learningScheduleStorage';
import {AppDispatch, RootState} from '../store';

const activeSyncs = new Map<string, Promise<void>>();

export interface SyncCampusDataArgs {
  semesterIndex?: number;
}

function syncKey(semesterIndex?: number): string {
  return semesterIndex === undefined || semesterIndex < 0
    ? 'current'
    : `next:${semesterIndex}`;
}

export const syncCampusData = createAsyncThunk<
  void,
  SyncCampusDataArgs | undefined,
  {dispatch: AppDispatch; state: RootState; rejectValue: string}
>(
  'learning/syncCampusData',
  async (args, {dispatch, getState, rejectWithValue}) => {
    const {auth} = getState();
    if (auth.demoMode) {
      return;
    }

    const key = syncKey(args?.semesterIndex);
    const activeSync = activeSyncs.get(key);
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
      const cachedEntry = await loadLearningScheduleCacheEntry(
        args?.semesterIndex,
      );
      const cachedSchedule = cachedEntry?.events ?? [];

      const {snapshot, schedulePack} = await fetchLearningCoreSnapshot(
        args?.semesterIndex,
      );

      let schedule = snapshot.schedule;
      if (schedule.length === 0) {
        const isCurrentSemester =
          args?.semesterIndex === undefined || args.semesterIndex < 0;
        schedule = isCurrentSemester
          ? cachedSchedule.length > 0
            ? cachedSchedule
            : prevSchedule
          : cachedSchedule;
      }

      const merged: typeof snapshot = {...snapshot, schedule};

      if (
        merged.courses.length === 0 &&
        merged.schedule.length === 0 &&
        merged.homework.length === 0
      ) {
        throw new Error(
          '未拉取到课程、课表或作业，请确认 WebVPN 已登录且当前学期有课',
        );
      }

      dispatch(setLearningSnapshot(merged));
      if (schedulePack) {
        dispatch(
          setCampusSchedule({
            calendar: schedulePack.calendar,
            baseSchedule: schedulePack.schedules,
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
      if (merged.schedule.length > 0) {
        dispatch(clearScheduleError());
      }
      await saveLearningScheduleCache(
        merged.schedule,
        args?.semesterIndex,
        schedulePack ?? cachedEntry?.pack,
      );

      fetchLearningExtras(snapshot.courses)
        .then(extras => dispatch(mergeLearningExtras(extras)))
        .catch(() => undefined);
    };

    const sync = run()
      .catch(error => {
        const message =
          error instanceof Error ? error.message : '同步校园数据失败';
        dispatch(setLearningError(message));
        throw error;
      })
      .finally(() => {
        activeSyncs.delete(key);
      });
    activeSyncs.set(key, sync);

    try {
      await sync;
    } catch (error) {
      const message = error instanceof Error ? error.message : '同步校园数据失败';
      return rejectWithValue(message);
    }
  },
);
