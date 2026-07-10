import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {colors, radii, spacing, typography} from '../../app/theme';
import {uiImages} from '../../app/assets/uiImages';
import {RootStackParamList} from '../../app/navigation/types';
import {DetailHeader, SurfaceGroup} from '../common/components/Ui';
import {EmptyHint, InlineLoader, StateBlock} from '../common/components/Status';
import {
  LaundryBuilding,
  LaundryBuildingGroup,
  getLaundryBuildings,
} from '../../services/campus/laundry';

type Props = NativeStackScreenProps<RootStackParamList, 'CampusLaundry'>;

function platformLabel(platform: LaundryBuilding['platform']): string {
  return platform === 'haile' ? '海乐' : '洁力';
}

export function CampusLaundryScreen({navigation}: Props) {
  const [groups, setGroups] = useState<LaundryBuildingGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const total = useMemo(
    () => groups.reduce((sum, group) => sum + group.buildings.length, 0),
    [groups],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setGroups(await getLaundryBuildings());
    } catch (e) {
      setError(e instanceof Error ? e.message : '洗衣机楼宇加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openBuilding = (building: LaundryBuilding) => {
    navigation.navigate('CampusLaundryDetail', {
      id: building.id,
      name: building.name,
      platform: building.platform,
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <DetailHeader
        title="洗衣机查询"
        onBack={() => navigation.goBack()}
        rightLabel={loading ? undefined : '刷新'}
        onRight={load}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Image source={uiImages.campusLaundry} style={styles.heroIcon} />
          <View style={styles.heroText}>
            <Text style={styles.heroLabel}>宿舍服务</Text>
            <Text style={styles.heroTitle}>洗衣机查询</Text>
            <Text style={styles.heroSub}>
              {loading
                ? '正在同步楼宇列表'
                : total > 0
                ? `${total} 个可查询位置`
                : '查看空闲、运行中和故障状态'}
            </Text>
          </View>
        </View>

        {error ? (
          <StateBlock
            title="洗衣机楼宇加载失败"
            message={error}
            tone="error"
            actionLabel="重试"
            onAction={load}
            style={styles.statusBlock}
          />
        ) : null}

        {loading ? (
          <InlineLoader label="正在同步楼宇列表" style={styles.loader} />
        ) : (
          groups.map(group => (
            <View key={group.name} style={styles.section}>
              <Text style={styles.sectionTitle}>{group.name}</Text>
              <SurfaceGroup style={styles.card}>
                {group.buildings.map((building, index) => (
                  <Pressable
                    key={`${building.platform}-${building.id}`}
                    onPress={() => openBuilding(building)}
                    style={({pressed}) => [
                      styles.row,
                      index > 0 && styles.divider,
                      pressed && styles.pressed,
                    ]}>
                    <View style={styles.rowBody}>
                      <Text style={styles.rowTitle} numberOfLines={1}>
                        {building.name}
                      </Text>
                      <Text style={styles.rowSub}>
                        {platformLabel(building.platform)}洗衣服务
                      </Text>
                    </View>
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>
                        {platformLabel(building.platform)}
                      </Text>
                    </View>
                    <Text style={styles.chev}>›</Text>
                  </Pressable>
                ))}
              </SurfaceGroup>
            </View>
          ))
        )}

        {!loading && !error && groups.length === 0 ? (
          <EmptyHint
            title="暂无可查询洗衣机楼宇"
            message="可以稍后刷新，或从宿舍服务入口重新进入。"
            style={styles.empty}
          />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background},
  content: {padding: spacing.lg, paddingBottom: spacing.xxl},
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: spacing.lg,
    gap: spacing.md,
  },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: 16,
    resizeMode: 'cover',
  },
  heroText: {flex: 1, gap: 3},
  heroLabel: {...typography.micro, color: colors.textMuted},
  heroTitle: {...typography.h2, color: colors.text},
  heroSub: {...typography.caption, color: colors.textSecondary},
  loader: {marginVertical: spacing.xxl},
  statusBlock: {marginTop: spacing.md},
  section: {marginTop: spacing.lg},
  sectionTitle: {
    ...typography.label,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    fontSize: 12,
    marginBottom: spacing.sm,
    paddingLeft: spacing.xs,
  },
  card: {
    paddingHorizontal: 0,
    paddingVertical: 0,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  divider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  rowBody: {flex: 1, gap: 2},
  rowTitle: {...typography.body, color: colors.text, fontWeight: '600'},
  rowSub: {...typography.caption, color: colors.textMuted},
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
    backgroundColor: colors.primaryMuted,
  },
  badgeText: {...typography.micro, color: colors.primary, fontWeight: '700'},
  chev: {
    fontSize: 22,
    color: colors.textMuted,
    fontWeight: '300',
    marginLeft: -spacing.xs,
  },
  pressed: {backgroundColor: colors.surfaceAlt},
  empty: {
    marginTop: spacing.xl,
  },
});
