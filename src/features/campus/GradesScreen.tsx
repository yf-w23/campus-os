import React, {useCallback, useEffect, useState} from 'react';
import {ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {colors, radii, shadows, spacing, typography} from '../../app/theme';
import {Badge, DetailHeader, EmptyState} from '../common/components/Ui';
import {RootStackParamList} from '../../app/navigation/types';
import {fetchGradeReport, GradeCourse, GradeReportResult} from '../../services/campus/grades';

type Props = NativeStackScreenProps<RootStackParamList, 'CampusGrades'>;

function gradeTone(g: string): 'success' | 'default' | 'warning' | 'error' {
  if (g.startsWith('A')) return 'success';
  if (g.startsWith('B')) return 'default';
  if (g.startsWith('C')) return 'warning';
  if (g.startsWith('D') || g === 'F') return 'error';
  return 'default';
}

export function GradesScreen({navigation}: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<GradeReportResult | null>(null);
  const [graduate, setGraduate] = useState(false);

  const load = useCallback(async (isGrad: boolean) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchGradeReport({graduate: isGrad});
      setReport(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(graduate);
  }, [load, graduate]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <DetailHeader
        title="成绩查询"
        onBack={() => navigation.goBack()}
        rightLabel={loading ? '…' : '刷新'}
        onRight={() => !loading && load(graduate)}
      />
      <View style={styles.tabs}>
        {(['本科生', '研究生'] as const).map((label, i) => {
          const active = (i === 1) === graduate;
          return (
            <Pressable
              key={label}
              style={[styles.tab, active && styles.tabActive]}
              onPress={() => setGraduate(i === 1)}>
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>正在从教务系统拉取成绩…</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorTitle}>加载失败</Text>
          <Text style={styles.errorMsg}>{error}</Text>
          <Pressable style={styles.retry} onPress={() => load(graduate)}>
            <Text style={styles.retryText}>重试</Text>
          </Pressable>
        </View>
      ) : !report || report.courses.length === 0 ? (
        <EmptyState title="暂无成绩" description="本学期尚未录入成绩" />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.summaryCard}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>
                {isNaN(report.gpa) ? 'N/A' : report.gpa.toFixed(2)}
              </Text>
              <Text style={styles.summaryLabel}>学分绩</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{report.allCredit}</Text>
              <Text style={styles.summaryLabel}>总学分</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{report.courses.length}</Text>
              <Text style={styles.summaryLabel}>课程数</Text>
            </View>
          </View>
          <Text style={styles.summaryFootnote}>
            学分绩按 {report.totalCredit} 学分（不含 P/F 等通过制课程）计算
          </Text>

          {Object.entries(report.bySemester)
            .sort((a, b) => (a[0] < b[0] ? 1 : -1))
            .map(([sem, courses]) => (
              <View key={sem} style={styles.section}>
                <Text style={styles.sectionTitle}>{sem}</Text>
                {courses.map((c: GradeCourse, idx: number) => (
                  <View key={idx} style={styles.row}>
                    <View style={{flex: 1}}>
                      <Text style={styles.courseName}>{c.name}</Text>
                      <Text style={styles.courseMeta}>
                        {c.credit} 学分 · 绩点{' '}
                        {isNaN(c.point) ? 'N/A' : c.point.toFixed(1)}
                      </Text>
                    </View>
                    <Badge label={c.grade || '—'} tone={gradeTone(c.grade)} />
                  </View>
                ))}
              </View>
            ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background},
  tabs: {
    flexDirection: 'row',
    padding: 4,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.md,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  tab: {flex: 1, paddingVertical: spacing.sm, alignItems: 'center', borderRadius: radii.sm},
  tabActive: {backgroundColor: colors.surface},
  tabText: {...typography.caption, color: colors.textSecondary},
  tabTextActive: {color: colors.text, fontWeight: '600'},
  content: {padding: spacing.lg, paddingBottom: spacing.xxl},
  center: {flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.lg},
  loadingText: {...typography.caption, color: colors.textSecondary},
  errorTitle: {...typography.h3, color: colors.error},
  errorMsg: {...typography.caption, color: colors.textSecondary, textAlign: 'center'},
  retry: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radii.md,
  },
  retryText: {...typography.label, color: colors.textInvert},
  summaryCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.soft,
    alignItems: 'center',
  },
  summaryItem: {flex: 1, alignItems: 'center', gap: 4},
  summaryValue: {...typography.h1, color: colors.primary},
  summaryLabel: {...typography.micro, color: colors.textMuted},
  summaryDivider: {width: 1, height: 40, backgroundColor: colors.divider},
  summaryFootnote: {
    ...typography.micro,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: -spacing.sm,
    marginBottom: spacing.md,
  },
  section: {marginBottom: spacing.lg},
  sectionTitle: {...typography.h3, color: colors.text, marginBottom: spacing.sm},
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radii.md,
    marginBottom: spacing.xs,
    gap: spacing.sm,
    ...shadows.soft,
  },
  courseName: {...typography.label, color: colors.text},
  courseMeta: {...typography.caption, color: colors.textSecondary, marginTop: 2},
});
