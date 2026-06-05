import React, {useCallback, useEffect, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
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
import {colors, radii, spacing, typography} from '../../app/theme';
import {DetailHeader} from '../common/components/Ui';
import {PrimaryButton} from '../common/components/Buttons';
import {RootStackParamList} from '../../app/navigation/types';
import {uiImages} from '../../app/assets/uiImages';
import {MailMessageSummary} from '../../services/campus/mail';
import {
  clearNativeMailConfig,
  getNativeMailStatus,
  listNativeMailFolders,
  listNativeMailMessages,
  MailFolderBinding,
  saveNativeMailConfig,
} from '../../services/campus/nativeMail';

type Props = NativeStackScreenProps<RootStackParamList, 'CampusMail'>;

function contactLine(message: MailMessageSummary): string {
  const contacts = message.fid === 3 ? message.to : message.from;
  const first = contacts[0];
  return first?.name || first?.address || '未知联系人';
}

function formatMailDate(value: string): string {
  const normalized = String(value || '').trim();
  if (!normalized) return '';
  const visibleMonthDay = /^(\d{1,2})-(\d{1,2})$/.exec(normalized);
  if (visibleMonthDay) {
    return `${visibleMonthDay[1].padStart(
      2,
      '0',
    )}-${visibleMonthDay[2].padStart(2, '0')}`;
  }
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) return normalized.slice(0, 16);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  if (sameDay) return `${hh}:${mm}`;
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

export function CampusMailScreen({navigation}: Props) {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [configuredUser, setConfiguredUser] = useState('');
  const [setupUser, setSetupUser] = useState('');
  const [setupPassword, setSetupPassword] = useState('');
  const [setupLoading, setSetupLoading] = useState(false);
  const [folders, setFolders] = useState<MailFolderBinding[]>([]);
  const [folder, setFolder] = useState<MailFolderBinding | null>(null);
  const [messages, setMessages] = useState<MailMessageSummary[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  const loadStatus = useCallback(async () => {
    const status = await getNativeMailStatus();
    setConfigured(status.configured);
    setConfiguredUser(status.username ?? '');
    if (status.configured) {
      const bindings = await listNativeMailFolders();
      setFolders(bindings);
      setFolder(prev => prev ?? bindings[0] ?? null);
    }
  }, []);

  useEffect(() => {
    loadStatus().catch(e => {
      setConfigured(false);
      setError(e instanceof Error ? e.message : '邮箱状态读取失败');
    });
  }, [loadStatus]);

  const load = useCallback(
    async (refresh = false) => {
      if (!folder) return;
      if (refresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const result = await listNativeMailMessages(folder, query, 60);
        setMessages(result.messages);
        setTotal(result.total);
      } catch (e) {
        setError(e instanceof Error ? e.message : '邮件加载失败');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [folder, query],
  );

  useEffect(() => {
    if (configured && folder) {
      load().catch(() => undefined);
    }
  }, [configured, folder, load]);

  const saveSetup = async () => {
    setSetupLoading(true);
    try {
      await saveNativeMailConfig({
        username: setupUser.trim(),
        password: setupPassword,
      });
      setSetupPassword('');
      await loadStatus();
    } catch (e) {
      Alert.alert('邮箱配置失败', e instanceof Error ? e.message : '配置失败');
    } finally {
      setSetupLoading(false);
    }
  };

  const resetConfig = () => {
    Alert.alert('重设邮箱', '将清除本机保存的邮箱客户端专用密码。', [
      {text: '取消', style: 'cancel'},
      {
        text: '清除',
        style: 'destructive',
        onPress: () => {
          clearNativeMailConfig()
            .then(() => {
              setConfigured(false);
              setFolders([]);
              setFolder(null);
              setMessages([]);
              setTotal(0);
            })
            .catch(() => undefined);
        },
      },
    ]);
  };

  const openMessage = (item: MailMessageSummary) => {
    if (!folder) return;
    navigation.navigate('CampusMailDetail', {
      id: item.id,
      title: item.subject,
      fid: item.fid,
      folderName: folder.folderName,
      fromName: contactLine(item),
      date: item.date,
      brief: item.brief,
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

  if (configured === null) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <DetailHeader title="清华邮箱" onBack={() => navigation.goBack()} />
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.loadingText}>检查邮箱配置…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!configured) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <DetailHeader title="清华邮箱" onBack={() => navigation.goBack()} />
        <ScrollView contentContainerStyle={styles.setupContent}>
          <View style={styles.headerCard}>
            <Image source={uiImages.campusMail} style={styles.icon} />
            <View style={styles.headerText}>
              <Text style={styles.headerTitle}>原生 IMAP 邮箱</Text>
              <Text style={styles.headerSub}>
                使用清华官方 IMAP/SMTP 协议读取邮件、HTML 正文、链接与附件。
              </Text>
            </View>
          </View>
          <View style={styles.notice}>
            <Text style={styles.noticeTitle}>需要客户端专用密码</Text>
            <Text style={styles.noticeText}>
              请在清华邮箱网页版进入 设置 → 安全设置 →
              客户端专用密码，生成后填入这里。不要填写信息门户密码。
            </Text>
          </View>
          <Field
            label="邮箱账号"
            value={setupUser}
            onChangeText={setSetupUser}
            placeholder="yourname@mails.tsinghua.edu.cn"
          />
          <Field
            label="客户端专用密码"
            value={setupPassword}
            onChangeText={setSetupPassword}
            placeholder="从 Coremail 安全设置生成"
            secureTextEntry
          />
          <PrimaryButton
            label={setupLoading ? '验证中…' : '保存并连接'}
            onPress={saveSetup}
            loading={setupLoading}
            disabled={setupLoading}
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
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
            {query.trim()
              ? `搜索结果 · ${messages.length}`
              : `${folder?.name ?? '邮箱'} · ${total || messages.length}`}
          </Text>
          {configuredUser ? (
            <Text style={styles.accountText} numberOfLines={1}>
              {configuredUser}
            </Text>
          ) : null}
        </View>
        <Pressable style={styles.resetButton} onPress={resetConfig}>
          <Text style={styles.resetText}>重设</Text>
        </Pressable>
      </View>

      <View style={styles.searchRow}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="搜索当前已加载邮件"
          placeholderTextColor={colors.textMuted}
          returnKeyType="search"
          onSubmitEditing={() => load().catch(() => undefined)}
          style={styles.searchInput}
        />
        <Pressable
          style={styles.searchButton}
          onPress={() => load().catch(() => undefined)}>
          <Text style={styles.searchButtonText}>搜索</Text>
        </Pressable>
      </View>

      <View style={styles.folderRow}>
        {folders.map(item => (
          <Pressable
            key={item.id}
            style={[
              styles.folderChip,
              folder?.id === item.id && styles.folderChipActive,
            ]}
            onPress={() => {
              setQuery('');
              setFolder(item);
            }}>
            <Text
              style={[
                styles.folderText,
                folder?.id === item.id && styles.folderTextActive,
              ]}>
              {item.name}
            </Text>
          </Pressable>
        ))}
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <PrimaryButton
            label="重试"
            onPress={() => load().catch(() => undefined)}
            variant="ghost"
          />
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

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  secureTextEntry?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        autoCapitalize="none"
        secureTextEntry={secureTextEntry}
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background},
  setupContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
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
  accountText: {...typography.micro, color: colors.textMuted},
  resetButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 7,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceAlt,
  },
  resetText: {...typography.micro, color: colors.textSecondary},
  notice: {
    marginHorizontal: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    gap: 4,
  },
  noticeTitle: {...typography.label, color: colors.text},
  noticeText: {...typography.caption, color: colors.textSecondary},
  field: {
    marginHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: 4,
  },
  label: {...typography.caption, color: colors.textMuted},
  input: {...typography.body, color: colors.text, padding: 0, minHeight: 34},
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
  folderChipActive: {
    backgroundColor: colors.primaryMuted,
    borderColor: colors.primary,
  },
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
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  loadingText: {...typography.caption, color: colors.textMuted},
  listContent: {
    padding: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },
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
  unreadDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
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
