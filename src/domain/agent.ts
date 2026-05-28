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

export interface AgentContext {
  scheduleSummary: string;
  ddlSummary: string;
  courseSummary: string;
}

export interface AgentRequest {
  messages: ChatMessage[];
  context: AgentContext;
  provider: AIProviderConfig;
}
