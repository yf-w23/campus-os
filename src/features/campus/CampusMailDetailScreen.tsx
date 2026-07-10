import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
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
import {WebView} from 'react-native-webview';
import {colors, radii, spacing, typography} from '../../app/theme';
import {DetailHeader} from '../common/components/Ui';
import {InlineLoader, StateBlock} from '../common/components/Status';
import {RootStackParamList} from '../../app/navigation/types';
import {
  MAIL_FOLDERS,
  MailContact,
  MailMessageDetail,
} from '../../services/campus/mail';
import {
  deleteNativeMailMessage,
  downloadNativeMailAttachment,
  listNativeMailFolders,
  MailFolderBinding,
  markNativeMailRead,
  moveNativeMailMessage,
  readNativeMailMessage,
} from '../../services/campus/nativeMail';

type Props = NativeStackScreenProps<RootStackParamList, 'CampusMailDetail'>;

type DetailWithInline = MailMessageDetail & {
  inlineImages?: Record<string, string>;
};

function contactsText(list: MailContact[]): string {
  if (list.length === 0) {
    return '—';
  }
  return list.map(item => item.name || item.address).join('、');
}

function quoteText(message: MailMessageDetail): string {
  return `\n\n---- 原始邮件 ----\n发件人：${contactsText(
    message.from,
  )}\n主题：${message.subject}\n\n${message.contentText}`;
}

function formatSize(value?: number): string {
  const size = Number(value || 0);
  if (size <= 0) return '';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

export function CampusMailDetailScreen({route, navigation}: Props) {
  const {id, title, folderName = 'INBOX'} = route.params;
  const [message, setMessage] = useState<DetailWithInline | null>(null);
  const [folders, setFolders] = useState<MailFolderBinding[]>([]);
  const [loading, setLoading] = useState(true);
  const [htmlHeight, setHtmlHeight] = useState(260);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [detail, folderBindings] = await Promise.all([
        readNativeMailMessage(folderName, id),
        listNativeMailFolders().catch(() => []),
      ]);
      setMessage(detail);
      setFolders(folderBindings);
    } catch (e) {
      setError(e instanceof Error ? e.message : '邮件详情加载失败');
    } finally {
      setLoading(false);
    }
  }, [folderName, id]);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  const html = useMemo(
    () => (message ? htmlForMessage(message) : ''),
    [message],
  );

  const confirmDelete = () => {
    Alert.alert('删除邮件', '确认删除这封邮件？', [
      {text: '取消', style: 'cancel'},
      {
        text: '删除',
        style: 'destructive',
        onPress: () => {
          deleteNativeMailMessage(folderName, id)
            .then(() => navigation.goBack())
            .catch(e =>
              Alert.alert(
                '删除失败',
                e instanceof Error ? e.message : '删除失败',
              ),
            );
        },
      },
    ]);
  };

  const move = () => {
    const buttons = folders
      .filter(folder => folder.folderName !== folderName)
      .map(folder => ({
        text: folder.name,
        onPress: () => {
          moveNativeMailMessage(folderName, id, folder.folderName)
            .then(() => navigation.goBack())
            .catch(e =>
              Alert.alert(
                '移动失败',
                e instanceof Error ? e.message : '移动失败',
              ),
            );
        },
      }));
    Alert.alert('移动邮件', '选择目标文件夹', [
      ...buttons,
      {text: '取消', style: 'cancel'},
    ]);
  };

  const reply = () => {
    if (!message) return;
    navigation.navigate('CampusMailCompose', {
      mode: 'reply',
      to: message.from.map(item => item.address).join(', '),
      subject: message.subject.startsWith('Re:')
        ? message.subject
        : `Re: ${message.subject}`,
      content: quoteText(message),
    });
  };

  const forward = () => {
    if (!message) return;
    navigation.navigate('CampusMailCompose', {
      mode: 'forward',
      subject: message.subject.startsWith('Fwd:')
        ? message.subject
        : `Fwd: ${message.subject}`,
      content: quoteText(message),
    });
  };

  const downloadAttachment = async (partId?: string, name?: string) => {
    if (!partId) return;
    try {
      const result = await downloadNativeMailAttachment(folderName, id, partId);
      Alert.alert('附件已保存', `${name || result.name}\n${result.path}`, [
        {text: '好'},
        {
          text: '尝试打开',
          onPress: () => Linking.openURL(result.uri).catch(() => undefined),
        },
      ]);
    } catch (e) {
      Alert.alert('附件下载失败', e instanceof Error ? e.message : '下载失败');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <DetailHeader
        title={title || '邮件详情'}
        onBack={() => navigation.goBack()}
        rightLabel="刷新"
        onRight={load}
      />
      {loading ? (
        <InlineLoader label="加载邮件..." style={styles.loading} />
      ) : error ? (
        <StateBlock
          title="邮件详情加载失败"
          message={error}
          tone="error"
          actionLabel="重试"
          onAction={load}
          style={styles.statusBlock}
        />
      ) : message ? (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.subject}>{message.subject}</Text>
          <View style={styles.metaCard}>
            <MetaRow label="发件人" value={contactsText(message.from)} />
            <MetaRow label="收件人" value={contactsText(message.to)} />
            {message.cc.length ? (
              <MetaRow label="抄送" value={contactsText(message.cc)} />
            ) : null}
            <MetaRow
              label="时间"
              value={
                message.date ? new Date(message.date).toLocaleString() : '—'
              }
            />
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
              onPress={() =>
                markNativeMailRead(folderName, id, false).catch(() => undefined)
              }>
              <Text style={styles.actionText}>标未读</Text>
            </Pressable>
            <Pressable style={styles.actionButton} onPress={move}>
              <Text style={styles.actionText}>移动</Text>
            </Pressable>
            <Pressable
              style={[styles.actionButton, styles.deleteButton]}
              onPress={confirmDelete}>
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
                  onPress={() => downloadAttachment(item.id, item.name)}>
                  <View style={styles.attachTextWrap}>
                    <Text style={styles.attachName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    {item.size ? (
                      <Text style={styles.attachMeta}>
                        {formatSize(item.size)}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={styles.attachAction}>下载</Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          <View style={styles.bodyCard}>
            {message.contentHtml ? (
              <WebView
                originWhitelist={['*']}
                source={{html}}
                javaScriptEnabled
                domStorageEnabled={false}
                setSupportMultipleWindows={false}
                onMessage={event => {
                  const height = Number(event.nativeEvent.data);
                  if (Number.isFinite(height) && height > 80) {
                    setHtmlHeight(Math.min(6000, height + 24));
                  }
                }}
                onShouldStartLoadWithRequest={request => {
                  if (
                    request.navigationType === 'click' &&
                    /^https?:/i.test(request.url)
                  ) {
                    Linking.openURL(request.url).catch(() => undefined);
                    return false;
                  }
                  return true;
                }}
                style={[styles.htmlView, {height: htmlHeight}]}
              />
            ) : (
              <Text style={styles.bodyText}>
                {message.contentText || '（无正文）'}
              </Text>
            )}
          </View>
        </ScrollView>
      ) : null}
    </SafeAreaView>
  );
}

function htmlForMessage(message: DetailWithInline): string {
  let body = sanitizeMailHtml(
    message.contentHtml ||
      escapeHtml(message.contentText).replace(/\n/g, '<br>'),
  );
  for (const [cid, dataUri] of Object.entries(message.inlineImages ?? {})) {
    const escaped = cid.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    body = body.replace(new RegExp(`cid:${escaped}`, 'gi'), dataUri);
  }
  return `<!doctype html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { margin: 0; padding: 0; color: #111; font-size: 16px; line-height: 1.55; word-wrap: break-word; overflow-wrap: anywhere; }
    img { max-width: 100%; height: auto; }
    a { color: #6f55e8; }
    table { max-width: 100%; }
  </style>
</head>
<body>${body}<script>
  function sendHeight() {
    window.ReactNativeWebView && window.ReactNativeWebView.postMessage(String(document.documentElement.scrollHeight || document.body.scrollHeight || 240));
  }
  setTimeout(sendHeight, 80);
  setTimeout(sendHeight, 500);
  window.onload = sendHeight;
</script></body>
</html>`;
}

function sanitizeMailHtml(value: string): string {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/<object[\s\S]*?<\/object>/gi, '')
    .replace(/<embed[\s\S]*?>/gi, '')
    .replace(/\son\w+\s*=\s*(['"]).*?\1/gi, '')
    .replace(/\s(href|src)\s*=\s*(['"])\s*javascript:[\s\S]*?\2/gi, ' $1="#"');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
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
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  statusBlock: {margin: spacing.lg},
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
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
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
  attachTextWrap: {flex: 1},
  attachName: {...typography.caption, color: colors.text},
  attachMeta: {...typography.micro, color: colors.textMuted, marginTop: 2},
  attachAction: {...typography.caption, color: colors.primary},
  bodyCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: spacing.md,
    overflow: 'hidden',
  },
  htmlView: {backgroundColor: colors.surface},
  bodyText: {...typography.body, color: colors.text, lineHeight: 24},
});
