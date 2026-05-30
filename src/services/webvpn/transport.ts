import CookieManager from '@react-native-cookies/cookies';
import {USER_AGENT, WEBVPN_ROOT_URL} from './constants';
import {parseUrlToWebVPN} from './parseUrl';

const WEBVPN_BASE = WEBVPN_ROOT_URL;
const COOKIE_SYNC_URL = `${WEBVPN_BASE}/wengine-vpn/cookie?method=get&host=info.tsinghua.edu.cn&scheme=https&path=/f/info/gxfw_fg/common/index`;
const INFO_TOKEN = '77726476706e69737468656265737421f9f9479369247b59700f81b9991b2631506205de';
const ROAMING_URL = `${WEBVPN_BASE}/https/${INFO_TOKEN}/b/yyfw/vyyfwxx/info/portal_fg/common/onlineAppRedirect`;

/**
 * 直连 HTTP 传输层（无 webvpn 包装）。
 * 与 thu-learn-lib 行为对齐：
 * - 不手动管理 Cookie 头（依赖 OkHttp 原生 CookieJar）
 * - 默认 fetch follow 重定向
 * - 支持 url-encoded 与 multipart/form-data 两种 body
 */

export interface FetchOptions {
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  /**
   * body 形式：
   * - string：当作已编码的 url-encoded 字符串
   * - Record：自动编码为 url-encoded
   * - FormData：当作 multipart/form-data（fetch 自动添加 boundary）
   */
  body?: string | Record<string, string> | FormData;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 60000;

function stringifyForm(form: Record<string, string>): string {
  return Object.entries(form)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {...init, signal: controller.signal});
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`请求超时（${Math.round(timeoutMs / 1000)}s）`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function isFormData(value: unknown): value is FormData {
  return typeof FormData !== 'undefined' && value instanceof FormData;
}

/**
 * 这些 webvpn token 对应的清华子系统后端默认 GBK 编码。
 * 命中其中之一时即便响应头没声明 charset 也按 GBK 解码。
 */
const GBK_WEBVPN_TOKENS = [
  // zhjw.cic.tsinghua.edu.cn — 教务系统（成绩 / 教室 / 培养方案 / 学籍）
  'eaff4b8b69336153301c9aa596522b20bc86e6e559a9b290',
  // yhdf — 电费充值
  'fdee49932a3526446d0187ab9040227bca90a6e14cc9',
  // cr_xk — 选课系统
  'eaff4b8b3f3b2653770bc7b88b5c2d320506b1aec738590a49ba',
  // gymbook — 体育场馆预约
  'a5a70f8834396657761d88e29d51367b6a00',
];

function inferResponseCharset(url: string, contentType: string): string {
  // 1) 响应头里写明 charset
  const m = /charset=([^;\s'"]+)/i.exec(contentType);
  if (m && m[1]) {
    const cs = m[1].toLowerCase().replace(/['"]/g, '');
    if (cs && cs !== 'utf-8' && cs !== 'utf8') {
      return cs;
    }
    if (cs === 'utf-8' || cs === 'utf8') {
      return 'utf-8';
    }
  }
  // 2) URL 命中 GBK 子系统（webvpn token 或直连 zhjw 教务系统）
  if (GBK_WEBVPN_TOKENS.some(t => url.includes(t))) {
    return 'gbk';
  }
  // 直连教务系统 zhjw.cic.tsinghua.edu.cn（课表 jxmh_out.do 等）默认 GBK
  if (url.includes('zhjw.cic.tsinghua.edu.cn')) {
    return 'gbk';
  }
  return 'utf-8';
}

/**
 * 通过 FileReader 把 blob 按指定编码解码为 string。
 * RN-Android 的 BlobModule readAsText 底层调 Java `new String(bytes, charset)`，
 * 支持 GBK / GB2312 / Big5 等 JDK 已知字符集。
 */
function readBlobAsText(blob: Blob, charset: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else if (reader.result === null) {
        resolve('');
      } else {
        reject(new Error('FileReader 返回非字符串'));
      }
    };
    reader.onerror = () => reject(reader.error ?? new Error('FileReader 解码失败'));
    try {
      reader.readAsText(blob, charset);
    } catch (e) {
      reject(e);
    }
  });
}

export class WebVPNTransport {
  async clearCookies(): Promise<void> {
    await CookieManager.clearAll();
  }

  async clearIdCookies(): Promise<void> {
    // 与 thu-learn-lib 行为一致：登录前清掉 id 域 JSESSIONID，避免 session 复用
    try {
      await CookieManager.setFromResponse(
        'https://id.tsinghua.edu.cn',
        'JSESSIONID=; path=/; HttpOnly',
      );
      await CookieManager.flush();
    } catch {
      // ignore
    }
  }

  /**
   * 关键修复：手动从 system CookieManager 取 cookies 拼到 Cookie header。
   * 因为 RN 0.76 + react-native-cookies 6.2.1 的 OkHttp cookie jar 桥接在某些情况下
   * 不会自动把 cookies 加到出站请求头（特别是跨域 redirect 后的请求）。
   */
  private async buildCookieHeader(url: string): Promise<string> {
    try {
      const cookies = await CookieManager.get(url);
      return Object.entries(cookies)
        .map(([k, v]) => `${k}=${v.value}`)
        .join('; ');
    } catch {
      return '';
    }
  }

  async fetch(url: string, options: FetchOptions = {}): Promise<Response> {
    const headers: Record<string, string> = {
      'User-Agent': USER_AGENT,
      ...options.headers,
    };

    // 手动注入 cookies（OkHttp 桥接不可靠的兜底）
    if (!headers.Cookie && !headers.cookie) {
      const cookieHeader = await this.buildCookieHeader(url);
      if (cookieHeader) {
        headers.Cookie = cookieHeader;
      }
    }

    let body: string | FormData | undefined;
    let method: 'GET' | 'POST' = options.method ?? 'GET';

    if (options.body !== undefined) {
      method = options.method ?? 'POST';
      if (typeof options.body === 'string') {
        body = options.body;
        if (!headers['Content-Type']) {
          headers['Content-Type'] = 'application/x-www-form-urlencoded';
        }
      } else if (isFormData(options.body)) {
        // 让 fetch 自动设置 multipart/form-data; boundary=...
        body = options.body;
      } else {
        body = stringifyForm(options.body);
        if (!headers['Content-Type']) {
          headers['Content-Type'] = 'application/x-www-form-urlencoded';
        }
      }
    }

    const response = await fetchWithTimeout(
      url,
      {method, headers, body},
      options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    );
    // 关键：把 Set-Cookie 同步到 system CookieManager，
    // 让 WebView / 后续 fetch / native 模块都能看到 cookies。
    await this.syncResponseCookies(response.url || url, response);
    return response;
  }

  private async syncResponseCookies(url: string, response: Response): Promise<void> {
    try {
      const headers = response.headers as Headers & {getSetCookie?: () => string[]};
      if (typeof headers.getSetCookie === 'function') {
        for (const cookie of headers.getSetCookie()) {
          await CookieManager.setFromResponse(response.url || url, cookie);
        }
      } else {
        const raw = response.headers.get('set-cookie');
        if (raw) {
          await CookieManager.setFromResponse(url, raw);
        }
      }
      await CookieManager.flush();
    } catch {
      // ignore
    }
  }

  /**
   * 自动检测响应编码并解码，与 thu-info-lib `uFetch` 一致：
   *
   * 1. 从 `Content-Type: text/html; charset=GBK` 解析 charset
   * 2. 对 zhjw / 电费 / cr 等老 ASP/Java 子系统的 webvpn token 路径硬编码 GBK（这些后端
   *    常常不在响应头里声明 charset，但响应体确实是 GBK）
   * 3. UTF-8 直接走 `response.text()`；非 UTF-8 走 `FileReader.readAsText(blob, charset)`
   *    — RN-Android 的 BlobModule 底层用 Java `new String(bytes, charset)`，原生支持 GBK
   */
  async fetchText(url: string, options?: FetchOptions): Promise<string> {
    const response = await this.fetch(url, options);
    if (response.status !== 200 && response.status !== 201) {
      throw new Error(`HTTP ${response.status} (${url})`);
    }

    const contentType = response.headers.get('Content-Type') ?? '';
    const charset = inferResponseCharset(url, contentType);
    if (charset === 'utf-8') {
      return response.text();
    }
    const blob = await response.blob();
    return await readBlobAsText(blob, charset);
  }

  async fetchJson<T = unknown>(url: string, options?: FetchOptions): Promise<T> {
    const text = await this.fetchText(url, options);
    return JSON.parse(text) as T;
  }

  /**
   * 激活 webvpn 域会话：访问 oauth_login=true，依赖 id session 自动 OAuth 回 webvpn 写入 cookies。
   */
  async activateWebvpn(): Promise<void> {
    try {
      await this.fetchText(`${WEBVPN_BASE}/login?oauth_login=true`);
    } catch {
      // ignore
    }
  }

  /**
   * 用 XMLHttpRequest 替代 fetch 发请求，让 cookies 同步到 system CookieManager。
   * RN-Android 上 XHR 经 ReactCookieJarContainer，与 WebView 共享 cookie 池更可靠。
   */
  async syncCookiesViaXhr(url: string, timeoutMs = 15000): Promise<string> {
    return new Promise(resolve => {
      try {
        const xhr = new XMLHttpRequest();
        xhr.timeout = timeoutMs;
        xhr.onreadystatechange = () => {
          if (xhr.readyState === XMLHttpRequest.DONE) {
            resolve(xhr.responseURL || '');
          }
        };
        xhr.ontimeout = () => resolve('');
        xhr.onerror = () => resolve('');
        xhr.open('GET', url);
        xhr.send();
      } catch {
        resolve('');
      }
    });
  }

  /**
   * 与 thu-info-lib getCsrfToken 一致：访问 cookieSync 接口，从响应体匹配 XSRF-TOKEN。
   * 与上游对齐：失败时不做"重激活"魔法，直接抛错让 caller 走 verifyAndReLogin。
   */
  async getCsrfToken(): Promise<string> {
    const text = await this.fetchText(COOKIE_SYNC_URL);
    const m = /XSRF-TOKEN=(.+?);/.exec(`${text};`);
    if (!m || !m[1]) {
      throw new Error(
        `Failed to get csrf token. (cookieSync 未返回 XSRF-TOKEN, head=${text.slice(0, 60)})`,
      );
    }
    return m[1];
  }

  /**
   * roam("default", payload)：通用 webvpn 漫游入口。
   * 1) 获取 csrf
   * 2) GET ROAMING_URL?yyfwid=...&_csrf=...&machine=p → JSON
   * 3) 解析 object.roamingurl → parseUrl → fetch
   */
  async roamDefault(payload: string): Promise<string> {
    const csrf = await this.getCsrfToken();
    const url = `${ROAMING_URL}?yyfwid=${payload}&_csrf=${csrf}&machine=p`;
    const responseText = await this.fetchText(url);
    let parsed: {object?: {roamingurl?: string}; result?: string; msg?: string};
    try {
      parsed = JSON.parse(responseText);
    } catch {
      throw new Error(
        `门户漫游失败：响应非 JSON (head: ${responseText.slice(0, 80)})`,
      );
    }
    if (parsed.result && parsed.result !== 'success') {
      throw new Error(parsed.msg ?? '门户漫游失败');
    }
    const roamingUrl = parsed.object?.roamingurl?.replace(/&amp;/g, '&');
    if (!roamingUrl) {
      throw new Error('未获取到漫游地址');
    }
    return this.fetchText(parseUrlToWebVPN(roamingUrl));
  }
}

export const webvpnTransport = new WebVPNTransport();
