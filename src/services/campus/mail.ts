import CookieManager from '@react-native-cookies/cookies';
import {CampusCredentials} from '../../domain/campus';
import {stripHtml} from '../../utils/html';
import {tsinghuaAuthService} from '../auth/tsinghuaAuth';
import {INFO_PORTAL_YYFWID} from '../webvpn/constants';
import {webvpnTransport} from '../webvpn/transport';
import {MAIL_PORTAL_URL} from './campusEndpoints';

const COREMAIL_BASE_URL = 'https://mails.tsinghua.edu.cn';
const COREMAIL_INDEX_URL = `${COREMAIL_BASE_URL}/coremail/XT/index.jsp`;

export type MailFolderId = 1 | 2 | 3 | 4 | 5;

export interface MailFolder {
  id: MailFolderId;
  name: string;
  system: 'inbox' | 'drafts' | 'sent' | 'deleted' | 'junk';
}

export interface MailContact {
  name: string;
  address: string;
}

export interface MailAttachment {
  id?: string;
  name: string;
  size?: number;
  downloadUrl?: string;
}

export interface MailMessageSummary {
  id: string;
  fid: number;
  from: MailContact[];
  to: MailContact[];
  subject: string;
  date: string;
  unread: boolean;
  flagged: boolean;
  hasAttachment: boolean;
  brief: string;
}

export interface MailMessageDetail extends MailMessageSummary {
  cc: MailContact[];
  contentText: string;
  contentHtml: string;
  attachments: MailAttachment[];
}

export interface MailListResult {
  messages: MailMessageSummary[];
  total: number;
}

export interface ComposeDraft {
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  content: string;
}

export const MAIL_FOLDERS: MailFolder[] = [
  {id: 1, name: '收件箱', system: 'inbox'},
  {id: 2, name: '草稿箱', system: 'drafts'},
  {id: 3, name: '已发送', system: 'sent'},
  {id: 4, name: '已删除', system: 'deleted'},
  {id: 5, name: '垃圾邮件', system: 'junk'},
];

interface CoremailSession {
  sid: string;
  baseUrl: string;
  finalUrl: string;
  createdAt: number;
}

let session: CoremailSession | null = null;

class CoremailApiError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'CoremailApiError';
  }
}

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === 'object' ? (value as Record<string, any>) : {};
}

function buildBaseUrl(finalUrl: string): string {
  const idx = finalUrl.indexOf('/coremail/');
  if (idx >= 0) {
    return finalUrl.slice(0, idx);
  }
  const parsed = new URL(finalUrl);
  return parsed.origin;
}

function extractSid(url: string): string {
  const normalized = url.replace(/&amp;/g, '&');
  try {
    const parsed = new URL(normalized);
    return parsed.searchParams.get('sid') ?? '';
  } catch {
    const m =
      /[?&]sid=([^&#"'<>]+)/i.exec(normalized) ??
      /(?:^|[;\s])sid=([^;&#"'<>]+)/i.exec(normalized) ??
      /["']sid["']\s*[:=]\s*["']([^"']+)/i.exec(normalized);
    return m?.[1] ? decodeURIComponent(m[1]) : '';
  }
}

function normalizeMaybeEscapedUrl(value: string): string {
  return value
    .replace(/\\\//g, '/')
    .replace(/&amp;/g, '&')
    .replace(/&#x2F;/gi, '/')
    .replace(/&#47;/g, '/')
    .trim();
}

function extractCoremailUrl(text: string, baseUrl: string): string {
  const normalized = normalizeMaybeEscapedUrl(text);
  const absolute = /https?:\/\/mails\.tsinghua\.edu\.cn\/coremail\/[^"' <>)]+/i.exec(
    normalized,
  );
  if (absolute?.[0]) {
    return absolute[0];
  }
  const relative = /(?:href|src|action|location\.href|url)\s*=\s*["']([^"']*\/coremail\/[^"']+)["']/i.exec(
    normalized,
  );
  if (relative?.[1]) {
    try {
      return new URL(normalizeMaybeEscapedUrl(relative[1]), baseUrl).toString();
    } catch {
      return normalizeMaybeEscapedUrl(relative[1]);
    }
  }
  const bareRelative = /\/coremail\/[^"' <>)]+/i.exec(normalized);
  if (bareRelative?.[0]) {
    try {
      return new URL(bareRelative[0], COREMAIL_BASE_URL).toString();
    } catch {
      return `${COREMAIL_BASE_URL}${bareRelative[0]}`;
    }
  }
  return '';
}

async function fetchLanding(url: string): Promise<{finalUrl: string; text: string}> {
  const response = await webvpnTransport.fetch(url, {
    headers: {Accept: 'text/html,application/xhtml+xml,application/json,*/*'},
    timeoutMs: 20000,
  });
  const finalUrl = response.url || url;
  const text = await response.text();
  return {finalUrl, text};
}

function sessionFromEvidence(
  finalUrl: string,
  text = '',
): Omit<CoremailSession, 'createdAt'> | null {
  const sid = extractSid(finalUrl) || extractSid(text);
  if (!sid) {
    return null;
  }
  const landingCoremailUrl = finalUrl.includes('/coremail/')
    ? finalUrl
    : extractCoremailUrl(text, finalUrl) || `${COREMAIL_INDEX_URL}?sid=${sid}`;
  return {
    sid,
    baseUrl: buildBaseUrl(landingCoremailUrl),
    finalUrl: landingCoremailUrl.includes('sid=')
      ? landingCoremailUrl
      : `${landingCoremailUrl}${
          landingCoremailUrl.includes('?') ? '&' : '?'
        }sid=${encodeURIComponent(sid)}`,
  };
}

async function sidFromCookieJar(): Promise<string> {
  const urls = [
    COREMAIL_BASE_URL,
    `${COREMAIL_BASE_URL}/coremail/`,
    COREMAIL_INDEX_URL,
    MAIL_PORTAL_URL,
  ];
  for (const url of urls) {
    try {
      const cookies = await CookieManager.get(url);
      for (const [name, cookie] of Object.entries(cookies)) {
        const sid = extractSid(`${name}=${cookie.value}`);
        if (sid) {
          return sid;
        }
        if (/sid/i.test(name) && cookie.value) {
          return cookie.value;
        }
      }
    } catch {
      // Try the next cookie scope.
    }
  }
  return '';
}

async function tryResolveFromUrl(
  url: string,
): Promise<Omit<CoremailSession, 'createdAt'> | null> {
  const xhrFinalUrl = await webvpnTransport.syncCookiesViaXhr(url, 20000);
  const xhrSession = sessionFromEvidence(xhrFinalUrl);
  if (xhrSession) {
    return xhrSession;
  }

  try {
    const landing = await fetchLanding(url);
    const landingSession = sessionFromEvidence(landing.finalUrl, landing.text);
    if (landingSession) {
      return landingSession;
    }
    const nextUrl = extractCoremailUrl(landing.text, landing.finalUrl);
    if (nextUrl && nextUrl !== url) {
      const nextFinalUrl = await webvpnTransport.syncCookiesViaXhr(nextUrl, 20000);
      const nextXhrSession = sessionFromEvidence(nextFinalUrl);
      if (nextXhrSession) {
        return nextXhrSession;
      }
      const nextLanding = await fetchLanding(nextUrl);
      return sessionFromEvidence(nextLanding.finalUrl, nextLanding.text);
    }
  } catch {
    // The caller will try the remaining fallbacks and report one clear error.
  }
  return null;
}

async function ensurePortalSession(credentials: CampusCredentials): Promise<void> {
  await tsinghuaAuthService.ensureSubsystemSession(
    credentials,
    'id',
    INFO_PORTAL_YYFWID,
  );
}

export async function ensureCoremailSession(force = false): Promise<CoremailSession> {
  if (session && !force && Date.now() - session.createdAt < 20 * 60 * 1000) {
    return session;
  }

  const credentials = await tsinghuaAuthService.hydrateCredentials();
  if (!credentials) {
    throw new Error('未登录，无法访问清华邮箱');
  }
  await ensurePortalSession(credentials);

  const resolved =
    (await tryResolveFromUrl(MAIL_PORTAL_URL)) ??
    (await tryResolveFromUrl(COREMAIL_INDEX_URL));
  if (resolved) {
    await webvpnTransport.syncCookiesViaXhr(resolved.finalUrl, 20000);
    await CookieManager.flush();
    session = {...resolved, createdAt: Date.now()};
    return session;
  }

  const cookieSid = await sidFromCookieJar();
  if (cookieSid) {
    const finalUrl = `${COREMAIL_INDEX_URL}?sid=${encodeURIComponent(cookieSid)}`;
    await webvpnTransport.syncCookiesViaXhr(finalUrl, 20000);
    await CookieManager.flush();
    session = {
      sid: cookieSid,
      baseUrl: COREMAIL_BASE_URL,
      finalUrl,
      createdAt: Date.now(),
    };
    return session;
  }
  throw new Error('邮箱登录后未获取到 Coremail 会话，请点右上角“浏览器”确认邮箱网页登录一次后重试');
}

function coremailUrl(s: CoremailSession, path: string): string {
  return `${s.baseUrl}/coremail/${path.replace(/^\//, '')}`;
}

function coremailJsonUrl(s: CoremailSession, func: string): string {
  return `${coremailUrl(s, 's/json')}?sid=${encodeURIComponent(
    s.sid,
  )}&func=${encodeURIComponent(func)}`;
}

function coremailRpcUrl(s: CoremailSession, func: string): string {
  return `${coremailUrl(s, 's')}?sid=${encodeURIComponent(
    s.sid,
  )}&func=${encodeURIComponent(func)}`;
}

async function jsonCall<T = any>(
  func: string,
  body: Record<string, unknown>,
  forceSession = false,
): Promise<T> {
  const s = await ensureCoremailSession(forceSession);
  const text = await coremailXhrText(coremailJsonUrl(s, func), {
    headers: {'Content-Type': 'application/json;charset=UTF-8'},
    body: JSON.stringify(body),
  });
  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`邮箱接口响应非 JSON: ${text.slice(0, 100)}`);
  }
  if (parsed?.code === 'FA_INVALID_SESSION' && !forceSession) {
    session = null;
    return jsonCall<T>(func, body, true);
  }
  if (parsed?.code === 'FA_SECURITY' && !forceSession) {
    session = null;
    return jsonCall<T>(func, body, true);
  }
  if (parsed?.result === 'error' || parsed?.code?.startsWith?.('FA_')) {
    throw new CoremailApiError(
      coremailErrorMessage(parsed),
      parsed.code,
    );
  }
  return parsed as T;
}

async function legacyXmlCall<T = any>(
  func: string,
  xml: string,
  forceSession = false,
): Promise<T> {
  const s = await ensureCoremailSession(forceSession);
  const text = await coremailXhrText(coremailRpcUrl(s, func), {
    headers: {'Content-Type': 'application/json;charset=UTF-8'},
    body: JSON.stringify({var: xml}),
  });
  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`邮箱兼容接口响应非 JSON: ${text.slice(0, 100)}`);
  }
  if (parsed?.code === 'FA_INVALID_SESSION' && !forceSession) {
    session = null;
    return legacyXmlCall<T>(func, xml, true);
  }
  if (parsed?.code === 'FA_SECURITY' && !forceSession) {
    session = null;
    return legacyXmlCall<T>(func, xml, true);
  }
  if (parsed?.result === 'error' || parsed?.code?.startsWith?.('FA_')) {
    throw new CoremailApiError(coremailErrorMessage(parsed), parsed.code);
  }
  return parsed as T;
}

async function formCall<T = any>(
  func: string,
  body: Record<string, unknown>,
  forceSession = false,
): Promise<T> {
  const s = await ensureCoremailSession(forceSession);
  const form = Object.entries(body)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
  const text = await coremailXhrText(coremailRpcUrl(s, func), {
    headers: {'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'},
    body: form,
  });
  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`邮箱接口响应非 JSON: ${text.slice(0, 100)}`);
  }
  if (parsed?.code === 'FA_INVALID_SESSION' && !forceSession) {
    session = null;
    return formCall<T>(func, body, true);
  }
  if (parsed?.code === 'FA_SECURITY' && !forceSession) {
    session = null;
    return formCall<T>(func, body, true);
  }
  if (parsed?.result === 'error' || parsed?.code?.startsWith?.('FA_')) {
    throw new CoremailApiError(coremailErrorMessage(parsed), parsed.code);
  }
  return parsed as T;
}

function coremailErrorMessage(parsed: any): string {
  const messages = asArray(parsed?.messages)
    .map(item => asRecord(item).summary)
    .filter(Boolean)
    .join('；');
  if (parsed?.code === 'FA_SECURITY') {
    return `邮箱接口安全校验失败${messages ? `：${messages}` : ''}`;
  }
  return parsed?.errorMsg ?? parsed?.message ?? messages ?? parsed?.code ?? '邮箱接口失败';
}

function coremailXhrText(
  url: string,
  options: {headers?: Record<string, string>; body?: string; timeoutMs?: number},
): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const xhr = new XMLHttpRequest();
      xhr.timeout = options.timeoutMs ?? 25000;
      xhr.onreadystatechange = () => {
        if (xhr.readyState === XMLHttpRequest.DONE) {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(xhr.responseText ?? '');
          } else {
            reject(new Error(`HTTP ${xhr.status} (${url})`));
          }
        }
      };
      xhr.ontimeout = () => reject(new Error('邮箱接口请求超时'));
      xhr.onerror = () => reject(new Error('邮箱接口网络请求失败'));
      xhr.open('POST', url);
      xhr.withCredentials = true;
      xhr.setRequestHeader('Accept', 'text/x-json, application/json, */*');
      xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
      for (const [key, value] of Object.entries(options.headers ?? {})) {
        xhr.setRequestHeader(key, value);
      }
      xhr.send(options.body ?? '');
    } catch (e) {
      reject(e);
    }
  });
}

function pickPayload(parsed: any): any {
  if (parsed?.var !== undefined) {
    return parsed.var;
  }
  if (parsed?.object !== undefined) {
    return parsed.object;
  }
  if (parsed?.data !== undefined) {
    return parsed.data;
  }
  return parsed;
}

function asArray(value: any): any[] {
  if (Array.isArray(value)) {
    return value;
  }
  return [];
}

function coalesce(...values: any[]): any {
  return values.find(value => value !== undefined && value !== null && value !== '');
}

function parseContacts(value: any): MailContact[] {
  const list = Array.isArray(value) ? value : value ? [value] : [];
  return list
    .map(item => {
      if (typeof item === 'string') {
        const m = /(.*)<(.+?)>/.exec(item);
        return {
          name: (m?.[1] ?? '').replace(/["']/g, '').trim(),
          address: (m?.[2] ?? item).trim(),
        };
      }
      const obj = asRecord(item);
      return {
        name: String(obj.name ?? obj.personal ?? obj.nickName ?? obj.trueName ?? ''),
        address: String(obj.email ?? obj.address ?? obj.addr ?? ''),
      };
    })
    .filter(item => item.name || item.address);
}

function parseMessage(raw: any): MailMessageSummary {
  const item = asRecord(raw);
  const attr = asRecord(item.attr ?? item.attrs ?? item.attributes);
  const envelope = asRecord(item.envelope ?? item.mail ?? item.message);
  const flags = asRecord(item.flags);
  const id = String(
    coalesce(
      item.id,
      item.mid,
      item.uid,
      item.msgid,
      item.mailId,
      item.messageId,
      item.midList?.[0],
      item.messages?.[0]?.id,
      item.messages?.[0]?.mid,
      attr.id,
      attr.mid,
      envelope.id,
      envelope.mid,
    ) ?? '',
  );
  const subject =
    String(coalesce(item.subject, attr.subject, envelope.subject) ?? '').trim() ||
    '(无主题)';
  const content = String(
    coalesce(
      item.summary,
      item.brief,
      item.content,
      item.abstract,
      attr.summary,
      envelope.summary,
      envelope.brief,
    ) ?? '',
  );
  const attachments = asArray(
    coalesce(item.attachments, item.attachInfos, attr.attachments, envelope.attachments),
  );
  return {
    id,
    fid: Number(coalesce(item.fid, attr.fid, envelope.fid) ?? 0),
    from: parseContacts(
      coalesce(item.from, item.sender, attr.from, attr.sender, envelope.from),
    ),
    to: parseContacts(coalesce(item.to, attr.to, envelope.to)),
    subject,
    date: String(
      coalesce(
        item.date,
        item.sentDate,
        item.receivedDate,
        item.lastModifiedDate,
        item.firstDate,
        item.lastDate,
        item.time,
        item.createTime,
        attr.date,
        attr.sentDate,
        attr.receivedDate,
        envelope.date,
        envelope.receivedDate,
      ) ?? '',
    ),
    unread:
      flags.read === false ||
      item.read === false ||
      attr.read === false ||
      item.isRead === false,
    flagged: Boolean(flags.flagged ?? item.flagged ?? item.label0),
    hasAttachment: Boolean(
      coalesce(
        item.attached,
        item.hasAttachment,
        item.attach,
        attr.attached,
        attr.hasAttachment,
        envelope.hasAttachment,
      ) ?? attachments.length,
    ),
    brief: stripHtml(content),
  };
}

function looksLikeMessage(value: any): boolean {
  const item = asRecord(value);
  const attr = asRecord(item.attr ?? item.attrs ?? item.attributes);
  return Boolean(
    coalesce(
      item.id,
      item.mid,
      item.uid,
      item.msgid,
      item.mailId,
      item.messageId,
      item.midList?.[0],
      item.messages?.[0]?.id,
      item.messages?.[0]?.mid,
      attr.id,
      attr.mid,
    ) ||
      coalesce(item.subject, attr.subject) ||
      coalesce(item.from, item.sender, attr.from, attr.sender),
  );
}

function findMessageArrays(value: any, depth = 0): any[][] {
  if (depth > 6 || value === null || value === undefined) {
    return [];
  }
  if (Array.isArray(value)) {
    const objectItems = value.filter(item => item && typeof item === 'object');
    const current =
      objectItems.length > 0 && objectItems.some(looksLikeMessage)
        ? [objectItems]
        : [];
    return current.concat(
      value.flatMap(item => findMessageArrays(item, depth + 1)),
    );
  }
  if (typeof value === 'object') {
    return Object.values(value).flatMap(item => findMessageArrays(item, depth + 1));
  }
  return [];
}

function firstNumberFromKeys(value: any): number | undefined {
  const keys = [
    'total',
    'totalCount',
    'count',
    'messageCount',
    'msgCount',
    'allCount',
  ];
  const obj = asRecord(value);
  for (const key of keys) {
    const raw = obj[key];
    if (raw !== undefined && raw !== null && raw !== '') {
      const n = Number(raw);
      if (!Number.isNaN(n)) {
        return n;
      }
    }
  }
  return undefined;
}

function findTotal(value: any, depth = 0): number | undefined {
  if (depth > 5 || value === null || value === undefined) {
    return undefined;
  }
  if (typeof value !== 'object') {
    return undefined;
  }
  const direct = firstNumberFromKeys(value);
  if (direct !== undefined) {
    return direct;
  }
  for (const child of Object.values(value)) {
    const nested = findTotal(child, depth + 1);
    if (nested !== undefined) {
      return nested;
    }
  }
  return undefined;
}

function unwrapMessageList(parsed: any): {messages: any[]; total: number} {
  const payload = pickPayload(parsed);
  if (Array.isArray(payload)) {
    const messages = payload.find(item => Array.isArray(item)) ?? [];
    const total = Number(payload.find(item => typeof item === 'number') ?? messages.length);
    return {messages, total};
  }
  const obj = asRecord(payload);
  const messages =
    asArray(obj.messages).length > 0
      ? asArray(obj.messages)
      : asArray(obj.list).length > 0
      ? asArray(obj.list)
      : asArray(obj.msgs).length > 0
      ? asArray(obj.msgs)
      : asArray(obj.mails).length > 0
      ? asArray(obj.mails)
      : asArray(obj.items).length > 0
      ? asArray(obj.items)
      : asArray(obj.rows).length > 0
      ? asArray(obj.rows)
      : findMessageArrays(payload).sort((a, b) => b.length - a.length)[0] ?? [];
  return {messages, total: findTotal(payload) ?? messages.length};
}

function listMessagesXml(fid: MailFolderId, start: number, limit: number): string {
  return `<?xml version="1.0"?><object><int name="fid">${fid}</int><string name="order">date</string><boolean name="desc">true</boolean><int name="limit">${limit}</int><int name="start">${start}</int><boolean name="skipLockedFolders">false</boolean><boolean name="returnTag">true</boolean><boolean name="returnTotal">true</boolean><int name="summaryWindowSize">${limit}</int><string name="mboxa"></string><boolean name="topFirst">true</boolean></object>`;
}

type MailListFunc = 'mbox:listThreads' | 'mbox:listMessages';

function listRequestBody(fid: MailFolderId, start: number, limit: number, order: string) {
  return {
    start,
    limit,
    mode: 'count',
    order,
    desc: true,
    returnTotal: true,
    returnTag: true,
    summaryWindowSize: limit,
    fid,
    mboxa: '',
    topFirst: true,
  };
}

async function listViaJson(
  func: MailListFunc,
  fid: MailFolderId,
  start: number,
  limit: number,
  order: string,
): Promise<{messages: any[]; total: number}> {
  const parsed = await jsonCall(func, listRequestBody(fid, start, limit, order));
  return unwrapMessageList(parsed);
}

export async function listMailMessages(
  fid: MailFolderId,
  start = 0,
  limit = 30,
): Promise<MailListResult> {
  let messages: any[] = [];
  let total = 0;
  const attempts: Array<[MailListFunc, string]> = [
    ['mbox:listThreads', 'date'],
    ['mbox:listThreads', 'receivedDate'],
    ['mbox:listMessages', 'date'],
    ['mbox:listMessages', 'receivedDate'],
  ];

  for (const [func, order] of attempts) {
    try {
      const result = await listViaJson(func, fid, start, limit, order);
      if (result.messages.length > 0 || result.total > 0) {
        messages = result.messages;
        total = result.total;
        break;
      }
    } catch {
      // Try the next Coremail list mode. The web UI may switch between
      // threaded and flat message lists depending on account settings.
    }
  }

  if (messages.length === 0 && total === 0) {
    try {
      const legacy = await legacyXmlCall(
        'mbox:listMessages',
        listMessagesXml(fid, start, limit),
      );
      const fallback = unwrapMessageList(legacy);
      messages = fallback.messages;
      total = fallback.total;
    } catch {
      // Keep the empty result; the UI can still offer refresh/retry.
    }
  }
  const parsedMessages = messages.map(parseMessage).filter(m => m.id);
  if (total > 0 && parsedMessages.length === 0) {
    throw new Error(
      `邮箱列表已返回 ${total} 封邮件，但当前版本无法解析邮件结构，请反馈后继续适配`,
    );
  }
  return {messages: parsedMessages, total: total || parsedMessages.length};
}

export async function searchMailMessages(
  pattern: string,
  start = 0,
  limit = 30,
): Promise<MailListResult> {
  let messages: any[] = [];
  let total = 0;
  try {
    const body = {
      start,
      limit,
      pattern,
      order: 'date',
      desc: true,
      returnTotal: true,
      summaryWindowSize: limit,
      mboxa: '',
    };
    let parsed: any;
    try {
      parsed = await formCall('!mail:searchMessages', body);
    } catch {
      parsed = await formCall('mail:searchMessages', body);
    }
    const result = unwrapMessageList(parsed);
    messages = result.messages;
    total = result.total;
  } catch {
    const parsed = await jsonCall('mail:searchMessages', {
      start,
      limit,
      pattern,
      summaryWindowSize: limit,
      mboxa: '',
    });
    const result = unwrapMessageList(parsed);
    messages = result.messages;
    total = result.total;
  }
  return {messages: messages.map(parseMessage).filter(m => m.id), total};
}

export async function readMailMessage(
  id: string,
  mboxa = '',
): Promise<MailMessageDetail> {
  let parsed: any;
  try {
    parsed = await formCall('!readMessage', {mid: id, mboxa});
  } catch {
    parsed = await formCall('readMessage', {mid: id, mboxa});
  }
  const s = await ensureCoremailSession();
  const payload = asRecord(pickPayload(parsed));
  const mail = asRecord(payload.mail ?? payload.message ?? payload);
  const info = asRecord(payload.mailInfo ?? payload.info);
  const summary = parseMessage({...mail, ...info, id});
  const attachments = asArray(mail.attachments ?? info.attachments).map(att => {
    const item = asRecord(att);
    const aid = String(item.id ?? item.attachId ?? '');
    const part = String(item.part ?? '');
    const downloadUrl =
      item.url ??
      (part
        ? `${coremailUrl(s, 's')}?sid=${encodeURIComponent(
            s.sid,
          )}&func=${encodeURIComponent('mbox:getMessageData')}&mid=${encodeURIComponent(
            id,
          )}&part=${encodeURIComponent(part)}&mode=download`
        : '');
    return {
      id: aid,
      name: String(item.name ?? item.fileName ?? item.displayName ?? '附件'),
      size: Number(item.size ?? 0) || undefined,
      downloadUrl: String(downloadUrl),
    };
  });
  const contentHtml = String(mail.content ?? mail.html ?? mail.text ?? '');
  return {
    ...summary,
    cc: parseContacts(mail.cc ?? info.cc),
    contentHtml,
    contentText: stripHtml(contentHtml),
    attachments,
  };
}

export async function markMailRead(ids: string[], read: boolean): Promise<void> {
  if (ids.length === 0) {
    return;
  }
  await jsonCall('mbox:updateMessageInfos', {
    ids,
    attrs: {flags: {read}},
    returnOriginalMsgInfos: true,
  });
}

export async function deleteMailMessages(ids: string[]): Promise<void> {
  if (ids.length === 0) {
    return;
  }
  await jsonCall('mbox:deleteMessages', {ids});
}

export async function moveMailMessages(ids: string[], fid: MailFolderId): Promise<void> {
  if (ids.length === 0) {
    return;
  }
  await jsonCall('mbox:updateMessageInfos', {
    ids,
    attrs: {fid},
    returnOriginalMsgInfos: true,
  });
}

export async function sendMail(draft: ComposeDraft): Promise<void> {
  let composeInit: any;
  try {
    composeInit = await formCall('!compose', {ctype: 'normal'});
  } catch {
    composeInit = await formCall('compose', {ctype: 'normal'});
  }
  const composePayload = pickPayload(composeInit);
  const composeId = String(
    coalesce(
      asRecord(composePayload).id,
      asRecord(composePayload).composeId,
      asRecord(asRecord(composePayload).compose).id,
      asRecord(asRecord(composePayload).data).id,
    ) ?? '',
  );
  if (!composeId) {
    throw new Error('邮箱写信草稿初始化失败，请稍后重试');
  }
  const attrs = {
    to: draft.to,
    cc: draft.cc ?? '',
    bcc: draft.bcc ?? '',
    subject: draft.subject,
    content: draft.content.replace(/\n/g, '<br>'),
  };
  await jsonCall('mbox:compose', {
    id: composeId,
    attrs,
    returnInfo: true,
    action: 'deliver',
    autosaveHitCounter: true,
  });
}
