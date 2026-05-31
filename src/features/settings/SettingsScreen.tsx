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
import {AIProviderPreset} from '../../domain/agent';
import {AuditRecord} from '../../domain/actions';

const presetKeys = Object.keys(AI_PRESETS) as AIProviderPreset[];

const riskLabels: Record<AuditRecord['risk'], string> = {
  read: '只读',
  write_reversible: '可撤销写入',
  write_irreversible: '不可逆写入',
  payment: '支付',
  credential: '凭证',
};

const confirmationLabels: Record<AuditRecord['confirmation'], string> = {
  not_required: '无需确认',
  approved: '已确认',
  denied: '已取消',
  unavailable: '无确认通道',
};

const statusLabels: Record<AuditRecord['status'], string> = {
  success: '成功',
  error: '失败',
  cancelled: '已取消',
};

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

export function SettingsScreen() {
  const t = useTranslation();
  const dispatch = useDispatch();
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
        Alert.alert('自定义服务', '请填写 Base URL 与模型名');
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
    Alert.alert('清空 AI 操作记录', '这只会清除本机审计记录，不影响对话历史。', [
      {text: '取消', style: 'cancel'},
      {
        text: '清空',
        style: 'destructive',
        onPress: async () => {
          await clearActionAuditRecords();
          setAuditRecords([]);
        },
      },
    ]);
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
              placeholder="Base URL（如 https://api.example.com/v1）"
              placeholderTextColor={colors.textMuted}
              value={customBaseUrl}
              onChangeText={setCustomBaseUrl}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
            <TextInput
              style={styles.input}
              placeholder="模型名（如 gpt-4o-mini）"
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

        <Text style={styles.groupHeader}>AI 操作记录</Text>
        <View style={styles.auditGroup}>
          {auditRecords.length === 0 ? (
            <Text style={styles.auditEmpty}>暂无 AI 工具操作记录</Text>
          ) : (
            auditRecords.slice(0, 6).map((record, index) => (
              <View
                key={record.id}
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
                    验证：{record.verification.ok ? '通过' : '未通过'}
                    {record.verification.message
                      ? ` · ${record.verification.message}`
                      : ''}
                  </Text>
                ) : null}
              </View>
            ))
          )}
        </View>
        {auditRecords.length > 0 ? (
          <View style={styles.auditActions}>
            <PrimaryButton
              label={`清空操作记录（${auditRecords.length}）`}
              onPress={handleClearAuditRecords}
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
  auditActions: {
    marginTop: spacing.sm,
  },
  bottomActions: {
    marginTop: spacing.xl + spacing.md,
    gap: spacing.sm,
  },
});
