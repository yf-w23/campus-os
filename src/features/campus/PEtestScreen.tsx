import React, {useCallback, useEffect, useState} from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {colors, radii, shadows, spacing, typography} from '../../app/theme';
import {DetailHeader} from '../common/components/Ui';
import {EmptyHint, InlineLoader, StateBlock} from '../common/components/Status';
import {RootStackParamList} from '../../app/navigation/types';
import {fetchPEResult, PEItem} from '../../services/campus/petest';

type Props = NativeStackScreenProps<RootStackParamList, 'CampusPEtest'>;

export function PEtestScreen({navigation}: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<PEItem[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPEResult();
      setItems(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // 把列表拆成"汇总 / 单项"两组
  const summaryKeys = new Set(['是否免测', '免测原因', '总分', '标准分', '附加分', '长跑附加分', '参考成绩（自动结算）', '体育课成绩']);
  const summary = items.filter(it => summaryKeys.has(it.label));
  const details = items.filter(it => !summaryKeys.has(it.label));

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <DetailHeader
        title="体测成绩"
        onBack={() => navigation.goBack()}
        rightLabel={loading ? '…' : '刷新'}
        onRight={() => !loading && load()}
      />
      {loading ? (
        <InlineLoader label="正在加载体测成绩..." style={styles.center} />
      ) : error ? (
        <View style={styles.center}>
          <StateBlock
            title="体测成绩加载失败"
            message={error}
            tone="error"
            actionLabel="重试"
            onAction={load}
            style={styles.statusBlock}
          />
        </View>
      ) : items.length === 0 ? (
        <EmptyHint
          title="暂无体测数据"
          message="教务系统暂未返回体测记录，可以稍后刷新。"
          style={styles.center}
        />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {summary.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>总览</Text>
              {summary.map(it => (
                <View key={it.label} style={styles.row}>
                  <Text style={styles.label}>{it.label}</Text>
                  <Text style={[styles.value, isNumericScore(it) && styles.valueAccent]}>
                    {it.value}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          {details.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>单项成绩</Text>
              {details.map(it => (
                <View key={it.label} style={styles.row}>
                  <Text style={styles.label}>{it.label}</Text>
                  <Text style={styles.value}>{it.value}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function isNumericScore(it: PEItem): boolean {
  return it.label === '总分' || it.label === '参考成绩（自动结算）';
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background},
  center: {flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.lg},
  statusBlock: {alignSelf: 'stretch'},
  content: {padding: spacing.lg, paddingBottom: spacing.xxl},
  section: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginBottom: spacing.md,
    ...shadows.soft,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.text,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    paddingHorizontal: spacing.xs,
    gap: spacing.md,
  },
  label: {...typography.caption, color: colors.textSecondary, flex: 1},
  value: {...typography.body, color: colors.text, fontWeight: '500'},
  valueAccent: {...typography.h3, color: colors.primary},
});
