import {AIProviderConfig, AIProviderPreset, AgentContext, ChatMessage} from '../../domain/agent';
import {LearningSnapshot} from '../../domain/learning';

export const AI_PRESETS: Record<
  AIProviderPreset,
  Omit<AIProviderConfig, 'apiKey'>
> = {
  openai: {
    preset: 'openai',
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
  },
  deepseek: {
    preset: 'deepseek',
    label: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
  },
  qwen: {
    preset: 'qwen',
    label: '通义千问',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'qwen-plus',
  },
  moonshot: {
    preset: 'moonshot',
    label: 'Moonshot',
    baseUrl: 'https://api.moonshot.cn/v1',
    model: 'moonshot-v1-8k',
  },
  custom: {
    preset: 'custom',
    label: '自定义',
    baseUrl: '',
    model: 'gpt-4o-mini',
  },
};

export function buildAgentContext(snapshot: LearningSnapshot): AgentContext {
  const upcoming = snapshot.homework
    .filter(item => !item.submitted)
    .slice(0, 8)
    .map(item => `- [${item.courseName}] ${item.title} · 截止 ${item.deadline}`)
    .join('\n');

  const schedule = snapshot.schedule
    .slice(0, 10)
    .map(item => `- ${item.date} ${item.startTime}-${item.endTime} ${item.title} @ ${item.location}`)
    .join('\n');

  const courses = snapshot.courses
    .map(item => `- ${item.name} (${item.teacherName})`)
    .join('\n');

  return {
    scheduleSummary: schedule || '暂无课表数据',
    ddlSummary: upcoming || '暂无待办作业',
    courseSummary: courses || '暂无课程数据',
  };
}

export function buildSystemPrompt(context: AgentContext): string {
  return [
    '你是 Campus OS 的校园学习助手，只能基于提供的校园数据进行只读分析和总结。',
    '你不能提交作业、修改课表、发送通知或执行任何写操作。',
    '如果数据不足，请明确说明并给出下一步建议。',
    '',
    '## 课表',
    context.scheduleSummary,
    '',
    '## 待办 DDL',
    context.ddlSummary,
    '',
    '## 课程列表',
    context.courseSummary,
  ].join('\n');
}

export async function streamChatCompletion(
  provider: AIProviderConfig,
  messages: ChatMessage[],
  context: AgentContext,
  onToken: (token: string) => void,
): Promise<string> {
  const baseUrl = provider.baseUrl || AI_PRESETS[provider.preset].baseUrl;
  if (!baseUrl || !provider.apiKey) {
    throw new Error('请先配置 AI Provider 与 API Key');
  }

  const payload = {
    model: provider.model,
    stream: true,
    messages: [
      {role: 'system', content: buildSystemPrompt(context)},
      ...messages.map(item => ({role: item.role, content: item.content})),
    ],
  };

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${provider.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI 请求失败: ${response.status} ${errorText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('当前环境不支持流式响应');
  }

  const decoder = new TextDecoder();
  let fullText = '';
  let buffer = '';

  while (true) {
    const {done, value} = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, {stream: true});
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) {
        continue;
      }
      const data = trimmed.slice(5).trim();
      if (data === '[DONE]') {
        continue;
      }
      try {
        const parsed = JSON.parse(data);
        const token = parsed.choices?.[0]?.delta?.content ?? '';
        if (token) {
          fullText += token;
          onToken(token);
        }
      } catch {
        // ignore malformed chunks
      }
    }
  }

  return fullText;
}

export function createMockAgentReply(question: string, context: AgentContext): string {
  return [
    '【演示模式】我已读取你的本地校园数据上下文：',
    '',
    `你问：${question}`,
    '',
    '课表摘要：',
    context.scheduleSummary,
    '',
    '待办 DDL：',
    context.ddlSummary,
    '',
    '提示：配置 AI Provider 后，可获得真实模型回答。',
  ].join('\n');
}
