import React, {useState} from 'react';
import {
  Alert,
  DevSettings,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useDispatch, useSelector} from 'react-redux';
import {useTranslation} from '../../app/i18n';
import {colors, radii, spacing, typography} from '../../app/theme';
import type {ColorScheme} from '../../app/theme';
import {PrimaryButton} from '../common/components/Buttons';
import {ScreenHeader} from '../common/components/Ui';
import {AI_PRESETS} from '../../services/ai/agentService';
import {selectAuth, selectSettings} from '../../state/selectors';
import {logout, setDemoMode} from '../../state/slices/authSlice';
import {resetLearningDemo, resetLearningEmpty} from '../../state/slices/learningSlice';
import {
  setAIApiKeyConfigured,
  setColorScheme,
  setLocale,
  setTrustDevice,
} from '../../state/slices/settingsSlice';
import {setProvider} from '../../state/slices/aiSlice';
import {clearCredentials, saveAIApiKey} from '../../storage/secureStorage';
import {
  clearSessionStudentId,
  setColorScheme as persistColorScheme,
  setDemoMode as persistDemoMode,
  setLocale as persistLocale,
  setTrustDevice as persistTrustDevice,
  setAIProviderConfig,
} from '../../storage/preferencesStorage';
import {AIProviderPreset} from '../../domain/agent';

const presetKeys = Object.keys(AI_PRESETS) as AIProviderPreset[];

interface RowProps {
  label: string;
  value?: string;
  onPress?: () => void;
  right?: React.ReactNode;
  divider?: boolean;
}

function Row({label, value, onPress, right, divider}: RowProps) {
  const Inner = (
    <View style={[styles.row, divider && styles.rowDivider]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowRight}>
        {value ? <Text style={styles.rowValue}>{value}</Text> : null}
        {right}
      </View>
    </View>
  );
  if (!onPress) return Inner;
  return (
    <Pressable
      onPress={onPress}
      style={({pressed}) => [pressed && styles.rowPressed]}>
      {Inner}
    </Pressable>
  );
}

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
    await clearSessionStudentId();
    dispatch(logout());
    dispatch(resetLearningEmpty());
    await persistDemoMode(false);
  };

  const handleSwitchScheme = async (next: ColorScheme) => {
    if (next === settings.colorScheme) return;
    dispatch(setColorScheme(next));
    await persistColorScheme(next);
    Alert.alert(t.settings.appearance, t.settings.appearanceRestart);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <ScreenHeader
          eyebrow={t.tabs.settings}
          title={t.settings.title}
          subtitle={auth.demoMode ? '演示模式' : auth.session.studentId ?? '账号与偏好'}
        />

        <Text style={[styles.groupHeader, styles.groupHeaderFirst]}>偏好</Text>
        <View style={styles.group}>
          <Row
            label={t.settings.demoMode}
            right={
              <Switch
                value={auth.demoMode}
                onValueChange={handleToggleDemo}
                trackColor={{false: colors.surfaceAlt, true: colors.primary}}
                thumbColor={colors.text}
              />
            }
            divider
          />
          <Row
            label={t.settings.trustDevice}
            right={
              <Switch
                value={settings.trustDevice}
                onValueChange={handleToggleTrust}
                trackColor={{false: colors.surfaceAlt, true: colors.primary}}
                thumbColor={colors.text}
              />
            }
            divider
          />
          <Row
            label={t.settings.language}
            value={settings.locale === 'zh' ? '中文' : 'English'}
            onPress={handleToggleLocale}
            right={<Text style={styles.chev}>›</Text>}
            divider
          />
          <View style={styles.appearanceRow}>
            <Text style={styles.rowLabel}>{t.settings.appearance}</Text>
            <View style={styles.segment}>
              {(['dark', 'light'] as const).map(s => {
                const active = settings.colorScheme === s;
                return (
                  <Pressable
                    key={s}
                    onPress={() => handleSwitchScheme(s)}
                    style={[styles.segmentItem, active && styles.segmentItemActive]}>
                    <Text
                      style={[
                        styles.segmentText,
                        active && styles.segmentTextActive,
                      ]}>
                      {s === 'dark'
                        ? t.settings.appearanceDark
                        : t.settings.appearanceLight}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>

        <Text style={styles.groupHeader}>{t.settings.aiProvider}</Text>
        <View style={styles.presetRow}>
          {presetKeys.map(key => (
            <Pressable
              key={key}
              onPress={() => setSelectedPreset(key)}
              style={[
                styles.presetChip,
                selectedPreset === key && styles.presetChipActive,
              ]}>
              <Text
                style={[
                  styles.presetChipText,
                  selectedPreset === key && styles.presetChipTextActive,
                ]}>
                {AI_PRESETS[key].label}
              </Text>
            </Pressable>
          ))}
        </View>

        <TextInput
          style={styles.input}
          placeholder={t.settings.apiKey}
          placeholderTextColor={colors.textMuted}
          secureTextEntry
          value={apiKey}
          onChangeText={setApiKey}
          autoCapitalize="none"
        />
        <View style={styles.actions}>
          <PrimaryButton label={t.settings.save} onPress={handleSaveProvider} />
        </View>

        <View style={styles.bottomActions}>
          {!auth.demoMode ? (
            <PrimaryButton
              label={t.settings.logout}
              onPress={handleLogout}
              variant="ghost"
            />
          ) : null}
          {__DEV__ ? (
            <PrimaryButton
              label={t.settings.reloadJs}
              onPress={() => DevSettings.reload()}
              variant="ghost"
            />
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl + spacing.xl,
  },
  groupHeader: {
    ...typography.micro,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    paddingLeft: spacing.xs,
  },
  groupHeaderFirst: {
    marginTop: 0,
  },
  group: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    minHeight: 52,
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  rowPressed: {
    backgroundColor: colors.surfaceAlt,
  },
  rowLabel: {
    ...typography.body,
    color: colors.text,
    flex: 1,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  rowValue: {
    ...typography.body,
    color: colors.textSecondary,
  },
  chev: {
    fontSize: 20,
    color: colors.textMuted,
    fontWeight: '300',
  },
  appearanceRow: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.md,
    padding: 3,
  },
  segmentItem: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.sm,
  },
  segmentItemActive: {
    backgroundColor: colors.surface,
  },
  segmentText: {
    ...typography.caption,
    color: colors.textMuted,
  },
  segmentTextActive: {
    color: colors.text,
    fontWeight: '600',
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs + 2,
    marginBottom: spacing.md,
  },
  presetChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  presetChipActive: {
    backgroundColor: colors.primaryMuted,
    borderColor: colors.primary,
  },
  presetChipText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  presetChipTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  input: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md - 2,
    ...typography.body,
    color: colors.text,
    marginBottom: spacing.md,
  },
  actions: {
    gap: spacing.sm,
  },
  bottomActions: {
    marginTop: spacing.xl + spacing.md,
    gap: spacing.sm,
  },
});
