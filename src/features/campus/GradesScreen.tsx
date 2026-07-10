import React, {useCallback, useEffect, useState} from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {colors, radii, shadows, spacing, typography} from '../../app/theme';
import {
  Badge,
  DetailHeader,
  MetricPill,
  SegmentedControl,
  SurfaceGroup,
} from '../common/components/Ui';
import {EmptyHint, InlineLoader, StateBlock} from '../common/components/Status';
import {RootStackParamList} from '../../app/navigation/types';
import {fetchGradeReport, GradeCourse, GradeReportResult} from '../../services/campus/grades';

type Props = NativeStackScreenProps<RootStackParamList, 'CampusGrades'>;
type GradeAudience = 'undergrad' | 'grad';

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

  const gradeAudience: GradeAudience = graduate ? 'grad' : 'undergrad';

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <DetailHeader
        title="成绩查询"
        onBack={() => navigation.goBack()}
        rightLabel={loading ? '…' : '刷新'}
        onRight={() => !loading && load(graduate)}
      />
      <SegmentedControl<GradeAudience>
        value={gradeAudience}
        onChange={value => setGraduate(value === 'grad')}
        options={[
          {value: 'undergrad', label: '本科生'},
          {value: 'grad', label: '研究生'},
        ]}
        style={styles.tabs}
      />

      {loading ? (
        <InlineLoader label="正在从教务系统拉取成绩..." style={styles.center} />
      ) : error ? (
        <View style={styles.center}>
          <StateBlock
            title="成绩加载失败"
            message={error}
            tone="error"
            actionLabel="重试"
            onAction={() => load(graduate)}
            style={styles.statusBlock}
          />
        </View>
      ) : !report || report.courses.length === 0 ? (
        <EmptyHint
          title="暂无成绩"
          message="本学期尚未录入成绩，或当前培养层次暂无可显示课程。"
          style={styles.center}
        />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <SurfaceGroup compact style={styles.summaryCard}>
            <MetricPill
              label="学分绩"
              value={isNaN(report.gpa) ? 'N/A' : report.gpa.toFixed(2)}
            />
            <View style={styles.summaryDivider} />
            <MetricPill label="总学分" value={report.allCredit} />
            <View style={styles.summaryDivider} />
            <MetricPill label="课程数" value={report.courses.length} />
          </SurfaceGroup>
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
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  content: {padding: spacing.lg, paddingBottom: spacing.xxl},
  center: {flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.lg},
  statusBlock: {alignSelf: 'stretch'},
  summaryCard: {
    flexDirection: 'row',
    marginBottom: spacing.lg,
    ...shadows.soft,
    alignItems: 'center',
    gap: spacing.sm,
  },
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
