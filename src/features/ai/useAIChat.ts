import {useCallback} from 'react';
import {Alert} from 'react-native';
import {useDispatch, useSelector} from 'react-redux';
import {v4 as uuidv4} from 'uuid';
import {ChatMessage} from '../../domain/agent';
import {
  buildAgentContext,
  createMockAgentReply,
  runAgent,
} from '../../services/ai/agentService';
import {AgentTool} from '../../services/ai/tools';
import {loadAIApiKey} from '../../storage/secureStorage';
import {loadAIMemory, summarizeMemory} from '../../storage/aiMemoryStorage';
import {
  selectAI,
  selectActiveConversationId,
  selectActiveMessages,
  selectAuth,
  selectLearning,
  selectSettings,
} from '../../state/selectors';
import {
  addMessage,
  appendToLastAssistant,
  newConversation,
  pushToolTrace,
  setAgentStatus,
  setAIError,
  setStreaming,
  updateLastToolTrace,
} from '../../state/slices/aiSlice';
import {AppDispatch} from '../../state/store';

export function useAIChat() {
  const dispatch = useDispatch<AppDispatch>();
  const {streaming, provider} = useSelector(selectAI);
  const messages = useSelector(selectActiveMessages);
  const activeConversationId = useSelector(selectActiveConversationId);
  const {snapshot} = useSelector(selectLearning);
  const auth = useSelector(selectAuth);
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

      const memory = await loadAIMemory();
      const context = buildAgentContext(snapshot, {
        memorySummary: summarizeMemory(memory),
        studentId: auth.session.studentId,
        demoMode: auth.demoMode,
      });

      try {
        const apiKey = aiApiKeyConfigured
          ? (await loadAIApiKey(provider.preset)) ?? ''
          : '';

        if (!apiKey) {
          const mock = createMockAgentReply(trimmed, context);
          dispatch(appendToLastAssistant(mock));
        } else {
          await runAgent({...provider, apiKey}, [...history, userMessage], context, {
            onAnswer: text => dispatch(appendToLastAssistant(text)),
            onToolStart: (tool: AgentTool, args) => {
              const label = tool.summarize ? tool.summarize(args) : tool.name;
              dispatch(setAgentStatus(label));
              dispatch(
                pushToolTrace({name: tool.name, label, status: 'running'}),
              );
            },
            onToolEnd: (_tool: AgentTool, ok, detail) => {
              dispatch(
                updateLastToolTrace({
                  status: ok ? 'success' : 'error',
                  detail,
                }),
              );
              dispatch(setAgentStatus(undefined));
            },
            requestConfirmation: (tool: AgentTool, args) =>
              new Promise<boolean>(resolve => {
                const prompt = tool.confirmPrompt?.(args);
                Alert.alert(
                  prompt?.title ?? '确认操作',
                  prompt?.message ?? '确认执行该操作？',
                  [
                    {
                      text: '取消',
                      style: 'cancel',
                      onPress: () => resolve(false),
                    },
                    {text: '确认', onPress: () => resolve(true)},
                  ],
                  {cancelable: true, onDismiss: () => resolve(false)},
                );
              }),
          });
        }
      } catch (error) {
        dispatch(
          setAIError(error instanceof Error ? error.message : 'AI 回复失败'),
        );
        dispatch(appendToLastAssistant('\n\n[错误] 请检查 API Key 与网络连接。'));
      } finally {
        dispatch(setAgentStatus(undefined));
        dispatch(setStreaming(false));
      }
    },
    [
      activeConversationId,
      aiApiKeyConfigured,
      auth.demoMode,
      auth.session.studentId,
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
