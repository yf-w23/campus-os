import React, {useCallback, useEffect, useState} from 'react';
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
import {DetailHeader, EmptyState} from '../common/components/Ui';
import {RootStackParamList} from '../../app/navigation/types';
import {getSportsResources, sportsDateString} from '../../services/campus/sports';

type Props = NativeStackScreenProps<RootStackParamList, 'CampusSportsDetail'>;

interface TimePeriod {
  description: string;
  total: number;
  availableFields: {id: string; name: string; cost: number}[];
}

export function SportsDetailScreen({navigation, route}: Props) {
  const {info} = route.params;
  const [dateOffset, setDateOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | undefined>();
  const [periods, setPeriods] = useState<TimePeriod[]>([]);

  const date = sportsDateString(dateOffset);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setPeriods([]);
    try {
      const {data, init, count, phone: p} = await getSportsResources(
        info.gymId,
        info.itemId,
        date,
      );
      setPhone(p);
      if (init <= 0) {
        setError('当前暂不可预约');
        return;
      }
      if (count === 0) {
        setError(`你有 ${init} 笔未支付订单，请先处理后再预约`);
        return;
      }
      const grouped: Record<string, TimePeriod> = {};
      for (const r of data) {
        if (!grouped[r.timeSession]) {
          grouped[r.timeSession] = {
            description: r.timeSession,
            total: 0,
            availableFields: [],
          };
        }
        grouped[r.timeSession].total += 1;
        if (r.locked !== true && r.userType === undefined && r.canNetBook) {
          grouped[r.timeSession].availableFields.push({
            id: r.resHash,
            name: r.fieldName,
            cost: r.cost ?? 0,
          });
        }
      }
      setPeriods(Object.values(grouped));
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [info.gymId, info.itemId, date]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <DetailHeader title={info.name} onBack={() => navigation.goBack()} />
      <View style={styles.dateRow}>
        {[0, 1, 2, 3].map(off => {
          const active = off === dateOffset;
          return (
            <Pressable
              key={off}
              style={[styles.dateChip, active && styles.dateChipActive]}
              onPress={() => setDateOffset(off)}>
              <Text style={[styles.dateText, active && styles.dateTextActive]}>
                {sportsDateString(off).slice(5)}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} />
        ) : error ? (
          <EmptyState title="无法预约" description={error} />
        ) : periods.length === 0 ? (
          <EmptyState title="暂无场次" description="请换一天或稍后重试" />
        ) : (
          periods.map(period => (
            <View key={period.description} style={styles.periodCard}>
              <Text style={styles.periodTitle}>{period.description}</Text>
              <Text style={styles.periodStat}>
                可约 {period.availableFields.length} / 共 {period.total}
              </Text>
              {period.availableFields.length === 0 ? (
                <Text style={styles.periodEmpty}>该时段已满或未开放</Text>
              ) : (
                period.availableFields.map(field => (
                  <Pressable
                    key={field.id}
                    style={styles.fieldRow}
                    onPress={() =>
                      navigation.navigate('CampusSportsBook', {
                        info,
                        date,
                        phone: phone ?? '',
                        period: period.description,
                        field,
                      })
                    }>
                    <Text style={styles.fieldName}>{field.name}</Text>
                    <Text style={styles.fieldCost}>
                      {field.cost > 0 ? `${field.cost} 元` : '免费'} ›
                    </Text>
                  </Pressable>
                ))
              )}
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background},
  dateRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  dateChip: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: radii.md,
    backgroundColor: colors.surface,
  },
  dateChipActive: {backgroundColor: colors.primaryMuted},
  dateText: {...typography.caption, color: colors.textSecondary},
  dateTextActive: {color: colors.primary, fontWeight: '600'},
  content: {padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md},
  periodCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  periodTitle: {...typography.h3, color: colors.text},
  periodStat: {...typography.caption, color: colors.textSecondary, marginTop: 4},
  periodEmpty: {...typography.caption, color: colors.textMuted, marginTop: spacing.sm},
  fieldRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
    marginTop: spacing.sm,
  },
  fieldName: {...typography.body, color: colors.text},
  fieldCost: {...typography.caption, color: colors.primary, fontWeight: '600'},
});
