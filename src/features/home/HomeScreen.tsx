import React, {useEffect, useMemo, useState} from 'react';
import {
  Alert,
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
  selectSettings,
  selectTodaySchedule,
  selectUnreadNotifications,
  selectUpcomingDeadlines,
} from '../../state/selectors';
import {AppDispatch} from '../../state/store';
import {syncCampusData} from '../../state/thunks/syncCampusData';
import {AgentUIAction} from '../../domain/agentUi';
import {
  CampusWeather,
  fetchHaidianWeather,
} from '../../services/campus/weather';
import {AgentUIRenderer} from '../agent-ui/AgentUIRenderer';
import {PrimaryButton} from '../common/components/Buttons';
import {FadeIn, StaggerItem} from '../common/components/Animated';
import {HomeLoadingSkeleton} from '../common/components/Skeleton';
import {SectionHeader} from '../common/components/Ui';
import {StateBlock} from '../common/components/Status';
import {buildHomeWorkbenchBlocks} from './homeWorkbench';

type HomeScreenProps = CompositeScreenProps<
  BottomTabScreenProps<RootTabParamList, 'Home'>,
  NativeStackScreenProps<RootStackParamList>
>;

function template(
  value: string,
  vars: Record<string, string | number>,
): string {
  return value.replace(/\{(\w+)\}/g, (_, key) => String(vars[key] ?? ''));
}

function greetingByHour(locale: 'zh' | 'en'): string {
  const h = new Date().getHours();
  if (locale === 'en') {
    if (h < 5) {
      return 'Good night';
    }
    if (h < 12) {
      return 'Good morning';
    }
    if (h < 18) {
      return 'Good afternoon';
    }
    return 'Good evening';
  }
  if (h < 5) {
    return '夜深了';
  }
  if (h < 11) {
    return '早上好';
  }
  if (h < 14) {
    return '中午好';
  }
  if (h < 18) {
    return '下午好';
  }
  return '晚上好';
}

function formatToday(locale: 'zh' | 'en'): string {
  const now = new Date();
  if (locale === 'en') {
    return now.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      weekday: 'short',
    });
  }
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return `${now.getMonth() + 1}月${now.getDate()}日 ${weekdays[now.getDay()]}`;
}

function compactWeatherLine(
  weather: CampusWeather | null,
  loading: boolean,
  locale: 'zh' | 'en',
): string {
  if (weather) {
    const temp =
      typeof weather.temperature === 'number'
        ? `${Math.round(weather.temperature)}°`
        : '--';
    const rain =
      typeof weather.precipitationProbability === 'number'
        ? ` · ${locale === 'zh' ? '近3h降水' : '3h rain'} ${Math.round(
            weather.precipitationProbability,
          )}%`
        : '';
    return `${locale === 'zh' ? '海淀' : 'Haidian'} ${temp} · ${
      weather.condition
    }${rain}`;
  }
  return loading
    ? locale === 'zh'
      ? '海淀天气更新中'
      : 'Updating Haidian weather'
    : locale === 'zh'
    ? '海淀天气暂不可用'
    : 'Haidian weather unavailable';
}

export function HomeScreen({navigation}: HomeScreenProps) {
  const t = useTranslation();
  const dispatch = useDispatch<AppDispatch>();
  const auth = useSelector(selectAuth);
  const {loading, error, dataSource, lastSyncedAt} =
    useSelector(selectLearning);

  const isDemoData = useSelector(selectIsDemoData);
  const schedule = useSelector(selectTodaySchedule);
  const deadlines = useSelector(selectUpcomingDeadlines);
  const unread = useSelector(selectUnreadNotifications);
  const {locale} = useSelector(selectSettings);
  const [weather, setWeather] = useState<CampusWeather | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState<string | null>(null);

  const handleSync = () => {
    dispatch(syncCampusData());
  };

  const openAI = (question?: string) => {
    navigation.navigate(
      'AI',
      question ? {initialQuestion: question} : undefined,
    );
  };

  const openAddDdl = () => {
    navigation.navigate('Learning', {
      initialTab: 'homework',
      openAddDeadline: true,
    });
  };

  const openWeatherDetail = () => {
    navigation.navigate('WeatherDetail');
  };

  useEffect(() => {
    let cancelled = false;
    setWeatherLoading(true);
    setWeatherError(null);
    fetchHaidianWeather(locale)
      .then(result => {
        if (!cancelled) {
          setWeather(result);
        }
      })
      .catch(weatherFetchError => {
        if (!cancelled) {
          setWeatherError(
            weatherFetchError instanceof Error
              ? weatherFetchError.message
              : 'Weather request failed',
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setWeatherLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [locale]);

  const workbenchBlocks = useMemo(
    () =>
      buildHomeWorkbenchBlocks({
        schedule,
        deadlines,
        unread,
        weather,
        weatherLoading,
        weatherError,
        locale,
      }),
    [
      deadlines,
      locale,
      schedule,
      unread,
      weather,
      weatherError,
      weatherLoading,
    ],
  );

  const handleAgentAction = (action: AgentUIAction) => {
    if (action.type === 'ask_ai') {
      openAI(action.question);
      return;
    }
    if (action.type === 'add_deadline') {
      openAddDdl();
      return;
    }
    if (action.type === 'sync') {
      handleSync();
      return;
    }
    if (action.type === 'navigate' && action.routeName) {
      (navigation as any).navigate(action.routeName, action.params);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <FadeIn>
          <View style={styles.topHeader}>
            <View style={styles.topHeaderCopy}>
              <Text style={styles.headerEyebrow}>
                {greetingByHour(locale)} · {formatToday(locale)}
              </Text>
              <Text style={styles.headerTitle}>{t.appName}</Text>
              <Pressable
                onPress={openWeatherDetail}
                hitSlop={8}
                accessibilityRole="button"
                style={({pressed}) => [
                  styles.weatherLink,
                  pressed && styles.weatherLinkPressed,
                ]}>
                <Text style={styles.headerMeta} numberOfLines={1}>
                  {compactWeatherLine(weather, weatherLoading, locale)} ·{' '}
                  {locale === 'zh' ? '详情' : 'Details'}
                </Text>
              </Pressable>
            </View>
            <View style={styles.statusPill}>
              <Text style={styles.statusPillText} numberOfLines={1}>
                {auth.demoMode || isDemoData
                  ? t.home.demoBadge
                  : lastSyncedAt && dataSource === 'campus'
                  ? template(t.home.syncedAt, {
                      time: lastSyncedAt.slice(11, 16),
                    })
                  : locale === 'zh'
                  ? '待同步'
                  : 'Sync pending'}
              </Text>
            </View>
          </View>
        </FadeIn>

        {error && !auth.demoMode ? (
          <FadeIn delay={80}>
            <StateBlock
              title={t.home.syncFailed}
              message={error}
              tone="error"
              style={styles.syncErrorBlock}>
              <PrimaryButton
                label={loading ? '同步中…' : t.home.retrySync}
                onPress={handleSync}
                loading={loading}
                variant="ghost"
              />
            </StateBlock>
          </FadeIn>
        ) : null}

        {loading && !auth.demoMode ? <HomeLoadingSkeleton /> : null}

        {!loading || auth.demoMode ? (
          <>
            <FadeIn delay={100}>
              <AgentUIRenderer
                blocks={workbenchBlocks}
                onAction={handleAgentAction}
              />
            </FadeIn>

            <SectionHeader title={t.home.todaySchedule} />
            <StaggerItem index={0}>
              <View style={styles.todayCard}>
                {schedule.length === 0 ? (
                  <Text style={styles.emptyLine}>
                    {auth.demoMode
                      ? t.home.demoNoClasses
                      : t.home.noClassesToday}
                  </Text>
                ) : (
                  schedule.map((item, idx) => (
                    <View
                      key={item.id}
                      style={[
                        styles.scheduleRow,
                        idx > 0 && styles.scheduleDivider,
                      ]}>
                      <View style={styles.scheduleTime}>
                        <Text style={styles.scheduleStart}>
                          {item.startTime}
                        </Text>
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

            <SectionHeader
              title={t.home.upcomingDdl}
              actionLabel={t.home.addDdl}
              onAction={openAddDdl}
            />
            {deadlines.length === 0 ? (
              <Text style={styles.emptyLine}>{t.home.noDdl}</Text>
            ) : (
              <View style={styles.listGroup}>
                {deadlines.slice(0, 4).map((item, idx) => (
                  <StaggerItem key={item.id} index={idx + 1}>
                    <Pressable
                      style={({pressed}) => [
                        styles.listItem,
                        idx > 0 && styles.listItemDivider,
                        pressed && styles.listItemPressed,
                      ]}
                      onPress={() => {
                        if (item.kind === 'homework') {
                          navigation.navigate('HomeworkDetail', {id: item.id});
                          return;
                        }
                        Alert.alert(
                          item.title,
                          [
                            `${t.learning.deadlinePrefix.replace(
                              '{deadline}',
                              item.deadline,
                            )}`,
                            item.courseName,
                            item.note,
                          ]
                            .filter(Boolean)
                            .join('\n'),
                        );
                      }}>
                      <Text style={styles.itemTitle} numberOfLines={1}>
                        {item.title}
                      </Text>
                      <Text style={styles.itemMeta} numberOfLines={1}>
                        {[
                          item.kind === 'manual'
                            ? t.learning.manualDdl
                            : item.courseName,
                          item.deadline || t.home.noDeadline,
                        ].join(' · ')}
                      </Text>
                    </Pressable>
                  </StaggerItem>
                ))}
              </View>
            )}

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
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  topHeaderCopy: {
    flex: 1,
    gap: 3,
  },
  headerEyebrow: {
    ...typography.caption,
    color: colors.textMuted,
  },
  headerTitle: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
    color: colors.text,
  },
  headerMeta: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  weatherLink: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  weatherLinkPressed: {
    opacity: 0.65,
  },
  statusPill: {
    maxWidth: 112,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 1,
  },
  statusPillText: {
    ...typography.micro,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  syncErrorBlock: {marginBottom: spacing.md},
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
  syncButtonWrap: {
    marginTop: spacing.xl,
  },
});
