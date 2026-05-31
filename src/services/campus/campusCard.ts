/**
 * 校园卡只读服务 — 参考 thu-info-lib `card.ts` 的接口协议重写。
 *
 * Phase 2 只接入余额与流水；充值、挂失、改密码等高风险动作不在这里暴露。
 */
import {AES, enc, mode, pad} from 'crypto-js';
import {tsinghuaAuthService} from '../auth/tsinghuaAuth';
import {webvpnTransport} from '../webvpn/transport';

const CARD_USER_BY_TOKEN_URL = 'https://card.tsinghua.edu.cn/login/getUserInfoFromToken';
const CARD_INFO_BY_USER_URL = 'https://card.tsinghua.edu.cn/business/getCardUserinfo';
const CARD_TRANSACTION_URL = 'https://card.tsinghua.edu.cn/business/querySelfTradeList';
const CARD_LOGIN_PAYLOAD = 'eea30cbedcaf97c69d28b2d92f22a259/0?/userindex';

export type CampusCardTransactionType = -1 | 1 | 2 | 3;

export interface CampusCardInfo {
  userId: string;
  userName: string;
  departmentName: string;
  balance: number;
  cardId: string;
  cardStatus: string;
  lastTransactionTimestamp?: string;
  maxDailyTransactionAmount?: number;
  maxOneTimeTransactionAmount?: number;
}

export interface CampusCardTransaction {
  id: string;
  summary: string;
  timestamp: string;
  balance: number;
  amount: number;
  address: string;
  name?: string;
  txName: string;
}

const accountBaseInfo = {
  user: '',
  cardId: '',
};

function parseDate(value: unknown): string | undefined {
  if (!value) {
    return undefined;
  }
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? String(value) : d.toISOString();
}

async function cardFetchParsed<T = any>(
  url: string,
  jsonStruct?: Record<string, unknown>,
): Promise<T> {
  const text = await webvpnTransport.fetchText(url, {
    method: jsonStruct === undefined ? 'GET' : 'POST',
    headers:
      jsonStruct === undefined
        ? undefined
        : {'Content-Type': 'application/json'},
    body: jsonStruct === undefined ? undefined : JSON.stringify(jsonStruct),
  });
  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`校园卡接口响应非 JSON: ${text.slice(0, 80)}`);
  }
  if (parsed?.success === true) {
    return parsed.resultData as T;
  }
  if (typeof parsed?.data === 'string' && parsed.data.length > 16) {
    const key = enc.Utf8.parse(parsed.data.substring(0, 16));
    const encrypted = parsed.data.substring(16);
    const decrypted = AES.decrypt(encrypted, key, {
      mode: mode.ECB,
      padding: pad.Pkcs7,
    });
    const decryptedText = enc.Utf8.stringify(decrypted).toString();
    let decoded: any;
    try {
      decoded = JSON.parse(decryptedText);
    } catch {
      throw new Error('校园卡加密响应解密失败');
    }
    if (decoded?.success === true) {
      return decoded.resultData as T;
    }
    throw new Error(decoded?.message ?? '校园卡接口返回失败');
  }
  if (parsed?.resultData !== undefined && parsed?.success === undefined) {
    return parsed.resultData as T;
  }
  throw new Error(parsed?.message ?? '校园卡接口返回失败');
}

async function ensureCampusCardLogin(force = false): Promise<void> {
  if (accountBaseInfo.user && !force) {
    return;
  }
  const creds = await tsinghuaAuthService.hydrateCredentials();
  if (!creds) {
    throw new Error('未登录，无法访问校园卡服务');
  }
  await tsinghuaAuthService.roamCardPolicy(creds, CARD_LOGIN_PAYLOAD);
  const user = await cardFetchParsed<{loginuser?: string}>(CARD_USER_BY_TOKEN_URL);
  const loginuser = String(user.loginuser ?? '');
  if (!loginuser) {
    throw new Error('校园卡登录后未获取到用户标识');
  }
  accountBaseInfo.user = loginuser;
}

async function assureCampusCardSession(): Promise<void> {
  try {
    const user = await cardFetchParsed<{loginuser?: string}>(CARD_USER_BY_TOKEN_URL);
    if (user.loginuser && user.loginuser === accountBaseInfo.user) {
      return;
    }
  } catch {
    // fall through to relogin
  }
  await ensureCampusCardLogin(true);
}

async function withCardRetry<T>(operation: () => Promise<T>): Promise<T> {
  return tsinghuaAuthService.withSessionRecovery(
    async () => {
      await ensureCampusCardLogin();
      await assureCampusCardSession();
      return operation();
    },
    async () => {
      accountBaseInfo.user = '';
      accountBaseInfo.cardId = '';
      await ensureCampusCardLogin(true);
    },
    'campus-card',
  );
}

export async function getCampusCardInfo(): Promise<CampusCardInfo> {
  return withCardRetry(async () => {
    const raw = await cardFetchParsed<any>(CARD_INFO_BY_USER_URL, {
      idserial: accountBaseInfo.user,
    });
    const firstCard = raw?.cardInfos?.[0] ?? {};
    const info: CampusCardInfo = {
      userId: String(raw?.idserial ?? ''),
      userName: String(raw?.username ?? ''),
      departmentName: String(raw?.departname ?? ''),
      balance: Number(raw?.baseAccount?.balance ?? 0) / 100,
      cardId: String(firstCard.cardid ?? ''),
      cardStatus: String(firstCard.accstatus ?? ''),
      lastTransactionTimestamp: parseDate(firstCard.lasttxdate),
      maxDailyTransactionAmount: Number(firstCard.maxconstolamt ?? 0) / 100,
      maxOneTimeTransactionAmount: Number(firstCard.maxconsamt ?? 0) / 100,
    };
    accountBaseInfo.cardId = info.cardId;
    return info;
  });
}

export async function getCampusCardTransactions(input: {
  start: string;
  end: string;
  type?: CampusCardTransactionType;
}): Promise<CampusCardTransaction[]> {
  return withCardRetry(async () => {
    const raw = await cardFetchParsed<{rows?: any[]}>(CARD_TRANSACTION_URL, {
      idserial: accountBaseInfo.user,
      starttime: input.start,
      endtime: input.end,
      tradetype: input.type ?? -1,
      pageSize: 100,
      pageNumber: 0,
    });
    return (raw.rows ?? []).map(item => ({
      id: String(item.id ?? ''),
      summary: String(item.summary ?? ''),
      timestamp: parseDate(item.txdate) ?? '',
      balance: Number(item.balance ?? 0) / 100,
      amount: Number(item.txamt ?? 0) / 100,
      address: String(item.meraddr ?? ''),
      name: item.mername ? String(item.mername) : undefined,
      txName: String(item.txname ?? ''),
    }));
  });
}
