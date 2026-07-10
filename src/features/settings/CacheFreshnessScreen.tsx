import React, {useCallback, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useSelector} from 'react-redux';
import {RootStackParamList} from '../../app/navigation/types';
import {colors, radii, spacing, typography} from '../../app/theme';
import {selectCampusSchedule, selectLearning} from '../../state/selectors';
import {
  LearningScheduleCacheEntry,
  listLearningScheduleCacheEntries,
} from '../../storage/learningScheduleStorage';
import {Badge, DetailHeader} from '../common/components/Ui';

type Props = NativeStackScreenProps<RootStackParamList, 'CacheFreshness'>;

interface Metric {
  label: string;
  value: string | number;
}

function formatTime(value?: string): string {
  if (!value) {
    return '暂无';
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    return value;
  }
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hour = String(d.getHours()).padStart(2, '0');
  const minute = String(d.getMinutes()).padStart(2, '0');
  return `${month}-${day} ${hour}:${minute}`;
}

function ageLabel(value?: string): string {
  if (!value) {
    return '无记录';
  }
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) {
    return '未知';
  }
  const diff = Math.max(0, Date.now() - time);
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) {
    return '刚刚';
  }
  if (minutes < 60) {
    return `${minutes} 分钟前`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} 小时前`;
  }
  return `${Math.floor(hours / 24)} 天前`;
}

function freshnessTone(
  value?: string,
): 'default' | 'success' | 'warning' | 'error' {
  if (!value) {
    return 'default';
  }
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) {
    return 'warning';
  }
  const hours = Math.max(0, Date.now() - time) / 3600000;
  if (hours <= 6) {
    return 'success';
  }
  if (hours <= 48) {
    return 'warning';
  }
  return 'error';
}

function Section({
  title,
  subtitle,
  children,
  right,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleBlock}>
          <Text style={styles.sectionTitle}>{title}</Text>
          {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
        </View>
        {right}
      </View>
      {children}
    </View>
  );
}

function MetricGrid({items}: {items: Metric[]}) {
  return (
    <View style={styles.metricGrid}>
      {items.map(item => (
        <View key={item.label} style={styles.metric}>
          <Text style={styles.metricValue}>{item.value}</Text>
          <Text style={styles.metricLabel}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}

function InfoLine({
  label,
  value,
  divider,
}: {
  label: string;
  value: string;
  divider?: boolean;
}) {
  return (
    <View style={[styles.infoLine, divider && styles.infoLineDivider]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function CacheEntryCard({entry}: {entry: LearningScheduleCacheEntry}) {
  const isCurrent = entry.key === 'current';
  const title = isCurrent
    ? '当前学期'
    : entry.semesterName || `未来学期 ${entry.semesterIndex ?? ''}`.trim();
  return (
    <View style={styles.cacheCard}>
      <View style={styles.cacheTop}>
        <View style={styles.cacheTitleBlock}>
          <Text style={styles.cacheTitle}>{title}</Text>
          <Text style={styles.cacheKey}>{entry.key}</Text>
        </View>
        <Badge label={ageLabel(entry.savedAt)} tone={freshnessTone(entry.savedAt)} />
      </View>
      <InfoLine label="保存时间" value={formatTime(entry.savedAt)} divider />
      <InfoLine
        label="学期"
        value={entry.semesterName || entry.semesterId || '未知'}
        divider
      />
      <InfoLine label="事件" value={`${entry.events.length} 条`} divider />
      <InfoLine
        label="原始课表"
        value={`${entry.pack?.schedules.length ?? 0} 条`}
      />
    </View>
  );
}

export function CacheFreshnessScreen({navigation}: Props) {
  const learning = useSelector(selectLearning);
  const campusSchedule = useSelector(selectCampusSchedule);
  const [entries, setEntries] = useState<LearningScheduleCacheEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(() => {
    let active = true;
    setLoading(true);
    listLearningScheduleCacheEntries()
      .then(list => {
        if (active) {
          setEntries(list);
        }
      })
      .catch(() => {
        if (active) {
          setEntries([]);
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  useFocusEffect(reload);

  const learningMetrics = useMemo(
    () => [
      {label: '课程', value: learning.snapshot.courses.length},
      {label: '课表', value: learning.snapshot.schedule.length},
      {label: '作业', value: learning.snapshot.homework.length},
      {label: '通知', value: learning.snapshot.notifications.length},
      {label: '文件', value: learning.snapshot.files.length},
    ],
    [learning.snapshot],
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <DetailHeader
        title="数据新鲜度"
        onBack={navigation.goBack}
        rightLabel={loading ? '' : '刷新'}
        onRight={reload}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <Text style={styles.summary}>
          这里显示本机学习数据、课表缓存与 AI 可读取数据的大致更新时间；它不会主动同步，只用于判断当前页面和 AI
          看到的数据是否新鲜。
        </Text>

        <Section
          title="学习快照"
          subtitle={`来源：${learning.dataSource}`}
          right={
            <Badge
              label={ageLabel(learning.lastSyncedAt)}
              tone={freshnessTone(learning.lastSyncedAt)}
            />
          }>
          <InfoLine
            label="最近同步"
            value={formatTime(learning.lastSyncedAt)}
            divider
          />
          <InfoLine
            label="快照时间"
            value={formatTime(learning.snapshot.fetchedAt)}
            divider
          />
          <InfoLine
            label="同步状态"
            value={learning.loading ? '同步中' : learning.error || '正常'}
            divider
          />
          <MetricGrid items={learningMetrics} />
        </Section>

        <Section
          title="课表状态"
          subtitle={campusSchedule.calendar?.semesterName || '暂无学期信息'}
          right={
            <Badge
              label={ageLabel(campusSchedule.scheduleSyncedAt)}
              tone={freshnessTone(campusSchedule.scheduleSyncedAt)}
            />
          }>
          <InfoLine
            label="最近同步"
            value={formatTime(campusSchedule.scheduleSyncedAt)}
            divider
          />
          <InfoLine
            label="学期 ID"
            value={campusSchedule.calendar?.semesterId || '暂无'}
            divider
          />
          <InfoLine
            label="教务课表"
            value={`${campusSchedule.baseSchedule.length} 条`}
            divider
          />
          <InfoLine
            label="同步状态"
            value={campusSchedule.scheduleError || '正常'}
          />
        </Section>

        <Section
          title="学期课表缓存"
          subtitle="当前学期与未来学期分别缓存，切换学期失败时可回退">
          {loading ? (
            <View style={styles.loading}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : entries.length === 0 ? (
            <Text style={styles.empty}>暂无课表缓存</Text>
          ) : (
            <View style={styles.cacheList}>
              {entries.map(entry => (
                <CacheEntryCard key={entry.key} entry={entry} />
              ))}
            </View>
          )}
        </Section>

        <Section title="实时数据策略" subtitle="当前未持久化缓存的校园能力">
          <InfoLine label="新闻动态" value="实时读取，AI 可按需拉取详情摘要" divider />
          <InfoLine label="天气" value="AI 工具实时刷新，首页使用进入时快照" divider />
          <InfoLine label="图书馆/邮箱/余额" value="按需实时查询，不落本地缓存" />
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background},
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  summary: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  section: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  sectionTitleBlock: {flex: 1, gap: 2},
  sectionTitle: {...typography.body, color: colors.text, fontWeight: '700'},
  sectionSubtitle: {...typography.caption, color: colors.textMuted},
  infoLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  infoLineDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  infoLabel: {...typography.caption, color: colors.textMuted, width: 82},
  infoValue: {...typography.body, color: colors.text, flex: 1, textAlign: 'right'},
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  metric: {
    minWidth: '30%',
    flexGrow: 1,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    gap: 2,
  },
  metricValue: {fontSize: 20, lineHeight: 24, fontWeight: '700', color: colors.primary},
  metricLabel: {...typography.micro, color: colors.textMuted},
  loading: {
    minHeight: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
  cacheList: {gap: spacing.sm},
  cacheCard: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  cacheTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingBottom: spacing.xs,
  },
  cacheTitleBlock: {flex: 1},
  cacheTitle: {...typography.body, color: colors.text, fontWeight: '700'},
  cacheKey: {...typography.micro, color: colors.textMuted, marginTop: 2},
});
