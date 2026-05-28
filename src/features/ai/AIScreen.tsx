import React, {useRef, useState} from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {useDispatch, useSelector} from 'react-redux';
import {v4 as uuidv4} from 'uuid';
import {useTranslation} from '../../app/i18n';
import {colors, spacing, typography} from '../../app/theme';
import {PrimaryButton} from '../common/components/Buttons';
import {selectAI, selectLearning, selectSettings} from '../../state/selectors';
import {
  addMessage,
  appendToLastAssistant,
  setAIError,
  setStreaming,
} from '../../state/slices/aiSlice';
import {
  buildAgentContext,
  createMockAgentReply,
  streamChatCompletion,
} from '../../services/ai/agentService';
import {loadAIApiKey} from '../../storage/secureStorage';
import {AppDispatch} from '../../state/store';
import {ChatMessage} from '../../domain/agent';

function ChatBubble({message}: {message: ChatMessage}) {
  const isUser = message.role === 'user';
  return (
    <View style={[styles.bubble, isUser ? styles.userBubble : styles.aiBubble]}>
      <Text style={[styles.bubbleText, isUser && styles.userBubbleText]}>
        {message.content}
        {message.streaming ? '▍' : ''}
      </Text>
    </View>
  );
}

export function AIScreen() {
  const t = useTranslation();
  const dispatch = useDispatch<AppDispatch>();
  const {messages, streaming, provider} = useSelector(selectAI);
  const {snapshot} = useSelector(selectLearning);
  const {aiApiKeyConfigured} = useSelector(selectSettings);
  const [input, setInput] = useState('');
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const handleSend = async () => {
    const question = input.trim();
    if (!question || streaming || !snapshot) {
      return;
    }

    const userMessage: ChatMessage = {
      id: uuidv4(),
      role: 'user',
      content: question,
      createdAt: new Date().toISOString(),
    };
    const assistantMessage: ChatMessage = {
      id: uuidv4(),
      role: 'assistant',
      content: '',
      createdAt: new Date().toISOString(),
      streaming: true,
    };

    dispatch(addMessage(userMessage));
    dispatch(addMessage(assistantMessage));
    setInput('');
    dispatch(setStreaming(true));
    dispatch(setAIError(undefined));

    const context = buildAgentContext(snapshot);

    try {
      const apiKey = aiApiKeyConfigured
        ? (await loadAIApiKey(provider.preset)) ?? ''
        : '';

      if (!apiKey) {
        const mock = createMockAgentReply(question, context);
        dispatch(appendToLastAssistant(mock));
      } else {
        await streamChatCompletion(
          {...provider, apiKey},
          [...messages, userMessage],
          context,
          token => dispatch(appendToLastAssistant(token)),
        );
      }
    } catch (error) {
      dispatch(
        setAIError(error instanceof Error ? error.message : 'AI 回复失败'),
      );
      dispatch(appendToLastAssistant('\n[错误] 请检查 API Key 与网络连接。'));
    } finally {
      dispatch(setStreaming(false));
      listRef.current?.scrollToEnd({animated: true});
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={88}>
      <Text style={styles.title}>{t.ai.title}</Text>
      <Text style={styles.hint}>{t.ai.readonlyHint}</Text>
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        renderItem={({item}) => <ChatBubble message={item} />}
        onContentSizeChange={() => listRef.current?.scrollToEnd({animated: true})}
      />
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder={t.ai.placeholder}
          placeholderTextColor={colors.textMuted}
          value={input}
          onChangeText={setInput}
          multiline
        />
        <PrimaryButton
          label={t.ai.send}
          onPress={handleSend}
          disabled={streaming || !input.trim()}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
  },
  title: {
    ...typography.h1,
    color: colors.text,
  },
  hint: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  list: {
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  bubble: {
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.sm,
    maxWidth: '88%',
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: colors.primary,
  },
  aiBubble: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bubbleText: {
    ...typography.body,
    color: colors.text,
  },
  userBubbleText: {
    color: '#fff',
  },
  inputRow: {
    gap: spacing.sm,
  },
  input: {
    minHeight: 48,
    maxHeight: 120,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...typography.body,
    color: colors.text,
  },
});
