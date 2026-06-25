import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
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
import {useSelector} from 'react-redux';
import {RootStackParamList} from '../../app/navigation/types';
import {colors, radii, spacing, typography} from '../../app/theme';
import {selectSettings} from '../../state/selectors';
import {
  CampusDailyWeather,
  CampusHourlyWeather,
  CampusWeather,
  fetchHaidianWeather,
} from '../../services/campus/weather';
import {DetailHeader} from '../common/components/Ui';

type WeatherDetailProps = NativeStackScreenProps<
  RootStackParamList,
  'WeatherDetail'
>;

type Locale = 'zh' | 'en';

const HOUR_MS = 60 * 60 * 1000;
const WEEKDAYS_ZH = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const WEEKDAYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function roundValue(value?: number, suffix = ''): string {
  return typeof value === 'number' ? `${Math.round(value)}${suffix}` : '--';
}

function parseWeatherTime(value?: string): number | undefined {
  const time = Date.parse(String(value ?? ''));
  return Number.isNaN(time) ? undefined : time;
}

function formatUpdatedAt(value: string | undefined, locale: Locale): string {
  const time = parseWeatherTime(value);
  if (time == null) {
    return locale === 'zh' ? '刚刚更新' : 'Updated just now';
  }
  const date = new Date(time);
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return locale === 'zh' ? `更新于 ${hh}:${mm}` : `Updated ${hh}:${mm}`;
}

function formatHour(value: string, index: number, locale: Locale): string {
  if (index === 0) {
    return locale === 'zh' ? '现在' : 'Now';
  }
  const time = parseWeatherTime(value);
  if (time == null) {
    return '--';
  }
  const date = new Date(time);
  return `${String(date.getHours()).padStart(2, '0')}:00`;
}

function dayLabel(value: string, index: number, locale: Locale): string {
  if (index === 0) {
    return locale === 'zh' ? '今天' : 'Today';
  }
  if (index === 1) {
    return locale === 'zh' ? '明天' : 'Tomorrow';
  }
  const time = parseWeatherTime(`${value}T00:00`);
  if (time == null) {
    return value;
  }
  const date = new Date(time);
  return locale === 'zh'
    ? WEEKDAYS_ZH[date.getDay()] ?? value
    : WEEKDAYS_EN[date.getDay()] ?? value;
}

function rainSummary(weather: CampusWeather, locale: Locale): string {
  const probability = weather.shortTermPrecipitationProbability;
  if (typeof probability !== 'number') {
    return locale === 'zh' ? '短时降水待更新' : 'Short-term rain pending';
  }
  if (probability <= 5) {
    return locale === 'zh'
      ? '未来短时内基本无降水'
      : 'Little rain expected soon';
  }
  return locale === 'zh'
    ? `未来 3 小时降水 ${Math.round(probability)}%`
    : `${Math.round(probability)}% rain in the next 3h`;
}

function dailyRainLabel(item: CampusDailyWeather, locale: Locale): string {
  if (typeof item.precipitationProbabilityMax !== 'number') {
    return '--';
  }
  return locale === 'zh'
    ? `最高 ${Math.round(item.precipitationProbabilityMax)}%`
    : `max ${Math.round(item.precipitationProbabilityMax)}%`;
}

function upcomingHourly(items: CampusHourlyWeather[]): CampusHourlyWeather[] {
  const now = Date.now();
  const firstIndex = items.findIndex(item => {
    const time = parseWeatherTime(item.time);
    return time != null && time >= now - HOUR_MS;
  });
  return items.slice(Math.max(firstIndex, 0), Math.max(firstIndex, 0) + 12);
}

function WeatherMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue} numberOfLines={1}>
        {value}
      </Text>
      {detail ? (
        <Text style={styles.metricDetail} numberOfLines={1}>
          {detail}
        </Text>
      ) : null}
    </View>
  );
}

function HourlyTile({
  item,
  index,
  locale,
}: {
  item: CampusHourlyWeather;
  index: number;
  locale: Locale;
}) {
  return (
    <View style={styles.hourlyTile}>
      <Text style={styles.hourlyTime}>
        {formatHour(item.time, index, locale)}
      </Text>
      <Text style={styles.hourlyTemp}>{roundValue(item.temperature, '°')}</Text>
      <Text style={styles.hourlyCondition} numberOfLines={1}>
        {item.condition}
      </Text>
      <Text style={styles.hourlyRain}>
        {typeof item.precipitationProbability === 'number'
          ? `${Math.round(item.precipitationProbability)}%`
          : '--'}
      </Text>
    </View>
  );
}

function DailyRow({
  item,
  index,
  locale,
}: {
  item: CampusDailyWeather;
  index: number;
  locale: Locale;
}) {
  return (
    <View style={[styles.dailyRow, index > 0 && styles.dailyDivider]}>
      <Text style={styles.dailyDay}>{dayLabel(item.date, index, locale)}</Text>
      <Text style={styles.dailyCondition} numberOfLines={1}>
        {item.condition}
      </Text>
      <Text style={styles.dailyRange}>
        {roundValue(item.temperatureMin, '°')} /{' '}
        {roundValue(item.temperatureMax, '°')}
      </Text>
      <Text style={styles.dailyRain} numberOfLines={1}>
        {dailyRainLabel(item, locale)}
      </Text>
    </View>
  );
}

export function WeatherDetailScreen({navigation}: WeatherDetailProps) {
  const {locale} = useSelector(selectSettings);
  const [weather, setWeather] = useState<CampusWeather | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const requestSeqRef = useRef(0);

  const refresh = useCallback(() => {
    const requestSeq = requestSeqRef.current + 1;
    requestSeqRef.current = requestSeq;
    setLoading(true);
    setError(null);
    fetchHaidianWeather(locale)
      .then(result => {
        if (mountedRef.current && requestSeqRef.current === requestSeq) {
          setWeather(result);
        }
      })
      .catch(weatherError => {
        if (mountedRef.current && requestSeqRef.current === requestSeq) {
          setError(
            weatherError instanceof Error
              ? weatherError.message
              : 'Weather request failed',
          );
        }
      })
      .finally(() => {
        if (mountedRef.current && requestSeqRef.current === requestSeq) {
          setLoading(false);
        }
      });
  }, [locale]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const hourly = useMemo(
    () => (weather ? upcomingHourly(weather.hourly) : []),
    [weather],
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <DetailHeader
        title={locale === 'zh' ? '海淀天气' : 'Haidian Weather'}
        onBack={navigation.goBack}
        rightLabel={locale === 'zh' ? '刷新' : 'Refresh'}
        onRight={refresh}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        {loading && !weather ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.loadingText}>
              {locale === 'zh' ? '正在更新天气' : 'Updating weather'}
            </Text>
          </View>
        ) : null}

        {error && !weather ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>
              {locale === 'zh' ? '天气暂不可用' : 'Weather unavailable'}
            </Text>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable style={styles.retryButton} onPress={refresh}>
              <Text style={styles.retryText}>
                {locale === 'zh' ? '重试' : 'Retry'}
              </Text>
            </Pressable>
          </View>
        ) : null}

        {weather ? (
          <>
            <View style={styles.currentCard}>
              <View style={styles.currentTop}>
                <View style={styles.currentCopy}>
                  <Text style={styles.location}>{weather.location}</Text>
                  <Text style={styles.updated}>
                    {formatUpdatedAt(weather.updatedAt, locale)}
                  </Text>
                </View>
                <View style={styles.conditionPill}>
                  <Text style={styles.conditionPillText}>
                    {weather.condition}
                  </Text>
                </View>
              </View>
              <View style={styles.currentMain}>
                <Text style={styles.currentTemp}>
                  {roundValue(weather.temperature, '°')}
                </Text>
                <View style={styles.currentSide}>
                  <Text style={styles.currentRange}>
                    {roundValue(weather.temperatureMin, '°')} /{' '}
                    {roundValue(weather.temperatureMax, '°')}
                  </Text>
                  <Text style={styles.currentSummary}>
                    {rainSummary(weather, locale)}
                  </Text>
                </View>
              </View>
              <View style={styles.adviceList}>
                {weather.advice.slice(0, 2).map(item => (
                  <Text key={item} style={styles.adviceText}>
                    {item}
                  </Text>
                ))}
              </View>
            </View>

            <View style={styles.sectionBlock}>
              <Text style={styles.sectionTitle}>
                {locale === 'zh' ? '小时预报' : 'Hourly Forecast'}
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.hourlyStrip}>
                  {hourly.map((item, index) => (
                    <HourlyTile
                      key={`${item.time}-${index}`}
                      item={item}
                      index={index}
                      locale={locale}
                    />
                  ))}
                </View>
              </ScrollView>
            </View>

            <View style={styles.sectionBlock}>
              <Text style={styles.sectionTitle}>
                {locale === 'zh' ? '未来几天' : 'Next Days'}
              </Text>
              <Text style={styles.sectionHint}>
                {locale === 'zh'
                  ? '右侧为当天任一时段的最高降水概率，不代表当前或全天都下雨。'
                  : 'Right side shows the highest rain probability at any point that day, not current or all-day rain.'}
              </Text>
              <View style={styles.dailyCard}>
                {weather.daily.map((item, index) => (
                  <DailyRow
                    key={`${item.date}-${index}`}
                    item={item}
                    index={index}
                    locale={locale}
                  />
                ))}
              </View>
            </View>

            <View style={styles.sectionBlock}>
              <Text style={styles.sectionTitle}>
                {locale === 'zh' ? '出行指标' : 'Campus Metrics'}
              </Text>
              <View style={styles.metricGrid}>
                <WeatherMetric
                  label={locale === 'zh' ? '紫外线' : 'UV'}
                  value={roundValue(weather.uvIndex)}
                  detail={
                    locale === 'zh'
                      ? (weather.uvIndex ?? 0) >= 6
                        ? '偏强'
                        : '适中'
                      : (weather.uvIndex ?? 0) >= 6
                      ? 'Strong'
                      : 'Moderate'
                  }
                />
                <WeatherMetric
                  label={locale === 'zh' ? '湿度' : 'Humidity'}
                  value={roundValue(weather.humidity, '%')}
                />
                <WeatherMetric
                  label={locale === 'zh' ? '体感' : 'Feels Like'}
                  value={roundValue(weather.apparentTemperature, '°')}
                />
                <WeatherMetric
                  label={locale === 'zh' ? '风速' : 'Wind'}
                  value={roundValue(weather.windSpeed)}
                  detail="km/h"
                />
              </View>
            </View>

            <Text style={styles.sourceText}>
              Open-Meteo ·{' '}
              {locale === 'zh'
                ? `今日最高降水概率 ${roundValue(
                    weather.dailyPrecipitationProbabilityMax,
                    '%',
                  )}（非当前）`
                : `Daily max rain probability ${roundValue(
                    weather.dailyPrecipitationProbabilityMax,
                    '%',
                  )} (not current)`}
            </Text>
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
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  loadingWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
    gap: spacing.sm,
  },
  loadingText: {
    ...typography.caption,
    color: colors.textMuted,
  },
  errorCard: {
    backgroundColor: colors.errorMuted,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.14)',
  },
  errorTitle: {
    ...typography.label,
    color: colors.error,
  },
  errorText: {
    ...typography.caption,
    color: colors.text,
  },
  retryButton: {
    alignSelf: 'flex-start',
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  retryText: {
    ...typography.label,
    color: colors.primary,
  },
  currentCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: spacing.lg,
    gap: spacing.md,
  },
  currentTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  currentCopy: {
    flex: 1,
    gap: 4,
  },
  location: {
    ...typography.h2,
    color: colors.text,
  },
  updated: {
    ...typography.caption,
    color: colors.textMuted,
  },
  conditionPill: {
    borderRadius: radii.pill,
    backgroundColor: colors.primaryMuted,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  conditionPillText: {
    ...typography.label,
    color: colors.primary,
  },
  currentMain: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.md,
  },
  currentTemp: {
    fontSize: 58,
    lineHeight: 62,
    fontWeight: '700',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  currentSide: {
    flex: 1,
    paddingBottom: spacing.sm,
    gap: 4,
  },
  currentRange: {
    ...typography.label,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  currentSummary: {
    ...typography.body,
    color: colors.textSecondary,
  },
  adviceList: {
    gap: spacing.xs,
    paddingTop: spacing.xs,
  },
  adviceText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  sectionBlock: {
    gap: spacing.sm,
  },
  sectionTitle: {
    ...typography.label,
    color: colors.textSecondary,
  },
  sectionHint: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: -spacing.xs,
  },
  hourlyStrip: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingRight: spacing.lg,
  },
  hourlyTile: {
    width: 82,
    minHeight: 132,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  hourlyTime: {
    ...typography.caption,
    color: colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  hourlyTemp: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '700',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  hourlyCondition: {
    ...typography.caption,
    color: colors.textSecondary,
    width: '100%',
    textAlign: 'center',
  },
  hourlyRain: {
    ...typography.micro,
    color: colors.primary,
    fontVariant: ['tabular-nums'],
  },
  dailyCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    overflow: 'hidden',
  },
  dailyRow: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  dailyDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  dailyDay: {
    ...typography.label,
    color: colors.text,
    width: 48,
  },
  dailyCondition: {
    ...typography.body,
    color: colors.textSecondary,
    flex: 1,
  },
  dailyRange: {
    ...typography.label,
    color: colors.text,
    width: 72,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  dailyRain: {
    ...typography.caption,
    color: colors.primary,
    width: 68,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  metricCard: {
    width: '48.7%',
    minHeight: 108,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: spacing.md,
    justifyContent: 'space-between',
  },
  metricLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  metricValue: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  metricDetail: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  sourceText: {
    ...typography.micro,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
