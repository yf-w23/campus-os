import React, {useEffect, useState} from 'react';
import {Provider, useDispatch} from 'react-redux';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {ActivityIndicator, StatusBar, Text, View} from 'react-native';
import {store, AppDispatch} from './src/state/store';
import {setAuthenticated, setDemoMode} from './src/state/slices/authSlice';
import {resetLearningDemo, resetLearningEmpty} from './src/state/slices/learningSlice';
import {
  setLocale,
  setTrustDevice,
  setAIApiKeyConfigured,
  setColorScheme,
} from './src/state/slices/settingsSlice';
import {hydrateConversations, setProvider} from './src/state/slices/aiSlice';
import {
  loadConversations,
  saveConversations,
} from './src/storage/conversationsStorage';
import {
  getAIProviderConfig,
  getColorScheme,
  getLocale,
  getSessionStudentId,
  getTrustDevice,
  isDemoMode,
} from './src/storage/preferencesStorage';
import {loadAIApiKey} from './src/storage/secureStorage';
import {tsinghuaAuthService} from './src/services/auth/tsinghuaAuth';
import {syncCampusData} from './src/state/thunks/syncCampusData';
import {applyScheme, colors} from './src/app/theme';
import type {ColorScheme} from './src/app/theme';

/**
 * Bootstrap 不在模块顶层 import AppNavigator —— 等 colorScheme 落盘后再
 * 动态 import，这样所有屏幕模块顶层的 StyleSheet.create 才能拿到正确调色板。
 */
function Bootstrap() {
  const dispatch = useDispatch<AppDispatch>();
  const [NavComponent, setNavComponent] = useState<React.ComponentType | null>(
    null,
  );
  const [scheme, setScheme] = useState<ColorScheme>('dark');
  const [bootError, setBootError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [demoMode, locale, trustDevice, providerConfig, loadedScheme] =
          await Promise.all([
            isDemoMode(),
            getLocale(),
            getTrustDevice(),
            getAIProviderConfig(),
            getColorScheme(),
          ]);

        // 必须先 applyScheme 再加载 AppNavigator —— 顺序敏感。
        applyScheme(loadedScheme);
        setScheme(loadedScheme);
        dispatch(setColorScheme(loadedScheme));

        dispatch(setDemoMode(demoMode));
        if (demoMode) {
          dispatch(resetLearningDemo());
        } else {
          dispatch(resetLearningEmpty());
        }
        dispatch(setLocale(locale));
        dispatch(setTrustDevice(trustDevice));

        if (providerConfig) {
          dispatch(setProvider(providerConfig));
          const apiKey = await loadAIApiKey(providerConfig.preset);
          dispatch(setAIApiKeyConfigured(Boolean(apiKey)));
        }

        // 载入持久化的 AI 对话历史
        const persistedAI = await loadConversations();
        dispatch(hydrateConversations(persistedAI));

        // === 持久化登录恢复（对齐 THU Info）===
        // 上次登录过 + Keychain 仍有凭证 → 乐观进入主界面，后台静默续期会话。
        // Cookie 过期时，首屏 syncCampusData 会经 withSessionRecovery 用保存的
        // 学号密码 + 复用的设备指纹自动重登，通常无需再次 2FA。
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

        // 用 require 而非 import()，避免真机调试时分包加载失败导致永久黑屏。
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

  const isLight = scheme === 'light';

  return (
    <>
      <StatusBar
        barStyle={isLight ? 'dark-content' : 'light-content'}
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
  // 防抖持久化 AI 对话历史：会话数组引用一变就保存（包含流式追加，debounce 合并）。
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
