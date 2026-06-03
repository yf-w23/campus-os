import React, {useEffect, useState} from 'react';
import {Provider, useDispatch} from 'react-redux';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {ActivityIndicator, AppState, StatusBar, Text, View} from 'react-native';
import {store, AppDispatch} from './src/state/store';
import {setAuthenticated, setDemoMode} from './src/state/slices/authSlice';
import {
  hydrateLearningSchedule,
  resetLearningDemo,
  resetLearningEmpty,
} from './src/state/slices/learningSlice';
import {loadLearningScheduleCache} from './src/storage/learningScheduleStorage';
import {
  setLocale,
  setTrustDevice,
  setAIApiKeyConfigured,
} from './src/state/slices/settingsSlice';
import {hydrateConversations, setProvider} from './src/state/slices/aiSlice';
import {hydratePersonalEvents} from './src/state/slices/scheduleSlice';
import {hydrateManualDeadlines} from './src/state/slices/manualDeadlineSlice';
import {
  loadPersonalEvents,
  savePersonalEvents,
} from './src/storage/personalEventsStorage';
import {
  loadManualDeadlines,
  saveManualDeadlines,
} from './src/storage/manualDeadlinesStorage';
import {AI_PRESETS} from './src/services/ai/agentService';
import {
  loadConversations,
  saveConversations,
} from './src/storage/conversationsStorage';
import {
  getAIProviderConfig,
  getLocale,
  getSessionStudentId,
  getTrustDevice,
  isDemoMode,
} from './src/storage/preferencesStorage';
import {loadAIApiKey} from './src/storage/secureStorage';
import {tsinghuaAuthService} from './src/services/auth/tsinghuaAuth';
import {syncCampusData} from './src/state/thunks/syncCampusData';
import {runWorkflowChecks} from './src/services/workflow/WorkflowEngine';
import {colors} from './src/app/theme';

function Bootstrap() {
  const dispatch = useDispatch<AppDispatch>();
  const [NavComponent, setNavComponent] = useState<React.ComponentType | null>(
    null,
  );
  const [bootError, setBootError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [demoMode, locale, trustDevice, providerConfig] =
          await Promise.all([
            isDemoMode(),
            getLocale(),
            getTrustDevice(),
            getAIProviderConfig(),
          ]);

        dispatch(setDemoMode(demoMode));
        if (demoMode) {
          dispatch(resetLearningDemo());
        } else {
          dispatch(resetLearningEmpty());
        }
        dispatch(setLocale(locale));
        dispatch(setTrustDevice(trustDevice));

        if (providerConfig) {
          const refreshed =
            providerConfig.preset !== 'custom'
              ? AI_PRESETS[providerConfig.preset]
              : providerConfig;
          dispatch(setProvider(refreshed));
          const apiKey = await loadAIApiKey(providerConfig.preset);
          dispatch(setAIApiKeyConfigured(Boolean(apiKey)));
        }

        const [persistedAI, persistedEvents, persistedDeadlines] = await Promise.all([
          loadConversations(),
          loadPersonalEvents(),
          loadManualDeadlines(),
        ]);
        dispatch(hydrateConversations(persistedAI));
        dispatch(hydratePersonalEvents(persistedEvents));
        dispatch(hydrateManualDeadlines(persistedDeadlines));
        const cachedSchedule = await loadLearningScheduleCache();
        if (cachedSchedule.length > 0) {
          dispatch(hydrateLearningSchedule(cachedSchedule));
        }

        if (!demoMode) {
          const sessionStudentId = await getSessionStudentId();
          if (sessionStudentId) {
            const creds = await tsinghuaAuthService.hydrateCredentials();
            if (creds) {
              dispatch(
                setAuthenticated({
                  isAuthenticated: true,
                  studentId: sessionStudentId,
                  displayName: sessionStudentId,
                  authenticatedAt: new Date().toISOString(),
                  webvpnReady: true,
                }),
              );
              dispatch(syncCampusData());
            }
          }
        }

        const mod = require('./src/app/navigation/AppNavigator') as typeof import(
          './src/app/navigation/AppNavigator'
        );
        setNavComponent(() => mod.AppNavigator);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : '应用初始化失败，请重启 App';
        setBootError(message);
      }
    })();
  }, [dispatch]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', nextState => {
      if (nextState === 'active') {
        const check = async () => {
          try {
            await runWorkflowChecks();
          } catch {
            // 静默失败
          }
        };
        check();
      }
    });
    return () => sub.remove();
  }, []);

  return (
    <>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={colors.background}
        translucent={false}
      />
      {NavComponent ? (
        <NavComponent />
      ) : (
        <View
          style={{
            flex: 1,
            backgroundColor: colors.background,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            paddingHorizontal: 24,
          }}>
          {bootError ? (
            <>
              <Text style={{color: colors.error, textAlign: 'center'}}>
                {bootError}
              </Text>
              <Text style={{color: colors.textMuted, textAlign: 'center'}}>
                请摇一摇打开开发菜单，选择 Reload
              </Text>
            </>
          ) : (
            <>
              <ActivityIndicator color={colors.primary} size="large" />
              <Text style={{color: colors.textSecondary}}>正在加载…</Text>
            </>
          )}
        </View>
      )}
    </>
  );
}

function App(): React.JSX.Element {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let lastEvents = store.getState().schedule.personalEvents;
    const unsubscribe = store.subscribe(() => {
      const events = store.getState().schedule.personalEvents;
      if (!store.getState().schedule.hydrated || events === lastEvents) {
        return;
      }
      lastEvents = events;
      if (timer) {
        clearTimeout(timer);
      }
      timer = setTimeout(() => {
        void savePersonalEvents(events);
      }, 400);
    });
    return () => {
      unsubscribe();
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let lastDeadlines = store.getState().manualDeadlines.items;
    const unsubscribe = store.subscribe(() => {
      const {items, hydrated} = store.getState().manualDeadlines;
      if (!hydrated || items === lastDeadlines) {
        return;
      }
      lastDeadlines = items;
      if (timer) {
        clearTimeout(timer);
      }
      timer = setTimeout(() => {
        void saveManualDeadlines(items);
      }, 400);
    });
    return () => {
      unsubscribe();
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let lastConversations = store.getState().ai.conversations;
    const unsubscribe = store.subscribe(() => {
      const {conversations, activeConversationId} = store.getState().ai;
      if (conversations === lastConversations) {
        return;
      }
      lastConversations = conversations;
      if (timer) {
        clearTimeout(timer);
      }
      timer = setTimeout(() => {
        void saveConversations(conversations, activeConversationId);
      }, 400);
    });
    return () => {
      unsubscribe();
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, []);

  return (
    <Provider store={store}>
      <SafeAreaProvider>
        <Bootstrap />
      </SafeAreaProvider>
    </Provider>
  );
}

export default App;
