/**
 * 单个分区的座位列表 — 点击楼层后跳进来。
 * 显示该分区内全部座位编号 + 状态（可用 / 占用 / 已预约）。
 */
import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {colors, radii, shadows, spacing, typography} from '../../app/theme';
import {DetailHeader, EmptyState} from '../common/components/Ui';
import {RootStackParamList} from '../../app/navigation/types';
import {
  bookLibrarySeat,
  DateChoice,
  LibrarySeat,
  getLibrarySeatList,
} from '../../services/campus/library';

type Props = NativeStackScreenProps<RootStackParamList, 'CampusLibrarySection'>;

interface SeatStat {
  available: number;
  reserved: number;
  occupied: number;
  total: number;
}

function statusInfo(status: number): {label: string; tone: 'ok' | 'warn' | 'bad' | 'mute'} {
  switch (status) {
    case 1:
      return {label: '可用', tone: 'ok'};
    case 6:
      return {label: '已预约', tone: 'warn'};
    case 7:
      return {label: '已占用', tone: 'bad'};
    default:
      return {label: '不可用', tone: 'mute'};
  }
}

const TONE_COLOR: Record<'ok' | 'warn' | 'bad' | 'mute', string> = {
  ok: '#10B981',
  warn: '#F59E0B',
  bad: '#EF4444',
  mute: '#94A3B8',
};

export function LibrarySectionScreen({navigation, route}: Props) {
  const {sectionId, sectionName, initialDateChoice} = route.params;
  const [dateChoice, setDateChoice] = useState<DateChoice>(initialDateChoice ?? 0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [seats, setSeats] = useState<LibrarySeat[]>([]);
  const [filter, setFilter] = useState<'all' | 'ok' | 'taken'>('all');
  const [booking, setBooking] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await getLibrarySeatList(sectionId, dateChoice);
      setSeats(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
      setSeats([]);
    } finally {
      setLoading(false);
    }
  }, [sectionId, dateChoice]);

  useEffect(() => {
    load();
  }, [load]);

  /** 弹确认 → 调 bookLibrarySeat → 显示结果 → 刷新座位 */
  const handleBook = useCallback(
    (seat: LibrarySeat) => {
      if (booking) return;
      if (seat.status !== 1) {
        Alert.alert('无法预约', '该座位当前不可预约');
        return;
      }
      const dateLabel = dateChoice === 0 ? '今天' : '明天';
      Alert.alert(
        '确认预约',
        `要预约座位 ${seat.zhName || `#${seat.id}`}（${dateLabel}）吗？\n\n预约成功后请按时到馆，并在终端刷卡 / 扫码签到，否则可能影响后续预约信用。`,
        [
          {text: '取消', style: 'cancel'},
          {
            text: '确认预约',
            onPress: async () => {
              setBooking(true);
              try {
                const result = await bookLibrarySeat(
                  {id: seat.id, type: seat.type},
                  sectionId,
                  dateChoice,
                );
                if (result.status === 0) {
                  Alert.alert(
                    '预约成功',
                    `${seat.zhName || `#${seat.id}`} 已预约` +
                      (result.msg ? `\n\n${result.msg}` : ''),
                    [{text: '好的', onPress: () => load()}],
                  );
                } else {
                  Alert.alert(
                    '预约失败',
                    result.msg || `服务端返回 status=${result.status}`,
                  );
                }
              } catch (e) {
                Alert.alert('预约失败', (e as Error).message ?? '未知错误');
              } finally {
                setBooking(false);
              }
            },
          },
        ],
      );
    },
    [booking, dateChoice, sectionId, load],
  );

  const stat: SeatStat = useMemo(() => {
    let available = 0;
    let reserved = 0;
    let occupied = 0;
    for (const s of seats) {
      if (s.status === 1) available++;
      else if (s.status === 6) reserved++;
      else if (s.status === 7) occupied++;
    }
    return {available, reserved, occupied, total: seats.length};
  }, [seats]);

  const visibleSeats = useMemo(() => {
    if (filter === 'all') return seats;
    if (filter === 'ok') return seats.filter(s => s.status === 1);
    return seats.filter(s => s.status === 6 || s.status === 7);
  }, [seats, filter]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <DetailHeader
        title={sectionName}
        onBack={() => navigation.goBack()}
        rightLabel={loading ? '…' : '刷新'}
        onRight={() => !loading && load()}
      />

      <View style={styles.dateRow}>
        {(['今天', '明天'] as const).map((label, idx) => {
          const active = (idx as DateChoice) === dateChoice;
          return (
            <Pressable
              key={label}
              style={[styles.dateChip, active && styles.dateChipActive]}
              onPress={() => setDateChoice(idx as DateChoice)}>
              <Text
                style={[styles.dateChipText, active && styles.dateChipTextActive]}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.hint}>正在加载座位…</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorTitle}>加载失败</Text>
          <Text style={styles.errorMsg}>{error}</Text>
          <Pressable style={styles.retry} onPress={load}>
            <Text style={styles.retryText}>重试</Text>
          </Pressable>
        </View>
      ) : seats.length === 0 ? (
        <EmptyState title="无座位数据" description="该分区暂无可显示的座位" />
      ) : (
        <>
          <View style={styles.statRow}>
            <StatCell
              label="可用"
              value={stat.available}
              total={stat.total}
              color={TONE_COLOR.ok}
            />
            <StatCell
              label="已预约"
              value={stat.reserved}
              total={stat.total}
              color={TONE_COLOR.warn}
            />
            <StatCell
              label="已占用"
              value={stat.occupied}
              total={stat.total}
              color={TONE_COLOR.bad}
            />
          </View>

          <View style={styles.filterRow}>
            {(
              [
                ['all', '全部'],
                ['ok', '可用'],
                ['taken', '已被预约 / 占用'],
              ] as const
            ).map(([key, label]) => {
              const active = filter === key;
              return (
                <Pressable
                  key={key}
                  style={[styles.filterChip, active && styles.filterChipActive]}
                  onPress={() => setFilter(key)}>
                  <Text
                    style={[
                      styles.filterChipText,
                      active && styles.filterChipTextActive,
                    ]}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <ScrollView contentContainerStyle={styles.grid}>
            <Text style={styles.tipText}>
              点击 <Text style={{color: TONE_COLOR.ok, fontWeight: '600'}}>绿色</Text> 的座位即可预约
            </Text>
            <View style={styles.gridInner}>
              {visibleSeats.map(seat => {
                const info = statusInfo(seat.status);
                const bookable = seat.status === 1;
                return (
                  <Pressable
                    key={seat.id}
                    style={({pressed}) => [
                      styles.seatCell,
                      {borderColor: TONE_COLOR[info.tone]},
                      bookable && pressed && {opacity: 0.6},
                    ]}
                    onPress={bookable ? () => handleBook(seat) : undefined}
                    disabled={!bookable || booking}>
                    <Text
                      style={[
                        styles.seatName,
                        {color: TONE_COLOR[info.tone]},
                      ]}>
                      {seat.zhName || `#${seat.id}`}
                    </Text>
                    <Text
                      style={[
                        styles.seatStatus,
                        {color: TONE_COLOR[info.tone]},
                      ]}>
                      {info.label}
                    </Text>
                  </Pressable>
                );
              })}
              {visibleSeats.length === 0 ? (
                <Text style={styles.emptyFilter}>
                  当前筛选下没有座位
                </Text>
              ) : null}
            </View>
          </ScrollView>
        </>
      )}
    </SafeAreaView>
  );
}

function StatCell({
  label,
  value,
  total,
  color,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
}) {
  const percent = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <View style={[styles.statCell, {borderColor: color}]}>
      <Text style={[styles.statValue, {color}]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statPercent}>{percent}%</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background},
  dateRow: {
    flexDirection: 'row',
    padding: 4,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.md,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  dateChip: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: radii.sm,
  },
  dateChipActive: {backgroundColor: colors.surface},
  dateChipText: {...typography.caption, color: colors.textSecondary},
  dateChipTextActive: {color: colors.text, fontWeight: '600'},

  statRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  statCell: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    gap: 2,
  },
  statValue: {...typography.h2, fontWeight: '700'},
  statLabel: {...typography.caption, color: colors.textSecondary},
  statPercent: {...typography.micro, color: colors.textMuted},

  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.surface,
  },
  filterChipActive: {
    borderColor: colors.primary,
    backgroundColor: '#E3F2FD',
  },
  filterChipText: {...typography.micro, color: colors.textSecondary},
  filterChipTextActive: {color: colors.primary, fontWeight: '600'},

  grid: {paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xxl},
  tipText: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  gridInner: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
  seatCell: {
    width: 76,
    paddingVertical: spacing.sm,
    paddingHorizontal: 4,
    borderRadius: radii.sm,
    borderWidth: 1.5,
    backgroundColor: colors.surface,
    alignItems: 'center',
    gap: 2,
    ...shadows.soft,
  },
  seatName: {...typography.caption, fontWeight: '600'},
  seatStatus: {...typography.micro},
  emptyFilter: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    width: '100%',
    paddingVertical: spacing.lg,
  },

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
  },
  hint: {...typography.caption, color: colors.textSecondary},
  errorTitle: {...typography.h3, color: colors.error},
  errorMsg: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  retry: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radii.md,
  },
  retryText: {...typography.label, color: '#fff'},
});
