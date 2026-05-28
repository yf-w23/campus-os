import React, {useEffect, useState} from 'react';
import {Provider, useDispatch} from 'react-redux';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {StatusBar} from 'react-native';
import {AppNavigator} from './src/app/navigation/AppNavigator';
import {store, AppDispatch} from './src/state/store';
import {setDemoMode} from './src/state/slices/authSlice';
import {resetLearningDemo, resetLearningEmpty} from './src/state/slices/learningSlice';
import {setLocale, setTrustDevice, setAIApiKeyConfigured} from './src/state/slices/settingsSlice';
import {setProvider} from './src/state/slices/aiSlice';
import {
  getAIProviderConfig,
  getLocale,
  getTrustDevice,
  isDemoMode,
} from './src/storage/preferencesStorage';
import {loadAIApiKey} from './src/storage/secureStorage';
import {colors} from './src/app/theme';

function Bootstrap() {
  const dispatch = useDispatch<AppDispatch>();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const [demoMode, locale, trustDevice, providerConfig] = await Promise.all([
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
        dispatch(setProvider(providerConfig));
        const apiKey = await loadAIApiKey(providerConfig.preset);
        dispatch(setAIApiKeyConfigured(Boolean(apiKey)));
      }
      setReady(true);
    })();
  }, [dispatch]);

  if (!ready) {
    return null;
  }

  return <AppNavigator />;
}

function App(): React.JSX.Element {
  return (
    <Provider store={store}>
      <SafeAreaProvider>
        <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
        <Bootstrap />
      </SafeAreaProvider>
    </Provider>
  );
}

export default App;
