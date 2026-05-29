export type AIProviderPreset =
  | 'openai'
  | 'deepseek'
  | 'qwen'
  | 'moonshot'
  | 'custom';

export interface AIProviderConfig {
  preset: AIProviderPreset;
  apiKey: string;
  baseUrl?: string;
  model: string;
  label: string;
}

export type ChatRole = 'system' | 'user' | 'assistant';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
  streaming?: boolean;
}

/** 一次完整的对话（类 ChatGPT 会话），持久化到本地 */
export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface AgentContext {
  /** 真实当前日期，形如 "2026-05-29 周五" —— 注入系统提示，避免模型臆测今天 */
  todayDate: string;
  /** 今天（按真实日期过滤）的课表 */
  todaySummary: string;
  scheduleSummary: string;
  ddlSummary: string;
  courseSummary: string;
}

export interface AgentRequest {
  messages: ChatMessage[];
  context: AgentContext;
  provider: AIProviderConfig;
}
