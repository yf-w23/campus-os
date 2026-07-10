/**
 * 图书馆 + 研讨间 native 浏览。
 *
 * - tab "座位查询"：今天/明天 → 馆水平 chip → 楼层使用率卡片 → 点进入座位列表
 * - tab "研讨间"：研讨间类型 + 全部研讨间资源列表
 *
 * 与上游 thu-info-app 的核心差别：当前只读，下单仍走小程序。
 */
import React, {useCallback, useEffect, useState} from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {colors, radii, shadows, spacing, typography} from '../../app/theme';
import {Badge, DetailHeader, SegmentedControl} from '../common/components/Ui';
import {EmptyHint, InlineLoader, StateBlock} from '../common/components/Status';
import {RootStackParamList} from '../../app/navigation/types';
import {
  DateChoice,
  formatLibRoomDateIso,
  formatLibRoomDateYmd,
  getLibraryFloorList,
  getLibraryList,
  getLibraryRoomBookingInfoList,
  getLibraryRoomBookingResourceList,
  LibRoomInfo,
  LibRoomRes,
  Library,
  LibraryFloor,
} from '../../services/campus/library';

type Props = NativeStackScreenProps<RootStackParamList, 'CampusLibrary'>;

type Tab = 'seats' | 'rooms';

export function LibraryNativeScreen({navigation}: Props) {
  const [tab, setTab] = useState<Tab>('seats');

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <DetailHeader
        title="图书馆与研读间"
        onBack={() => navigation.goBack()}
      />
      <SegmentedControl<Tab>
        value={tab}
        onChange={setTab}
        options={[
          {value: 'seats', label: '座位查询'},
          {value: 'rooms', label: '研读间'},
        ]}
        style={styles.tabs}
      />

      {tab === 'seats' ? (
        <SeatsView navigation={navigation} />
      ) : (
        <RoomsView />
      )}
    </SafeAreaView>
  );
}

// =====================================================================
// 座位查询
// =====================================================================

function SeatsView({navigation}: {navigation: Props['navigation']}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [libraries, setLibraries] = useState<Library[]>([]);
  const [activeLib, setActiveLib] = useState<Library | null>(null);
  const [dateChoice, setDateChoice] = useState<DateChoice>(0);

  const [floorsLoading, setFloorsLoading] = useState(false);
  const [floors, setFloors] = useState<LibraryFloor[]>([]);
  const [floorError, setFloorError] = useState<string | null>(null);
  const [floorReloadKey, setFloorReloadKey] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await getLibraryList();
      setLibraries(list);
      if (list.length > 0) {
        setActiveLib(prev => prev ?? list.find(l => l.valid) ?? list[0]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!activeLib) return;
    let cancelled = false;
    (async () => {
      setFloorsLoading(true);
      setFloorError(null);
      try {
        const list = await getLibraryFloorList(activeLib.id, dateChoice);
        if (!cancelled) setFloors(list);
      } catch (e) {
        if (!cancelled) {
          setFloors([]);
          setFloorError(e instanceof Error ? e.message : '加载失败');
        }
      } finally {
        if (!cancelled) setFloorsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeLib, dateChoice, floorReloadKey]);

  if (loading) {
    return (
      <InlineLoader label="正在加载图书馆列表..." style={styles.center} />
    );
  }
  if (error) {
    return (
      <View style={styles.center}>
        <StateBlock
          title="图书馆列表加载失败"
          message={error}
          tone="error"
          actionLabel="重试"
          onAction={load}
          style={styles.statusBlock}
        />
      </View>
    );
  }
  if (libraries.length === 0) {
    return (
      <EmptyHint
        title="暂无图书馆"
        message="接口未返回可用图书馆数据，可以稍后刷新。"
        style={styles.center}
      />
    );
  }

  return (
    <ScrollView contentContainerStyle={{paddingBottom: spacing.xxl}}>
      <SegmentedControl<DateChoice>
        value={dateChoice}
        onChange={setDateChoice}
        options={[
          {value: 0 as DateChoice, label: '今天'},
          {value: 1 as DateChoice, label: '明天'},
        ]}
        style={styles.dateRow}
      />

      <ScrollView
        horizontal
        contentContainerStyle={styles.libRow}
        showsHorizontalScrollIndicator={false}>
        {libraries.map(lib => {
          const active = activeLib?.id === lib.id;
          return (
            <Pressable
              key={lib.id}
              style={[
                styles.libChip,
                active && styles.libChipActive,
                !lib.valid && styles.libChipDisabled,
              ]}
              onPress={() => lib.valid && setActiveLib(lib)}
              disabled={!lib.valid}>
              <Text
                style={[
                  styles.libChipText,
                  active && styles.libChipTextActive,
                  !lib.valid && styles.libChipTextDisabled,
                ]}
                numberOfLines={1}>
                {lib.zhName || lib.enName}
              </Text>
              {!lib.valid ? (
                <Text style={styles.libChipBadge}>暂停</Text>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={{paddingHorizontal: spacing.lg}}>
        {floorsLoading ? (
          <InlineLoader label="读取楼层使用率..." style={styles.inlineLoader} />
        ) : floorError ? (
          <StateBlock
            title="楼层使用率加载失败"
            message={floorError}
            tone="error"
            actionLabel="重试"
            onAction={() => setFloorReloadKey(value => value + 1)}
            compact
            style={styles.inlineStatus}
          />
        ) : floors.length === 0 ? (
          <EmptyHint
            title="无楼层数据"
            message="该馆暂无开放楼层，或当前日期没有可查询区域。"
            style={styles.inlineStatus}
          />
        ) : (
          floors.map(floor => (
            <FloorCard
              key={floor.id}
              floor={floor}
              onPress={() =>
                navigation.navigate('CampusLibraryFloor', {
                  floorId: floor.id,
                  floorName: floor.zhName || `楼层 ${floor.id}`,
                  initialDateChoice: dateChoice,
                })
              }
            />
          ))
        )}
      </View>
    </ScrollView>
  );
}

function FloorCard({
  floor,
  onPress,
}: {
  floor: LibraryFloor;
  onPress: () => void;
}) {
  const total = floor.total;
  const available = floor.available;
  const taken = Math.max(0, total - available);
  const percentTaken = total > 0 ? taken / total : 0;
  const barColor =
    percentTaken < 0.7
      ? colors.success
      : percentTaken < 0.9
      ? colors.warning
      : colors.error;

  return (
    <Pressable
      style={({pressed}) => [
        styles.sectionCard,
        pressed && {opacity: 0.75},
      ]}
      onPress={onPress}
      disabled={!floor.valid}>
      <View style={styles.sectionTop}>
        <View style={{flex: 1}}>
          <Text style={styles.sectionName}>{floor.zhName}</Text>
          {total > 0 ? (
            <Text style={styles.sectionStat}>
              剩余 {available} / 共 {total}
            </Text>
          ) : (
            <Text style={styles.sectionStat}>
              {floor.valid ? '开放 · 查看分区' : '暂停开放'}
            </Text>
          )}
        </View>
        {!floor.valid ? (
          <Badge label="暂停" tone="warning" />
        ) : total > 0 ? (
          <View style={styles.bigStat}>
            <Text style={[styles.bigStatNum, {color: barColor}]}>
              {available}
            </Text>
            <Text style={styles.bigStatLabel}>剩余</Text>
          </View>
        ) : (
          <Text style={styles.cardArrow}>›</Text>
        )}
      </View>

      {total > 0 ? (
        <View style={styles.barTrack}>
          <View
            style={[
              styles.barFill,
              {
                width: `${Math.min(100, Math.round(percentTaken * 100))}%`,
                backgroundColor: barColor,
              },
            ]}
          />
        </View>
      ) : null}
    </Pressable>
  );
}

// =====================================================================
// 研讨间
// =====================================================================

function RoomsView() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [kinds, setKinds] = useState<LibRoomInfo[]>([]);
  const [selectedKind, setSelectedKind] = useState<number | null>(null);
  const [resources, setResources] = useState<LibRoomRes[]>([]);
  const [resLoading, setResLoading] = useState(false);

  const loadKinds = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await getLibraryRoomBookingInfoList();
      setKinds(list);
      if (list.length > 0) {
        setSelectedKind(prev => prev ?? list[0].kindId);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadKinds();
  }, [loadKinds]);

  const loadResources = useCallback(
    async (kindId: number, dateOffset: number) => {
      setResLoading(true);
      setError(null);
      try {
        const list = await getLibraryRoomBookingResourceList(
          formatLibRoomDateYmd(dateOffset),
          kindId,
        );
        setResources(list);
      } catch (e) {
        setError(e instanceof Error ? e.message : '加载资源失败');
        setResources([]);
      } finally {
        setResLoading(false);
      }
    },
    [],
  );

  if (loading) {
    return (
      <InlineLoader label="正在激活研读间会话..." style={styles.center} />
    );
  }
  if (error && kinds.length === 0) {
    return (
      <View style={styles.center}>
        <StateBlock
          title="研读间类型加载失败"
          message={error}
          tone="error"
          actionLabel="重试"
          onAction={loadKinds}
          style={styles.statusBlock}
        />
      </View>
    );
  }

  const validDateNum = 5;

  return (
    <ScrollView contentContainerStyle={{paddingBottom: spacing.xxl}}>
      <Text style={styles.groupTitle}>研读间类型</Text>
      {kinds.length === 0 ? (
        <View style={{paddingHorizontal: spacing.lg}}>
          <EmptyHint
            title="无研读间类型"
            message="接口未返回研读间类型数据，可以稍后刷新。"
          />
        </View>
      ) : (
        <View style={{paddingHorizontal: spacing.lg, gap: spacing.sm}}>
          {kinds.map(lib => {
            const expanded = selectedKind === lib.kindId;
            return (
              <View key={lib.kindId} style={styles.sectionCard}>
                <Pressable
                  onPress={() =>
                    setSelectedKind(expanded ? null : lib.kindId)
                  }>
                  <Text style={styles.sectionName}>{lib.kindName}</Text>
                  <Text style={styles.sectionStat}>
                    {lib.rooms.length} 个房间 · 点选查看近 {validDateNum} 天
                  </Text>
                </Pressable>
                {expanded
                  ? Array.from({length: validDateNum}, (_, k) => k).map(
                      dateOffset => (
                        <Pressable
                          key={`${lib.kindId}-${dateOffset}`}
                          style={styles.libDateRow}
                          onPress={() => {
                            setSelectedKind(lib.kindId);
                            void loadResources(lib.kindId, dateOffset);
                          }}>
                          <Text style={styles.libDateRowText}>
                            {formatLibRoomDateIso(dateOffset)}
                          </Text>
                          <Text style={styles.libDateRowChev}>›</Text>
                        </Pressable>
                      ),
                    )
                  : null}
              </View>
            );
          })}
        </View>
      )}

      {resLoading ? (
        <InlineLoader label="正在读取研读间资源..." style={styles.inlineLoader} />
      ) : null}

      {resources.length > 0 ? (
        <>
          <Text style={[styles.groupTitle, {marginTop: spacing.lg}]}>
            可预约资源（{resources.length}）
          </Text>
          <View style={{paddingHorizontal: spacing.lg}}>
            {resources.map(r => {
              const closed = r.kindName.includes('暂未开放');
              return (
                <View key={`${r.devId}-${r.roomId}`} style={styles.resourceCard}>
                  <View style={{flex: 1}}>
                    <Text
                      style={[
                        styles.sectionName,
                        closed && {textDecorationLine: 'line-through', opacity: 0.5},
                      ]}>
                      {r.roomName}
                      {r.maxUser > 1 ? ` (${r.minUser}~${r.maxUser}人)` : ''}
                    </Text>
                    <Text style={styles.sectionStat}>{r.kindName}</Text>
                    {r.openStart && r.openEnd ? (
                      <Text style={styles.sectionStat}>
                        开放 {r.openStart}–{r.openEnd}
                      </Text>
                    ) : null}
                  </View>
                  <Badge
                    label={closed ? '未开放' : '可浏览'}
                    tone={closed ? 'warning' : 'default'}
                  />
                </View>
              );
            })}
          </View>
        </>
      ) : null}

      {error && kinds.length > 0 ? (
        <View style={{paddingHorizontal: spacing.lg}}>
          <StateBlock
            title="研读间资源加载失败"
            message={error}
            tone="error"
            compact
          />
        </View>
      ) : null}

      <Text style={styles.footer}>
        研读间预约对照 THU Info「研读间预约」：先 cab 登录再拉类型与资源。
        完整下单（选时段、邀请成员）请在清华师生大厅小程序完成。
      </Text>
    </ScrollView>
  );
}

// =====================================================================
// styles
// =====================================================================

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background},
  tabs: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
  },

  dateRow: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
  },

  libRow: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  libChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    marginRight: spacing.xs,
    minWidth: 96,
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  libChipActive: {borderColor: colors.primary, backgroundColor: colors.primaryMuted},
  libChipDisabled: {opacity: 0.5},
  libChipText: {...typography.caption, color: colors.text},
  libChipTextActive: {color: colors.primary, fontWeight: '600'},
  libChipTextDisabled: {color: colors.textMuted},
  libChipBadge: {
    ...typography.micro,
    color: colors.textMuted,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radii.sm,
  },

  groupTitle: {
    ...typography.h3,
    color: colors.text,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.lg,
  },

  sectionCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.soft,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    gap: spacing.sm,
  },
  resourceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.sm,
    ...shadows.soft,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  sectionTop: {flexDirection: 'row', alignItems: 'center', gap: spacing.sm},
  sectionName: {...typography.label, color: colors.text},
  sectionStat: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  bigStat: {alignItems: 'flex-end', minWidth: 56},
  bigStatNum: {...typography.h2, fontWeight: '700'},
  bigStatLabel: {...typography.micro, color: colors.textMuted},
  cardArrow: {fontSize: 24, color: colors.textMuted},
  barTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.surfaceAlt,
    overflow: 'hidden',
  },
  barFill: {height: '100%', borderRadius: 3},

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
  },
  inlineLoader: {
    paddingVertical: spacing.lg,
  },
  statusBlock: {alignSelf: 'stretch'},
  inlineStatus: {marginBottom: spacing.sm},
  libDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    marginTop: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  libDateRowText: {...typography.body, color: colors.primary},
  libDateRowChev: {fontSize: 20, color: colors.textMuted},
  footer: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xl,
    paddingHorizontal: spacing.md,
    lineHeight: 18,
  },
});
