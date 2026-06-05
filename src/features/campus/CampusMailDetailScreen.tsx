import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {WebView, WebViewMessageEvent} from 'react-native-webview';
import {colors, radii, spacing, typography} from '../../app/theme';
import {DetailHeader} from '../common/components/Ui';
import {PrimaryButton} from '../common/components/Buttons';
import {RootStackParamList} from '../../app/navigation/types';
import {MAIL_PORTAL_URL} from '../../services/campus/campusEndpoints';
import {
  MAIL_FOLDERS,
  MailContact,
  MailMessageDetail,
  deleteMailMessages,
  markMailRead,
  moveMailMessages,
  readMailMessage,
} from '../../services/campus/mail';

type Props = NativeStackScreenProps<RootStackParamList, 'CampusMailDetail'>;

function contactsText(list: MailContact[]): string {
  if (list.length === 0) {
    return '—';
  }
  return list.map(item => item.name || item.address).join('、');
}

function quoteText(message: MailMessageDetail): string {
  return `\n\n---- 原始邮件 ----\n发件人：${contactsText(message.from)}\n主题：${message.subject}\n\n${message.contentText}`;
}

export function CampusMailDetailScreen({route, navigation}: Props) {
  const {id, title, fid = 1} = route.params;
  const webRef = useRef<WebView>(null);
  const [message, setMessage] = useState<MailMessageDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    webRef.current?.injectJavaScript(mailDetailBridgeScript(id, fid, title || ''));
  }, [fid, id, title]);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  const handleBridgeMessage = useCallback(
    (event: WebViewMessageEvent) => {
      try {
        const payload = JSON.parse(event.nativeEvent.data);
        if (payload.type === 'mailDetail') {
          setMessage(payload.message);
          setError(null);
          setLoading(false);
          markMailRead([id], true).catch(() => undefined);
        } else if (payload.type === 'mailError') {
          setError(payload.message || '邮件详情加载失败');
          setLoading(false);
        }
      } catch {
        // Ignore non-bridge messages.
      }
    },
    [id],
  );

  const confirmDelete = () => {
    Alert.alert('删除邮件', '确认删除这封邮件？', [
      {text: '取消', style: 'cancel'},
      {
        text: '删除',
        style: 'destructive',
        onPress: () => {
          deleteMailMessages([id])
            .then(() => navigation.goBack())
            .catch(e => Alert.alert('删除失败', e instanceof Error ? e.message : '删除失败'));
        },
      },
    ]);
  };

  const move = () => {
    const buttons = MAIL_FOLDERS.map(folder => ({
      text: folder.name,
      onPress: () => {
        moveMailMessages([id], folder.id)
          .then(() => navigation.goBack())
          .catch(e => Alert.alert('移动失败', e instanceof Error ? e.message : '移动失败'));
      },
    }));
    Alert.alert('移动邮件', '选择目标文件夹', [
      ...buttons,
      {text: '取消', style: 'cancel'},
    ]);
  };

  const reply = () => {
    if (!message) {
      return;
    }
    navigation.navigate('CampusMailCompose', {
      mode: 'reply',
      to: message.from.map(item => item.address).join(', '),
      subject: message.subject.startsWith('Re:') ? message.subject : `Re: ${message.subject}`,
      content: quoteText(message),
    });
  };

  const forward = () => {
    if (!message) {
      return;
    }
    navigation.navigate('CampusMailCompose', {
      mode: 'forward',
      subject: message.subject.startsWith('Fwd:') ? message.subject : `Fwd: ${message.subject}`,
      content: quoteText(message),
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <WebView
        ref={webRef}
        source={{uri: MAIL_PORTAL_URL}}
        pointerEvents="none"
        containerStyle={styles.bridgeWebViewContainer}
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
        title={title || '邮件详情'}
        onBack={() => navigation.goBack()}
        rightLabel="刷新"
        onRight={load}
      />
      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.loadingText}>加载邮件…</Text>
        </View>
      ) : error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorTitle}>邮件详情加载失败</Text>
          <Text style={styles.errorText}>{error}</Text>
          <PrimaryButton label="重试" onPress={load} variant="ghost" />
          <PrimaryButton
            label="打开官方邮箱页"
            onPress={() =>
              navigation.navigate('CampusMailViewer', {view: 'inbox', title: '官方邮箱'})
            }
            variant="ghost"
          />
        </View>
      ) : message ? (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.subject}>{message.subject}</Text>
          <View style={styles.metaCard}>
            <MetaRow label="发件人" value={contactsText(message.from)} />
            <MetaRow label="收件人" value={contactsText(message.to)} />
            {message.cc.length ? <MetaRow label="抄送" value={contactsText(message.cc)} /> : null}
            <MetaRow label="时间" value={message.date || '—'} />
          </View>

          <View style={styles.actionRow}>
            <Pressable style={styles.actionButton} onPress={reply}>
              <Text style={styles.actionText}>回复</Text>
            </Pressable>
            <Pressable style={styles.actionButton} onPress={forward}>
              <Text style={styles.actionText}>转发</Text>
            </Pressable>
            <Pressable
              style={styles.actionButton}
              onPress={() => markMailRead([id], false).catch(() => undefined)}>
              <Text style={styles.actionText}>标未读</Text>
            </Pressable>
            <Pressable style={styles.actionButton} onPress={move}>
              <Text style={styles.actionText}>移动</Text>
            </Pressable>
            <Pressable style={[styles.actionButton, styles.deleteButton]} onPress={confirmDelete}>
              <Text style={[styles.actionText, styles.deleteText]}>删除</Text>
            </Pressable>
          </View>

          {message.attachments.length ? (
            <View style={styles.attachCard}>
              <Text style={styles.sectionTitle}>附件</Text>
              {message.attachments.map((item, index) => (
                <Pressable
                  key={`${item.name}-${index}`}
                  style={styles.attachRow}
                  onPress={() => {
                    if (item.downloadUrl) {
                      Linking.openURL(item.downloadUrl).catch(() => undefined);
                    } else {
                      Alert.alert('附件下载', '这个附件需要在官方邮箱页中下载。');
                    }
                  }}>
                  <Text style={styles.attachName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.attachAction}>查看</Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          <View style={styles.bodyCard}>
            <Text style={styles.bodyText}>{message.contentText || '（无正文）'}</Text>
          </View>
        </ScrollView>
      ) : null}
    </SafeAreaView>
  );
}

function mailDetailBridgeScript(id: string, fid: number, fallbackTitle: string): string {
  return `
    (function () {
      var targetMid = ${JSON.stringify(id)};
      var targetFid = ${JSON.stringify(fid)};
      function post(data) {
        window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(data));
      }
      function normalize(text) {
        return String(text || '').replace(/\\s+/g, ' ').trim();
      }
      function stripHtml(html) {
        var div = document.createElement('div');
        div.innerHTML = String(html || '');
        return normalize(div.innerText || div.textContent || '');
      }
      function contacts(value) {
        var list = Array.isArray(value) ? value : value ? [value] : [];
        return list.map(function (item) {
          if (typeof item === 'string') {
            var match = item.match(/(.*)<(.+?)>/);
            return {name: normalize(match ? match[1].replace(/["']/g, '') : ''), address: normalize(match ? match[2] : item)};
          }
          item = item || {};
          return {name: normalize(item.name || item.personal || item.trueName || ''), address: normalize(item.email || item.address || item.addr || '')};
        }).filter(function (item) { return item.name || item.address; });
      }
      function sid() {
        var match = location.href.match(/[?&]sid=([^&#]+)/);
        return match ? decodeURIComponent(match[1]) : '';
      }
      function xhrForm(func, body, callback) {
        var xhr = new XMLHttpRequest();
        xhr.open('POST', location.origin + '/coremail/s?sid=' + encodeURIComponent(sid()) + '&func=' + encodeURIComponent(func));
        xhr.withCredentials = true;
        xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded; charset=UTF-8');
        xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
        xhr.onreadystatechange = function () {
          if (xhr.readyState === 4) {
            if (xhr.status >= 200 && xhr.status < 300) {
              callback(null, xhr.responseText || '');
            } else {
              callback(new Error('HTTP ' + xhr.status));
            }
          }
        };
        xhr.onerror = function () { callback(new Error('网络请求失败')); };
        xhr.send(Object.keys(body).map(function (key) {
          return encodeURIComponent(key) + '=' + encodeURIComponent(body[key]);
        }).join('&'));
      }
      function payloadOf(parsed) {
        return parsed && (parsed.var || parsed.object || parsed.data || parsed);
      }
      function buildMessage(parsed) {
        var payload = payloadOf(parsed) || {};
        var mail = payload.mail || payload.message || payload;
        var info = payload.mailInfo || payload.info || {};
        var html = mail.content || mail.html || mail.text || '';
        return {
          id: targetMid,
          fid: targetFid,
          from: contacts(mail.from || info.from || mail.sender || info.sender),
          to: contacts(mail.to || info.to),
          cc: contacts(mail.cc || info.cc),
          subject: normalize(mail.subject || info.subject || ${JSON.stringify(fallbackTitle)}) || '(无主题)',
          date: normalize(mail.date || mail.sentDate || mail.receivedDate || info.date || ''),
          unread: false,
          flagged: false,
          hasAttachment: !!(mail.attachments || info.attachments),
          brief: stripHtml(html).slice(0, 160),
          contentHtml: String(html || ''),
          contentText: stripHtml(html),
          attachments: []
        };
      }
      function scrapeVisible() {
        var text = document.body ? document.body.innerText || '' : '';
        var lines = text.split(/\\n+/).map(normalize).filter(Boolean);
        var subject = lines.find(function (line) { return line && line !== '收件箱' && line !== '回复'; }) || ${JSON.stringify(fallbackTitle)};
        var fromLine = lines.find(function (line) { return /发送给/.test(line); }) || '';
        var email = (fromLine.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+/i) || [''])[0];
        var date = (text.match(/\\d{4}-\\d{2}-\\d{2}\\s+\\d{2}:\\d{2}:\\d{2}/) || [''])[0];
        return {
          id: targetMid,
          fid: targetFid,
          from: email ? [{name: email.split('@')[0], address: email}] : [],
          to: [],
          cc: [],
          subject: normalize(subject) || '(无主题)',
          date: date,
          unread: false,
          flagged: false,
          hasAttachment: false,
          brief: '',
          contentHtml: '',
          contentText: '',
          attachments: []
        };
      }
      function readRpc() {
        var body = {mid: targetMid, mboxa: ''};
        xhrForm('!readMessage', body, function (err, text) {
          if (err) {
            xhrForm('readMessage', body, finish);
          } else {
            finish(null, text);
          }
        });
      }
      function finish(err, text) {
        if (!err) {
          try {
            var parsed = JSON.parse(text);
            if (!parsed.code || !/^FA_/.test(parsed.code)) {
              post({type: 'mailDetail', message: buildMessage(parsed)});
              return;
            }
          } catch (e) {}
        }
        post({type: 'mailDetail', message: scrapeVisible()});
      }
      function openAndRead() {
        if (!/\\/coremail\\//.test(location.href)) return;
        var wanted = 'mail.read|' + encodeURIComponent(JSON.stringify({fid: targetFid, mid: targetMid, mboxa: ''}));
        if (location.hash.slice(1) !== wanted) {
          location.href = location.href.split('#')[0] + '#' + wanted;
        }
        setTimeout(readRpc, 900);
      }
      try {
        setTimeout(openAndRead, 300);
      } catch (e) {
        post({type: 'mailError', message: e && e.message ? e.message : '邮件详情加载失败'});
      }
      return true;
    })();
  `;
}

function MetaRow({label, value}: {label: string; value: string}) {
  return (
    <View style={styles.metaRow}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background},
  bridgeWebViewContainer: {
    position: 'absolute',
    flex: 0,
    top: -1200,
    left: -1200,
    width: 1,
    height: 1,
    opacity: 0,
    zIndex: -1,
    elevation: -1,
    overflow: 'hidden',
  },
  bridgeWebView: {
    flex: 0,
    width: 1,
    height: 1,
    opacity: 0,
  },
  loading: {flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm},
  loadingText: {...typography.caption, color: colors.textMuted},
  content: {padding: spacing.lg, paddingBottom: spacing.xxl},
  subject: {...typography.h2, color: colors.text, marginBottom: spacing.md},
  metaCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  metaRow: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  metaLabel: {...typography.caption, color: colors.textMuted, width: 58},
  metaValue: {...typography.caption, color: colors.text, flex: 1},
  actionRow: {flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md},
  actionButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  deleteButton: {backgroundColor: colors.errorMuted},
  actionText: {...typography.caption, color: colors.primary, fontWeight: '600'},
  deleteText: {color: colors.error},
  attachCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  sectionTitle: {...typography.label, color: colors.textSecondary},
  attachRow: {flexDirection: 'row', alignItems: 'center', gap: spacing.md},
  attachName: {...typography.caption, color: colors.text, flex: 1},
  attachAction: {...typography.caption, color: colors.primary},
  bodyCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: spacing.md,
  },
  bodyText: {...typography.body, color: colors.text, lineHeight: 24},
  errorBox: {margin: spacing.lg, padding: spacing.lg, gap: spacing.md},
  errorTitle: {...typography.h3, color: colors.error},
  errorText: {...typography.body, color: colors.error},
});
