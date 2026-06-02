/**
 * 校园卡服务 — 参考 thu-info-lib `card.ts` 的接口协议重写。
 *
 * 包含：余额/流水查询（只读）+ 支付宝/银行卡充值（写操作）。
 */
import {AES, enc, mode, pad} from 'crypto-js';
import {tsinghuaAuthService} from '../auth/tsinghuaAuth';
import {webvpnTransport} from '../webvpn/transport';

const CARD_USER_BY_TOKEN_URL = 'https://card.tsinghua.edu.cn/login/getUserInfoFromToken';
const CARD_INFO_BY_USER_URL = 'https://card.tsinghua.edu.cn/business/getCardUserinfo';
const CARD_TRANSACTION_URL = 'https://card.tsinghua.edu.cn/business/querySelfTradeList';
const CARD_RECHARGE_PAY_URL = 'https://card.tsinghua.edu.cn/wx/rechard/qrcode';
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

let cardLoginLock: Promise<void> | null = null;

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
  if (Array.from(Object.values(accountBaseInfo)).some(v => v)) {
    accountBaseInfo.user = '';
    accountBaseInfo.cardId = '';
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
  accountBaseInfo.cardId = '';
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
      const snapshot = {...accountBaseInfo};
      const result = await operation();
      // verify login state was not corrupted during concurrent calls
      if (accountBaseInfo.user !== snapshot.user || accountBaseInfo.cardId !== snapshot.cardId) {
        throw new Error('校园卡登录态在请求期间被并发修改');
      }
      return result;
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

// =============================================================
// 校园卡充值 — 对照 thu-info-lib cardRechargeFromWechatAlipay
// =============================================================

export interface CardRechargeResult {
  ok: boolean;
  message: string;
  alipayUrl?: string;
}

/**
 * 支付宝扫码充值。
 * 对照 thu-info-lib `cardRechargeFromWechatAlipay` 的 alipay 分支：
 *   POST CARD_RECHARGE_PAY_URL (`/wx/rechard/qrcode`)
 *   body: {idserial, transamt, paytype:3, txcode:"2493", productdesc, method, tradetype}
 *   response: {success, response: "{bizContent:{webUrl:'...'}}"}
 *   → 解析 webUrl 尾部 payCode → 构建支付宝 Deep Link
 */
export async function rechargeCampusCardAlipay(
  amount: number,
): Promise<CardRechargeResult> {
  return withCardRetry(async () => {
    const raw = await cardFetchParsed<any>(CARD_RECHARGE_PAY_URL, {
      idserial: accountBaseInfo.user,
      transamt: amount,
      paytype: 3,
      txcode: '2493',
      productdesc: '综合服务支付宝扫码充值',
      method: 'trade.pay.qrcode',
      tradetype: 'alipay.qrcode',
    });

    if (raw.success !== true) {
      return {ok: false, message: raw.message ?? '支付宝充值接口返回失败'};
    }

    let parsedResponse: any;
    try {
      parsedResponse =
        typeof raw.response === 'string'
          ? JSON.parse(raw.response)
          : raw.response;
    } catch {
      return {ok: false, message: '支付宝充值响应解析失败'};
    }

    const paymentUrl: string = parsedResponse?.bizContent?.webUrl;
    if (!paymentUrl) {
      return {ok: false, message: '支付宝充值未返回支付 URL'};
    }

    const payCode = paymentUrl.substring(paymentUrl.lastIndexOf('/') + 1);
    const alipayUrl = buildAlipayUrl(payCode);

    return {ok: true, message: '支付宝跳转链接已生成', alipayUrl};
  });
}

export function buildAlipayUrl(payCode: string): string {
  return (
    'alipayqr://platformapi/startapp?saId=10000007&qrcode=https%3A%2F%2Fqr.alipay.com%2F' +
    payCode
  );
}
