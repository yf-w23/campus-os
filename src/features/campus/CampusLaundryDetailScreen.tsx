import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {colors, radii, spacing, typography} from '../../app/theme';
import {RootStackParamList} from '../../app/navigation/types';
import {DetailHeader} from '../common/components/Ui';
import {PrimaryButton} from '../common/components/Buttons';
import {
  LaundryFloor,
  LaundryMachine,
  LaundryMachineStatus,
  getLaundryFloors,
} from '../../services/campus/laundry';

type Props = NativeStackScreenProps<RootStackParamList, 'CampusLaundryDetail'>;

const statusMeta: Record<
  LaundryMachineStatus,
  {label: string; tone: string; background: string}
> = {
  idle: {
    label: '空闲',
    tone: colors.success,
    background: colors.successMuted,
  },
  working: {
    label: '运行中',
    tone: colors.textSecondary,
    background: colors.surfaceAlt,
  },
  error: {
    label: '故障',
    tone: colors.error,
    background: colors.errorMuted,
  },
};

function machineMainLabel(machine: LaundryMachine): string {
  return machine.location
    ? `${machine.location} ${machine.type}`
    : `${machine.name} ${machine.type}`;
}

function machineStatusLabel(machine: LaundryMachine): string {
  if (machine.status === 'working' && machine.etaMinutes != null) {
    return `剩余 ${machine.etaMinutes} 分钟`;
  }
  return statusMeta[machine.status].label;
}

function StatPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <View style={styles.statPill}>
      <Text style={[styles.statValue, {color: tone}]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function MachineCard({machine}: {machine: LaundryMachine}) {
  const meta = statusMeta[machine.status];
  return (
    <View style={styles.machineCard}>
      <View style={styles.machineTop}>
        <Text style={styles.machineTitle} numberOfLines={2}>
          {machineMainLabel(machine)}
        </Text>
        <View style={[styles.statusDot, {backgroundColor: meta.tone}]} />
      </View>
      {machine.location ? (
        <Text style={styles.machineMeta} numberOfLines={1}>
          编号 {machine.name}
        </Text>
      ) : null}
      <Text
        style={[
          styles.machineStatus,
          {color: meta.tone, backgroundColor: meta.background},
        ]}>
        {machineStatusLabel(machine)}
      </Text>
      {machine.updatedAt ? (
        <Text style={styles.machineMeta} numberOfLines={1}>
          更新 {machine.updatedAt}
        </Text>
      ) : (
        <Text style={styles.machineMeta}>实时状态</Text>
      )}
    </View>
  );
}

export function CampusLaundryDetailScreen({navigation, route}: Props) {
  const [floors, setFloors] = useState<LaundryFloor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const building = route.params;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setFloors(await getLaundryFloors(building));
    } catch (e) {
      setError(e instanceof Error ? e.message : '洗衣机状态加载失败');
    } finally {
      setLoading(false);
    }
  }, [building]);

  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo(() => {
    const machines = floors.flatMap(floor => floor.machines);
    return {
      total: machines.length,
      idle: machines.filter(item => item.status === 'idle').length,
      working: machines.filter(item => item.status === 'working').length,
      error: machines.filter(item => item.status === 'error').length,
    };
  }, [floors]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <DetailHeader
        title={building.name}
        onBack={() => navigation.goBack()}
        rightLabel={loading ? undefined : '刷新'}
        onRight={load}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.summary}>
          <Text style={styles.summaryLabel}>
            {building.platform === 'haile' ? '海乐生活' : '洁力洗衣'}
          </Text>
          <Text style={styles.summaryTitle}>{building.name}</Text>
          <View style={styles.statsRow}>
            <StatPill label="空闲" value={stats.idle} tone={colors.success} />
            <StatPill
              label="运行"
              value={stats.working}
              tone={colors.textSecondary}
            />
            <StatPill label="异常" value={stats.error} tone={colors.error} />
          </View>
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
            <PrimaryButton label="重试" onPress={load} variant="ghost" />
          </View>
        ) : null}

        {loading ? (
          <ActivityIndicator color={colors.primary} style={styles.loader} />
        ) : null}

        {!loading && !error && stats.total === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>暂无设备状态</Text>
            <Text style={styles.emptyText}>可以稍后刷新，或换一个楼宇查看。</Text>
          </View>
        ) : null}

        {!loading &&
          floors.map(floor => (
            <View key={floor.name} style={styles.floorSection}>
              <Text style={styles.sectionTitle}>{floor.name}</Text>
              <View style={styles.machineGrid}>
                {floor.machines.map(machine => (
                  <MachineCard
                    key={`${machine.floor}-${machine.name}-${machine.type}`}
                    machine={machine}
                  />
                ))}
              </View>
            </View>
          ))}

        {!loading && stats.total > 0 ? (
          <Pressable
            onPress={load}
            style={({pressed}) => [styles.refreshNote, pressed && styles.pressed]}>
            <Text style={styles.refreshText}>状态由第三方洗衣平台提供，点击刷新</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background},
  content: {padding: spacing.lg, paddingBottom: spacing.xxl},
  loader: {marginVertical: spacing.xxl},
  summary: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  summaryLabel: {...typography.micro, color: colors.textMuted},
  summaryTitle: {...typography.h2, color: colors.text},
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  statPill: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    gap: 2,
  },
  statValue: {fontSize: 20, lineHeight: 24, fontWeight: '700'},
  statLabel: {...typography.micro, color: colors.textMuted},
  errorBox: {
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.errorMuted,
    borderRadius: radii.md,
    gap: spacing.sm,
  },
  errorText: {...typography.caption, color: colors.error},
  emptyBox: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    gap: spacing.xs,
  },
  emptyTitle: {...typography.body, color: colors.textSecondary},
  emptyText: {...typography.caption, color: colors.textMuted},
  floorSection: {marginTop: spacing.lg},
  sectionTitle: {
    ...typography.label,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    fontSize: 12,
    marginBottom: spacing.sm,
    paddingLeft: spacing.xs,
  },
  machineGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  machineCard: {
    width: '48%',
    minHeight: 136,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: spacing.md,
    gap: spacing.xs,
  },
  machineTop: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
  machineTitle: {
    ...typography.caption,
    color: colors.text,
    fontWeight: '600',
    flex: 1,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 5,
  },
  machineStatus: {
    ...typography.caption,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
    overflow: 'hidden',
    fontWeight: '700',
  },
  machineMeta: {...typography.micro, color: colors.textMuted},
  refreshNote: {
    marginTop: spacing.lg,
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  refreshText: {...typography.caption, color: colors.primary},
  pressed: {opacity: 0.7},
});
