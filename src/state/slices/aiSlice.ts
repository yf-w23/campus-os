import {createSlice, PayloadAction} from '@reduxjs/toolkit';
import {AIProviderConfig, ChatMessage} from '../../domain/agent';

interface AISliceState {
  messages: ChatMessage[];
  streaming: boolean;
  error?: string;
  provider: Omit<AIProviderConfig, 'apiKey'>;
}

const initialState: AISliceState = {
  messages: [
    {
      id: 'welcome',
      role: 'assistant',
      content:
        '你好，我是 Campus OS 助手。你可以问我今天的课表、待交作业或课程通知，我会基于你的校园数据只读回答。',
      createdAt: new Date().toISOString(),
    },
  ],
  streaming: false,
  provider: {
    preset: 'deepseek',
    label: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
  },
};

const aiSlice = createSlice({
  name: 'ai',
  initialState,
  reducers: {
    addMessage(state, action: PayloadAction<ChatMessage>) {
      state.messages.push(action.payload);
    },
    appendToLastAssistant(state, action: PayloadAction<string>) {
      const last = state.messages[state.messages.length - 1];
      if (last?.role === 'assistant') {
        last.content += action.payload;
      }
    },
    setStreaming(state, action: PayloadAction<boolean>) {
      state.streaming = action.payload;
    },
    setAIError(state, action: PayloadAction<string | undefined>) {
      state.error = action.payload;
    },
    setProvider(state, action: PayloadAction<Omit<AIProviderConfig, 'apiKey'>>) {
      state.provider = action.payload;
    },
    clearMessages(state) {
      state.messages = initialState.messages;
    },
  },
});

export const {
  addMessage,
  appendToLastAssistant,
  setStreaming,
  setAIError,
  setProvider,
  clearMessages,
} = aiSlice.actions;

export default aiSlice.reducer;
