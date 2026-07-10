import React, {useCallback, useState} from 'react';
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
import {useFocusEffect} from '@react-navigation/native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useDispatch, useSelector} from 'react-redux';
import {useNavigation} from '@react-navigation/native';
import {useTranslation} from '../../app/i18n';
import {colors, radii, spacing, typography} from '../../app/theme';
import {PrimaryButton} from '../common/components/Buttons';
import {ScreenHeader} from '../common/components/Ui';
import {AI_PRESETS} from '../../services/ai/agentService';
import {selectAI, selectAuth, selectSettings} from '../../state/selectors';
import {logout, setDemoMode} from '../../state/slices/authSlice';
import {resetLearningDemo, resetLearningEmpty} from '../../state/slices/learningSlice';
import {
  setAIApiKeyConfigured,
  setLocale,
  setTrustDevice,
} from '../../state/slices/settingsSlice';
import {setProvider} from '../../state/slices/aiSlice';
import {clearCredentials, saveAIApiKey} from '../../storage/secureStorage';
import {
  clearActionAuditRecords,
  loadActionAuditRecords,
} from '../../storage/actionAuditStorage';
import {
  clearSessionStudentId,
  setDemoMode as persistDemoMode,
  setLocale as persistLocale,
  setTrustDevice as persistTrustDevice,
  setAIProviderConfig,
} from '../../storage/preferencesStorage';
import {AIProviderPreset, AIMemory} from '../../domain/agent';
import {AuditRecord} from '../../domain/actions';
import {
  loadAIMemory,
  clearAIMemory,
  summarizeMemory,
} from '../../storage/aiMemoryStorage';

const presetKeys = Object.keys(AI_PRESETS) as AIProviderPreset[];

function getRiskLabels(t: any): Record<AuditRecord['risk'], string> {
  return {
    read: t.settings.riskRead,
    write_reversible: t.settings.riskWriteReversible,
    write_irreversible: t.settings.riskWriteIrreversible,
    payment: t.settings.riskPayment,
    credential: t.settings.riskCredential,
  };
}

function getConfirmationLabels(t: any): Record<AuditRecord['confirmation'], string> {
  return {
    not_required: t.settings.confirmNotRequired,
    approved: t.settings.confirmApproved,
    denied: t.settings.confirmDenied,
    unavailable: t.settings.confirmUnavailable,
  };
}

function getStatusLabels(t: any): Record<AuditRecord['status'], string> {
  return {
    success: t.settings.statusSuccess,
    error: t.settings.statusError,
    cancelled: t.settings.statusCancelled,
  };
}

function formatAuditTime(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    return value;
  }
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hour = String(d.getHours()).padStart(2, '0');
  const minute = String(d.getMinutes()).padStart(2, '0');
  return `${month}-${day} ${hour}:${minute}`;
}

function formatAuditJson(value: unknown): string {
  try {
    const text = JSON.stringify(value, null, 2);
    if (!text) {
      return '';
    }
    return text.length > 800 ? `${text.slice(0, 800)}...` : text;
  } catch {
    return String(value ?? '');
  }
}

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
  if (!onPress) {
    return Inner;
  }
  return (
    <Pressable
      onPress={onPress}
      style={({pressed}) => [pressed && styles.rowPressed]}>
      {Inner}
    </Pressable>
  );
}

function MemoryField({label, value}: {label: string; value: string}) {
  return (
    <View style={styles.memoryField}>
      <Text style={styles.memoryFieldLabel}>{label}</Text>
      <Text style={styles.memoryFieldValue}>{value}</Text>
    </View>
  );
}

export function SettingsScreen() {
  const t = useTranslation();
  const dispatch = useDispatch();
  const navigation = useNavigation<any>();
  const auth = useSelector(selectAuth);
  const settings = useSelector(selectSettings);
  const {provider} = useSelector(selectAI);
  const [apiKey, setApiKey] = useState('');
  const [selectedPreset, setSelectedPreset] = useState<AIProviderPreset>('deepseek');
  // 自定义 provider 的 base URL / 模型名（仅 selectedPreset === 'custom' 时使用）
  const [customBaseUrl, setCustomBaseUrl] = useState(
    provider.preset === 'custom' ? provider.baseUrl ?? '' : '',
  );
  const [customModel, setCustomModel] = useState(
    provider.preset === 'custom' ? provider.model : '',
  );
  const [auditRecords, setAuditRecords] = useState<AuditRecord[]>([]);
  const [expandedAuditId, setExpandedAuditId] = useState<string | null>(null);
  const [aiMemory, setAiMemory] = useState<AIMemory>({});
  const [memoryExpanded, setMemoryExpanded] = useState(false);

  const riskLabels = getRiskLabels(t);
  const confirmationLabels = getConfirmationLabels(t);
  const statusLabels = getStatusLabels(t);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      loadActionAuditRecords()
        .then(records => {
          if (active) {
            setAuditRecords(records);
          }
        })
        .catch(() => undefined);
      loadAIMemory()
        .then(memory => {
          if (active) {
            setAiMemory(memory);
          }
        })
        .catch(() => undefined);
      return () => {
        active = false;
      };
    }, []),
  );

  const handleSaveProvider = async () => {
    let config = AI_PRESETS[selectedPreset];
    if (selectedPreset === 'custom') {
      const baseUrl = customBaseUrl.trim();
      const model = customModel.trim();
      if (!baseUrl || !model) {
        Alert.alert(t.settings.customProviderTitle, '请填写 Base URL 与模型名');
        return;
      }
      config = {...AI_PRESETS.custom, baseUrl, model};
    }
    dispatch(setProvider(config));
    await setAIProviderConfig(config);
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

  const handleClearAuditRecords = () => {
    Alert.alert(
      t.settings.clearRecordsConfirmTitle,
      t.settings.clearRecordsConfirmMsg,
      [
        {text: t.settings.cancel, style: 'cancel'},
        {
          text: t.settings.clear,
          style: 'destructive',
          onPress: async () => {
            await clearActionAuditRecords();
            setAuditRecords([]);
          },
        },
      ],
    );
  };

  const handleClearMemory = () => {
    Alert.alert(
      t.settings.clearMemoryConfirmTitle,
      t.settings.clearMemoryConfirmMsg,
      [
        {text: t.settings.cancel, style: 'cancel'},
        {
          text: t.settings.clear,
          style: 'destructive',
          onPress: async () => {
            await clearAIMemory();
            setAiMemory({});
          },
        },
      ],
    );
  };

  const hasMemory = Boolean(
    aiMemory.favoriteLibrary ||
    aiMemory.favoriteSection ||
    aiMemory.defaultRechargeAmount ||
    (aiMemory.watchedCourses?.length) ||
    (aiMemory.notes?.length),
  );

  const memorySummary = summarizeMemory(aiMemory);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <ScreenHeader
          eyebrow={t.tabs.settings}
          title={t.settings.title}
          subtitle={auth.demoMode ? t.settings.demoMode : auth.session.studentId ?? t.settings.account}
        />

        <Text style={[styles.groupHeader, styles.groupHeaderFirst]}>{t.settings.preferences}</Text>
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
          <Row
            label={t.settings.monitors}
            value={t.monitors.title}
            onPress={() => navigation.navigate('Monitors')}
            right={<Text style={styles.chev}>›</Text>}
            divider
          />
          <Row
            label="AI 权限面板"
            value="工具开关"
            onPress={() => navigation.navigate('AIPermissions')}
            right={<Text style={styles.chev}>›</Text>}
            divider
          />
          <Row
            label="数据新鲜度"
            value="缓存状态"
            onPress={() => navigation.navigate('CacheFreshness')}
            right={<Text style={styles.chev}>›</Text>}
          />
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

        {selectedPreset === 'custom' ? (
          <>
            <TextInput
              style={styles.input}
              placeholder={t.settings.customProviderPlaceholderBaseUrl}
              placeholderTextColor={colors.textMuted}
              value={customBaseUrl}
              onChangeText={setCustomBaseUrl}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
            <TextInput
              style={styles.input}
              placeholder={t.settings.customProviderPlaceholderModel}
              placeholderTextColor={colors.textMuted}
              value={customModel}
              onChangeText={setCustomModel}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </>
        ) : null}

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

        <Text style={styles.groupHeader}>{t.settings.aiActionRecords}</Text>
        <View style={styles.auditGroup}>
          {auditRecords.length === 0 ? (
            <Text style={styles.auditEmpty}>{t.settings.noAiActionRecords}</Text>
          ) : (
            auditRecords.slice(0, 6).map((record, index) => {
              const expanded = expandedAuditId === record.id;
              return (
              <Pressable
                key={record.id}
                onPress={() =>
                  setExpandedAuditId(current =>
                    current === record.id ? null : record.id,
                  )
                }
                style={[
                  styles.auditRecord,
                  index < Math.min(auditRecords.length, 6) - 1 &&
                    styles.auditRecordDivider,
                ]}>
                <View style={styles.auditTopLine}>
                  <Text style={styles.auditTitle} numberOfLines={1}>
                    {record.toolTitle ?? record.toolName}
                  </Text>
                  <Text
                    style={[
                      styles.auditStatus,
                      record.status === 'success' && styles.auditStatusSuccess,
                      record.status === 'error' && styles.auditStatusError,
                      record.status === 'cancelled' &&
                        styles.auditStatusCancelled,
                    ]}>
                    {statusLabels[record.status]}
                  </Text>
                </View>
                <Text style={styles.auditMeta} numberOfLines={1}>
                  {formatAuditTime(record.createdAt)} · {riskLabels[record.risk]} ·{' '}
                  {confirmationLabels[record.confirmation]}
                </Text>
                {record.resultSummary || record.errorMessage ? (
                  <Text style={styles.auditDetail} numberOfLines={2}>
                    {record.errorMessage ?? record.resultSummary}
                  </Text>
                ) : null}
                {record.verification ? (
                  <Text style={styles.auditDetail} numberOfLines={1}>
                    验证：{record.verification.ok ? t.settings.verifyPass : t.settings.verifyFail}
                    {record.verification.message
                      ? ` · ${record.verification.message}`
                      : ''}
                  </Text>
                ) : null}
                <Text style={styles.auditExpandHint}>
                  {expanded ? t.settings.collapse : t.settings.expand}
                </Text>
                {expanded ? (
                  <View style={styles.auditExpanded}>
                    <View style={styles.auditExpandedRow}>
                      <Text style={styles.auditExpandedLabel}>权限</Text>
                      <Text style={styles.auditExpandedValue}>
                        {record.permission}
                      </Text>
                    </View>
                    {record.preview ? (
                      <>
                        <View style={styles.auditExpandedRow}>
                          <Text style={styles.auditExpandedLabel}>影响</Text>
                          <Text style={styles.auditExpandedValue}>
                            {record.preview.affectedResource ||
                              record.preview.title}
                          </Text>
                        </View>
                        <Text style={styles.auditPreviewText}>
                          {record.preview.summary}
                        </Text>
                      </>
                    ) : null}
                    {record.verification?.message ? (
                      <Text style={styles.auditPreviewText}>
                        验证结果：{record.verification.message}
                      </Text>
                    ) : null}
                    {record.params != null ? (
                      <View style={styles.auditParamsBox}>
                        <Text style={styles.auditParamsTitle}>脱敏参数</Text>
                        <Text style={styles.auditParamsText}>
                          {formatAuditJson(record.params)}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                ) : null}
              </Pressable>
              );
            })
          )}
        </View>
        {auditRecords.length > 0 ? (
          <View style={styles.auditActions}>
            <PrimaryButton
              label={`${t.settings.clearActionRecords}（${auditRecords.length}）`}
              onPress={handleClearAuditRecords}
              variant="ghost"
            />
          </View>
        ) : null}

        <Text style={styles.groupHeader}>{t.settings.aiMemory}</Text>
        <View style={styles.auditGroup}>
          {hasMemory ? (
            <>
              <Pressable
                style={styles.memorySummaryRow}
                onPress={() => setMemoryExpanded(!memoryExpanded)}>
                <Text style={styles.memorySummaryText} numberOfLines={memoryExpanded ? undefined : 3}>
                  {memorySummary}
                </Text>
                <Text style={styles.memoryExpandHint}>
                  {memoryExpanded ? t.settings.collapse : t.settings.expand}
                </Text>
              </Pressable>
              {memoryExpanded ? (
                <View style={styles.memoryDetails}>
                  {aiMemory.favoriteLibrary ? (
                    <MemoryField
                      label={t.settings.memoryFavoriteLibrary}
                      value={`${aiMemory.favoriteLibrary}${
                        aiMemory.favoriteSection ? ` · ${aiMemory.favoriteSection}` : ''
                      }`}
                    />
                  ) : null}
                  {aiMemory.defaultRechargeAmount ? (
                    <MemoryField
                      label={t.settings.memoryDefaultRecharge}
                      value={`${aiMemory.defaultRechargeAmount} 元`}
                    />
                  ) : null}
                  {aiMemory.watchedCourses?.length ? (
                    <MemoryField
                      label={t.settings.memoryWatchedCourses}
                      value={aiMemory.watchedCourses.join('、')}
                    />
                  ) : null}
                  {aiMemory.notes?.length ? (
                    <MemoryField
                      label={t.settings.memoryNotes}
                      value={aiMemory.notes.join('；')}
                    />
                  ) : null}
                </View>
              ) : null}
            </>
          ) : (
            <Text style={styles.auditEmpty}>{t.settings.noAiMemory}</Text>
          )}
        </View>
        {hasMemory ? (
          <View style={styles.auditActions}>
            <PrimaryButton
              label={t.settings.clearAiMemory}
              onPress={handleClearMemory}
              variant="ghost"
            />
          </View>
        ) : null}

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
  auditGroup: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    overflow: 'hidden',
  },
  auditEmpty: {
    ...typography.body,
    color: colors.textMuted,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
    textAlign: 'center',
  },
  auditRecord: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: 4,
  },
  auditRecordDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  auditTopLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  auditTitle: {
    ...typography.body,
    color: colors.text,
    flex: 1,
    fontWeight: '600',
  },
  auditStatus: {
    ...typography.micro,
    color: colors.textMuted,
    fontWeight: '700',
  },
  auditStatusSuccess: {
    color: colors.success,
  },
  auditStatusError: {
    color: colors.error,
  },
  auditStatusCancelled: {
    color: colors.warning,
  },
  auditMeta: {
    ...typography.caption,
    color: colors.textMuted,
  },
  auditDetail: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  auditExpandHint: {
    ...typography.micro,
    color: colors.primary,
    fontWeight: '700',
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  auditExpanded: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
    gap: spacing.xs,
  },
  auditExpandedRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  auditExpandedLabel: {
    ...typography.micro,
    color: colors.textMuted,
    width: 38,
  },
  auditExpandedValue: {
    ...typography.micro,
    color: colors.text,
    flex: 1,
  },
  auditPreviewText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  auditParamsBox: {
    marginTop: spacing.xs,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceAlt,
    padding: spacing.sm,
    gap: 4,
  },
  auditParamsTitle: {
    ...typography.micro,
    color: colors.textMuted,
    fontWeight: '700',
  },
  auditParamsText: {
    ...typography.micro,
    color: colors.textSecondary,
    fontFamily: 'monospace',
  },
  auditActions: {
    marginTop: spacing.sm,
  },
  bottomActions: {
    marginTop: spacing.xl + spacing.md,
    gap: spacing.sm,
  },
  memorySummaryRow: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: 8,
  },
  memorySummaryText: {
    ...typography.body,
    color: colors.text,
    lineHeight: 22,
  },
  memoryExpandHint: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '500',
  },
  memoryDetails: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: 6,
  },
  memoryField: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  memoryFieldLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  memoryFieldValue: {
    ...typography.caption,
    color: colors.text,
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
    marginLeft: spacing.md,
  },
});
