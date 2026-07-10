import {createSlice, PayloadAction} from '@reduxjs/toolkit';
import {v4 as uuidv4} from 'uuid';
import {
  AIProviderConfig,
  ChatMessage,
  Conversation,
  ToolTrace,
} from '../../domain/agent';

interface AISliceState {
  conversations: Conversation[];
  activeConversationId: string | null;
  streaming: boolean;
  error?: string;
  provider: Omit<AIProviderConfig, 'apiKey'>;
  /** 当前 agent 正在执行的工具状态行（过程可视化），空闲时 undefined */
  agentStatus?: string;
}

const initialState: AISliceState = {
  conversations: [],
  activeConversationId: null,
  streaming: false,
  provider: {
    preset: 'deepseek',
    label: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-v4-flash',
  },
};

function deriveTitle(content: string): string {
  const cleaned = content.trim().replace(/\s+/g, ' ');
  if (!cleaned) return '新对话';
  return cleaned.length > 20 ? `${cleaned.slice(0, 20)}…` : cleaned;
}

function activeConv(state: AISliceState): Conversation | undefined {
  return state.conversations.find(c => c.id === state.activeConversationId);
}

const aiSlice = createSlice({
  name: 'ai',
  initialState,
  reducers: {
    hydrateConversations(
      state,
      action: PayloadAction<{
        conversations: Conversation[];
        activeConversationId: string | null;
      }>,
    ) {
      state.conversations = action.payload.conversations;
      state.activeConversationId =
        action.payload.activeConversationId &&
        action.payload.conversations.some(
          c => c.id === action.payload.activeConversationId,
        )
          ? action.payload.activeConversationId
          : null;
    },
    /** 开启新对话：创建空会话并置为当前 */
    newConversation(state) {
      const now = new Date().toISOString();
      const conv: Conversation = {
        id: uuidv4(),
        title: '新对话',
        messages: [],
        createdAt: now,
        updatedAt: now,
      };
      state.conversations.unshift(conv);
      state.activeConversationId = conv.id;
      state.error = undefined;
    },
    setActiveConversation(state, action: PayloadAction<string>) {
      state.activeConversationId = action.payload;
      state.error = undefined;
    },
    /** 开启新对话（延迟创建）：仅清空当前选择，真正的会话等首条消息发出时才建立 */
    clearActiveConversation(state) {
      state.activeConversationId = null;
      state.error = undefined;
    },
    deleteConversation(state, action: PayloadAction<string>) {
      state.conversations = state.conversations.filter(
        c => c.id !== action.payload,
      );
      if (state.activeConversationId === action.payload) {
        state.activeConversationId = null;
      }
    },
    addMessage(state, action: PayloadAction<ChatMessage>) {
      const conv = activeConv(state);
      if (!conv) return;
      conv.messages.push(action.payload);
      conv.updatedAt = new Date().toISOString();
      // 用首条用户消息自动命名会话
      if (
        action.payload.role === 'user' &&
        (conv.title === '新对话' || !conv.title)
      ) {
        conv.title = deriveTitle(action.payload.content);
      }
    },
    appendToLastAssistant(state, action: PayloadAction<string>) {
      const conv = activeConv(state);
      if (!conv) return;
      const last = conv.messages[conv.messages.length - 1];
      if (last?.role === 'assistant') {
        last.content += action.payload;
        conv.updatedAt = new Date().toISOString();
      }
    },
    setStreaming(state, action: PayloadAction<boolean>) {
      state.streaming = action.payload;
      // 流式结束时清掉每条消息的 streaming 标记，否则 MarkdownText 会一直停在
      // 纯文本分支、Markdown 永不编译，末尾光标 ▍ 也不消失。
      if (!action.payload) {
        for (const conv of state.conversations) {
          for (const message of conv.messages) {
            if (message.streaming) {
              message.streaming = false;
            }
          }
        }
      }
    },
    setAIError(state, action: PayloadAction<string | undefined>) {
      state.error = action.payload;
    },
    setAgentStatus(state, action: PayloadAction<string | undefined>) {
      state.agentStatus = action.payload;
    },
    /** 给当前 assistant 消息追加一条工具调用轨迹 */
    pushToolTrace(state, action: PayloadAction<ToolTrace>) {
      const conv = activeConv(state);
      const last = conv?.messages[conv.messages.length - 1];
      if (last?.role === 'assistant') {
        if (!last.toolTraces) {
          last.toolTraces = [];
        }
        last.toolTraces.push(action.payload);
      }
    },
    /** 更新当前 assistant 消息最后一条工具轨迹的状态/详情 */
    updateLastToolTrace(
      state,
      action: PayloadAction<Partial<ToolTrace> & {status: ToolTrace['status']}>,
    ) {
      const conv = activeConv(state);
      const last = conv?.messages[conv.messages.length - 1];
      const traces = last?.toolTraces;
      if (traces && traces.length) {
        const t = traces[traces.length - 1];
        Object.assign(t, action.payload);
      }
    },
    setProvider(state, action: PayloadAction<Omit<AIProviderConfig, 'apiKey'>>) {
      state.provider = action.payload;
    },
  },
});

export const {
  hydrateConversations,
  newConversation,
  setActiveConversation,
  clearActiveConversation,
  deleteConversation,
  addMessage,
  appendToLastAssistant,
  setStreaming,
  setAIError,
  setProvider,
  setAgentStatus,
  pushToolTrace,
  updateLastToolTrace,
} = aiSlice.actions;

export default aiSlice.reducer;
