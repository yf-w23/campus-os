import {useCallback, useState} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import {v4 as uuidv4} from 'uuid';
import {ChatMessage, ToolTrace, ToolTraceMetric} from '../../domain/agent';
import {
  ActionExecutionStatus,
  ActionPreview,
  ConfirmationSpec,
  ConfirmationStatus,
  VerificationResult,
} from '../../domain/actions';
import {
  buildAgentContext,
  createMockAgentReply,
  runAgent,
} from '../../services/ai/agentService';
import {AgentTool} from '../../services/ai/tools';
import {
  buildCampusWeatherSummary,
  fetchHaidianWeather,
} from '../../services/campus/weather';
import {loadAIApiKey} from '../../storage/secureStorage';
import {loadAIMemory, summarizeMemory} from '../../storage/aiMemoryStorage';
import {
  selectAI,
  selectActiveConversationId,
  selectActiveMessages,
  selectAuth,
  selectLearning,
  selectManualDeadlines,
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

interface PendingConfirmation {
  tool: AgentTool;
  spec: ConfirmationSpec;
  preview?: ActionPreview;
  resolve: (ok: boolean) => void;
}

const previewArrayKeys = [
  'homework',
  'todayClasses',
  'upcomingHomework',
  'courses',
  'messages',
  'seats',
  'rooms',
  'devices',
  'transactions',
  'records',
  'floors',
  'sections',
  'libraries',
  'buildings',
  'news',
  'slots',
  'folders',
  'availableClassrooms',
  'resources',
];

function compactText(value: unknown, max = 64): string | undefined {
  if (value == null) {
    return undefined;
  }
  const text = String(value).replace(/\s+/g, ' ').trim();
  if (!text) {
    return undefined;
  }
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

function labelForRecord(item: unknown): string | undefined {
  if (item == null) {
    return undefined;
  }
  if (typeof item !== 'object') {
    return compactText(item);
  }
  const row = item as Record<string, unknown>;
  const title =
    row.title ??
    row.name ??
    row.subject ??
    row.roomName ??
    row.seatName ??
    row.zhName ??
    row.enName ??
    row.id;
  const meta =
    row.course ??
    row.courseName ??
    row.deadline ??
    row.date ??
    row.status ??
    row.from ??
    row.location ??
    row.available;
  const titleText = compactText(title, 40);
  const metaText = compactText(meta, 28);
  if (titleText && metaText) {
    return `${titleText} · ${metaText}`;
  }
  return titleText ?? metaText;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : undefined;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function textOf(record: Record<string, unknown>, key: string): string | undefined {
  return compactText(record[key], 80);
}

function fixedNumber(value: unknown, digits = 1): string | undefined {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return undefined;
  }
  return n.toFixed(digits);
}

function intText(value: unknown): string | undefined {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return undefined;
  }
  return String(Math.round(n));
}

function metric(
  label: string,
  value: unknown,
  tone?: ToolTraceMetric['tone'],
): ToolTraceMetric | undefined {
  const text = compactText(value, 24);
  return text ? {label, value: text, tone} : undefined;
}

function compactMetrics(
  items: Array<ToolTraceMetric | undefined>,
): ToolTraceMetric[] {
  return items.filter((item): item is ToolTraceMetric => Boolean(item));
}

function formatMoney(value: unknown): string | undefined {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return compactText(value, 24);
  }
  return `${n.toFixed(2)} 元`;
}

function previewHomeworkItems(items: unknown[]): string[] {
  return items
    .slice(0, 4)
    .map(item => {
      const row = asRecord(item);
      if (!row) {
        return compactText(item);
      }
      return [
        compactText(row.course ?? row.courseName, 18),
        compactText(row.title, 36),
        row.deadline ? `截止 ${compactText(row.deadline, 24)}` : undefined,
      ]
        .filter(Boolean)
        .join(' · ');
    })
    .filter((item): item is string => Boolean(item));
}

function previewCourseItems(items: unknown[]): string[] {
  return items
    .slice(0, 4)
    .map(item => {
      const row = asRecord(item);
      if (!row) {
        return compactText(item);
      }
      return [
        compactText(row.name, 34),
        row.grade ? `成绩 ${compactText(row.grade, 10)}` : undefined,
        row.credit != null ? `${row.credit} 学分` : undefined,
      ]
        .filter(Boolean)
        .join(' · ');
    })
    .filter((item): item is string => Boolean(item));
}

function previewSeatItems(items: unknown[]): string[] {
  return items
    .slice(0, 6)
    .map(item => {
      const row = asRecord(item);
      if (!row) {
        return compactText(item);
      }
      return [
        compactText(row.seatName ?? row.name ?? row.id, 28),
        row.seatId ? `ID ${compactText(row.seatId, 16)}` : undefined,
        row.status ? compactText(row.status, 12) : undefined,
      ]
        .filter(Boolean)
        .join(' · ');
    })
    .filter((item): item is string => Boolean(item));
}

function previewMailItems(items: unknown[]): string[] {
  return items
    .slice(0, 4)
    .map(item => {
      const row = asRecord(item);
      if (!row) {
        return compactText(item);
      }
      return [
        row.unread ? '未读' : undefined,
        compactText(row.subject, 36),
        compactText(row.from, 24),
        row.hasAttachment ? '附件' : undefined,
      ]
        .filter(Boolean)
        .join(' · ');
    })
    .filter((item): item is string => Boolean(item));
}

function previewNewsItems(items: unknown[]): string[] {
  return items
    .slice(0, 5)
    .map(item => {
      const row = asRecord(item);
      if (!row) {
        return compactText(item);
      }
      return [
        row.topped ? '置顶' : undefined,
        compactText(row.title, 42),
        compactText(row.source, 18),
        compactText(row.date, 16),
      ]
        .filter(Boolean)
        .join(' · ');
    })
    .filter((item): item is string => Boolean(item));
}

function domainToolTracePreview(
  tool: AgentTool,
  record: Record<string, unknown>,
  detail?: string,
): Partial<ToolTrace> | undefined {
  switch (tool.name) {
    case 'get_campus_weather': {
      const current = asRecord(record.current) ?? {};
      const temp = fixedNumber(current.temperature, 0);
      const shortRain = intText(current.shortTermPrecipitationProbability);
      const uv = fixedNumber(current.uvIndex, 1);
      return {
        resultTitle: '天气工具返回',
        resultSummary:
          textOf(record, 'summary') ??
          [
            textOf(record, 'location') ?? '海淀',
            temp ? `${temp}°` : undefined,
            textOf(current, 'condition'),
          ]
            .filter(Boolean)
            .join(' · '),
        resultMetrics: compactMetrics([
          metric('温度', temp ? `${temp}°` : undefined),
          metric('近3h降水', shortRain ? `${shortRain}%` : undefined, Number(shortRain) >= 50 ? 'warning' : 'success'),
          metric('UV', uv, Number(uv) >= 6 ? 'warning' : 'default'),
        ]),
        resultItems: asArray(record.daily)
          .slice(0, 3)
          .map(item => {
            const row = asRecord(item);
            if (!row) {
              return compactText(item);
            }
            return [
              compactText(row.date, 16),
              compactText(row.condition, 20),
              row.temperatureMin != null || row.temperatureMax != null
                ? `${row.temperatureMin ?? '-'}~${row.temperatureMax ?? '-'}°`
                : undefined,
            ]
              .filter(Boolean)
              .join(' · ');
          })
          .filter((item): item is string => Boolean(item)),
        resultFootnote: textOf(record, 'source')
          ? `来源：${textOf(record, 'source')}`
          : undefined,
      };
    }
    case 'get_today_overview': {
      const classes = asArray(record.todayClasses);
      const homework = asArray(record.upcomingHomework);
      return {
        resultTitle: '今日概览工具返回',
        resultSummary: `${textOf(record, 'date') ?? ''} ${textOf(record, 'weekday') ?? ''}`.trim(),
        resultMetrics: compactMetrics([
          metric('今日课程', `${classes.length} 节`),
          metric('待办 DDL', `${homework.length} 条`, homework.length > 0 ? 'warning' : 'success'),
        ]),
        resultItems: [...classes.slice(0, 2), ...homework.slice(0, 2)]
          .map(item => compactText(item, 70))
          .filter((item): item is string => Boolean(item)),
      };
    }
    case 'list_homework': {
      const homework = asArray(record.homework);
      return {
        resultTitle: 'DDL 工具返回',
        resultSummary: `共 ${record.count ?? homework.length} 条作业/DDL`,
        resultMetrics: compactMetrics([
          metric('总数', record.count ?? homework.length),
          metric(
            '可删除',
            homework.filter(item => asRecord(item)?.deletable === true).length,
          ),
        ]),
        resultItems: previewHomeworkItems(homework),
      };
    }
    case 'get_homework_detail':
      return {
        resultTitle: '作业详情工具返回',
        resultSummary: [
          textOf(record, 'course'),
          textOf(record, 'title'),
          record.deadline ? `截止 ${textOf(record, 'deadline')}` : undefined,
        ]
          .filter(Boolean)
          .join(' · '),
        resultMetrics: compactMetrics([
          metric('附件', record.hasAttachment ? '有' : '无'),
          metric('成绩', record.grade ?? '未批改'),
        ]),
        resultItems: record.attachmentName
          ? [`附件：${compactText(record.attachmentName, 60)}`]
          : undefined,
      };
    case 'get_grades': {
      const courses = asArray(record.courses);
      return {
        resultTitle: '成绩工具返回',
        resultSummary: `已读取 ${courses.length} 门课程成绩`,
        resultMetrics: compactMetrics([
          metric('GPA', record.gpa),
          metric('计入学分', record.totalCredit),
          metric('课程数', courses.length),
        ]),
        resultItems: previewCourseItems(courses),
      };
    }
    case 'get_electricity_balance': {
      const room = asRecord(record.room);
      return {
        resultTitle: '电费工具返回',
        resultSummary: room
          ? `${textOf(room, 'building') ?? ''} ${textOf(room, 'room') ?? ''}`.trim()
          : detail,
        resultMetrics: compactMetrics([
          metric('剩余', `${record.remainder ?? '-'} ${record.unit ?? '度'}`, Number(record.remainder) < 20 ? 'warning' : 'success'),
          metric('更新', record.updateTime),
        ]),
      };
    }
    case 'get_campus_card_balance':
      return {
        resultTitle: '校园卡工具返回',
        resultSummary: record.cardStatus ? `卡状态：${record.cardStatus}` : detail,
        resultMetrics: compactMetrics([
          metric('余额', formatMoney(record.balance), Number(record.balance) < 20 ? 'warning' : 'success'),
          metric('最近交易', record.lastTransactionTimestamp),
        ]),
      };
    case 'get_campus_card_transactions': {
      const transactions = asArray(record.transactions);
      return {
        resultTitle: '校园卡流水工具返回',
        resultSummary: `${record.start ?? ''} 至 ${record.end ?? ''} · ${transactions.length} 条`.trim(),
        resultMetrics: compactMetrics([
          metric('条数', record.count ?? transactions.length),
        ]),
        resultItems: transactions.slice(0, 4).map(item => {
          const row = asRecord(item);
          if (!row) {
            return compactText(item);
          }
          return [
            compactText(row.timestamp, 22),
            compactText(row.merchant ?? row.summary ?? row.txName, 24),
            row.amount != null ? formatMoney(row.amount) : undefined,
          ]
            .filter(Boolean)
            .join(' · ');
        }).filter((item): item is string => Boolean(item)),
      };
    }
    case 'get_network_balance':
      return {
        resultTitle: '校园网工具返回',
        resultSummary: textOf(record, 'productName') ?? detail,
        resultMetrics: compactMetrics([
          metric('余额', formatMoney(record.accountBalance), Number(record.accountBalance) < 10 ? 'warning' : 'success'),
          metric('流量', record.usedBytes),
          metric('结算日', record.settlementDate),
        ]),
      };
    case 'find_available_seats': {
      const seats = asArray(record.seats);
      return {
        resultTitle: '座位工具返回',
        resultSummary: `找到 ${record.availableCount ?? seats.length} 个可预约座位`,
        resultMetrics: compactMetrics([
          metric('可用座位', record.availableCount ?? seats.length, seats.length > 0 ? 'success' : 'warning'),
        ]),
        resultItems: previewSeatItems(seats),
        resultFootnote: '座位号与 seatId 来自工具返回，预约时不会凭空猜测。',
      };
    }
    case 'list_library_booking_records': {
      const records = asArray(record.records);
      return {
        resultTitle: '图书馆预约工具返回',
        resultSummary: `当前有 ${record.count ?? records.length} 条预约记录`,
        resultMetrics: compactMetrics([
          metric('预约数', record.count ?? records.length),
        ]),
        resultItems: records.slice(0, 4).map(labelForRecord).filter((item): item is string => Boolean(item)),
      };
    }
    case 'search_mail_messages': {
      const messages = asArray(record.messages);
      const folder = asRecord(record.folder);
      return {
        resultTitle: '邮件工具返回',
        resultSummary: `${textOf(folder ?? {}, 'name') ?? '邮箱'} · 共 ${record.total ?? messages.length} 封`,
        resultMetrics: compactMetrics([
          metric('返回', messages.length),
          metric('总数', record.total),
          metric('未读', messages.filter(item => asRecord(item)?.unread === true).length),
        ]),
        resultItems: previewMailItems(messages),
      };
    }
    case 'read_mail_message': {
      const attachments = asArray(record.attachments);
      return {
        resultTitle: '邮件详情工具返回',
        resultSummary: [
          textOf(record, 'subject'),
          textOf(record, 'from'),
          textOf(record, 'date'),
        ]
          .filter(Boolean)
          .join(' · '),
        resultMetrics: compactMetrics([
          metric('附件', attachments.length),
          metric('正文', record.text ? '已读取' : '空'),
        ]),
        resultItems: attachments
          .slice(0, 3)
          .map(item => {
            const row = asRecord(item);
            return row
              ? [compactText(row.name, 42), compactText(row.size, 16)]
                  .filter(Boolean)
                  .join(' · ')
              : compactText(item);
          })
          .filter((item): item is string => Boolean(item)),
      };
    }
    case 'get_news_list':
    case 'search_news': {
      const news = asArray(record.news);
      return {
        resultTitle: '新闻工具返回',
        resultSummary: `共返回 ${record.count ?? news.length} 条新闻动态`,
        resultMetrics: compactMetrics([
          metric('返回', news.length),
          metric(
            '置顶',
            news.filter(item => asRecord(item)?.topped === true).length,
          ),
        ]),
        resultItems: previewNewsItems(news),
      };
    }
    case 'get_news_detail':
      return {
        resultTitle: '新闻详情工具返回',
        resultSummary: [
          textOf(record, 'title'),
          record.truncated ? '摘要已截断' : undefined,
        ]
          .filter(Boolean)
          .join(' · '),
        resultMetrics: compactMetrics([
          metric('正文长度', record.textLength),
          metric('截断', record.truncated ? '是' : '否'),
        ]),
        resultItems: record.summary
          ? [compactText(record.summary, 180)].filter(
              (item): item is string => Boolean(item),
            )
          : undefined,
      };
    default:
      return undefined;
  }
}

function buildToolTracePreview(
  tool: AgentTool,
  status: ActionExecutionStatus,
  detail: string | undefined,
  result: unknown,
  meta?: {
    preview?: ActionPreview;
    confirmation?: ConfirmationStatus;
    verification?: VerificationResult;
  },
): Partial<ToolTrace> {
  const fallbackTitle =
    status === 'success'
      ? '工具返回'
      : status === 'cancelled'
      ? '操作未执行'
      : '工具失败';
  if (!result || typeof result !== 'object') {
    return {
      resultTitle: fallbackTitle,
      resultSummary: detail,
      ...buildWriteActionAftercare(tool, status, detail, meta),
    };
  }

  const record = result as Record<string, unknown>;
  if (record.error) {
    return {
      resultTitle: '错误信息',
      resultSummary: compactText(record.error, 160) ?? detail,
      ...buildWriteActionAftercare(tool, status, detail, meta),
    };
  }

  const domainPreview = domainToolTracePreview(tool, record, detail);
  if (domainPreview) {
    return {
      ...domainPreview,
      ...buildWriteActionAftercare(tool, status, detail, meta),
    };
  }

  const summary =
    compactText(record.message, 140) ??
    compactText(record.summary, 140) ??
    detail;
  const scalarParts: string[] = [];
  for (const key of [
    'count',
    'total',
    'date',
    'weekday',
    'balance',
    'remainder',
    'accountBalance',
    'completedCredit',
    'gpa',
  ]) {
    if (record[key] != null) {
      scalarParts.push(`${key}: ${String(record[key])}`);
    }
  }

  const arrayKey = previewArrayKeys.find(key => Array.isArray(record[key]));
  const arrayValue = arrayKey ? (record[arrayKey] as unknown[]) : undefined;
  const resultItems = arrayValue
    ?.slice(0, 3)
    .map(labelForRecord)
    .filter((item): item is string => Boolean(item));
  if (arrayKey && arrayValue) {
    scalarParts.unshift(`${arrayKey}: ${arrayValue.length} 条`);
  }

  const resultSummary =
    summary ??
    (scalarParts.length > 0 ? scalarParts.slice(0, 3).join(' · ') : undefined);

  return {
    resultTitle: tool.risk === 'read' ? '读取结果' : '执行结果',
    resultSummary,
    resultItems,
    ...buildWriteActionAftercare(tool, status, detail, meta),
  };
}

function buildWriteActionAftercare(
  tool: AgentTool,
  status: ActionExecutionStatus,
  detail?: string,
  meta?: {
    preview?: ActionPreview;
    confirmation?: ConfirmationStatus;
    verification?: VerificationResult;
  },
): Partial<ToolTrace> {
  if (tool.risk === 'read') {
    return {};
  }
  if (status === 'cancelled') {
    return {
      resultTitle: '操作未执行',
      resultSummary: detail ?? '用户取消了该操作。',
      resultFootnote: '没有修改校园资源。',
    };
  }
  const verification = meta?.verification;
  const preview = meta?.preview;
  const verifiedText =
    verification == null
      ? '未执行验证'
      : verification.ok
      ? '通过'
      : '未通过';
  const footnoteParts = [
    `确认状态：${meta?.confirmation ?? 'not_required'}`,
    `执行后验证：${verifiedText}`,
    verification?.message,
    preview?.reversible
      ? '该操作通常可通过对应取消/撤销工具恢复。'
      : preview?.reversible === false
      ? '该操作可能不可直接撤销。'
      : undefined,
  ].filter(Boolean);
  return {
    resultTitle: status === 'success' ? '执行结果' : '执行异常',
    resultMetrics: compactMetrics([
      metric(
        '执行',
        status === 'success' ? '成功' : status === 'error' ? '失败' : '取消',
        status === 'success' ? 'success' : status === 'error' ? 'error' : 'warning',
      ),
      metric(
        '验证',
        verifiedText,
        verification?.ok ? 'success' : verification ? 'error' : 'warning',
      ),
    ]),
    resultFootnote: footnoteParts.join(' · '),
    nextActionLabel:
      status === 'success' && preview?.reversible
        ? '请求 AI 撤销'
        : status === 'success'
        ? '让 AI 复查结果'
        : undefined,
    nextActionPrompt:
      status === 'success' && preview?.reversible
        ? `请尝试撤销刚才的「${tool.title}」操作，并先说明会影响什么。`
        : status === 'success'
        ? `请复查刚才的「${tool.title}」操作结果，并告诉我是否已经生效。`
        : undefined,
  };
}

export function useAIChat() {
  const dispatch = useDispatch<AppDispatch>();
  const {streaming, provider} = useSelector(selectAI);
  const messages = useSelector(selectActiveMessages);
  const activeConversationId = useSelector(selectActiveConversationId);
  const {snapshot} = useSelector(selectLearning);
  const manualDeadlines = useSelector(selectManualDeadlines);
  const auth = useSelector(selectAuth);
  const {aiApiKeyConfigured, locale} = useSelector(selectSettings);
  const [pendingConfirmation, setPendingConfirmation] =
    useState<PendingConfirmation | null>(null);

  const cancelPendingConfirmation = useCallback(() => {
    setPendingConfirmation(current => {
      current?.resolve(false);
      return null;
    });
  }, []);

  const approvePendingConfirmation = useCallback(() => {
    setPendingConfirmation(current => {
      current?.resolve(true);
      return null;
    });
  }, []);

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

      const [memory, weatherSummary] = await Promise.all([
        loadAIMemory(),
        fetchHaidianWeather(locale)
          .then(weather => buildCampusWeatherSummary(weather, locale))
          .catch(() => undefined),
      ]);
      const context = buildAgentContext(snapshot, {
        memorySummary: summarizeMemory(memory),
        studentId: auth.session.studentId,
        demoMode: auth.demoMode,
        manualDeadlines,
        weatherSummary,
      });

      try {
        const apiKey = aiApiKeyConfigured
          ? (await loadAIApiKey(provider.preset)) ?? ''
          : '';

        if (!apiKey) {
          const mock = createMockAgentReply(trimmed, context);
          dispatch(appendToLastAssistant(mock));
        } else {
          await runAgent(
            {...provider, apiKey},
            [...history, userMessage],
            context,
            {
              onAnswer: text => dispatch(appendToLastAssistant(text)),
              onToolStart: (tool: AgentTool, args) => {
                const label = tool.summarize ? tool.summarize(args) : tool.name;
                dispatch(setAgentStatus(label));
                dispatch(
                  pushToolTrace({
                    name: tool.name,
                    title: tool.title,
                    label,
                    risk: tool.risk,
                    permission: tool.permission,
                    status: 'running',
                    retryPrompt:
                      tool.risk === 'read'
                        ? `请重新尝试刚才失败的校园工具：${label}`
                        : undefined,
                  }),
                );
              },
              onToolEnd: (
                tool: AgentTool,
                status: ActionExecutionStatus,
                detail,
                meta,
              ) => {
                dispatch(
                  updateLastToolTrace({
                    status,
                    detail,
                    ...buildToolTracePreview(
                      tool,
                      status,
                      detail,
                      meta?.result,
                      {
                        preview: meta?.preview,
                        confirmation: meta?.confirmation,
                        verification: meta?.verification,
                      },
                    ),
                  }),
                );
                dispatch(setAgentStatus(undefined));
              },
              requestConfirmation: (tool: AgentTool, args, preview) =>
                new Promise<boolean>(resolve => {
                  const prompt = tool.confirmPrompt?.(args, preview);
                  setPendingConfirmation({
                    tool,
                    preview,
                    spec: {
                      title: prompt?.title ?? '确认操作',
                      message: prompt?.message ?? '确认执行该操作？',
                      confirmLabel: prompt?.confirmLabel,
                      cancelLabel: prompt?.cancelLabel,
                      destructive: prompt?.destructive,
                    },
                    resolve,
                  });
                }),
            },
          );
        }
      } catch (error) {
        dispatch(
          setAIError(error instanceof Error ? error.message : 'AI 回复失败'),
        );
        dispatch(
          appendToLastAssistant('\n\n[错误] 请检查 API Key 与网络连接。'),
        );
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
      locale,
      messages,
      manualDeadlines,
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
    pendingConfirmation,
    approvePendingConfirmation,
    cancelPendingConfirmation,
  };
}
