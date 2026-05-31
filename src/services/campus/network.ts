/**
 * 校园网服务 — 按 thu-info-lib `network.ts` 行为重写。
 *
 * 这里先接入 Phase 2/3 需要的低风险能力：
 * - 余额 / 账号信息 / 在线设备为只读。
 * - 注销在线设备为确认后写操作。
 */
import {JSEncrypt} from 'jsencrypt';
import {HTMLElement} from 'node-html-parser';
import {tsinghuaAuthService} from '../auth/tsinghuaAuth';
import {webvpnTransport} from '../webvpn/transport';
import {loadHtml, nodeText} from './htmlSelect';

const NETWORK_TOKEN =
  '77726476706e69737468656265737421e5e4448e223726446d0187ab9040227b54b6c80fcd73';
const WEBVPN_BASE = 'https://webvpn.tsinghua.edu.cn';

const NETWORK_LOGIN_URL = `${WEBVPN_BASE}/https/${NETWORK_TOKEN}/login`;
const NETWORK_VERIFICATION_CODE_URL = `${WEBVPN_BASE}/https/${NETWORK_TOKEN}/site/captcha`;
const NETWORK_VALIDATE_USER_URL = `${WEBVPN_BASE}/https/${NETWORK_TOKEN}/site/validate-user`;
const NETWORK_HOME_URL = `${WEBVPN_BASE}/https/${NETWORK_TOKEN}/home`;
const NETWORK_HOME_DELETE_URL = `${WEBVPN_BASE}/https/${NETWORK_TOKEN}/home/delete?id={id}&user_mac={mac}`;
const NETWORK_USER_INFO_URL = `${WEBVPN_BASE}/https/${NETWORK_TOKEN}/users`;
const NETWORK_ALLOWED_DEVICES_URL = `${WEBVPN_BASE}/https/${NETWORK_TOKEN}/user/online-num`;
const USER_INFO_YYFWID = 'F315577F5BF20E1B1668EDD594B2C04F';

const WEBVPN_TITLE = '<title>清华大学WebVPN</title>';

export interface NetworkDevice {
  key: number;
  ip4: string;
  ip6: string;
  loggedAt: string;
  mac: string;
  authPermission: string;
}

export interface NetworkBalance {
  productName: string;
  usedBytes: string;
  usedSeconds: string;
  accountBalance: string;
  settlementDate: string;
}

export interface NetworkAccountInfo {
  username: string;
  contactEmail: string;
  contactPhone: string;
  contactLandline: string;
  realName: string;
  status: string;
  userGroup: string;
  location: string;
  allowedDevices: number;
}

export interface NetworkSnapshot {
  balance: NetworkBalance;
  account: NetworkAccountInfo;
  devices: NetworkDevice[];
}

export class NetworkCaptchaRequiredError extends Error {
  readonly code = 'NETWORK_CAPTCHA_REQUIRED';

  constructor() {
    super('校园网需要验证码登录');
    this.name = 'NetworkCaptchaRequiredError';
  }
}

export function isNetworkCaptchaRequiredError(
  error: unknown,
): error is NetworkCaptchaRequiredError {
  return (
    error instanceof NetworkCaptchaRequiredError ||
    (typeof error === 'object' &&
      error !== null &&
      (error as {code?: string}).code === 'NETWORK_CAPTCHA_REQUIRED')
  );
}

function elementText(element: HTMLElement | undefined): string {
  return element?.text.replace(/\s+/g, ' ').trim() ?? '';
}

async function ensureNetworkLoggedIn(): Promise<void> {
  const html = await webvpnTransport.fetchText(NETWORK_LOGIN_URL);
  if (html.includes(WEBVPN_TITLE)) {
    throw new Error('校园网 WebVPN 会话失效，请重新登录后再试');
  }
  if (html.includes('loginform-verifycode')) {
    throw new NetworkCaptchaRequiredError();
  }
}

async function withNetworkRetry<T>(operation: () => Promise<T>): Promise<T> {
  const run = async () => {
    await ensureNetworkLoggedIn();
    return operation();
  };
  try {
    return await run();
  } catch (e) {
    if (isNetworkCaptchaRequiredError(e)) {
      throw e;
    }
    return tsinghuaAuthService.withSessionRecovery(run, undefined, 'network');
  }
}

function readBlobAsBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result === 'string') {
        resolve(result.split(',')[1] ?? '');
      } else {
        reject(new Error('验证码读取失败'));
      }
    };
    reader.onerror = () => reject(reader.error ?? new Error('验证码读取失败'));
    reader.readAsDataURL(blob);
  });
}

async function getNetworkEmailName(): Promise<string> {
  const infoHtml = await tsinghuaAuthService.roamDefault(USER_INFO_YYFWID);
  const emailName =
    /'addr':'(.+?)@mails\.tsinghua\.edu\.cn'/g.exec(infoHtml)?.[1] ?? '';
  if (!emailName) {
    throw new Error('无法获取校园网账号名，请稍后重试');
  }
  return emailName;
}

export async function fetchNetworkCaptchaBase64(): Promise<string> {
  await webvpnTransport.fetch(`${NETWORK_VERIFICATION_CODE_URL}?refresh=1`, {
    timeoutMs: 20000,
  });
  const response = await webvpnTransport.fetch(
    `${NETWORK_VERIFICATION_CODE_URL}?_=${Date.now()}`,
    {timeoutMs: 20000},
  );
  const blob = await response.blob();
  return readBlobAsBase64(blob);
}

export async function loginNetworkWithCaptcha(code: string): Promise<void> {
  const captcha = code.trim();
  if (!captcha) {
    throw new Error('请输入验证码');
  }

  const credentials = await tsinghuaAuthService.hydrateCredentials();
  if (!credentials) {
    throw new Error('未登录，无法访问校园网服务');
  }

  const loginHtml = await webvpnTransport.fetchText(NETWORK_LOGIN_URL);
  if (loginHtml.includes(WEBVPN_TITLE)) {
    throw new Error('校园网 WebVPN 会话失效，请重新登录后再试');
  }

  const $ = loadHtml(loginHtml);
  const csrfToken = String($('meta[name=csrf-token]').attr('content') ?? '');
  const csrfInput = String($('input[name=_csrf-8800]').attr('value') ?? '');
  const publicKey = String($('#public').attr('value') ?? '');
  if (!csrfToken || !csrfInput || !publicKey) {
    throw new Error('校园网登录页缺少必要参数，请刷新后重试');
  }

  const rsa = new JSEncrypt();
  rsa.setPublicKey(publicKey);
  const encryptedPassword = rsa.encrypt(credentials.password);
  if (!encryptedPassword) {
    throw new Error('校园网密码加密失败，请重试');
  }

  const username = await getNetworkEmailName();
  const loginForm = {
    'LoginForm[username]': username,
    'LoginForm[password]': encryptedPassword,
    'LoginForm[verifyCode]': captcha,
  };

  const validateText = await webvpnTransport.fetchText(NETWORK_VALIDATE_USER_URL, {
    method: 'POST',
    headers: {
      'X-CSRF-Token': csrfToken,
      'X-Requested-With': 'XMLHttpRequest',
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    },
    body: loginForm,
  });
  let validateResult: {success?: boolean; message?: string};
  try {
    validateResult = JSON.parse(validateText);
  } catch {
    throw new Error('校园网登录校验响应异常，请重试');
  }
  if (validateResult.success !== true) {
    throw new Error(validateResult.message || '校园网验证码登录失败');
  }

  await webvpnTransport.fetchText(NETWORK_LOGIN_URL, {
    method: 'POST',
    body: {
      '_csrf-8800': csrfInput,
      ...loginForm,
      'LoginForm[smsCode]': '',
    },
  });
  await ensureNetworkLoggedIn();
}

async function readOnlineNetworkDevices(): Promise<NetworkDevice[]> {
  const html = await webvpnTransport.fetchText(NETWORK_HOME_URL);
  const $ = loadHtml(html);
  return $('#w1-container table tbody tr')
    .toArray()
    .map(row => {
      const cells = row.querySelectorAll('td');
      return {
        key: Number(row.getAttribute('data-key') ?? 0),
        ip4: elementText(cells[0]),
        ip6: elementText(cells[1]),
        loggedAt: elementText(cells[2]),
        authPermission: elementText(cells[3]),
        mac: elementText(cells[4]),
      };
    })
    .filter(device => device.key > 0);
}

async function readNetworkBalance(): Promise<NetworkBalance> {
  const html = await webvpnTransport.fetchText(NETWORK_HOME_URL);
  const $ = loadHtml(html);
  const cells = $('#w3-container table tbody tr').find('td').toArray();
  if (cells.length < 5) {
    throw new Error('校园网余额页面结构异常，请刷新后重试');
  }
  return {
    productName: elementText(cells[0]),
    usedBytes: elementText(cells[1]),
    usedSeconds: elementText(cells[2]),
    accountBalance: elementText(cells[3]),
    settlementDate: elementText(cells[4]),
  };
}

async function readNetworkAccountInfo(): Promise<NetworkAccountInfo> {
  const homeHtml = await webvpnTransport.fetchText(NETWORK_HOME_URL);
  const home = loadHtml(homeHtml);
  const statusIcon = home('.glyphicon-info-sign').toArray()[0];
  const status =
    nodeText(statusIcon?.parentNode as HTMLElement | undefined)
      .replace(/\s+/g, ' ')
      .trim() || '';

  const usersHtml = await webvpnTransport.fetchText(NETWORK_USER_INFO_URL);
  const users = loadHtml(usersHtml)('#w0 td').toArray();

  const devicesHtml = await webvpnTransport.fetchText(NETWORK_ALLOWED_DEVICES_URL);
  const devices = loadHtml(devicesHtml);
  const allowedText =
    nodeText(
      devices('.glyphicon-exclamation-sign').toArray()[0]?.parentNode as
        | HTMLElement
        | undefined,
    ) || '';
  const allowedDevices = Number(/(\d+)/.exec(allowedText)?.[1] ?? 0);

  return {
    username: elementText(users[0]),
    contactEmail: elementText(users[1]),
    contactPhone: elementText(users[2]),
    location: elementText(users[3]),
    contactLandline: elementText(users[5]),
    realName: elementText(users[6]),
    userGroup: elementText(users[7]),
    status,
    allowedDevices,
  };
}

export async function getNetworkSnapshot(): Promise<NetworkSnapshot> {
  return withNetworkRetry(async () => {
    const [balance, account, devices] = await Promise.all([
      readNetworkBalance(),
      readNetworkAccountInfo(),
      readOnlineNetworkDevices(),
    ]);
    return {balance, account, devices};
  });
}

export async function getOnlineNetworkDevices(): Promise<NetworkDevice[]> {
  return withNetworkRetry(readOnlineNetworkDevices);
}

export async function getNetworkBalance(): Promise<NetworkBalance> {
  return withNetworkRetry(readNetworkBalance);
}

export async function getNetworkAccountInfo(): Promise<NetworkAccountInfo> {
  return withNetworkRetry(readNetworkAccountInfo);
}

export async function logoutNetworkDevice(input: {
  key: number;
  mac: string;
}): Promise<{ok: boolean; message: string}> {
  return withNetworkRetry(async () => {
    const homeHtml = await webvpnTransport.fetchText(NETWORK_HOME_URL);
    const rawCsrf = loadHtml(homeHtml)('input[name=_csrf-8800]').attr('value');
    const csrf = typeof rawCsrf === 'string' ? rawCsrf : '';
    if (!csrf) {
      throw new Error('校园网注销缺少 CSRF Token');
    }

    const url = NETWORK_HOME_DELETE_URL.replace(
      '{id}',
      encodeURIComponent(String(input.key)),
    ).replace('{mac}', encodeURIComponent(input.mac));
    const html = await webvpnTransport.fetchText(url, {
      body: {'_csrf-8800': csrf},
    });
    if (html.includes('w5-success-0')) {
      return {ok: true, message: '设备已注销'};
    }
    const $ = loadHtml(html);
    const error = $('#w5-danger-0').text().replace(/\s+/g, ' ').trim();
    return {ok: false, message: error || '设备注销失败'};
  });
}
