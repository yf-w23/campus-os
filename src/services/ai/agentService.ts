import {AIProviderConfig, AIProviderPreset, AgentContext, ChatMessage} from '../../domain/agent';
import {
  ActionExecutionStatus,
  ActionPreview,
  ConfirmationStatus,
  VerificationResult,
} from '../../domain/actions';
import {LearningSnapshot} from '../../domain/learning';
import {ManualDeadline} from '../../domain/deadline';
import {
  getToolByName,
  toolSpecs,
  type AgentTool,
} from './tools';

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
    model: 'deepseek-v4-flash',
  },
  qwen: {
    preset: 'qwen',
    label: '通义千问',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'qwen3.7-max',
  },
  moonshot: {
    preset: 'moonshot',
    label: 'Moonshot',
    baseUrl: 'https://api.moonshot.cn/v1',
    model: 'kimi-k2.6',
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
  if (!s) {
    return '';
  }
  const str = String(s).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    return str.slice(0, 10);
  }
  if (/^\d{8}$/.test(str)) {
    return `${str.slice(0, 4)}-${str.slice(4, 6)}-${str.slice(6, 8)}`;
  }
  return str;
}

export function buildAgentContext(
  snapshot: LearningSnapshot | null | undefined,
  extra?: {
    memorySummary?: string;
    studentId?: string;
    demoMode?: boolean;
    manualDeadlines?: ManualDeadline[];
  },
): AgentContext {
  const today = todayLocalISO();
  const todayDate = `${today} ${weekdayCN()}`;
  const base = {
    memorySummary: extra?.memorySummary,
    studentId: extra?.studentId,
    demoMode: extra?.demoMode,
  };

  if (!snapshot) {
    return {
      ...base,
      todayDate,
      todaySummary: '今天暂无课表数据（尚未同步或同步失败）',
      scheduleSummary: '暂无课表数据（尚未同步或同步失败）',
      ddlSummary: '暂无待办作业',
      courseSummary: '暂无课程数据',
    };
  }

  const manualUpcoming = (extra?.manualDeadlines ?? [])
    .slice(0, 8)
    .map(item =>
      `- [自建${item.courseName ? `/${item.courseName}` : ''}] ${item.title} · 截止 ${item.deadline}`,
    )
    .join('\n');

  const homeworkUpcoming = snapshot.homework
    .filter(item => !item.submitted)
    .slice(0, 8)
    .map(item => `- [${item.courseName}] ${item.title} · 截止 ${item.deadline}`)
    .join('\n');
  const upcoming = [homeworkUpcoming, manualUpcoming].filter(Boolean).join('\n');

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
    ...base,
    todayDate,
    todaySummary: todayClasses || '今天没有课程安排',
    scheduleSummary: schedule || '暂无课表数据',
    ddlSummary: upcoming || '暂无待办作业',
    courseSummary: courses || '暂无课程数据',
  };
}

export function buildSystemPrompt(context: AgentContext): string {
  const lines: string[] = [
    '你是 Campus OS 的校园智能体（agent），不只是问答助手——你可以通过“工具”实时查询校园数据，并在用户授权下替用户完成低风险、可撤销操作。',
    `今天是 ${context.todayDate}。当用户问“今天/明天/本周”等相对时间时，一律以这个日期为准，不要臆造日期。`,
    '',
    '## 工具使用原则',
    '- 需要实时/精确数据（成绩、电费余额、校园卡/校园网余额、图书馆空位、体育预约、作业详情）时，调用相应工具获取，不要凭注入摘要臆测。',
    '- 预约/取消图书馆座位、预约/取消研读间、注销校园网设备、添加/删除个人备忘日程、添加/删除自建 DDL 属于写操作，会触发 dry-run、用户二次确认和执行后验证。',
    '- 选课、支付、校园卡挂失/充值/改密码、教学评价提交、邮件发送等高风险事务当前不自动执行；只能给出方案或提醒用户到官方页面手动处理。',
    '- 问「这周/某天有什么安排」时优先用 get_week_schedule；仅查用户自建备忘用 list_personal_events。不能删除或修改教务课表，只能增删个人备忘。',
    '- 问 DDL/作业/待办时优先用 list_homework，它会合并老师布置的作业与用户自建 DDL。用户要求新增 DDL 时用 add_manual_deadline；要求删除 DDL 时只能用 remove_manual_deadline 删除自建 DDL，老师布置的作业不能删除。',
    '- 问空教室、自习地点、某教学楼空闲情况时，先用 list_classroom_buildings 或 find_available_classrooms 获取真实教室状态。',
    '- 预约图书馆座位按"列馆→列楼层→列分区→找座位→预约"的顺序逐步推进，不要反复试探。',
    '- 用户问图书馆当前预约记录或取消座位预约时，先用 list_library_booking_records 获取真实记录，再用其中 delId 调 cancel_library_seat_booking。',
    '- 用户问研读间时，先用 list_library_room_types / find_library_rooms 查可用资源；预约前必须有明确日期、开始/结束时间和 devId/kindId。',
    '- 用户问校园网余额/在线设备时使用 get_network_balance / list_network_devices；注销设备前只使用 key，工具会自行查 mac。',
    '- 用户问校园卡时只查询余额和流水，不要承诺充值、挂失或修改密码。',
    '- 用户问宿舍洗衣机状态、哪里有空闲洗衣机、某楼洗衣机剩余时间时，先用 list_laundry_buildings 找楼宇；有明确楼宇后用 get_laundry_status 获取真实状态。',
    '- 预约座位前若用户没指定地点，优先使用其常用图书馆（见下方记忆）；仍不确定时先询问。',
    '- 用户表达明确长期偏好（常去哪、默认充值多少、关注哪些课）时，用 remember_preference 记住。',
    '- 当用户在同一会话中连续 2 次以上对同一资源做同类操作（如连续查同一图书馆、同一分区、同一场馆），可主动建议：「我注意到你好像经常用 xxx，要不要我记住这个偏好？」如果用户同意，再调用 remember_preference 写入。',
    '- 操作完成后用简洁中文向用户复述结果（成功/失败/下一步）。',
    '- 【重要】展示工具返回的具体数据（座位号 seatName、成绩、电量、金额、日期等）时，必须逐字原样引用工具结果，严禁编造、改写、推测或用"范围/区间"概括座位号；项目较多时可只列前若干个真实值并注明"等"，但绝不能虚构编号。预约座位时必须使用工具返回的真实 seatId/seatType，不能凭座位号猜测。',
  ];
  if (context.demoMode) {
    lines.push('- 当前为演示模式：实时查询与写操作不可用，请提示用户退出演示模式并登录。');
  }
  lines.push(
    '',
    '## 关于用户',
    context.studentId ? `学号：${context.studentId}` : '（未获取到学号）',
    '',
    '## 个性化记忆',
    context.memorySummary ?? '（暂无个性化记忆）',
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
  );
  return lines.join('\n');
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

// ============================================================
// Agent loop —— 支持工具调用（function-calling）的多轮推理
// ============================================================

export interface AgentCallbacks {
  /** 最终回答文本（一次性给出）*/
  onAnswer: (text: string) => void;
  /** 工具开始执行（用于过程可视化）*/
  onToolStart?: (tool: AgentTool, args: unknown) => void;
  /** 工具执行结束 */
  onToolEnd?: (
    tool: AgentTool,
    status: ActionExecutionStatus,
    detail?: string,
  ) => void;
  /** 写操作二次确认；返回 true 才执行 */
  requestConfirmation?: (
    tool: AgentTool,
    args: unknown,
    preview?: ActionPreview,
  ) => Promise<boolean>;
}

interface OpenAIToolCall {
  id: string;
  type?: string;
  function: {name: string; arguments: string};
}

const MAX_AGENT_ROUNDS = 6;

async function postChatCompletion(
  provider: AIProviderConfig,
  body: Record<string, unknown>,
): Promise<any> {
  const baseUrl = provider.baseUrl || AI_PRESETS[provider.preset].baseUrl;
  if (!baseUrl || !provider.apiKey) {
    throw new Error('请先配置 AI Provider 与 API Key');
  }
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${provider.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({model: provider.model, ...body}),
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI 请求失败: ${response.status} ${errorText}`);
  }
  return response.json();
}

function summarizeToolResult(result: unknown): string | undefined {
  if (result && typeof result === 'object') {
    const r = result as Record<string, unknown>;
    if (typeof r.message === 'string') {
      return r.message;
    }
    if (r.error) {
      return String(r.error);
    }
    if (r.ok === true) {
      return '成功';
    }
    if (r.ok === false) {
      return '失败';
    }
  }
  return undefined;
}

function isToolResultFailure(result: unknown): boolean {
  if (result && typeof result === 'object') {
    const r = result as Record<string, unknown>;
    return Boolean(r.error) || r.ok === false;
  }
  return false;
}

async function auditToolCall(input: {
  tool: AgentTool;
  args: unknown;
  preview?: ActionPreview;
  confirmation: ConfirmationStatus;
  status: ActionExecutionStatus;
  verification?: VerificationResult;
  result?: unknown;
  errorMessage?: string;
}): Promise<void> {
  try {
    const {appendActionAuditRecord} = await import('../../storage/actionAuditStorage');
    await appendActionAuditRecord({
      toolName: input.tool.name,
      toolTitle: input.tool.title,
      risk: input.tool.risk,
      permission: input.tool.permission,
      params: input.args,
      preview: input.preview,
      confirmation: input.confirmation,
      status: input.status,
      verification: input.verification,
      resultSummary: summarizeToolResult(input.result),
      errorMessage: input.errorMessage,
    });
  } catch {
    // Audit persistence must never break the user-facing agent flow.
  }
}

/**
 * 运行一轮"对话→（按需调用工具）→…→最终回答"的 agent 循环。
 *
 * 与 streamChatCompletion 的区别：此函数会带 tools 给模型，处理 tool_calls，
 * 真正去查数据 / 执行操作（写操作经 requestConfirmation 确认），再把结果回灌，
 * 直到模型给出不含工具调用的最终回答。
 */
export async function runAgent(
  provider: AIProviderConfig,
  messages: ChatMessage[],
  context: AgentContext,
  callbacks: AgentCallbacks,
): Promise<string> {
  const convo: any[] = [
    {role: 'system', content: buildSystemPrompt(context)},
    ...messages.map(m => ({role: m.role, content: m.content})),
  ];
  const tools = toolSpecs();

  for (let round = 0; round < MAX_AGENT_ROUNDS; round += 1) {
    const data = await postChatCompletion(provider, {
      messages: convo,
      tools,
      tool_choice: 'auto',
      stream: false,
    });
    const message = data?.choices?.[0]?.message;
    const toolCalls: OpenAIToolCall[] | undefined = message?.tool_calls;

    if (!toolCalls || toolCalls.length === 0) {
      const answer = String(message?.content ?? '').trim();
      const finalText = answer || '（模型未返回内容）';
      callbacks.onAnswer(finalText);
      return finalText;
    }

    // 把模型的工具调用意图压回对话
    convo.push({
      role: 'assistant',
      content: message.content ?? '',
      tool_calls: toolCalls,
    });

    for (const call of toolCalls) {
      const tool = getToolByName(call.function?.name ?? '');
      let result: unknown;

      if (!tool) {
        result = {error: `未知工具：${call.function?.name}`};
      } else {
        let args: Record<string, unknown> = {};
        try {
          args = call.function.arguments ? JSON.parse(call.function.arguments) : {};
        } catch {
          args = {};
        }

        callbacks.onToolStart?.(tool, args);

        let cancelled = false;
        let confirmation: ConfirmationStatus = tool.requiresConfirmation
          ? 'unavailable'
          : 'not_required';
        let status: ActionExecutionStatus = 'success';
        let errorMessage: string | undefined;
        let preview: ActionPreview | undefined;
        let verification: VerificationResult | undefined;

        if (tool.requiresConfirmation) {
          if (tool.dryRun) {
            try {
              preview = await tool.dryRun(args);
            } catch (e) {
              cancelled = true;
              status = 'error';
              errorMessage = e instanceof Error ? e.message : String(e);
              result = {error: errorMessage};
              callbacks.onToolEnd?.(tool, 'error', errorMessage);
            }
          }
          const requestConfirmation = callbacks.requestConfirmation;
          if (!cancelled && !requestConfirmation) {
            cancelled = true;
            confirmation = 'unavailable';
            status = 'cancelled';
            result = {
              ok: false,
              cancelled: true,
              message: '缺少确认通道，已阻止执行',
            };
            callbacks.onToolEnd?.(tool, 'cancelled', '缺少确认通道');
          } else if (!cancelled) {
            const ok = await requestConfirmation!(tool, args, preview);
            confirmation = ok ? 'approved' : 'denied';
            if (!ok) {
              cancelled = true;
              status = 'cancelled';
              result = {ok: false, cancelled: true, message: '用户取消了该操作'};
              callbacks.onToolEnd?.(tool, 'cancelled', '已取消');
            }
          }
        }

        if (!cancelled) {
          try {
            result = await tool.run(args);
            status = isToolResultFailure(result) ? 'error' : 'success';
            if (tool.verify && status === 'success') {
              verification = await tool.verify(args, result);
              if (!verification.ok) {
                status = 'error';
                errorMessage = verification.message ?? '执行后验证失败';
              }
            }
            callbacks.onToolEnd?.(
              tool,
              status,
              errorMessage ?? summarizeToolResult(result),
            );
          } catch (e) {
            const detail = e instanceof Error ? e.message : String(e);
            result = {error: detail};
            status = 'error';
            errorMessage = detail;
            callbacks.onToolEnd?.(tool, 'error', detail);
          }
        }

        await auditToolCall({
          tool,
          args,
          preview,
          confirmation,
          status,
          verification,
          result,
          errorMessage,
        });
      }

      convo.push({
        role: 'tool',
        tool_call_id: call.id,
        content: JSON.stringify(result ?? {}),
      });
    }
  }

  const fallback = '（已达到工具调用上限，请补充信息或拆分需求后再试）';
  callbacks.onAnswer(fallback);
  return fallback;
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
