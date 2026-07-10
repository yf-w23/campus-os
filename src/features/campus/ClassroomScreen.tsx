/**
 * 教室查询 — native 实现。
 *
 * 与上游 thu-info-app `classroomDetail.tsx` 对齐的关键点：
 *   1. 每天**固定 6 节**（PERIODS_PER_DAY），不再用 `floor(status.length / 7)` 动态推。
 *      上游 model 注释明确："status is an array of 42(=7*6) ClassroomStatuses (starting from Monday)"。
 *   2. 教室名格式是 `"教室号:容量(人)"`（例如 `"6A101:60(人)"`），UI 用 `:` 拆分成两列显示。
 *   3. 状态色：上游用 grey / themePurple 两态；这里保留细分（teaching/exam/borrowed/disabled）以提供更多信息，
 *      但默认 AVAILABLE 为绿色而不是灰色，符合本 app 的视觉风格。
 *
 * 三段控制：教学楼水平 chip → 周次选择 → 周一到周日 day tab。
 */
import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {colors, radii, spacing, typography} from '../../app/theme';
import {DetailHeader} from '../common/components/Ui';
import {EmptyHint, InlineLoader, StateBlock} from '../common/components/Status';
import {RootStackParamList} from '../../app/navigation/types';
import {
  BuildingEntry,
  CLASSROOM_PERIODS,
  ClassroomState,
  ClassroomStateResult,
  ClassroomStatus,
  PERIODS_PER_DAY,
  fetchClassroomList,
  fetchClassroomState,
} from '../../services/campus/classroom';

type Props = NativeStackScreenProps<RootStackParamList, 'CampusClassroom'>;

// 注意：ClassroomStatus 是**数值枚举**（与上游一致）。
// 用固定数组遍历，避免 Object.values(enum) 同时返回 key+value 的坑。
const ALL_STATUSES: ClassroomStatus[] = [
  ClassroomStatus.AVAILABLE,
  ClassroomStatus.TEACHING,
  ClassroomStatus.EXAM,
  ClassroomStatus.BORROWED,
  ClassroomStatus.DISABLED,
];

const STATUS_COLOR: Record<ClassroomStatus, string> = {
  [ClassroomStatus.AVAILABLE]: colors.success,
  [ClassroomStatus.TEACHING]: colors.primary,
  [ClassroomStatus.EXAM]: colors.error,
  [ClassroomStatus.BORROWED]: colors.warning,
  [ClassroomStatus.DISABLED]: colors.textMuted,
  [ClassroomStatus.RESERVED_FOR_COMPAT]: colors.textMuted,
};

const STATUS_LABEL: Record<ClassroomStatus, string> = {
  [ClassroomStatus.AVAILABLE]: '空闲',
  [ClassroomStatus.TEACHING]: '上课',
  [ClassroomStatus.EXAM]: '考试',
  [ClassroomStatus.BORROWED]: '借用',
  [ClassroomStatus.DISABLED]: '停用',
  [ClassroomStatus.RESERVED_FOR_COMPAT]: '保留',
};

const DAYS = ['一', '二', '三', '四', '五', '六', '日'];

function todayWeekdayIndex(): number {
  // 0=周一, ..., 6=周日
  const d = new Date().getDay();
  return d === 0 ? 6 : d - 1;
}

/**
 * 把上游格式 `"6A101:60(人)"` 拆成 `{id, capacity}`：
 *   id        → "6A101"
 *   capacity  → "60"
 * 没有 `:` 时整串当 id、capacity 留空。
 */
function splitClassroomName(name: string): {id: string; capacity: string} {
  const idx = name.indexOf(':');
  if (idx === -1) return {id: name.trim(), capacity: ''};
  const id = name.slice(0, idx).trim();
  const cap = name
    .slice(idx + 1)
    .replace(/[（(].*?[)）]/g, '')
    .trim();
  return {id, capacity: cap};
}

export function ClassroomScreen({navigation}: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [buildings, setBuildings] = useState<BuildingEntry[]>([]);
  const [selected, setSelected] = useState<BuildingEntry | null>(null);
  const [week, setWeek] = useState<number | null>(null);
  const [state, setState] = useState<ClassroomStateResult | null>(null);
  const [stateLoading, setStateLoading] = useState(false);
  const [stateError, setStateError] = useState<string | null>(null);
  const [stateReloadKey, setStateReloadKey] = useState(0);
  const [activeDay, setActiveDay] = useState(todayWeekdayIndex());

  const loadList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchClassroomList();
      setBuildings(list);
      // 仅在还没选中任何建筑时设默认值；刷新已选状态不应被覆盖。
      setSelected(prev => prev ?? list[0] ?? null);
      setWeek(prev => prev ?? list[0]?.weekNumber ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载教学楼失败');
    } finally {
      setLoading(false);
    }
    // 不依赖 selected/week 状态，避免每次切换楼栋都重新 fetchList
  }, []);

  useEffect(() => {
    loadList();
  }, [loadList]);

  useEffect(() => {
    if (!selected || week == null) return;
    let cancelled = false;
    setStateLoading(true);
    setStateError(null);
    setState(null);
    fetchClassroomState(selected.searchName, week)
      .then(s => {
        if (!cancelled) setState(s);
      })
      .catch(e => {
        if (!cancelled)
          setStateError(e instanceof Error ? e.message : '加载失败');
      })
      .finally(() => {
        if (!cancelled) setStateLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selected, stateReloadKey, week]);

  /** 当前日某教室是否完全空闲 — 用固定 PERIODS_PER_DAY，与上游 status 数组约定一致 */
  const summary = useMemo(() => {
    if (!state) return null;
    let totalRooms = state.classroomStates.length;
    let freeRooms = 0;
    for (const cs of state.classroomStates) {
      const slice = cs.status.slice(
        activeDay * PERIODS_PER_DAY,
        (activeDay + 1) * PERIODS_PER_DAY,
      );
      if (
        slice.length > 0 &&
        slice.every(s => s === ClassroomStatus.AVAILABLE)
      ) {
        freeRooms += 1;
      }
    }
    return {totalRooms, freeRooms};
  }, [state, activeDay]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <DetailHeader
        title="教室查询"
        onBack={() => navigation.goBack()}
        rightLabel={loading || stateLoading ? '…' : '刷新'}
        onRight={() => !loading && loadList()}
      />

      {loading ? (
        <InlineLoader label="正在加载教学楼列表..." style={styles.center} />
      ) : error ? (
        <View style={styles.center}>
          <StateBlock
            title="教学楼列表加载失败"
            message={error}
            tone="error"
            actionLabel="重试"
            onAction={loadList}
            style={styles.statusBlock}
          />
        </View>
      ) : (
        <View style={{flex: 1}}>
          {/* 教学楼 chip */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.buildingScroll}
            contentContainerStyle={styles.buildingRow}>
            {buildings.map(b => {
              const active = selected?.searchName === b.searchName;
              return (
                <Pressable
                  key={b.searchName}
                  onPress={() => {
                    setSelected(b);
                    setWeek(b.weekNumber);
                  }}
                  style={[
                    styles.buildingChip,
                    active && styles.buildingChipActive,
                  ]}>
                  <Text
                    style={[
                      styles.buildingText,
                      active && styles.buildingTextActive,
                    ]}
                    numberOfLines={1}>
                    {b.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* 周次选择（紧凑横滚） */}
          {state?.validWeekNumbers?.length ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.weekScroll}
              contentContainerStyle={styles.weekRow}>
              {state.validWeekNumbers.map(w => {
                const active = w === week;
                return (
                  <Pressable
                    key={w}
                    onPress={() => setWeek(w)}
                    style={[styles.weekChip, active && styles.weekChipActive]}>
                    <Text
                      style={[
                        styles.weekText,
                        active && styles.weekTextActive,
                      ]}>
                      第 {w} 周
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : null}

          {/* 周一到周日 */}
          <View style={styles.dayRow}>
            {DAYS.map((d, i) => {
              const active = i === activeDay;
              const date = state?.datesOfCurrentWeek?.[i];
              const isToday =
                week === selected?.weekNumber && i === todayWeekdayIndex();
              return (
                <Pressable
                  key={d}
                  onPress={() => setActiveDay(i)}
                  style={[styles.dayCell, active && styles.dayCellActive]}>
                  <Text
                    style={[styles.dayLabel, active && styles.dayLabelActive]}>
                    周{d}
                    {isToday ? '·今' : ''}
                  </Text>
                  {date ? (
                    <Text
                      style={[styles.dayDate, active && styles.dayDateActive]}>
                      {date}
                    </Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>

          {/* 汇总 + 图例 */}
          {summary ? (
            <View style={styles.summaryBar}>
              <Text style={styles.summaryText}>
                {selected?.name} · 周{DAYS[activeDay]}
                {state?.datesOfCurrentWeek?.[activeDay]
                  ? ` (${state.datesOfCurrentWeek[activeDay]})`
                  : ''}
              </Text>
              <Text style={styles.summaryHi}>
                {summary.freeRooms}/{summary.totalRooms} 间全天空闲
              </Text>
            </View>
          ) : null}

          {stateLoading ? (
            <InlineLoader label="加载教室状态..." style={styles.center} />
          ) : stateError ? (
            <View style={styles.center}>
              <StateBlock
                title="教室状态加载失败"
                message={stateError}
                tone="error"
                actionLabel="重试"
                onAction={() => setStateReloadKey(value => value + 1)}
                style={styles.statusBlock}
              />
            </View>
          ) : !state || state.classroomStates.length === 0 ? (
            <EmptyHint
              title="该教学楼无教室数据"
              message="可以切换其它教学楼、周次或稍后刷新。"
              style={styles.center}
            />
          ) : (
            <ScrollView contentContainerStyle={styles.tableWrap}>
              <View style={styles.legend}>
                {ALL_STATUSES.map(s => (
                  <View key={s} style={styles.legendItem}>
                    <View
                      style={[
                        styles.legendDot,
                        {backgroundColor: STATUS_COLOR[s]},
                      ]}
                    />
                    <Text style={styles.legendText}>{STATUS_LABEL[s]}</Text>
                  </View>
                ))}
              </View>
              <View style={styles.periodLegend}>
                {CLASSROOM_PERIODS.map(p => (
                  <Text key={p.period} style={styles.periodLegendText}>
                    {p.period} {p.timeRange}
                  </Text>
                ))}
              </View>
              <View style={styles.tableHeader}>
                <Text style={[styles.headerCell, {flex: 3}]}>教室</Text>
                <Text
                  style={[
                    styles.headerCell,
                    styles.headerCellCenter,
                    {flex: 1},
                  ]}>
                  容量
                </Text>
                <Text
                  style={[
                    styles.headerCell,
                    styles.headerCellCenter,
                    {flex: 5},
                  ]}>
                  1 2 3 4 5 6
                </Text>
              </View>
              {state.classroomStates.map(cs => (
                <ClassroomRow key={cs.name} classroom={cs} day={activeDay} />
              ))}
            </ScrollView>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

function ClassroomRow({
  classroom,
  day,
}: {
  classroom: ClassroomState;
  day: number;
}) {
  const {id, capacity} = splitClassroomName(classroom.name);
  const slice = classroom.status.slice(
    day * PERIODS_PER_DAY,
    (day + 1) * PERIODS_PER_DAY,
  );
  const freeCount = slice.filter(s => s === ClassroomStatus.AVAILABLE).length;
  const allFree = freeCount === slice.length && slice.length > 0;
  return (
    <View
      style={[
        styles.classroomRow,
        allFree && {borderColor: STATUS_COLOR[ClassroomStatus.AVAILABLE]},
      ]}>
      <View style={styles.classroomNameWrap}>
        <Text style={styles.classroomName}>{id}</Text>
        <Text style={styles.classroomFree}>
          {freeCount}/{slice.length || PERIODS_PER_DAY} 节空
        </Text>
      </View>
      <Text style={styles.classroomCapacity}>{capacity || '—'}</Text>
      <View style={styles.periodRow}>
        {(slice.length > 0
          ? slice
          : Array.from(
              {length: PERIODS_PER_DAY},
              () => ClassroomStatus.AVAILABLE,
            )
        ).map((status, i) => (
          <View
            key={i}
            style={[styles.period, {backgroundColor: STATUS_COLOR[status]}]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background},
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
  },
  statusBlock: {alignSelf: 'stretch'},

  buildingScroll: {flexGrow: 0, flexShrink: 0},
  buildingRow: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    gap: spacing.xs,
  },
  buildingChip: {
    height: 36,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    marginRight: spacing.xs,
    minWidth: 88,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buildingChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryMuted,
  },
  buildingText: {...typography.caption, color: colors.text},
  buildingTextActive: {color: colors.primary, fontWeight: '600'},

  weekScroll: {flexGrow: 0, flexShrink: 0},
  weekRow: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    alignItems: 'center',
    gap: spacing.xs,
  },
  weekChip: {
    height: 28,
    paddingHorizontal: spacing.sm + 2,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.sm,
    marginRight: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekChipActive: {backgroundColor: colors.primaryMuted},
  weekText: {...typography.micro, color: colors.textSecondary},
  weekTextActive: {color: colors.primary, fontWeight: '600'},

  dayRow: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  dayCell: {flex: 1, paddingVertical: spacing.sm + 2, alignItems: 'center'},
  dayCellActive: {backgroundColor: colors.primary},
  dayLabel: {...typography.caption, color: colors.text, fontWeight: '600'},
  dayLabelActive: {color: colors.textInvert},
  dayDate: {...typography.micro, color: colors.textMuted, marginTop: 2},
  dayDateActive: {color: 'rgba(10, 10, 11, 0.7)'},

  summaryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  summaryText: {...typography.caption, color: colors.textSecondary, flex: 1},
  summaryHi: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
  },

  tableWrap: {
    paddingHorizontal: spacing.lg,
    paddingTop: 0,
    paddingBottom: spacing.xxl,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  legendItem: {flexDirection: 'row', alignItems: 'center', gap: 4},
  legendDot: {width: 12, height: 12, borderRadius: 3},
  legendText: {...typography.micro, color: colors.textSecondary},
  periodLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  periodLegendText: {
    ...typography.micro,
    color: colors.textMuted,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.xs,
    paddingVertical: 3,
  },

  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.xs,
  },
  headerCell: {
    ...typography.micro,
    color: colors.textMuted,
  },
  headerCellCenter: {textAlign: 'center'},

  classroomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: 8,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  classroomNameWrap: {flex: 3},
  classroomName: {...typography.label, color: colors.text},
  classroomFree: {
    ...typography.micro,
    color: colors.textMuted,
    marginTop: 2,
  },
  classroomCapacity: {
    flex: 1,
    textAlign: 'center',
    ...typography.label,
    color: colors.textSecondary,
  },
  periodRow: {flex: 5, flexDirection: 'row', gap: 3},
  period: {flex: 1, height: 22, borderRadius: 3},
});
