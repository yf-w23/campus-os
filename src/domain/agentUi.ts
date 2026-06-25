export type AgentUIActionType = 'ask_ai' | 'navigate' | 'sync' | 'add_deadline';

export interface AgentUIAction {
  id: string;
  type: AgentUIActionType;
  label: string;
  question?: string;
  routeName?: string;
  params?: Record<string, unknown>;
}

export interface AgentUIBaseBlock {
  id: string;
  title: string;
  subtitle?: string;
  priority?: number;
  actions?: AgentUIAction[];
}

export interface AgentUIBriefingMetric {
  label: string;
  value: string | number;
  tone?: 'default' | 'success' | 'warning' | 'error';
}

export interface AgentUIBriefingBlock extends AgentUIBaseBlock {
  type: 'briefing';
  summary: string;
  metrics: AgentUIBriefingMetric[];
}

export interface AgentUITaskPlanItem {
  id: string;
  title: string;
  detail?: string;
  tone?: 'default' | 'success' | 'warning' | 'error';
  action?: AgentUIAction;
}

export interface AgentUITaskPlanBlock extends AgentUIBaseBlock {
  type: 'task_plan';
  items: AgentUITaskPlanItem[];
}

export interface AgentUIWeatherBlock extends AgentUIBaseBlock {
  type: 'weather';
  location: string;
  labels?: {
    precipitation: string;
    uv: string;
    wind: string;
    humidity: string;
  };
  temperature?: number;
  apparentTemperature?: number;
  temperatureMin?: number;
  temperatureMax?: number;
  condition: string;
  precipitationProbability?: number;
  uvIndex?: number;
  windSpeed?: number;
  humidity?: number;
  updatedAt?: string;
  source?: string;
  advice: string[];
  loading?: boolean;
  error?: string;
}

export type AgentUIBlock =
  | AgentUIBriefingBlock
  | AgentUITaskPlanBlock
  | AgentUIWeatherBlock;
