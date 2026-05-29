import {useCallback} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import {v4 as uuidv4} from 'uuid';
import {ChatMessage} from '../../domain/agent';
import {
  buildAgentContext,
  createMockAgentReply,
  streamChatCompletion,
} from '../../services/ai/agentService';
import {loadAIApiKey} from '../../storage/secureStorage';
import {
  selectAI,
  selectActiveConversationId,
  selectActiveMessages,
  selectLearning,
  selectSettings,
} from '../../state/selectors';
import {
  addMessage,
  appendToLastAssistant,
  newConversation,
  setAIError,
  setStreaming,
} from '../../state/slices/aiSlice';
import {AppDispatch} from '../../state/store';

export function useAIChat() {
  const dispatch = useDispatch<AppDispatch>();
  const {streaming, provider} = useSelector(selectAI);
  const messages = useSelector(selectActiveMessages);
  const activeConversationId = useSelector(selectActiveConversationId);
  const {snapshot} = useSelector(selectLearning);
  const {aiApiKeyConfigured} = useSelector(selectSettings);

  const sendQuestion = useCallback(
    async (question: string) => {
      const trimmed = question.trim();
      if (!trimmed || streaming) {
        return;
      }

      // 当前没有活动会话（开启新对话后的延迟创建）→ 现在才真正建立会话
      if (!activeConversationId) {
        dispatch(newConversation());
      }
      // 无活动会话时 messages 选择器返回 []，新会话天然从空历史开始
      const history = messages;

      const userMessage: ChatMessage = {
        id: uuidv4(),
        role: 'user',
        content: trimmed,
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
      dispatch(setStreaming(true));
      dispatch(setAIError(undefined));

      const context = buildAgentContext(snapshot);

      try {
        const apiKey = aiApiKeyConfigured
          ? (await loadAIApiKey(provider.preset)) ?? ''
          : '';

        if (!apiKey) {
          const mock = createMockAgentReply(trimmed, context);
          dispatch(appendToLastAssistant(mock));
        } else {
          await streamChatCompletion(
            {...provider, apiKey},
            [...history, userMessage],
            context,
            token => dispatch(appendToLastAssistant(token)),
          );
        }
      } catch (error) {
        dispatch(
          setAIError(error instanceof Error ? error.message : 'AI 回复失败'),
        );
        dispatch(appendToLastAssistant('\n\n[错误] 请检查 API Key 与网络连接。'));
      } finally {
        dispatch(setStreaming(false));
      }
    },
    [
      activeConversationId,
      aiApiKeyConfigured,
      dispatch,
      messages,
      provider,
      snapshot,
      streaming,
    ],
  );

  return {
    messages,
    streaming,
    provider,
    aiApiKeyConfigured,
    sendQuestion,
  };
}
