import React from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {useDispatch, useSelector} from 'react-redux';
import {useTranslation} from '../../app/i18n';
import {colors, spacing, typography} from '../../app/theme';
import {PrimaryButton} from '../common/components/Buttons';
import {Badge, GradientCard, SectionHeader} from '../common/components/Ui';
import {
  selectAuth,
  selectIsDemoData,
  selectLearning,
  selectTodaySchedule,
  selectUnreadNotifications,
  selectUpcomingHomework,
} from '../../state/selectors';
import {AppDispatch} from '../../state/store';
import {syncCampusData} from '../../state/thunks/syncCampusData';

interface HomeProps {
  navigation: any;
}

export function HomeScreen({navigation}: HomeProps) {
  const t = useTranslation();
  const dispatch = useDispatch<AppDispatch>();
  const auth = useSelector(selectAuth);
  const {loading, error, dataSource, lastSyncedAt} = useSelector(selectLearning);

  const isDemoData = useSelector(selectIsDemoData);
  const schedule = useSelector(selectTodaySchedule);
  const homework = useSelector(selectUpcomingHomework);
  const unread = useSelector(selectUnreadNotifications);

  const handleSync = () => {
    dispatch(syncCampusData());
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Image
          source={require('../../assets/illustrations/app-icon.png')}
          style={styles.logo}
        />
        <View style={styles.headerText}>
          <Text style={styles.greeting}>{t.home.greeting}</Text>
          <Text style={styles.title}>{auth.session.displayName ?? 'Campus OS'}</Text>
          <View style={styles.badges}>
            {auth.demoMode || isDemoData ? (
              <Badge label={t.home.demoBadge} tone="warning" />
            ) : (
              <Badge label={t.home.campusBadge} tone="success" />
            )}
          </View>
        </View>
      </View>

      {error && !auth.demoMode ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorTitle}>校园数据同步失败</Text>
          <Text style={styles.errorText}>{error}</Text>
          <PrimaryButton
            label={loading ? '同步中…' : '重新同步'}
            onPress={handleSync}
            loading={loading}
          />
        </View>
      ) : null}

      {loading && !auth.demoMode ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.loadingText}>正在拉取你的课表与作业…</Text>
        </View>
      ) : null}

      <GradientCard>
        <Text style={styles.cardTitle}>{t.home.todaySchedule}</Text>
        {schedule.length === 0 ? (
          <Text style={styles.cardBody}>
            {auth.demoMode ? '演示数据：今天暂无课程' : '今天暂无课程安排'}
          </Text>
        ) : (
          schedule.map(item => (
            <Text key={item.id} style={styles.cardBody}>
              {item.startTime}-{item.endTime} · {item.title} @ {item.location}
            </Text>
          ))
        )}
      </GradientCard>

      <SectionHeader title={t.home.upcomingDdl} />
      {homework.length === 0 ? (
        <Text style={styles.metaText}>暂无待办作业</Text>
      ) : (
        homework.slice(0, 4).map(item => (
          <Pressable
            key={item.id}
            style={({pressed}) => [styles.listItem, pressed && styles.itemPressed]}
            onPress={() => navigation.navigate('HomeworkDetail', {id: item.id})}>
            <Text style={styles.itemTitle}>{item.title}</Text>
            <Text style={styles.itemMeta}>
              {item.courseName} · {item.deadline || '无截止时间'}
            </Text>
          </Pressable>
        ))
      )}

      <SectionHeader title={t.learning.notifications} />
      <Text style={styles.metaText}>未读通知 {unread.length} 条</Text>

      {lastSyncedAt && !auth.demoMode && dataSource === 'campus' ? (
        <Text style={styles.syncMeta}>
          上次同步：{lastSyncedAt.replace('T', ' ').slice(0, 19)}
        </Text>
      ) : null}

      {!auth.demoMode ? (
        <PrimaryButton
          label={loading ? '同步中…' : t.home.sync}
          onPress={handleSync}
          disabled={loading}
        />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 16,
  },
  headerText: {
    flex: 1,
    gap: spacing.xs,
  },
  badges: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  greeting: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  title: {
    ...typography.h1,
    color: colors.text,
  },
  errorBox: {
    backgroundColor: '#FEF2F2',
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: '#FECACA',
    gap: spacing.sm,
  },
  errorTitle: {
    ...typography.label,
    color: colors.error,
  },
  errorText: {
    ...typography.caption,
    color: colors.text,
  },
  loadingBox: {
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  loadingText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  cardTitle: {
    ...typography.h3,
    color: '#fff',
    marginBottom: spacing.sm,
  },
  cardBody: {
    ...typography.body,
    color: '#fff',
    marginBottom: spacing.xs,
  },
  itemPressed: {opacity: 0.75, transform: [{scale: 0.99}]},
  listItem: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  itemTitle: {
    ...typography.label,
    color: colors.text,
  },
  itemMeta: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  metaText: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  syncMeta: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
});
