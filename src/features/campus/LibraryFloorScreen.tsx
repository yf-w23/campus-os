/**
 * 楼层 → 分区列表：从楼层卡片点进来，显示该楼层下所有分区 + 各分区的座位使用情况。
 * 点击分区卡片再跳进座位详情页。
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
  getLibrarySectionList,
  LibrarySection,
} from '../../services/campus/library';

type Props = NativeStackScreenProps<RootStackParamList, 'CampusLibraryFloor'>;

export function LibraryFloorScreen({navigation, route}: Props) {
  const {floorId, floorName, initialDateChoice} = route.params;
  const [dateChoice, setDateChoice] = useState<DateChoice>(
    initialDateChoice ?? 0,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sections, setSections] = useState<LibrarySection[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await getLibrarySectionList(floorId, dateChoice);
      setSections(list);
    } catch (e) {
      setSections([]);
      setError(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [floorId, dateChoice]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <DetailHeader
        title={floorName}
        onBack={() => navigation.goBack()}
        rightLabel={loading ? '…' : '刷新'}
        onRight={() => !loading && load()}
      />

      <SegmentedControl<DateChoice>
        value={dateChoice}
        onChange={setDateChoice}
        options={[
          {value: 0 as DateChoice, label: '今天'},
          {value: 1 as DateChoice, label: '明天'},
        ]}
        style={styles.dateRow}
      />

      {loading ? (
        <InlineLoader label="正在读取分区..." style={styles.center} />
      ) : error ? (
        <View style={styles.center}>
          <StateBlock
            title="楼层分区加载失败"
            message={error}
            tone="error"
            actionLabel="重试"
            onAction={load}
            style={styles.statusBlock}
          />
        </View>
      ) : sections.length === 0 ? (
        <EmptyHint
          title="无分区数据"
          message="该楼层暂无可显示的分区，可以切换日期或返回选择其它楼层。"
          style={styles.center}
        />
      ) : (
        <ScrollView contentContainerStyle={styles.body}>
          {sections.map(sec => (
            <SectionCard
              key={sec.id}
              section={sec}
              onPress={() =>
                navigation.navigate('CampusLibrarySection', {
                  sectionId: sec.id,
                  sectionName: sec.zhName || `分区 ${sec.id}`,
                  initialDateChoice: dateChoice,
                })
              }
            />
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function SectionCard({
  section,
  onPress,
}: {
  section: LibrarySection;
  onPress: () => void;
}) {
  const total = section.total;
  const available = section.available;
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
        styles.card,
        pressed && {opacity: 0.85, transform: [{scale: 0.995}]},
      ]}
      onPress={onPress}
      disabled={!section.valid}>
      <View style={styles.cardTop}>
        <View style={{flex: 1}}>
          <Text style={styles.sectionName}>{section.zhName}</Text>
          {total > 0 ? (
            <Text style={styles.sectionStat}>
              剩余 {available} / 共 {total}
              {section.reservedCount > 0
                ? ` · 已预约 ${section.reservedCount}`
                : ''}
            </Text>
          ) : (
            <Text style={styles.sectionStat}>
              {section.valid ? '开放 · 查看座位' : '暂停开放'}
            </Text>
          )}
        </View>
        {!section.valid ? (
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

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background},
  dateRow: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
  },

  body: {padding: spacing.lg, paddingBottom: spacing.xxl},
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.soft,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    gap: spacing.sm,
  },
  cardTop: {flexDirection: 'row', alignItems: 'center', gap: spacing.sm},
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
  statusBlock: {alignSelf: 'stretch'},
});
