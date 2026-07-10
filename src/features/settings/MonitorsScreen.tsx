import React, {useCallback, useEffect, useState} from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useSelector} from 'react-redux';
import {colors, radii, spacing, typography} from '../../app/theme';
import {DetailHeader} from '../common/components/Ui';
import {PrimaryButton} from '../common/components/Buttons';
import {EmptyHint, InlineLoader} from '../common/components/Status';
import {RootStackParamList} from '../../app/navigation/types';
import {useTranslation} from '../../app/i18n';
import {
  Workflow,
  WorkflowCheckStatus,
  PRESET_WORKFLOWS,
  generateWorkflowId,
} from '../../domain/workflow';
import {
  loadWorkflows,
  saveWorkflows,
  removeWorkflow,
  toggleWorkflow,
} from '../../storage/workflowStorage';
import {
  runWorkflowChecks,
  getLastRunTimestamp,
  isWorkflowCheckerAvailable,
  getWorkflowUnavailableReason,
} from '../../services/workflow/WorkflowEngine';
import {
  BackgroundWorkflowStatus,
  getBackgroundWorkflowStatus,
  requestWorkflowNotificationPermission,
  runHeadlessWorkflowCheckNow,
  syncBackgroundWorkflowScheduler,
} from '../../services/workflow/backgroundWorkflow';
import {
  QuietHoursConfig,
  formatQuietHours,
  loadQuietHoursConfig,
  saveQuietHoursConfig,
} from '../../services/notification/notificationService';
import {selectAuth} from '../../state/selectors';

type Props = NativeStackScreenProps<RootStackParamList, 'Monitors'>;

function conditionLabel(type: string, t: any): string {
  switch (type) {
    case 'electricity_balance':
      return t.monitors.conditionElectricity;
    case 'network_balance':
      return t.monitors.conditionNetwork;
    case 'course_capacity':
      return t.monitors.conditionCourse;
    case 'ddl_reminder':
      return t.monitors.conditionDdl;
    case 'schedule_reminder':
      return t.monitors.conditionSchedule;
    case 'sports_slot':
      return t.monitors.conditionSports;
    case 'library_room':
      return t.monitors.conditionLibraryRoom;
    case 'library_seat':
      return t.monitors.conditionLibrarySeat;
    default:
      return type;
  }
}

function resultStatusLabel(status: WorkflowCheckStatus, t: any): string {
  switch (status) {
    case 'ok':
      return t.monitors.resultOk;
    case 'triggered':
      return t.monitors.resultTriggered;
    case 'unavailable':
      return t.monitors.resultUnavailable;
    case 'error':
      return t.monitors.resultError;
  }
}

function formatDateTime(iso?: string): string {
  if (!iso) {
    return '—';
  }
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) {
    return '—';
  }
  return new Date(time).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function MonitorsScreen({navigation}: Props) {
  const t = useTranslation();
  const auth = useSelector(selectAuth);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [lastCheck, setLastCheck] = useState<number | null>(null);
  const [backgroundStatus, setBackgroundStatus] =
    useState<BackgroundWorkflowStatus | null>(null);
  const [quietHours, setQuietHours] = useState<QuietHoursConfig | null>(null);

  const refreshBackground = useCallback(async () => {
    const [status, quiet] = await Promise.all([
      getBackgroundWorkflowStatus(),
      loadQuietHoursConfig(),
    ]);
    setBackgroundStatus(status);
    setQuietHours(quiet);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const list = await loadWorkflows();
      setWorkflows(list);
      setLastCheck(getLastRunTimestamp());
      await refreshBackground();
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [refreshBackground]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleToggle = async (id: string, enabled: boolean) => {
    const workflow = workflows.find(w => w.id === id);
    if (
      workflow &&
      enabled &&
      !isWorkflowCheckerAvailable(workflow.condition.type)
    ) {
      Alert.alert(
        t.monitors.unavailable,
        getWorkflowUnavailableReason(workflow.condition.type),
      );
      return;
    }
    await toggleWorkflow(id, enabled);
    setWorkflows(prev =>
      prev.map(w => (w.id === id ? {...w, enabled} : w)),
    );
    await syncBackgroundWorkflowScheduler();
    await refreshBackground();
  };

  const handleDelete = (wf: Workflow) => {
    Alert.alert(t.monitors.deleteTitle, t.monitors.deleteConfirm.replace('{name}', wf.name), [
      {text: t.monitors.cancel, style: 'cancel'},
      {
        text: t.monitors.delete,
        style: 'destructive',
        onPress: async () => {
          await removeWorkflow(wf.id);
          setWorkflows(prev => prev.filter(w => w.id !== wf.id));
          await syncBackgroundWorkflowScheduler();
          await refreshBackground();
        },
      },
    ]);
  };

  const handleAddPreset = async () => {
    const now = new Date().toISOString();
    const newWorkflows = PRESET_WORKFLOWS.map(preset => ({
      ...preset,
      id: generateWorkflowId(),
      createdAt: now,
      updatedAt: now,
    }));
    const existing = await loadWorkflows();
    const existingNames = new Set(existing.map(w => w.name));
    const toAdd = newWorkflows.filter(w => !existingNames.has(w.name));
    if (toAdd.length === 0) {
      Alert.alert(t.monitors.addPresetTitle, t.monitors.allPresetsAdded);
      return;
    }
    await saveWorkflows([...existing, ...toAdd]);
    setWorkflows([...existing, ...toAdd]);
    await syncBackgroundWorkflowScheduler();
    await refreshBackground();
  };

  const handleCheckNow = async () => {
    if (auth.demoMode) {
      Alert.alert(t.monitors.demoTitle, t.monitors.demoMessage);
      return;
    }
    setChecking(true);
    try {
      const results = await runWorkflowChecks();
      const triggered = results.filter(r => r.triggered);
      if (results.length === 0) {
        Alert.alert(t.monitors.checkNow, t.monitors.checkSkipped);
      } else if (triggered.length === 0) {
        Alert.alert(t.monitors.checkNow, t.monitors.checkAllOk);
      }
      setLastCheck(Date.now());
      await refresh();
    } catch {
      // ignore
    } finally {
      setChecking(false);
    }
  };

  const handleRequestPermission = async () => {
    const ok = await requestWorkflowNotificationPermission();
    Alert.alert(
      t.monitors.notificationPermission,
      ok ? t.monitors.permissionGranted : t.monitors.permissionDenied,
    );
    await syncBackgroundWorkflowScheduler();
    await refreshBackground();
  };

  const handleQuietHoursToggle = async (enabled: boolean) => {
    const next = {
      ...(quietHours ?? {enabled: true, startMinute: 23 * 60, endMinute: 7 * 60}),
      enabled,
    };
    await saveQuietHoursConfig(next);
    setQuietHours(next);
  };

  const handleRunBackgroundCheck = async () => {
    const ok = await runHeadlessWorkflowCheckNow();
    Alert.alert(
      t.monitors.backgroundTest,
      ok ? t.monitors.backgroundTestStarted : t.monitors.backgroundUnsupported,
    );
    setTimeout(() => {
      refreshBackground().catch(() => undefined);
    }, 1500);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <DetailHeader
        title={t.monitors.title}
        onBack={() => navigation.goBack()}
        rightLabel={loading ? '…' : t.monitors.refresh}
        onRight={() => !loading && refresh()}
      />

      {loading ? (
        <InlineLoader label="加载监控项..." style={styles.center} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}>
          {lastCheck ? (
            <Text style={styles.lastCheck}>
              {t.monitors.lastCheck}: {new Date(lastCheck).toLocaleTimeString('zh-CN')}
            </Text>
          ) : null}

          <View style={styles.backgroundPanel}>
            <View style={styles.backgroundHeader}>
              <View style={styles.backgroundTitleGroup}>
                <Text style={styles.backgroundTitle}>
                  {t.monitors.backgroundMonitoring}
                </Text>
                <Text style={styles.backgroundSubtitle}>
                  {backgroundStatus?.supported
                    ? t.monitors.backgroundSupported
                    : t.monitors.backgroundUnsupported}
                </Text>
              </View>
              <Text
                style={[
                  styles.backgroundBadge,
                  backgroundStatus?.schedulerEnabled
                    ? styles.backgroundBadgeOn
                    : styles.backgroundBadgeOff,
                ]}>
                {backgroundStatus?.schedulerEnabled
                  ? t.monitors.backgroundEnabled
                  : t.monitors.backgroundDisabled}
              </Text>
            </View>
            <View style={styles.backgroundGrid}>
              <View style={styles.backgroundMetric}>
                <Text style={styles.backgroundMetricValue}>
                  {backgroundStatus?.notificationsEnabled
                    ? t.monitors.notificationOn
                    : t.monitors.notificationOff}
                </Text>
                <Text style={styles.backgroundMetricLabel}>
                  {t.monitors.notificationPermission}
                </Text>
              </View>
              <View style={styles.backgroundMetric}>
                <Text style={styles.backgroundMetricValue}>
                  {backgroundStatus?.intervalMinutes
                    ? `${backgroundStatus.intervalMinutes} min`
                    : '—'}
                </Text>
                <Text style={styles.backgroundMetricLabel}>
                  {t.monitors.backgroundInterval}
                </Text>
              </View>
            </View>
            <Text style={styles.backgroundLine}>
              {t.monitors.lastBackgroundRun}: {formatDateTime(backgroundStatus?.lastFinishedAt)}
            </Text>
            {backgroundStatus?.lastResultStatus ? (
              <Text style={styles.backgroundLine}>
                {t.monitors.lastBackgroundResult}: {backgroundStatus.lastResultStatus}
                {backgroundStatus.lastCheckedCount
                  ? ` · ${backgroundStatus.lastCheckedCount} ${t.monitors.backgroundChecks}`
                  : ''}
                {backgroundStatus.lastTriggeredCount
                  ? ` · ${backgroundStatus.lastTriggeredCount} ${t.monitors.backgroundAlerts}`
                  : ''}
              </Text>
            ) : null}
            {backgroundStatus?.lastError ? (
              <Text style={styles.backgroundError} numberOfLines={2}>
                {backgroundStatus.lastError}
              </Text>
            ) : null}
            <View style={styles.quietRow}>
              <View style={styles.quietTextGroup}>
                <Text style={styles.quietTitle}>{t.monitors.quietHours}</Text>
                <Text style={styles.quietSubtitle}>
                  {quietHours ? formatQuietHours(quietHours) : '23:00-07:00'}
                </Text>
              </View>
              <Switch
                value={quietHours?.enabled ?? true}
                onValueChange={handleQuietHoursToggle}
                trackColor={{false: colors.surfaceAlt, true: colors.primary}}
                thumbColor={colors.text}
              />
            </View>
            <View style={styles.backgroundActions}>
              <Pressable
                onPress={handleRequestPermission}
                style={({pressed}) => [
                  styles.backgroundActionBtn,
                  pressed && styles.deleteBtnPressed,
                ]}>
                <Text style={styles.backgroundActionText}>
                  {t.monitors.requestPermission}
                </Text>
              </Pressable>
              <Pressable
                onPress={handleRunBackgroundCheck}
                style={({pressed}) => [
                  styles.backgroundActionBtn,
                  pressed && styles.deleteBtnPressed,
                ]}>
                <Text style={styles.backgroundActionText}>
                  {t.monitors.backgroundTest}
                </Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.actions}>
            <PrimaryButton
              label={t.monitors.addPresets}
              onPress={handleAddPreset}
            />
            <PrimaryButton
              label={checking ? t.monitors.checking : t.monitors.checkNow}
              onPress={handleCheckNow}
              disabled={checking}
            />
          </View>

          {workflows.length === 0 ? (
            <EmptyHint
              title={t.monitors.emptyTitle}
              message={t.monitors.emptyDesc}
              style={styles.emptyHint}
            />
          ) : (
            <View style={styles.list}>
              {workflows.map((wf, idx) => {
                const available = isWorkflowCheckerAvailable(wf.condition.type);
                const canToggle = available || wf.enabled;
                return (
                  <View
                    key={wf.id}
                    style={[styles.card, idx > 0 && styles.cardDivider]}>
                    <View style={styles.cardHeader}>
                      <View style={styles.cardTitleRow}>
                        <View style={styles.cardNameGroup}>
                          <Text style={styles.cardName}>{wf.name}</Text>
                          <Text
                            style={[
                              styles.availabilityBadge,
                              available
                                ? styles.availabilityAvailable
                                : styles.availabilityUnavailable,
                            ]}>
                            {available
                              ? t.monitors.available
                              : t.monitors.unavailable}
                          </Text>
                        </View>
                        <Switch
                          value={wf.enabled}
                          disabled={!canToggle}
                          onValueChange={v => handleToggle(wf.id, v)}
                          trackColor={{
                            false: colors.surfaceAlt,
                            true: colors.primary,
                          }}
                          thumbColor={wf.enabled ? colors.text : colors.textMuted}
                        />
                      </View>
                      <Text style={styles.cardDesc}>{wf.description}</Text>
                      {!available ? (
                        <Text style={styles.unavailableText}>
                          {getWorkflowUnavailableReason(wf.condition.type)}
                        </Text>
                      ) : null}
                    </View>
                    <View style={styles.cardMeta}>
                      <Text style={styles.cardMetaText}>
                        {conditionLabel(wf.condition.type, t)}
                      </Text>
                      {wf.lastCheckedAt ? (
                        <Text style={styles.cardMetaText}>
                          {t.monitors.lastCheck}: {new Date(wf.lastCheckedAt).toLocaleTimeString('zh-CN')}
                        </Text>
                      ) : null}
                      {wf.lastTriggeredAt ? (
                        <Text style={styles.cardMetaText}>
                          {t.monitors.lastTriggered}: {new Date(wf.lastTriggeredAt).toLocaleDateString('zh-CN')}
                        </Text>
                      ) : null}
                    </View>
                    {wf.lastResult ? (
                      <View style={styles.resultBox}>
                        <Text
                          style={[
                            styles.resultBadge,
                            wf.lastResult.status === 'ok' && styles.resultOk,
                            wf.lastResult.status === 'triggered' &&
                              styles.resultTriggered,
                            wf.lastResult.status === 'unavailable' &&
                              styles.resultUnavailable,
                            wf.lastResult.status === 'error' && styles.resultError,
                          ]}>
                          {resultStatusLabel(wf.lastResult.status, t)}
                        </Text>
                        <Text style={styles.resultText} numberOfLines={2}>
                          {wf.lastResult.detail ?? wf.lastResult.message}
                        </Text>
                      </View>
                    ) : null}
                    <View style={styles.cardActions}>
                      <Pressable
                        onPress={() => handleDelete(wf)}
                        style={({pressed}) => [
                          styles.deleteBtn,
                          pressed && styles.deleteBtnPressed,
                        ]}>
                        <Text style={styles.deleteBtnText}>{t.monitors.delete}</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyHint: {paddingVertical: spacing.xxl},
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl + spacing.xl,
  },
  lastCheck: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  backgroundPanel: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: spacing.md,
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  backgroundHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  backgroundTitleGroup: {
    flex: 1,
    gap: 3,
  },
  backgroundTitle: {
    ...typography.body,
    color: colors.text,
    fontWeight: '700',
  },
  backgroundSubtitle: {
    ...typography.caption,
    color: colors.textMuted,
  },
  backgroundBadge: {
    ...typography.micro,
    borderRadius: radii.pill,
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 3,
    fontWeight: '700',
  },
  backgroundBadgeOn: {
    color: colors.success,
    backgroundColor: colors.successMuted,
  },
  backgroundBadgeOff: {
    color: colors.warning,
    backgroundColor: colors.warningMuted,
  },
  backgroundGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  backgroundMetric: {
    flex: 1,
    minHeight: 56,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    justifyContent: 'center',
  },
  backgroundMetricValue: {
    ...typography.label,
    color: colors.text,
    fontWeight: '700',
  },
  backgroundMetricLabel: {
    ...typography.micro,
    color: colors.textMuted,
    marginTop: 2,
  },
  backgroundLine: {
    ...typography.micro,
    color: colors.textSecondary,
  },
  backgroundError: {
    ...typography.micro,
    color: colors.error,
  },
  quietRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
    paddingTop: spacing.sm,
  },
  quietTextGroup: {
    flex: 1,
    gap: 2,
  },
  quietTitle: {
    ...typography.caption,
    color: colors.text,
    fontWeight: '700',
  },
  quietSubtitle: {
    ...typography.micro,
    color: colors.textMuted,
  },
  backgroundActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  backgroundActionBtn: {
    flex: 1,
    alignItems: 'center',
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceAlt,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  backgroundActionText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '700',
  },
  actions: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  list: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    overflow: 'hidden',
  },
  card: {
    padding: spacing.md,
  },
  cardDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  cardHeader: {
    gap: 4,
    marginBottom: spacing.xs,
  },
  cardTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  cardNameGroup: {
    flex: 1,
    gap: 6,
  },
  cardName: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
  },
  cardDesc: {
    ...typography.caption,
    color: colors.textMuted,
  },
  availabilityBadge: {
    ...typography.micro,
    alignSelf: 'flex-start',
    borderRadius: radii.pill,
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 3,
    fontWeight: '700',
  },
  availabilityAvailable: {
    color: colors.success,
    backgroundColor: colors.successMuted,
  },
  availabilityUnavailable: {
    color: colors.warning,
    backgroundColor: colors.warningMuted,
  },
  unavailableText: {
    ...typography.micro,
    color: colors.warning,
    lineHeight: 16,
  },
  cardMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.xs,
  },
  cardMetaText: {
    ...typography.micro,
    color: colors.textSecondary,
  },
  resultBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    marginBottom: spacing.xs,
  },
  resultBadge: {
    ...typography.micro,
    borderRadius: radii.pill,
    overflow: 'hidden',
    paddingHorizontal: 7,
    paddingVertical: 2,
    fontWeight: '700',
  },
  resultOk: {
    color: colors.success,
    backgroundColor: colors.successMuted,
  },
  resultTriggered: {
    color: colors.primary,
    backgroundColor: colors.primaryMuted,
  },
  resultUnavailable: {
    color: colors.warning,
    backgroundColor: colors.warningMuted,
  },
  resultError: {
    color: colors.error,
    backgroundColor: colors.errorMuted,
  },
  resultText: {
    ...typography.micro,
    color: colors.textSecondary,
    flex: 1,
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  deleteBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.sm,
  },
  deleteBtnPressed: {
    backgroundColor: colors.errorMuted,
  },
  deleteBtnText: {
    ...typography.caption,
    color: colors.error,
    fontWeight: '500',
  },
});
