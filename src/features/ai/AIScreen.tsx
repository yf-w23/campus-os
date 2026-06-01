import React, {useEffect, useRef, useState} from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useDispatch, useSelector} from 'react-redux';
import LinearGradient from 'react-native-linear-gradient';
import {BottomTabScreenProps} from '@react-navigation/bottom-tabs';
import {CompositeScreenProps} from '@react-navigation/native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useTranslation} from '../../app/i18n';
import {colors, radii, spacing, typography} from '../../app/theme';
import {RootStackParamList, RootTabParamList} from '../../app/navigation/types';
import {ChatMessage, Conversation, ToolTrace} from '../../domain/agent';
import {
  clearActiveConversation,
  deleteConversation,
  setActiveConversation,
} from '../../state/slices/aiSlice';
import {
  selectAI,
  selectActiveConversationId,
  selectConversations,
  selectLearning,
} from '../../state/selectors';
import {AppDispatch} from '../../state/store';
import {Chip} from '../common/components/Chip';
import {MarkdownText} from '../common/components/MarkdownText';
import {StaggerItem} from '../common/components/Animated';
import {ActionConfirmationModal} from './ActionConfirmationModal';
import {useAIChat} from './useAIChat';

type AIScreenProps = CompositeScreenProps<
  BottomTabScreenProps<RootTabParamList, 'AI'>,
  NativeStackScreenProps<RootStackParamList>
>;

function relativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) {
    return '';
  }
  const diff = Date.now() - t;
  const min = Math.floor(diff / 60000);
  if (min < 1) {
    return '刚刚';
  }
  if (min < 60) {
    return `${min} 分钟前`;
  }
  const h = Math.floor(min / 60);
  if (h < 24) {
    return `${h} 小时前`;
  }
  const day = Math.floor(h / 24);
  if (day < 7) {
    return `${day} 天前`;
  }
  return iso.slice(0, 10);
}

function previewOf(conv: Conversation): string {
  const last = conv.messages[conv.messages.length - 1];
  if (!last) {
    return '';
  }
  const text = last.content.replace(/\s+/g, ' ').trim();
  return text.length > 40 ? `${text.slice(0, 40)}…` : text;
}

const traceIcon: Record<ToolTrace['status'], string> = {
  running: '⏳',
  success: '✓',
  error: '✕',
  cancelled: '⊘',
};

function ToolTraceList({traces}: {traces: ToolTrace[]}) {
  return (
    <View style={styles.traceWrap}>
      {traces.map((tr, i) => (
        <View key={`trace-${i}`} style={styles.traceRow}>
          <Text
            style={[
              styles.traceIcon,
              tr.status === 'success' && {color: colors.success},
              tr.status === 'error' && {color: colors.error},
              tr.status === 'cancelled' && {color: colors.textMuted},
            ]}>
            {traceIcon[tr.status]}
          </Text>
          <Text style={styles.traceLabel} numberOfLines={2}>
            {tr.label}
            {tr.detail ? <Text style={styles.traceDetail}> · {tr.detail}</Text> : null}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** 根据真实校园数据生成主动建议（AI-native：从"你问我答"到"我替你想到"）*/
function buildSuggestions(
  snapshot: ReturnType<typeof selectLearning>['snapshot'],
  fallback: string[],
): string[] {
  if (!snapshot) {
    return fallback;
  }
  const out: string[] = [];
  const pending = snapshot.homework.filter(h => !h.submitted);
  if (pending[0]) {
    out.push(`「${pending[0].title}」这个作业有什么要求？`);
  }
  if (pending.length > 0) {
    out.push('我还有哪些作业没交？按截止时间排一下');
  }
  out.push('余额、电费、校园网有没有异常？');
  out.push('李文正馆现在还有空位吗？有的话先给我一份确认单');
  return out.slice(0, 4);
}

function ChatBubble({message, index}: {message: ChatMessage; index: number}) {
  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <StaggerItem index={index % 6}>
        <View style={styles.userRow}>
          <LinearGradient
            colors={[colors.primary, colors.primaryDark]}
            start={{x: 0, y: 0}}
            end={{x: 1, y: 1}}
            style={styles.userBubble}>
            <Text style={styles.userText}>{message.content}</Text>
          </LinearGradient>
        </View>
      </StaggerItem>
    );
  }

  return (
    <StaggerItem index={index % 6}>
      <View style={styles.aiRow}>
        <LinearGradient
          colors={[colors.primaryMuted, colors.surfaceAlt]}
          style={styles.aiAvatar}>
          <Text style={styles.aiAvatarText}>✦</Text>
        </LinearGradient>
        <View style={styles.aiBody}>
          {message.toolTraces && message.toolTraces.length > 0 ? (
            <ToolTraceList traces={message.toolTraces} />
          ) : null}
          {message.content ? (
            <MarkdownText content={message.content} streaming={message.streaming} />
          ) : null}
        </View>
      </View>
    </StaggerItem>
  );
}

export function AIScreen({route, navigation}: AIScreenProps) {
  const t = useTranslation();
  const dispatch = useDispatch<AppDispatch>();
  const {
    messages,
    streaming,
    provider,
    aiApiKeyConfigured,
    sendQuestion,
    pendingConfirmation,
    approvePendingConfirmation,
    cancelPendingConfirmation,
  } = useAIChat();
  const conversations = useSelector(selectConversations);
  const activeConversationId = useSelector(selectActiveConversationId);
  const {agentStatus} = useSelector(selectAI);
  const {snapshot} = useSelector(selectLearning);
  const activeConversation =
    conversations.find(c => c.id === activeConversationId) ?? null;
  const suggestions = buildSuggestions(snapshot, t.ai.suggestions);

  const [input, setInput] = useState('');
  const [view, setView] = useState<'list' | 'chat'>(
    activeConversationId ? 'chat' : 'list',
  );
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const pendingQuestion = route.params?.initialQuestion;

  const canSend = !!input.trim() && !streaming;
  const showEmpty = messages.length === 0;

  // 首页「问问 AI」带问题进来 → 开新对话并直接发送
  useEffect(() => {
    if (!pendingQuestion || streaming) {
      return;
    }
    navigation.setParams({initialQuestion: undefined});
    dispatch(clearActiveConversation());
    setView('chat');
    setInput('');
    sendQuestion(pendingQuestion).catch(() => undefined);
  }, [dispatch, navigation, pendingQuestion, sendQuestion, streaming]);

  const handleSend = () => {
    const question = input.trim();
    if (!question) {
      return;
    }
    setInput('');
    sendQuestion(question).catch(() => undefined);
    listRef.current?.scrollToEnd({animated: true});
  };

  const startNewChat = () => {
    // 延迟创建：先清空选择，发出第一条消息时才落库，避免残留空「新对话」
    dispatch(clearActiveConversation());
    setInput('');
    setView('chat');
  };

  const openConversation = (id: string) => {
    dispatch(setActiveConversation(id));
    setInput('');
    setView('chat');
  };

  const confirmDelete = (conv: Conversation) => {
    Alert.alert(t.ai.deleteConfirmTitle, t.ai.deleteConfirmBody, [
      {text: t.ai.cancel, style: 'cancel'},
      {
        text: t.ai.confirmDelete,
        style: 'destructive',
        onPress: () => dispatch(deleteConversation(conv.id)),
      },
    ]);
  };

  // ===================== 会话列表视图 =====================
  if (view === 'list') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.listHeader}>
          <Text style={styles.listTitle}>{t.ai.conversations}</Text>
          <Pressable
            onPress={startNewChat}
            hitSlop={8}
            style={({pressed}) => [styles.newIconBtn, pressed && styles.pressed]}>
            <Text style={styles.newIconText}>✎</Text>
          </Pressable>
        </View>

        <Pressable
          onPress={startNewChat}
          style={({pressed}) => [styles.newChatCta, pressed && styles.pressed]}>
          <LinearGradient
            colors={[colors.primary, colors.primaryDark]}
            start={{x: 0, y: 0}}
            end={{x: 1, y: 0}}
            style={styles.newChatInner}>
            <Text style={styles.newChatPlus}>＋</Text>
            <Text style={styles.newChatLabel}>{t.ai.startNewChat}</Text>
          </LinearGradient>
        </Pressable>

        {conversations.length === 0 ? (
          <View style={styles.emptyConv}>
            <Text style={styles.emptyConvTitle}>
              {t.ai.emptyConversationsTitle}
            </Text>
            <Text style={styles.emptyConvDesc}>
              {t.ai.emptyConversationsDesc}
            </Text>
          </View>
        ) : (
          <FlatList
            data={conversations}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.convListContent}
            ListHeaderComponent={
              <Text style={styles.sectionLabel}>{t.ai.history}</Text>
            }
            showsVerticalScrollIndicator={false}
            renderItem={({item}) => (
              <Pressable
                onPress={() => openConversation(item.id)}
                onLongPress={() => confirmDelete(item)}
                style={({pressed}) => [
                  styles.convRow,
                  pressed && styles.convRowPressed,
                ]}>
                <View style={styles.convIcon}>
                  <Text style={styles.convIconText}>✦</Text>
                </View>
                <View style={styles.convBody}>
                  <Text style={styles.convTitle} numberOfLines={1}>
                    {item.title || t.ai.untitled}
                  </Text>
                  <Text style={styles.convPreview} numberOfLines={1}>
                    {previewOf(item) || t.ai.emptyConversationsDesc}
                  </Text>
                </View>
                <View style={styles.convMeta}>
                  <Text style={styles.convTime}>
                    {relativeTime(item.updatedAt)}
                  </Text>
                  <Pressable
                    onPress={() => confirmDelete(item)}
                    hitSlop={8}
                    style={styles.convDeleteBtn}>
                    <Text style={styles.convDeleteText}>{t.ai.deleteChat}</Text>
                  </Pressable>
                </View>
              </Pressable>
            )}
          />
        )}
      </SafeAreaView>
    );
  }

  // ===================== 聊天视图 =====================
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.chatHeader}>
        <Pressable
          onPress={() => setView('list')}
          hitSlop={10}
          style={({pressed}) => [styles.headerIconBtn, pressed && styles.pressed]}>
          <Text style={styles.headerIcon}>☰</Text>
        </Pressable>
        <View style={styles.chatHeaderCenter}>
          <Text style={styles.chatHeaderTitle} numberOfLines={1}>
            {activeConversation?.title || t.ai.title}
          </Text>
          <View style={styles.statusRow}>
            <Text style={styles.providerMini}>{provider.label}</Text>
            <View style={styles.dot} />
            <Text
              style={[
                styles.statusMini,
                aiApiKeyConfigured ? styles.statusTextLive : styles.statusTextDemo,
              ]}>
              {aiApiKeyConfigured ? t.ai.liveBadge : t.ai.demoBadge}
            </Text>
          </View>
        </View>
        <Pressable
          onPress={startNewChat}
          hitSlop={10}
          style={({pressed}) => [styles.headerIconBtn, pressed && styles.pressed]}>
          <Text style={styles.headerIcon}>✎</Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={88}>
        {showEmpty ? (
          <ScrollView
            contentContainerStyle={styles.emptyScroll}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled">
            <LinearGradient
              colors={[colors.gradientStart, colors.gradientEnd]}
              start={{x: 0, y: 0}}
              end={{x: 1, y: 1}}
              style={styles.emptyHero}>
              <Text style={styles.emptyMarkText}>✦</Text>
            </LinearGradient>
            <Text style={styles.emptyTitle}>{t.ai.emptyTitle}</Text>
            <Text style={styles.emptyDesc}>{t.ai.emptyDesc}</Text>
            <View style={styles.suggestionWrap}>
              {suggestions.map((label, index) => (
                <Chip
                  key={label}
                  label={label}
                  variant={index === 0 ? 'accent' : 'default'}
                  onPress={() => {
                    sendQuestion(label).catch(() => undefined);
                  }}
                />
              ))}
            </View>
          </ScrollView>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.list}
            renderItem={({item, index}) => (
              <ChatBubble message={item} index={index} />
            )}
            onContentSizeChange={() =>
              listRef.current?.scrollToEnd({animated: true})
            }
            showsVerticalScrollIndicator={false}
          />
        )}

        <View style={styles.composerWrap}>
          <LinearGradient
            colors={['transparent', colors.background]}
            style={styles.composerFade}
            pointerEvents="none"
          />
          {agentStatus ? (
            <View style={styles.agentStatusRow}>
              <Text style={styles.agentStatusDot}>✦</Text>
              <Text style={styles.agentStatusText} numberOfLines={1}>
                {agentStatus}…
              </Text>
            </View>
          ) : null}
          <View style={styles.composer}>
            <TextInput
              style={styles.input}
              placeholder={t.ai.placeholder}
              placeholderTextColor={colors.textMuted}
              value={input}
              onChangeText={setInput}
              multiline
            />
            <Pressable
              onPress={handleSend}
              disabled={!canSend}
              style={({pressed}) => [
                styles.sendBtn,
                !canSend && styles.sendBtnDisabled,
                pressed && canSend && styles.sendBtnPressed,
              ]}
              hitSlop={6}>
              <Text style={[styles.sendArrow, !canSend && styles.sendArrowDisabled]}>
                ↑
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
      <ActionConfirmationModal
        visible={Boolean(pendingConfirmation)}
        tool={pendingConfirmation?.tool}
        spec={pendingConfirmation?.spec}
        preview={pendingConfirmation?.preview}
        onConfirm={approvePendingConfirmation}
        onCancel={cancelPendingConfirmation}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {flex: 1},
  pressed: {opacity: 0.7},

  // ---- 会话列表 ----
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  listTitle: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.3,
    color: colors.text,
  },
  newIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  newIconText: {
    fontSize: 18,
    color: colors.primary,
  },
  newChatCta: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
    borderRadius: radii.lg,
    overflow: 'hidden',
  },
  newChatInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  newChatPlus: {
    color: colors.textInvert,
    fontSize: 18,
    fontWeight: '700',
  },
  newChatLabel: {
    ...typography.label,
    color: colors.textInvert,
    fontWeight: '700',
  },
  sectionLabel: {
    ...typography.micro,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  convListContent: {
    paddingBottom: spacing.xxl + spacing.xl,
  },
  convRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  convRowPressed: {
    backgroundColor: colors.surfaceAlt,
  },
  convIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryMuted,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  convIconText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '700',
  },
  convBody: {flex: 1, gap: 3},
  convTitle: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
  },
  convPreview: {
    ...typography.caption,
    color: colors.textMuted,
  },
  convMeta: {
    alignItems: 'flex-end',
    gap: 6,
  },
  convTime: {
    ...typography.micro,
    color: colors.textMuted,
  },
  convDeleteBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.pill,
  },
  convDeleteText: {
    ...typography.micro,
    color: colors.error,
    fontWeight: '600',
  },
  emptyConv: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  emptyConvTitle: {
    ...typography.h3,
    color: colors.textSecondary,
  },
  emptyConvDesc: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
  },

  // ---- 聊天头部 ----
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSubtle,
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIcon: {
    fontSize: 20,
    color: colors.text,
  },
  chatHeaderCenter: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  chatHeaderTitle: {
    ...typography.label,
    color: colors.text,
    fontWeight: '700',
    maxWidth: '90%',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  providerMini: {
    ...typography.micro,
    color: colors.textMuted,
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.textMuted,
  },
  statusMini: {
    ...typography.micro,
    fontWeight: '600',
  },
  statusTextDemo: {
    color: colors.warning,
  },
  statusTextLive: {
    color: colors.success,
  },

  // ---- 消息列表 ----
  list: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
  userRow: {
    alignItems: 'flex-end',
  },
  userBubble: {
    maxWidth: '86%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: radii.xl,
    borderBottomRightRadius: 8,
  },
  userText: {
    ...typography.body,
    color: colors.textInvert,
  },
  aiRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm + 2,
    paddingRight: spacing.md,
  },
  aiAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  aiAvatarText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '700',
  },
  aiBody: {
    flex: 1,
    paddingTop: 2,
    gap: 6,
  },
  traceWrap: {
    gap: 4,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle,
  },
  traceRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  traceIcon: {
    ...typography.micro,
    color: colors.primary,
    width: 14,
    textAlign: 'center',
  },
  traceLabel: {
    ...typography.micro,
    color: colors.textSecondary,
    flex: 1,
  },
  traceDetail: {
    color: colors.textMuted,
  },
  agentStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.xs,
  },
  agentStatusDot: {
    ...typography.micro,
    color: colors.primary,
  },
  agentStatusText: {
    ...typography.caption,
    color: colors.textSecondary,
    flex: 1,
  },
  emptyScroll: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  emptyHero: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  emptyMarkText: {
    fontSize: 30,
    color: colors.primary,
  },
  emptyTitle: {
    ...typography.h2,
    color: colors.text,
    textAlign: 'center',
  },
  emptyDesc: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.md,
  },
  suggestionWrap: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  composerWrap: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    backgroundColor: colors.background,
  },
  composerFade: {
    position: 'absolute',
    top: -24,
    left: 0,
    right: 0,
    height: 24,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    paddingLeft: spacing.md,
    paddingRight: 6,
    paddingVertical: 6,
    minHeight: 52,
  },
  input: {
    flex: 1,
    color: colors.text,
    ...typography.body,
    paddingVertical: spacing.sm,
    paddingRight: spacing.sm,
    maxHeight: 140,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: colors.surfaceAlt,
  },
  sendBtnPressed: {
    opacity: 0.85,
    transform: [{scale: 0.96}],
  },
  sendArrow: {
    color: colors.textInvert,
    fontSize: 20,
    fontWeight: '700',
    marginTop: -2,
  },
  sendArrowDisabled: {
    color: colors.textMuted,
  },
});
