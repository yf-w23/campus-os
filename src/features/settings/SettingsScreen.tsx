import React, {useState} from 'react';
import {
  DevSettings,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import {useDispatch, useSelector} from 'react-redux';
import {useTranslation} from '../../app/i18n';
import {colors, spacing, typography} from '../../app/theme';
import {PrimaryButton} from '../common/components/Buttons';
import {AI_PRESETS} from '../../services/ai/agentService';
import {selectAuth, selectSettings} from '../../state/selectors';
import {
  logout,
  setDemoMode,
} from '../../state/slices/authSlice';
import {resetLearningDemo, resetLearningEmpty} from '../../state/slices/learningSlice';
import {
  setAIApiKeyConfigured,
  setLocale,
  setTrustDevice,
} from '../../state/slices/settingsSlice';
import {setProvider} from '../../state/slices/aiSlice';
import {
  clearCredentials,
  saveAIApiKey,
} from '../../storage/secureStorage';
import {
  setDemoMode as persistDemoMode,
  setLocale as persistLocale,
  setTrustDevice as persistTrustDevice,
  setAIProviderConfig,
} from '../../storage/preferencesStorage';
import {AIProviderPreset} from '../../domain/agent';

const presetKeys = Object.keys(AI_PRESETS) as AIProviderPreset[];

export function SettingsScreen() {
  const t = useTranslation();
  const dispatch = useDispatch();
  const auth = useSelector(selectAuth);
  const settings = useSelector(selectSettings);
  const [apiKey, setApiKey] = useState('');
  const [selectedPreset, setSelectedPreset] = useState<AIProviderPreset>('deepseek');

  const handleSaveProvider = async () => {
    const preset = AI_PRESETS[selectedPreset];
    dispatch(setProvider(preset));
    await setAIProviderConfig(preset);
    if (apiKey.trim()) {
      await saveAIApiKey(selectedPreset, apiKey.trim());
      dispatch(setAIApiKeyConfigured(true));
    }
  };

  const handleToggleDemo = async (enabled: boolean) => {
    dispatch(setDemoMode(enabled));
    if (enabled) {
      dispatch(resetLearningDemo());
    } else {
      dispatch(resetLearningEmpty());
    }
    await persistDemoMode(enabled);
  };

  const handleToggleTrust = async (enabled: boolean) => {
    dispatch(setTrustDevice(enabled));
    await persistTrustDevice(enabled);
  };

  const handleToggleLocale = async () => {
    const next = settings.locale === 'zh' ? 'en' : 'zh';
    dispatch(setLocale(next));
    await persistLocale(next);
  };

  const handleLogout = async () => {
    await clearCredentials();
    dispatch(logout());
    dispatch(resetLearningEmpty());
    await persistDemoMode(false);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{t.settings.title}</Text>

      <View style={styles.row}>
        <Text style={styles.label}>{t.settings.demoMode}</Text>
        <Switch value={auth.demoMode} onValueChange={handleToggleDemo} />
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>{t.settings.trustDevice}</Text>
        <Switch value={settings.trustDevice} onValueChange={handleToggleTrust} />
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>{t.settings.language}</Text>
        <PrimaryButton
          label={settings.locale === 'zh' ? '中文 / EN' : 'EN / 中文'}
          onPress={handleToggleLocale}
          variant="ghost"
        />
      </View>

      <Text style={styles.section}>{t.settings.aiProvider}</Text>
      <View style={styles.presetRow}>
        {presetKeys.map(key => (
          <Text
            key={key}
            style={[
              styles.presetChip,
              selectedPreset === key && styles.presetChipActive,
            ]}
            onPress={() => setSelectedPreset(key)}>
            {AI_PRESETS[key].label}
          </Text>
        ))}
      </View>

      <TextInput
        style={styles.input}
        placeholder={t.settings.apiKey}
        placeholderTextColor={colors.textMuted}
        secureTextEntry
        value={apiKey}
        onChangeText={setApiKey}
      />
      <PrimaryButton label={t.settings.save} onPress={handleSaveProvider} />

      {!auth.demoMode ? (
        <PrimaryButton label={t.settings.logout} onPress={handleLogout} variant="ghost" />
      ) : null}

      {__DEV__ ? (
        <PrimaryButton
          label={t.settings.reloadJs}
          onPress={() => DevSettings.reload()}
          variant="ghost"
        />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  title: {
    ...typography.h1,
    color: colors.text,
  },
  section: {
    ...typography.h3,
    color: colors.text,
    marginTop: spacing.md,
  },
  row: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    ...typography.body,
    color: colors.text,
    flex: 1,
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  presetChip: {
    ...typography.caption,
    color: colors.textSecondary,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  presetChipActive: {
    color: '#fff',
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  input: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...typography.body,
    color: colors.text,
  },
});
