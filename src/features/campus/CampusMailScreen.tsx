import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {WebView, WebViewMessageEvent} from 'react-native-webview';
import {colors, radii, spacing, typography} from '../../app/theme';
import {DetailHeader} from '../common/components/Ui';
import {PrimaryButton} from '../common/components/Buttons';
import {RootStackParamList} from '../../app/navigation/types';
import {uiImages} from '../../app/assets/uiImages';
import {
  MAIL_FOLDERS,
  MailFolder,
  MailMessageSummary,
} from '../../services/campus/mail';
import {MAIL_PORTAL_URL} from '../../services/campus/campusEndpoints';

type Props = NativeStackScreenProps<RootStackParamList, 'CampusMail'>;

function contactLine(message: MailMessageSummary): string {
  const contacts = message.fid === 3 ? message.to : message.from;
  const first = contacts[0];
  return first?.name || first?.address || '未知联系人';
}

function formatMailDate(value: string): string {
  if (!value) {
    return '';
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    return value.slice(0, 16);
  }
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  if (sameDay) {
    return `${hh}:${mm}`;
  }
  return `${d.getMonth() + 1}-${String(d.getDate()).padStart(2, '0')}`;
}

export function CampusMailScreen({navigation}: Props) {
  const webRef = useRef<WebView>(null);
  const hasLoadedOnce = useRef(false);
  const [folder, setFolder] = useState<MailFolder>(MAIL_FOLDERS[0]);
  const [messages, setMessages] = useState<MailMessageSummary[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  const load = useCallback(
    async (refresh = false) => {
      if (refresh) {
        setRefreshing(true);
      } else if (!hasLoadedOnce.current) {
        setLoading(true);
      }
      setError(null);
      webRef.current?.injectJavaScript(mailListBridgeScript(folder.id, query.trim()));
    },
    [folder.id, query],
  );

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  const handleBridgeMessage = useCallback(
    (event: WebViewMessageEvent) => {
      try {
        const payload = JSON.parse(event.nativeEvent.data);
        if (payload.type === 'mailList') {
          hasLoadedOnce.current = true;
          setMessages(payload.messages ?? []);
          setTotal(Number(payload.total ?? payload.messages?.length ?? 0));
          setError(null);
          setLoading(false);
          setRefreshing(false);
        } else if (payload.type === 'mailError') {
          hasLoadedOnce.current = true;
          setError(payload.message || '邮箱加载失败');
          setLoading(false);
          setRefreshing(false);
        }
      } catch {
        // Ignore non-bridge messages.
      }
    },
    [load],
  );

  const openMessage = (item: MailMessageSummary) => {
    navigation.navigate('CampusMailDetail', {
      id: item.id,
      title: item.subject,
      fid: item.fid,
    });
  };

  const renderMessage = ({item}: {item: MailMessageSummary}) => (
    <Pressable
      style={({pressed}) => [styles.messageRow, pressed && styles.pressed]}
      onPress={() => openMessage(item)}>
      <View style={styles.messageTop}>
        <View style={styles.senderRow}>
          {item.unread ? <View style={styles.unreadDot} /> : null}
          <Text
            style={[styles.sender, item.unread && styles.unreadText]}
            numberOfLines={1}>
            {contactLine(item)}
          </Text>
        </View>
        <Text style={styles.date}>{formatMailDate(item.date)}</Text>
      </View>
      <Text
        style={[styles.subject, item.unread && styles.unreadText]}
        numberOfLines={1}>
        {item.subject}
      </Text>
      {item.brief ? (
        <Text style={styles.brief} numberOfLines={2}>
          {item.hasAttachment ? '附件 · ' : ''}
          {item.brief}
        </Text>
      ) : null}
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <WebView
        ref={webRef}
        source={{uri: MAIL_PORTAL_URL}}
        pointerEvents="none"
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        javaScriptEnabled
        domStorageEnabled
        originWhitelist={['*']}
        onLoadEnd={() => load().catch(() => undefined)}
        onMessage={handleBridgeMessage}
        style={styles.bridgeWebView}
      />
      <DetailHeader
        title="清华邮箱"
        onBack={() => navigation.goBack()}
        rightLabel="写信"
        onRight={() => navigation.navigate('CampusMailCompose', {})}
      />

      <View style={styles.headerCard}>
        <Image source={uiImages.campusMail} style={styles.icon} />
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>原生邮箱</Text>
          <Text style={styles.headerSub}>
            {query.trim() ? `搜索结果 · ${messages.length}` : `${folder.name} · ${total || messages.length}`}
          </Text>
        </View>
      </View>

      <View style={styles.searchRow}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="搜索邮件全文"
          placeholderTextColor={colors.textMuted}
          returnKeyType="search"
          onSubmitEditing={() => load().catch(() => undefined)}
          style={styles.searchInput}
        />
        <Pressable style={styles.searchButton} onPress={() => load().catch(() => undefined)}>
          <Text style={styles.searchButtonText}>搜索</Text>
        </Pressable>
      </View>

      <View style={styles.folderRow}>
        {MAIL_FOLDERS.map(item => (
          <Pressable
            key={item.id}
            style={[
              styles.folderChip,
              folder.id === item.id && !query.trim() && styles.folderChipActive,
            ]}
            onPress={() => {
              setQuery('');
              setFolder(item);
            }}>
            <Text
              style={[
                styles.folderText,
                folder.id === item.id && !query.trim() && styles.folderTextActive,
              ]}>
              {item.name}
            </Text>
          </Pressable>
        ))}
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <PrimaryButton label="重试" onPress={() => load().catch(() => undefined)} variant="ghost" />
        </View>
      ) : null}

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.loadingText}>加载邮件…</Text>
        </View>
      ) : (
        <FlatList
          data={messages}
          keyExtractor={item => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(true).catch(() => undefined)}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              {query.trim() ? '没有找到相关邮件' : '这个文件夹暂无邮件'}
            </Text>
          }
        />
      )}
    </SafeAreaView>
  );
}

function mailListBridgeScript(fid: number, query: string): string {
  return `
    (function () {
      var targetFid = ${JSON.stringify(fid)};
      var queryText = ${JSON.stringify(query)}.toLowerCase();
      function post(data) {
        window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(data));
      }
      function normalize(text) {
        return String(text || '').replace(/\\s+/g, ' ').trim();
      }
      function scrapeRows() {
        var rows = Array.prototype.slice.call(document.querySelectorAll('tr.j-mail[mid]'));
        var messages = rows.map(function (row) {
          var from = row.querySelector('.j-fromto');
          var subject = row.querySelector('.subject');
          var summary = row.querySelector('.summary');
          var time = row.querySelector('.time span, .time');
          var attachmentIcon = row.querySelector('.attach i:not(.f-vh)');
          return {
            id: row.getAttribute('mid') || '',
            fid: targetFid,
            from: [{name: normalize(from && from.textContent), address: (from && from.getAttribute('data-email')) || ''}],
            to: [],
            subject: normalize(subject && subject.textContent) || '(无主题)',
            date: normalize((time && (time.getAttribute('title') || time.textContent)) || ''),
            unread: !row.classList.contains('read'),
            flagged: false,
            hasAttachment: !!attachmentIcon,
            brief: normalize(summary && summary.textContent)
          };
        }).filter(function (item) {
          if (!item.id) return false;
          if (!queryText) return true;
          return (item.subject + ' ' + item.brief + ' ' + item.from.map(function (x) { return x.name + ' ' + x.address; }).join(' ')).toLowerCase().indexOf(queryText) >= 0;
        });
        var bodyText = normalize(document.body && document.body.innerText);
        var totalMatch = bodyText.match(/共\\s*(\\d+)\\s*封/) || bodyText.match(/邮件封数:\\s*(\\d+)\\s*封/);
        post({type: 'mailList', fid: targetFid, total: totalMatch ? Number(totalMatch[1]) : messages.length, messages: messages});
      }
      function ensureListPage() {
        if (!/\\/coremail\\//.test(location.href)) {
          return;
        }
        var wanted = 'mail.list|' + encodeURIComponent(JSON.stringify({fid: targetFid}));
        if (location.hash.slice(1) !== wanted) {
          location.href = location.href.split('#')[0] + '#' + wanted;
        }
        var tries = 0;
        var timer = setInterval(function () {
          tries += 1;
          if (document.querySelectorAll('tr.j-mail[mid]').length > 0 || tries > 25) {
            clearInterval(timer);
            scrapeRows();
          }
        }, 400);
      }
      try {
        setTimeout(ensureListPage, 300);
      } catch (e) {
        post({type: 'mailError', message: e && e.message ? e.message : '邮箱页面读取失败'});
      }
      return true;
    })();
  `;
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background},
  bridgeWebView: {
    position: 'absolute',
    flex: 0,
    top: -1200,
    left: -1200,
    width: 1,
    height: 1,
    opacity: 0.01,
    zIndex: -1,
    elevation: -1,
  },
  headerCard: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  icon: {width: 48, height: 48, borderRadius: 12},
  headerText: {flex: 1, gap: 3},
  headerTitle: {...typography.h3, color: colors.text},
  headerSub: {...typography.caption, color: colors.textMuted},
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    gap: spacing.sm,
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
    ...typography.body,
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
  folderRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  folderChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 7,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  folderChipActive: {backgroundColor: colors.primaryMuted, borderColor: colors.primary},
  folderText: {...typography.caption, color: colors.textSecondary},
  folderTextActive: {color: colors.primary, fontWeight: '600'},
  errorBox: {
    margin: spacing.lg,
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.errorMuted,
    gap: spacing.sm,
  },
  errorText: {...typography.caption, color: colors.error},
  loading: {flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm},
  loadingText: {...typography.caption, color: colors.textMuted},
  listContent: {padding: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xxl},
  messageRow: {
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    marginBottom: spacing.sm,
    gap: 5,
  },
  pressed: {opacity: 0.72},
  messageTop: {flexDirection: 'row', alignItems: 'center', gap: spacing.sm},
  senderRow: {flex: 1, flexDirection: 'row', alignItems: 'center', gap: 7},
  unreadDot: {width: 7, height: 7, borderRadius: 4, backgroundColor: colors.primary},
  sender: {...typography.body, color: colors.textSecondary},
  unreadText: {color: colors.text, fontWeight: '700'},
  date: {...typography.micro, color: colors.textMuted},
  subject: {...typography.body, color: colors.text, fontWeight: '500'},
  brief: {...typography.caption, color: colors.textMuted},
  emptyText: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: spacing.xxl,
  },
});
