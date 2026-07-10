import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useTranslation} from '../../app/i18n';
import {RootStackParamList} from '../../app/navigation/types';
import {colors, radii, spacing, typography} from '../../app/theme';
import {ChannelTag, NewsSlice} from '../../domain/news';
import {
  getNewsChannelLabel,
  getNewsDetail,
  getNewsList,
  searchNewsList,
} from '../../services/campus/news';
import {
  Badge,
  DetailHeader,
  ScreenHeader,
} from '../common/components/Ui';
import {EmptyHint, InlineLoader, StateBlock} from '../common/components/Status';
import {HtmlContent} from '../common/components/HtmlContent';

type ListProps = NativeStackScreenProps<RootStackParamList, 'CampusNews'>;
type DetailProps = NativeStackScreenProps<RootStackParamList, 'CampusNewsDetail'>;

const PAGE_SIZE = 24;

const CHANNEL_OPTIONS: {label: string; channel?: ChannelTag}[] = [
  {label: '全部'},
  {label: '教务', channel: 'LM_JWGG'},
  {label: '办公', channel: 'LM_BGTG'},
  {label: '重要', channel: 'LM_ZYGG'},
  {label: '学工', channel: 'LM_XSBGGG'},
  {label: '就业', channel: 'LM_BYJYXX'},
  {label: '海报', channel: 'LM_HB'},
];

function dedupeNews(prev: NewsSlice[], next: NewsSlice[]): NewsSlice[] {
  const seen = new Set(prev.map(item => item.url || item.xxid));
  return prev.concat(next.filter(item => !seen.has(item.url || item.xxid)));
}

function formatNewsDate(value: string): string {
  if (!value) {
    return '—';
  }
  return value.slice(0, 10);
}

function NewsCard({
  item,
  onPress,
}: {
  item: NewsSlice;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({pressed}) => [styles.newsCard, pressed && styles.newsCardPressed]}
      onPress={onPress}>
      <View style={styles.newsTitleRow}>
        <Text style={styles.newsTitle} numberOfLines={3}>
          {item.name.trim()}
        </Text>
        <Text style={styles.newsArrow}>›</Text>
      </View>
      <View style={styles.newsMetaRow}>
        <Badge label={getNewsChannelLabel(item.channel)} tone="default" />
        {item.topped ? <Badge label="置顶" tone="warning" /> : null}
        <Text style={styles.newsMeta} numberOfLines={1}>
          {item.source || '清华信息门户'}
        </Text>
        <Text style={styles.newsDate}>{formatNewsDate(item.date)}</Text>
      </View>
    </Pressable>
  );
}

export function CampusNewsScreen({navigation}: ListProps) {
  const t = useTranslation();
  const [items, setItems] = useState<NewsSlice[]>([]);
  const [query, setQuery] = useState('');
  const [selectedChannel, setSelectedChannel] = useState<ChannelTag | undefined>();
  const [page, setPage] = useState(1);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [reachedEnd, setReachedEnd] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeQuery = query.trim();

  const load = useCallback(
    async (reset: boolean, queryOverride?: string) => {
      if ((refreshing || loadingMore) && !reset) {
        return;
      }
      const nextPage = reset ? 1 : page + 1;
      const requestQuery = (queryOverride ?? activeQuery).trim();
      if (reset) {
        setRefreshing(true);
        setReachedEnd(false);
      } else {
        if (reachedEnd) {
          return;
        }
        setLoadingMore(true);
      }
      setError(null);
      try {
        const nextItems = requestQuery
          ? await searchNewsList(nextPage, requestQuery, selectedChannel)
          : await getNewsList(nextPage, PAGE_SIZE, selectedChannel);
        setItems(prev => (reset ? nextItems : dedupeNews(prev, nextItems)));
        setPage(nextPage);
        setReachedEnd(nextItems.length < PAGE_SIZE);
      } catch (e) {
        const message =
          e instanceof Error ? e.message : '新闻动态加载失败，请稍后重试';
        setError(message);
      } finally {
        setRefreshing(false);
        setLoadingMore(false);
      }
    },
    [
      activeQuery,
      loadingMore,
      page,
      reachedEnd,
      refreshing,
      selectedChannel,
    ],
  );

  useEffect(() => {
    load(true).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChannel]);

  const headerSubtitle = useMemo(() => {
    if (activeQuery) {
      return `搜索「${activeQuery}」 · ${items.length} 条`;
    }
    return items.length > 0
      ? `${getNewsChannelLabel(selectedChannel)} · 已加载 ${items.length} 条`
      : t.campus.news.subtitle;
  }, [activeQuery, items.length, selectedChannel, t.campus.news.subtitle]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <FlatList
        data={items}
        keyExtractor={(item, index) => item.url || item.xxid || String(index)}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={colors.primary}
            colors={[colors.primary]}
            onRefresh={() => load(true)}
          />
        }
        ListHeaderComponent={
          <View style={styles.headerArea}>
            <ScreenHeader
              eyebrow={t.tabs.campus}
              title={t.campus.news.title}
              subtitle={headerSubtitle}
            />
            <View style={styles.searchRow}>
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder={t.campus.news.searchPlaceholder}
                placeholderTextColor={colors.textMuted}
                returnKeyType="search"
                onSubmitEditing={() => load(true)}
                style={styles.searchInput}
              />
              <Pressable
                onPress={() => load(true)}
                hitSlop={8}
                style={({pressed}) => [styles.searchButton, pressed && styles.pressed]}>
                <Text style={styles.searchButtonText}>{t.campus.search}</Text>
              </Pressable>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.channelStrip}>
              {CHANNEL_OPTIONS.map(option => {
                const active = option.channel === selectedChannel;
                return (
                  <Pressable
                    key={option.label}
                    onPress={() => setSelectedChannel(option.channel)}
                    style={({pressed}) => [
                      styles.channelChip,
                      active && styles.channelChipActive,
                      pressed && styles.pressed,
                    ]}>
                    <Text
                      style={[
                        styles.channelChipText,
                        active && styles.channelChipTextActive,
                      ]}>
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            {error ? (
              <StateBlock
                title={t.campus.news.loadFailed}
                message={error}
                tone="error"
                compact
                actionLabel={t.home.retrySync}
                onAction={() => load(true)}
                style={styles.statusBlock}
              />
            ) : null}
          </View>
        }
        ListEmptyComponent={
          refreshing ? (
            <InlineLoader label={t.campus.news.loading} />
          ) : (
            <EmptyHint
              title={t.campus.news.empty}
              message={t.campus.news.emptyDesc}
              style={styles.empty}
            />
          )
        }
        renderItem={({item}) => (
          <NewsCard
            item={item}
            onPress={() => navigation.navigate('CampusNewsDetail', {news: item})}
          />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.footerLoader}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : reachedEnd && items.length > 0 ? (
            <Text style={styles.endText}>{t.campus.news.reachedEnd}</Text>
          ) : null
        }
        onEndReached={() => load(false)}
        onEndReachedThreshold={0.6}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

export function CampusNewsDetailScreen({navigation, route}: DetailProps) {
  const t = useTranslation();
  const {news} = route.params;
  const [detail, setDetail] = useState<{
    title: string;
    content: string;
    brief: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    getNewsDetail(news.url)
      .then(next => {
        if (mounted) {
          setDetail(next);
          setError(null);
        }
      })
      .catch(e => {
        if (mounted) {
          setError(e instanceof Error ? e.message : t.campus.news.detailFailed);
        }
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });
    return () => {
      mounted = false;
    };
  }, [news.url, t.campus.news.detailFailed]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <DetailHeader title={t.campus.news.title} onBack={navigation.goBack} />
      <ScrollView
        contentContainerStyle={styles.detailContent}
        showsVerticalScrollIndicator={false}>
        <Text style={styles.detailTitle}>{detail?.title || news.name}</Text>
        <View style={styles.detailMetaRow}>
          <Badge label={getNewsChannelLabel(news.channel)} />
          <Text style={styles.detailMeta} numberOfLines={1}>
            {news.source || '清华信息门户'}
          </Text>
          <Text style={styles.detailMeta}>{formatNewsDate(news.date)}</Text>
        </View>
        {loading ? (
          <InlineLoader label={t.campus.news.loadingDetail} />
        ) : error ? (
          <StateBlock
            title={t.campus.news.detailFailed}
            message={error}
            tone="error"
            actionLabel={t.home.retrySync}
            onAction={() => {
              setError(null);
              setLoading(true);
              getNewsDetail(news.url)
                .then(setDetail)
                .catch(e =>
                  setError(
                    e instanceof Error ? e.message : t.campus.news.detailFailed,
                  ),
                )
                .finally(() => setLoading(false));
            }}
          />
        ) : detail ? (
          <View style={styles.detailBody}>
            <HtmlContent
              html={detail.content}
              baseUrl="https://webvpn.tsinghua.edu.cn"
              minHeight={240}
            />
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background},
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl + spacing.xl,
  },
  headerArea: {marginBottom: spacing.md},
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  searchInput: {
    flex: 1,
    minHeight: 44,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    paddingHorizontal: spacing.md,
    color: colors.text,
  },
  searchButton: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchButtonText: {...typography.label, color: colors.textInvert},
  channelStrip: {gap: spacing.sm, paddingBottom: spacing.sm},
  channelChip: {
    minHeight: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  channelChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryMuted,
  },
  channelChipText: {...typography.caption, color: colors.textSecondary},
  channelChipTextActive: {color: colors.primary, fontWeight: '600'},
  pressed: {opacity: 0.72},
  statusBlock: {marginTop: spacing.sm},
  newsCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: spacing.md,
    gap: spacing.md,
  },
  newsCardPressed: {opacity: 0.74},
  newsTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  newsTitle: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
    lineHeight: 22,
    flex: 1,
  },
  newsArrow: {
    fontSize: 24,
    lineHeight: 24,
    color: colors.textMuted,
    fontWeight: '300',
  },
  newsMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  newsMeta: {
    ...typography.caption,
    color: colors.textMuted,
    flex: 1,
  },
  newsDate: {
    ...typography.micro,
    color: colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  separator: {height: spacing.sm},
  footerLoader: {paddingVertical: spacing.lg},
  endText: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
  empty: {minHeight: 260},
  detailContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  detailTitle: {
    ...typography.h2,
    color: colors.text,
    lineHeight: 28,
    marginBottom: spacing.sm,
  },
  detailMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  detailMeta: {
    ...typography.caption,
    color: colors.textMuted,
    flexShrink: 1,
  },
  detailBody: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    overflow: 'hidden',
  },
});
