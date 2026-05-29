import React, {useMemo, useState} from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useSelector} from 'react-redux';
import {useTranslation} from '../../app/i18n';
import {colors, radii, spacing, typography} from '../../app/theme';
import {Badge, EmptyState, ListCard, ScreenHeader} from '../common/components/Ui';
import {selectLearning} from '../../state/selectors';
import {HomeworkStatus} from '../../domain/learning';
import {stripHtml} from '../../utils/html';

type TabKey = 'courses' | 'homework' | 'notifications' | 'files';

const statusTone: Record<HomeworkStatus, 'default' | 'success' | 'warning' | 'error'> = {
  pending: 'warning',
  submitted: 'default',
  graded: 'success',
  overdue: 'error',
};

const statusAccent: Record<
  HomeworkStatus,
  'primary' | 'success' | 'warning' | 'error' | 'neutral'
> = {
  pending: 'warning',
  submitted: 'primary',
  graded: 'success',
  overdue: 'error',
};

interface Props {
  navigation: any;
}

export function LearningScreen({navigation}: Props) {
  const t = useTranslation();
  const {snapshot} = useSelector(selectLearning);
  const [tab, setTab] = useState<TabKey>('courses');

  const tabs = useMemo(
    () =>
      [
        {key: 'courses' as const, label: t.learning.courses},
        {key: 'homework' as const, label: t.learning.homework},
        {key: 'notifications' as const, label: t.learning.notifications},
        {key: 'files' as const, label: t.learning.files},
      ] as const,
    [t],
  );

  const counts = {
    courses: snapshot?.courses.length ?? 0,
    homework: snapshot?.homework.length ?? 0,
    notifications: snapshot?.notifications.length ?? 0,
    files: snapshot?.files.length ?? 0,
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
      <ScreenHeader
        eyebrow={t.tabs.learning}
        title={t.learning.title}
        subtitle={`${counts.courses} 课程 · ${counts.homework} 作业 · ${counts.notifications} 通知`}
      />

      <View style={styles.segment}>
        {tabs.map(item => {
          const active = tab === item.key;
          return (
            <Pressable
              key={item.key}
              style={[styles.segmentItem, active && styles.segmentItemActive]}
              onPress={() => setTab(item.key)}>
              <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                {item.label}
              </Text>
              <Text style={[styles.segmentCount, active && styles.segmentCountActive]}>
                {counts[item.key]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {tab === 'courses' ? (
        snapshot?.courses.length ? (
          snapshot.courses.map(course => (
            <ListCard
              key={course.id}
              accent="primary"
              onPress={() => navigation.navigate('CourseDetail', {id: course.id})}>
              <Text style={styles.cardTitle}>{course.name}</Text>
              {course.teacherName ? (
                <Text style={styles.cardMeta}>{course.teacherName}</Text>
              ) : null}
              {course.courseNumber ? (
                <Text style={styles.cardMeta}>课号 {course.courseNumber}</Text>
              ) : null}
            </ListCard>
          ))
        ) : (
          <EmptyState title="本学期暂无课程" />
        )
      ) : null}

      {tab === 'homework' ? (
        snapshot?.homework.length ? (
          snapshot.homework.map(item => (
            <ListCard
              key={item.id}
              accent={statusAccent[item.status]}
              onPress={() => navigation.navigate('HomeworkDetail', {id: item.id})}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle} numberOfLines={2}>
                  {item.title}
                </Text>
                <Badge
                  label={
                    item.status === 'pending'
                      ? t.learning.pending
                      : item.status === 'submitted'
                        ? t.learning.submitted
                        : item.status === 'graded'
                          ? t.learning.graded
                          : t.learning.overdue
                  }
                  tone={statusTone[item.status]}
                />
              </View>
              <Text style={styles.cardMeta}>{item.courseName}</Text>
              <Text style={styles.cardMeta}>截止 {item.deadline || '—'}</Text>
            </ListCard>
          ))
        ) : (
          <EmptyState title="暂无作业" />
        )
      ) : null}

      {tab === 'notifications' ? (
        snapshot?.notifications.length ? (
          snapshot.notifications.map(item => (
            <ListCard
              key={item.id}
              accent={!item.hasRead ? 'warning' : 'neutral'}
              onPress={() =>
                navigation.navigate('NotificationDetail', {id: item.id})
              }>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle} numberOfLines={2}>
                  {item.title}
                </Text>
                {!item.hasRead ? <Badge label="未读" tone="warning" /> : null}
              </View>
              <Text style={styles.cardMeta}>
                {item.courseName} · {item.publisher} · {item.publishTime}
              </Text>
              <Text style={styles.cardBody} numberOfLines={2}>
                {stripHtml(item.content).slice(0, 120) || '（无内容）'}
              </Text>
            </ListCard>
          ))
        ) : (
          <EmptyState title="暂无通知" />
        )
      ) : null}

      {tab === 'files' ? (
        snapshot?.files.length ? (
          snapshot.files.map(item => (
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
                {item.courseName} · {item.fileType.toUpperCase() || '文件'} · {item.size}
              </Text>
            </ListCard>
          ))
        ) : (
          <EmptyState title="暂无资料" />
        )
      ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background},
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl + spacing.xl,
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.md,
    padding: 3,
    marginBottom: spacing.lg,
  },
  segmentItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm + 2,
    borderRadius: radii.sm,
    gap: 4,
  },
  segmentItemActive: {
    backgroundColor: colors.surface,
  },
  segmentText: {...typography.caption, color: colors.textMuted},
  segmentTextActive: {color: colors.text, fontWeight: '600'},
  segmentCount: {...typography.micro, color: colors.textMuted},
  segmentCountActive: {color: colors.primary},
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  cardTitle: {...typography.label, color: colors.text, flex: 1, fontSize: 15},
  cardMeta: {...typography.caption, color: colors.textSecondary},
  cardBody: {...typography.caption, color: colors.textSecondary, marginTop: 2},
});
