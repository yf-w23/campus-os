import React, {useMemo} from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useSelector} from 'react-redux';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {colors, radii, shadows, spacing, typography} from '../../app/theme';
import {Badge, DetailHeader, EmptyState, InfoRow, ListCard, SectionHeader} from '../common/components/Ui';
import {selectLearning} from '../../state/selectors';
import {HomeworkStatus} from '../../domain/learning';
import {stripHtml} from '../../utils/html';
import {RootStackParamList} from '../../app/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'CourseDetail'>;

const labelMap: Record<HomeworkStatus, string> = {
  pending: '待提交',
  submitted: '已提交',
  graded: '已批改',
  overdue: '已逾期',
};
const toneMap: Record<HomeworkStatus, 'default' | 'success' | 'warning' | 'error'> = {
  pending: 'warning',
  submitted: 'default',
  graded: 'success',
  overdue: 'error',
};
const statusAccent: Record<HomeworkStatus, 'primary' | 'success' | 'warning' | 'error'> = {
  pending: 'warning',
  submitted: 'primary',
  graded: 'success',
  overdue: 'error',
};

export function CourseDetailScreen({route, navigation}: Props) {
  const {id} = route.params;
  const {snapshot} = useSelector(selectLearning);

  const course = useMemo(
    () => snapshot?.courses.find(c => c.id === id),
    [snapshot, id],
  );
  const homework = useMemo(
    () => (snapshot?.homework ?? []).filter(h => h.courseId === id),
    [snapshot, id],
  );
  const notifications = useMemo(
    () => (snapshot?.notifications ?? []).filter(n => n.courseId === id),
    [snapshot, id],
  );
  const files = useMemo(
    () => (snapshot?.files ?? []).filter(f => f.courseId === id),
    [snapshot, id],
  );

  if (!course) {
    return (
      <SafeAreaView style={styles.container}>
        <DetailHeader title="课程详情" onBack={() => navigation.goBack()} />
        <EmptyState title="课程信息不存在" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <DetailHeader title={course.name} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>{course.name}</Text>
          {course.teacherName ? (
            <Text style={styles.heroMeta}>授课 · {course.teacherName}</Text>
          ) : null}
          <View style={styles.statsRow}>
            <Stat label="作业" value={homework.length} />
            <Stat label="通知" value={notifications.length} />
            <Stat label="资料" value={files.length} />
          </View>
        </View>

        {(course.courseNumber || course.timeAndLocation?.length) ? (
          <View style={styles.section}>
            {course.courseNumber ? (
              <InfoRow label="课号" value={course.courseNumber} mono />
            ) : null}
            {course.timeAndLocation?.length ? (
              <InfoRow label="时间地点" value={course.timeAndLocation.join(' · ')} />
            ) : null}
          </View>
        ) : null}

        <SectionHeader title={`作业 (${homework.length})`} />
        {homework.length === 0 ? (
          <EmptyState title="暂无作业" />
        ) : (
          homework.map(item => (
            <ListCard
              key={item.id}
              accent={statusAccent[item.status]}
              onPress={() => navigation.navigate('HomeworkDetail', {id: item.id})}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle} numberOfLines={2}>
                  {item.title}
                </Text>
                <Badge label={labelMap[item.status]} tone={toneMap[item.status]} />
              </View>
              <Text style={styles.cardMeta}>截止 {item.deadline || '—'}</Text>
            </ListCard>
          ))
        )}

        <SectionHeader title={`通知 (${notifications.length})`} />
        {notifications.length === 0 ? (
          <EmptyState title="暂无通知" />
        ) : (
          notifications.slice(0, 10).map(item => (
            <ListCard
              key={item.id}
              accent={!item.hasRead ? 'warning' : 'neutral'}
              onPress={() => navigation.navigate('NotificationDetail', {id: item.id})}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle} numberOfLines={2}>
                  {item.title}
                </Text>
                {!item.hasRead ? <Badge label="未读" tone="warning" /> : null}
              </View>
              <Text style={styles.cardMeta}>{item.publishTime}</Text>
              <Text style={styles.cardBody} numberOfLines={2}>
                {stripHtml(item.content).slice(0, 80) || ' '}
              </Text>
            </ListCard>
          ))
        )}

        <SectionHeader title={`资料 (${files.length})`} />
        {files.length === 0 ? (
          <EmptyState title="暂无资料" />
        ) : (
          files.slice(0, 20).map(item => (
            <ListCard
              key={item.id}
              accent={item.isNew ? 'success' : 'neutral'}
              onPress={() => navigation.navigate('FileDetail', {id: item.id})}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle} numberOfLines={2}>
                  {item.title}
                </Text>
                {item.isNew ? <Badge label="NEW" tone="success" /> : null}
              </View>
              <Text style={styles.cardMeta}>
                {String(item.fileType).toUpperCase() || '文件'} · {item.size} · {item.uploadTime}
              </Text>
            </ListCard>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({label, value}: {label: string; value: number}) {
  return (
    <View style={styles.statItem}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background},
  content: {padding: spacing.lg, paddingBottom: spacing.xxl},
  hero: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.soft,
    gap: spacing.sm,
  },
  heroTitle: {...typography.h1, color: colors.text},
  heroMeta: {...typography.caption, color: colors.textSecondary},
  statsRow: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    marginTop: spacing.xs,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  statValue: {...typography.h2, color: colors.primary},
  statLabel: {...typography.micro, color: colors.textMuted},
  section: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    marginBottom: spacing.md,
    ...shadows.soft,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  cardTitle: {...typography.label, color: colors.text, flex: 1},
  cardMeta: {...typography.caption, color: colors.textSecondary},
  cardBody: {...typography.caption, color: colors.text},
});
