import {store} from '../../state/store';
import {setAuthenticated, setDemoMode} from '../../state/slices/authSlice';
import {
  hydrateLearningSchedule,
  resetLearningDemo,
  resetLearningEmpty,
} from '../../state/slices/learningSlice';
import {hydrateManualDeadlines} from '../../state/slices/manualDeadlineSlice';
import {hydratePersonalEvents} from '../../state/slices/scheduleSlice';
import {syncCampusData} from '../../state/thunks/syncCampusData';
import {loadLearningScheduleCache} from '../../storage/learningScheduleStorage';
import {loadManualDeadlines} from '../../storage/manualDeadlinesStorage';
import {loadPersonalEvents} from '../../storage/personalEventsStorage';
import {getSessionStudentId, isDemoMode} from '../../storage/preferencesStorage';
import {tsinghuaAuthService} from '../auth/tsinghuaAuth';
import {runWorkflowChecks} from './WorkflowEngine';
import {recordBackgroundWorkflowResult} from './backgroundWorkflow';

interface HeadlessWorkflowPayload {
  source?: string;
  scheduledAt?: number;
}

export async function campusWorkflowBackgroundTask(
  _payload?: HeadlessWorkflowPayload,
): Promise<void> {
  const results = [];
  try {
    const runnable = await hydrateBackgroundState();
    if (!runnable) {
      await recordBackgroundWorkflowResult([]);
      return;
    }
    await syncCampusDataBestEffort();
    const checked = await runWorkflowChecks();
    results.push(...checked);
    await recordBackgroundWorkflowResult(checked);
  } catch (error) {
    await recordBackgroundWorkflowResult(results, error);
  }
}

async function hydrateBackgroundState(): Promise<boolean> {
  const [demoMode, sessionStudentId, personalEvents, manualDeadlines, schedule] =
    await Promise.all([
      isDemoMode(),
      getSessionStudentId(),
      loadPersonalEvents(),
      loadManualDeadlines(),
      loadLearningScheduleCache(),
    ]);

  store.dispatch(setDemoMode(demoMode));
  if (demoMode) {
    store.dispatch(resetLearningDemo());
    return false;
  }

  store.dispatch(resetLearningEmpty());
  store.dispatch(hydratePersonalEvents(personalEvents));
  store.dispatch(hydrateManualDeadlines(manualDeadlines));
  store.dispatch(hydrateLearningSchedule(schedule));

  if (!sessionStudentId) {
    return false;
  }
  const credentials = await tsinghuaAuthService.hydrateCredentials();
  if (!credentials) {
    return false;
  }
  store.dispatch(
    setAuthenticated({
      isAuthenticated: true,
      studentId: sessionStudentId,
      displayName: sessionStudentId,
      authenticatedAt: new Date().toISOString(),
      webvpnReady: true,
    }),
  );
  return true;
}

async function syncCampusDataBestEffort(): Promise<void> {
  try {
    await store.dispatch(syncCampusData()).unwrap();
  } catch {
    // Cached schedule/manual DDL plus balance monitors can still run.
  }
}
