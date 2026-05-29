/**
 * 楼层 → 分区列表：从楼层卡片点进来，显示该楼层下所有分区 + 各分区的座位使用情况。
 * 点击分区卡片再跳进座位详情页。
 */
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
import {colors, radii, shadows, spacing, typography} from '../../app/theme';
import {Badge, DetailHeader, EmptyState} from '../common/components/Ui';
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

      <View style={styles.dateRow}>
        {(['今天', '明天'] as const).map((label, idx) => {
          const active = (idx as DateChoice) === dateChoice;
          return (
            <Pressable
              key={label}
              style={[styles.dateChip, active && styles.dateChipActive]}
              onPress={() => setDateChoice(idx as DateChoice)}>
              <Text
                style={[
                  styles.dateChipText,
                  active && styles.dateChipTextActive,
                ]}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.hint}>正在读取分区…</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorTitle}>加载失败</Text>
          <Text style={styles.errorMsg}>{error}</Text>
          <Pressable style={styles.retry} onPress={load}>
            <Text style={styles.retryText}>重试</Text>
          </Pressable>
        </View>
      ) : sections.length === 0 ? (
        <EmptyState title="无分区数据" description="该楼层暂无可显示的分区" />
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
  retryText: {...typography.label, color: colors.textInvert},
});
