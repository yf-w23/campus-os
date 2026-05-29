import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import {BottomTabScreenProps} from '@react-navigation/bottom-tabs';
import {CompositeScreenProps} from '@react-navigation/native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useDispatch, useSelector} from 'react-redux';
import {useTranslation} from '../../app/i18n';
import {RootStackParamList, RootTabParamList} from '../../app/navigation/types';
import {colors, radii, spacing, typography} from '../../app/theme';
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
import {PrimaryButton} from '../common/components/Buttons';
import {FadeIn, StaggerItem} from '../common/components/Animated';
import {HomeLoadingSkeleton} from '../common/components/Skeleton';
import {Badge, GradientCard, SectionHeader} from '../common/components/Ui';

type HomeScreenProps = CompositeScreenProps<
  BottomTabScreenProps<RootTabParamList, 'Home'>,
  NativeStackScreenProps<RootStackParamList>
>;

function greetingByHour(): string {
  const h = new Date().getHours();
  if (h < 5) return '夜深了';
  if (h < 11) return '早上好';
  if (h < 14) return '中午好';
  if (h < 18) return '下午好';
  return '晚上好';
}

function BentoStat({
  value,
  label,
  accent,
}: {
  value: number;
  label: string;
  accent?: string;
}) {
  return (
    <View style={styles.bentoStat}>
      <Text style={[styles.bentoValue, accent ? {color: accent} : null]}>{value}</Text>
      <Text style={styles.bentoLabel}>{label}</Text>
    </View>
  );
}

export function HomeScreen({navigation}: HomeScreenProps) {
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

  const openAI = (question?: string) => {
    navigation.navigate('AI', question ? {initialQuestion: question} : undefined);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <FadeIn>
          <GradientCard style={styles.heroCard}>
            <Text style={styles.greeting}>{greetingByHour()}</Text>
            <Text style={styles.name} numberOfLines={1}>
              {auth.session.displayName ?? t.appName}
            </Text>
            <View style={styles.badgeRow}>
              {auth.demoMode || isDemoData ? (
                <Badge label={t.home.demoBadge} tone="warning" />
              ) : (
                <Badge label={t.home.campusBadge} tone="success" />
              )}
              {lastSyncedAt && !auth.demoMode && dataSource === 'campus' ? (
                <Text style={styles.syncMeta}>
                  · 已同步 {lastSyncedAt.slice(11, 16)}
                </Text>
              ) : null}
            </View>
            <Pressable
              style={({pressed}) => [styles.aiCta, pressed && styles.aiCtaPressed]}
              onPress={() => openAI(t.ai.suggestions[0])}>
              <LinearGradient
                colors={[colors.primary, colors.primaryDark]}
                start={{x: 0, y: 0}}
                end={{x: 1, y: 0}}
                style={styles.aiCtaInner}>
                <Text style={styles.aiCtaLabel}>{t.home.quickAsk}</Text>
                <Text style={styles.aiCtaHint}>{t.ai.suggestions[0]}</Text>
              </LinearGradient>
            </Pressable>
          </GradientCard>
        </FadeIn>

        {error && !auth.demoMode ? (
          <FadeIn delay={80}>
            <View style={styles.errorCard}>
              <Text style={styles.errorTitle}>校园数据同步失败</Text>
              <Text style={styles.errorText}>{error}</Text>
              <PrimaryButton
                label={loading ? '同步中…' : '重新同步'}
                onPress={handleSync}
                loading={loading}
                variant="ghost"
              />
            </View>
          </FadeIn>
        ) : null}

        {loading && !auth.demoMode ? <HomeLoadingSkeleton /> : null}

        {!loading || auth.demoMode ? (
          <>
            <FadeIn delay={120}>
              <View style={styles.bentoRow}>
                <View style={[styles.bentoTile, styles.bentoTileWide]}>
                  <Text style={styles.bentoTileTitle}>今日概览</Text>
                  <View style={styles.bentoStatsRow}>
                    <BentoStat value={schedule.length} label="课程" accent={colors.primary} />
                    <View style={styles.bentoDivider} />
                    <BentoStat value={homework.length} label="待办" />
                    <View style={styles.bentoDivider} />
                    <BentoStat value={unread.length} label="未读" />
                  </View>
                </View>
              </View>
            </FadeIn>

            <SectionHeader title={t.home.todaySchedule} />
            <StaggerItem index={0}>
              <View style={styles.todayCard}>
                {schedule.length === 0 ? (
                  <Text style={styles.emptyLine}>
                    {auth.demoMode ? '演示数据：今天暂无课程' : '今天暂无课程安排'}
                  </Text>
                ) : (
                  schedule.map((item, idx) => (
                    <View
                      key={item.id}
                      style={[styles.scheduleRow, idx > 0 && styles.scheduleDivider]}>
                      <View style={styles.scheduleTime}>
                        <Text style={styles.scheduleStart}>{item.startTime}</Text>
                        <Text style={styles.scheduleEnd}>{item.endTime}</Text>
                      </View>
                      <LinearGradient
                        colors={[colors.primary, colors.primaryDark]}
                        style={styles.scheduleBar}
                      />
                      <View style={styles.scheduleBody}>
                        <Text style={styles.scheduleTitle} numberOfLines={1}>
                          {item.title}
                        </Text>
                        <Text style={styles.scheduleLoc} numberOfLines={1}>
                          {item.location}
                        </Text>
                      </View>
                    </View>
                  ))
                )}
              </View>
            </StaggerItem>

            <SectionHeader title={t.home.upcomingDdl} />
            {homework.length === 0 ? (
              <Text style={styles.emptyLine}>暂无待办作业</Text>
            ) : (
              <View style={styles.listGroup}>
                {homework.slice(0, 4).map((item, idx) => (
                  <StaggerItem key={item.id} index={idx + 1}>
                    <Pressable
                      style={({pressed}) => [
                        styles.listItem,
                        idx > 0 && styles.listItemDivider,
                        pressed && styles.listItemPressed,
                      ]}
                      onPress={() =>
                        navigation.navigate('HomeworkDetail', {id: item.id})
                      }>
                      <Text style={styles.itemTitle} numberOfLines={1}>
                        {item.title}
                      </Text>
                      <Text style={styles.itemMeta} numberOfLines={1}>
                        {item.courseName} · {item.deadline || '无截止时间'}
                      </Text>
                    </Pressable>
                  </StaggerItem>
                ))}
              </View>
            )}

            <FadeIn delay={180}>
              <Pressable
                style={({pressed}) => [styles.quickAskCard, pressed && styles.listItemPressed]}
                onPress={() => openAI()}>
                <View style={styles.quickAskCopy}>
                  <Text style={styles.quickAskTitle}>{t.home.quickAsk}</Text>
                  <Text style={styles.quickAskDesc}>{t.ai.emptyDesc}</Text>
                </View>
                <View style={styles.quickAskArrow}>
                  <Text style={styles.quickAskArrowText}>→</Text>
                </View>
              </Pressable>
            </FadeIn>

            {!auth.demoMode ? (
              <View style={styles.syncButtonWrap}>
                <PrimaryButton
                  label={loading ? '同步中…' : t.home.sync}
                  onPress={handleSync}
                  disabled={loading}
                  variant="ghost"
                />
              </View>
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {flex: 1},
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },
  heroCard: {
    marginBottom: spacing.lg,
  },
  greeting: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  name: {
    ...typography.display,
    color: colors.text,
    marginTop: 4,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  syncMeta: {
    ...typography.caption,
    color: colors.textMuted,
  },
  aiCta: {
    borderRadius: radii.lg,
    overflow: 'hidden',
  },
  aiCtaPressed: {
    opacity: 0.9,
    transform: [{scale: 0.99}],
  },
  aiCtaInner: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    gap: 4,
  },
  aiCtaLabel: {
    ...typography.label,
    color: colors.textInvert,
    fontWeight: '700',
  },
  aiCtaHint: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.82)',
  },
  errorCard: {
    backgroundColor: colors.errorMuted,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.25)',
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
  bentoRow: {
    marginBottom: spacing.md,
  },
  bentoTile: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: spacing.md,
  },
  bentoTileWide: {
    width: '100%',
  },
  bentoTileTitle: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  bentoStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bentoStat: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  bentoValue: {
    ...typography.h1,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  bentoLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  bentoDivider: {
    width: StyleSheet.hairlineWidth,
    height: 36,
    backgroundColor: colors.divider,
  },
  todayCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  scheduleDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  scheduleTime: {
    width: 52,
    alignItems: 'flex-start',
  },
  scheduleStart: {
    ...typography.label,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  scheduleEnd: {
    ...typography.caption,
    color: colors.textMuted,
    fontVariant: ['tabular-nums'],
    marginTop: 2,
  },
  scheduleBar: {
    width: 3,
    alignSelf: 'stretch',
    borderRadius: 2,
  },
  scheduleBody: {flex: 1, gap: 2},
  scheduleTitle: {
    ...typography.body,
    color: colors.text,
    fontWeight: '500',
  },
  scheduleLoc: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  emptyLine: {
    ...typography.body,
    color: colors.textMuted,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.md,
  },
  listGroup: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    overflow: 'hidden',
  },
  listItem: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    gap: 4,
  },
  listItemDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  listItemPressed: {
    backgroundColor: colors.surfaceAlt,
  },
  itemTitle: {
    ...typography.body,
    color: colors.text,
    fontWeight: '500',
  },
  itemMeta: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  quickAskCard: {
    marginTop: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  quickAskCopy: {
    flex: 1,
    gap: 4,
  },
  quickAskTitle: {
    ...typography.label,
    color: colors.text,
    fontWeight: '700',
  },
  quickAskDesc: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  quickAskArrow: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickAskArrowText: {
    color: colors.primary,
    fontSize: 18,
    fontWeight: '700',
  },
  syncButtonWrap: {
    marginTop: spacing.xl,
  },
});
