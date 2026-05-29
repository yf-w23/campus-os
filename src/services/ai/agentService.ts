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

/** 本地时区当前日期：YYYY-MM-DD（不是 UTC，避免凌晨偏到昨天/明天） */
function todayLocalISO(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function weekdayCN(): string {
  return ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][new Date().getDay()];
}

/** 把课表日期字段归一为 YYYY-MM-DD，用于和今天比较 */
function normalizeDate(s: string | undefined | null): string {
  if (!s) return '';
  const str = String(s).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
  if (/^\d{8}$/.test(str)) {
    return `${str.slice(0, 4)}-${str.slice(4, 6)}-${str.slice(6, 8)}`;
  }
  return str;
}

export function buildAgentContext(
  snapshot: LearningSnapshot | null | undefined,
): AgentContext {
  const today = todayLocalISO();
  const todayDate = `${today} ${weekdayCN()}`;

  if (!snapshot) {
    return {
      todayDate,
      todaySummary: '今天暂无课表数据（尚未同步或同步失败）',
      scheduleSummary: '暂无课表数据（尚未同步或同步失败）',
      ddlSummary: '暂无待办作业',
      courseSummary: '暂无课程数据',
    };
  }

  const upcoming = snapshot.homework
    .filter(item => !item.submitted)
    .slice(0, 8)
    .map(item => `- [${item.courseName}] ${item.title} · 截止 ${item.deadline}`)
    .join('\n');

  const todayClasses = snapshot.schedule
    .filter(item => normalizeDate(item.date) === today)
    .sort((a, b) => (a.startTime ?? '').localeCompare(b.startTime ?? ''))
    .map(item => `- ${item.startTime}-${item.endTime} ${item.title} @ ${item.location}`)
    .join('\n');

  const schedule = snapshot.schedule
    .slice(0, 14)
    .map(item => `- ${item.date} ${item.startTime}-${item.endTime} ${item.title} @ ${item.location}`)
    .join('\n');

  const courses = snapshot.courses
    .map(item => `- ${item.name} (${item.teacherName})`)
    .join('\n');

  return {
    todayDate,
    todaySummary: todayClasses || '今天没有课程安排',
    scheduleSummary: schedule || '暂无课表数据',
    ddlSummary: upcoming || '暂无待办作业',
    courseSummary: courses || '暂无课程数据',
  };
}

export function buildSystemPrompt(context: AgentContext): string {
  return [
    '你是 Campus OS 的校园学习助手，只能基于提供的校园数据进行只读分析和总结。',
    '你不能提交作业、修改课表、发送通知或执行任何写操作。',
    `今天是 ${context.todayDate}。当用户问“今天/明天/本周”等相对时间时，一律以这个日期为准，不要自行推断或臆造日期。`,
    '如果数据不足，请明确说明并给出下一步建议。',
    '',
    '## 今日课表（已按今天的真实日期筛选）',
    context.todaySummary,
    '',
    '## 近期课表（含日期）',
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

  // 解析单段 SSE 文本里的所有 data: 行，累积并回调 token。返回新增的文本。
  const consumeSSE = (chunk: string): string => {
    let added = '';
    for (const line of chunk.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) {
        continue;
      }
      const data = trimmed.slice(5).trim();
      if (!data || data === '[DONE]') {
        continue;
      }
      try {
        const parsed = JSON.parse(data);
        const token =
          parsed.choices?.[0]?.delta?.content ??
          parsed.choices?.[0]?.message?.content ??
          '';
        if (token) {
          added += token;
          onToken(token);
        }
      } catch {
        // ignore malformed chunks
      }
    }
    return added;
  };

  const reader =
    response.body && typeof (response.body as any).getReader === 'function'
      ? (response.body as ReadableStream<Uint8Array>).getReader()
      : null;

  // React Native 的 fetch 不支持 ReadableStream body —— 回退到「整体读取后解析」。
  // 此时已无逐字动效，但功能可用：要么是缓冲的 SSE 文本，要么是非流式 JSON。
  if (!reader) {
    const text = await response.text();
    const added = consumeSSE(text);
    if (added) {
      return added;
    }
    // 某些环境会把 stream:true 也当成整体 JSON 返回
    try {
      const parsed = JSON.parse(text);
      const content = parsed.choices?.[0]?.message?.content ?? '';
      if (content) {
        onToken(content);
        return content;
      }
    } catch {
      // 不是 JSON：把原文吐出去，至少不静默失败
    }
    if (text.trim()) {
      onToken(text.trim());
      return text.trim();
    }
    throw new Error('AI 返回空响应');
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
    fullText += consumeSSE(lines.join('\n'));
  }
  if (buffer.trim()) {
    fullText += consumeSSE(buffer);
  }

  return fullText;
}

export function createMockAgentReply(question: string, context: AgentContext): string {
  return [
    `【演示模式】今天是 ${context.todayDate}。我已读取你的本地校园数据上下文：`,
    '',
    `你问：${question}`,
    '',
    '今日课表：',
    context.todaySummary,
    '',
    '待办 DDL：',
    context.ddlSummary,
    '',
    '提示：配置 AI Provider 后，可获得真实模型回答。',
  ].join('\n');
}
