import React, {useCallback, useEffect, useState} from 'react';
import {
  ActivityIndicator,
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
import {DetailHeader, EmptyState} from '../common/components/Ui';
import {PrimaryButton} from '../common/components/Buttons';
import {RootStackParamList} from '../../app/navigation/types';
import {useTranslation} from '../../app/i18n';
import {
  Workflow,
  PRESET_WORKFLOWS,
  generateWorkflowId,
} from '../../domain/workflow';
import {
  loadWorkflows,
  saveWorkflows,
  removeWorkflow,
  toggleWorkflow,
} from '../../storage/workflowStorage';
import {runWorkflowChecks, getLastRunTimestamp} from '../../services/workflow/WorkflowEngine';
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
    default:
      return type;
  }
}

export function MonitorsScreen({navigation}: Props) {
  const t = useTranslation();
  const auth = useSelector(selectAuth);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [lastCheck, setLastCheck] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const list = await loadWorkflows();
      setWorkflows(list);
      setLastCheck(getLastRunTimestamp());
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleToggle = async (id: string, enabled: boolean) => {
    await toggleWorkflow(id, enabled);
    setWorkflows(prev =>
      prev.map(w => (w.id === id ? {...w, enabled} : w)),
    );
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
      if (triggered.length === 0) {
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

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <DetailHeader
        title={t.monitors.title}
        onBack={() => navigation.goBack()}
        rightLabel={loading ? '…' : t.monitors.refresh}
        onRight={() => !loading && refresh()}
      />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}>
          {lastCheck ? (
            <Text style={styles.lastCheck}>
              {t.monitors.lastCheck}: {new Date(lastCheck).toLocaleTimeString('zh-CN')}
            </Text>
          ) : null}

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
            <EmptyState
              title={t.monitors.emptyTitle}
              description={t.monitors.emptyDesc}
            />
          ) : (
            <View style={styles.list}>
              {workflows.map((wf, idx) => (
                <View
                  key={wf.id}
                  style={[styles.card, idx > 0 && styles.cardDivider]}>
                  <View style={styles.cardHeader}>
                    <View style={styles.cardTitleRow}>
                      <Text style={styles.cardName}>{wf.name}</Text>
                      <Switch
                        value={wf.enabled}
                        onValueChange={v => handleToggle(wf.id, v)}
                        trackColor={{false: colors.surfaceAlt, true: colors.primary}}
                        thumbColor={colors.text}
                      />
                    </View>
                    <Text style={styles.cardDesc}>{wf.description}</Text>
                  </View>
                  <View style={styles.cardMeta}>
                    <Text style={styles.cardMetaText}>
                      {conditionLabel(wf.condition.type, t)}
                    </Text>
                    {wf.lastTriggeredAt ? (
                      <Text style={styles.cardMetaText}>
                        {t.monitors.lastTriggered}: {new Date(wf.lastTriggeredAt).toLocaleDateString('zh-CN')}
                      </Text>
                    ) : null}
                  </View>
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
              ))}
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
  },
  cardName: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
    flex: 1,
  },
  cardDesc: {
    ...typography.caption,
    color: colors.textMuted,
  },
  cardMeta: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.xs,
  },
  cardMetaText: {
    ...typography.micro,
    color: colors.textSecondary,
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
