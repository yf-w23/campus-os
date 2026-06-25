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

/** 一次工具调用的记录，用于在对话气泡里可视化 AI 的"动手"过程 */
export interface ToolTrace {
  /** 工具名（如 book_library_seat）*/
  name: string;
  /** 人类可读的过程描述（如"预约 李文正馆 A 区 12 号座"）*/
  label: string;
  /** 结果状态 */
  status: 'running' | 'success' | 'error' | 'cancelled';
  /** 结果摘要（成功/失败原因）*/
  detail?: string;
}

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
  streaming?: boolean;
  /** 本条 assistant 消息执行过的工具调用轨迹 */
  toolTraces?: ToolTrace[];
  /** 多模态：随消息附带的图片（本地 file:// 或远程 URL）*/
  images?: string[];
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
  /** 海淀天气快照；实时追问时可让 agent 调工具刷新 */
  weatherSummary?: string;
  /** 用户个性化记忆摘要（常用图书馆、默认充值额、关注课程等）*/
  memorySummary?: string;
  /** 当前登录学号 */
  studentId?: string;
  /** 是否演示模式（演示模式下写操作 / 实时查询不可用）*/
  demoMode?: boolean;
}

/**
 * AI 个性化记忆 —— 跨会话持久化到本地，让助手"懂你"。
 */
export interface AIMemory {
  /** 常用图书馆名（如"李文正馆"）*/
  favoriteLibrary?: string;
  /** 常用分区名 */
  favoriteSection?: string;
  /** 默认电费充值金额 */
  defaultRechargeAmount?: number;
  /** 关注的课程名（用于 DDL 提醒优先级）*/
  watchedCourses?: string[];
  /** 其它自由记忆条目 */
  notes?: string[];
}

export interface AgentRequest {
  messages: ChatMessage[];
  context: AgentContext;
  provider: AIProviderConfig;
}
