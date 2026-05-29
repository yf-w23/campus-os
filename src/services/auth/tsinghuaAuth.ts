import {v4 as uuidv4} from 'uuid';
import {CampusCredentials, CampusSession} from '../../domain/campus';
import {AuthStatus, TwoFactorApproach} from '../../domain/session';
import {encryptPassword, extractSm2PublicKey} from './sm2';
import {extractFirstAnchorHref, extractMsgNote} from './htmlParse';
import {webvpnTransport} from '../webvpn/transport';
import {loadCredentials} from '../../storage/secureStorage';
import {
  ENDPOINTS,
  ID_BASE_URL,
  ID_HOST_URL,
  ID_LOGIN_URL,
  INFO_PORTAL_YYFWID,
  LEARN_BASE,
  LEARN_LOGIN_YYFWID,
  OAUTH_LBREDIRECT_PREFIX,
  WEBVPN_OAUTH_LOGIN_URL,
  WEBVPN_ROOT_URL,
} from '../webvpn/constants';

export interface LoginResult {
  session: CampusSession;
  status: AuthStatus;
  error?: string;
  twoFactorApproaches?: TwoFactorApproach[];
  csrfToken?: string;
  /** 给 UI 的可选诊断（trace 的最后几步） */
  diagnostic?: string;
}

export type TwoFactorPrompt = {
  approaches: TwoFactorApproach[];
  reason: string;
};

export type TwoFactorHandler = (
  prompt: TwoFactorPrompt,
) => Promise<{type: TwoFactorApproach['type']; code: string} | null>;

const LOGIN_SUCCESS_MARK = '登录成功。正在重定向到';
const TWO_FACTOR_MARK = '二次认证';

/** 子系统 roam 时清华可能再次弹出 2FA（thu-info-lib 会在 roam 内再跑一轮 twoFactorAuth） */
class RoamTwoFactorError extends Error {
  constructor(public readonly payload: string) {
    super(`roamId(${payload}): 2FA reappeared`);
    this.name = 'RoamTwoFactorError';
  }
}

export function createFingerprint(): string {
  return uuidv4().replace(/-/g, '');
}

/**
 * 单次 OAuth 链登录，严格对照 thu-info-lib core.ts `login()`：
 *
 *   clearCookies
 *   GET WEB_VPN_OAUTH_LOGIN_URL × 2     ← 让 webvpn → oauth → id 链跑完
 *   extract sm2publicKey
 *   POST ID_LOGIN_URL                   ← 登录 id（如需 2FA 在这一步弹出）
 *   XHR follow callback                 ← 写入 webvpn auth cookies
 *   roam("id", INFO_PORTAL_YYFWID)      ← 建立 info.tsinghua 后端会话（campus 通用）
 *   activateLearn                       ← 用另一个 yyfwid 建立 learn 会话 + 拿 _csrf
 *
 * 2FA 通过 `pendingTwoFactor` 状态机暂停，由 `verifyTwoFactor` 继续。
 */
export class TsinghuaAuthService {
  /** learn 的 csrf，受 LEARN_HOME 解析得到 */
  private csrfToken = '';

  /** 跟踪 OAuth 链每一步，便于诊断 */
  private trace: string[] = [];

  /** 2FA 暂停态：保留 credentials，等待 verifyTwoFactor 接续主链 */
  private pendingTwoFactor: {credentials: CampusCredentials} | null = null;

  /**
   * 登录成功后缓存凭证。供 roamDefault / withSessionRecovery 在会话掉线时
   * 主动重新激活 info portal、或完整重登录。
   * 与 thu-info-lib helper.userId/password 内存态等价。
   */
  private cachedCredentials: CampusCredentials | null = null;

  /** 同一时刻只允许一个完整重登录 Promise 在跑 */
  private reloginInflight: Promise<void> | null = null;

  /** roam 阶段再次 2FA 时，由 LoginScreen 注入以收集第二轮验证码 */
  private twoFactorHandler: TwoFactorHandler | null = null;

  setTwoFactorHandler(handler: TwoFactorHandler | null) {
    this.twoFactorHandler = handler;
  }

  getCachedCredentials(): CampusCredentials | null {
    return this.cachedCredentials;
  }

  /**
   * App 重启后内存 cachedCredentials 为空，但 Keychain 里还有上次登录保存的密码。
   * 需要会话恢复时先从 Keychain 拿回来。
   */
  async hydrateCredentials(): Promise<CampusCredentials | null> {
    if (this.cachedCredentials) return this.cachedCredentials;
    try {
      const saved = await loadCredentials();
      if (saved && saved.password) {
        this.cachedCredentials = {
          studentId: saved.studentId,
          password: saved.password,
          fingerprint: saved.fingerprint,
        };
      }
    } catch {
      // Keychain 读取失败：保留 null，让上层抛"未登录"
    }
    return this.cachedCredentials;
  }

  getCsrfToken(): string {
    return this.csrfToken;
  }

  setCsrfToken(token: string): void {
    this.csrfToken = token;
  }

  getLastTrace(): string {
    return this.trace.slice(-10).join(' → ');
  }

  private addTrace(step: string): void {
    this.trace.push(step);
  }

  // ============================================================
  // 公共入口
  // ============================================================

  async login(credentials: CampusCredentials): Promise<LoginResult> {
    try {
      this.trace = [];
      this.pendingTwoFactor = null;

      const userId = credentials.studentId.trim();
      if (!userId || !credentials.password) {
        return this.errorResult('请输入学号和密码');
      }
      if (!/^\d+$/.test(userId)) {
        return this.errorResult('请输入正确的学号');
      }
      const normalized: CampusCredentials = {...credentials, studentId: userId};

      // 1. 清掉所有 cookies — 单次 OAuth 链的起点
      await webvpnTransport.clearCookies();
      this.addTrace('clearAll');

      // 2. 走 webvpn OAuth 链 → 最终落到 id form
      await webvpnTransport.fetchText(WEBVPN_OAUTH_LOGIN_URL);
      this.addTrace('warm1');
      const oauthFormHtml = await webvpnTransport.fetchText(WEBVPN_OAUTH_LOGIN_URL);
      this.addTrace(`html=${oauthFormHtml.length}`);

      const publicKey = extractSm2PublicKey(oauthFormHtml);
      if (!publicKey) {
        return this.errorResult('登录页无 sm2publicKey，请检查网络或稍后再试');
      }
      this.addTrace(`pk=${publicKey.length}`);

      // 3. POST id_login_check（url-encoded，与上游一致）
      const encryptedPassword = encryptPassword(normalized.password, publicKey);
      const idResponse = await webvpnTransport.fetchText(ID_LOGIN_URL, {
        body: {
          i_user: normalized.studentId,
          i_pass: encryptedPassword,
          fingerPrint: normalized.fingerprint,
          fingerGenPrint: '',
          fingerGenPrint3: '',
          i_captcha: '',
        },
      });
      this.addTrace(`idPost=${idResponse.length}`);

      // 4. 二次认证检测 — 暂停主链，由 verifyTwoFactor 继续
      if (idResponse.includes(TWO_FACTOR_MARK)) {
        this.pendingTwoFactor = {credentials: normalized};
        const approaches = await this.fetchTwoFactorApproaches();
        return {
          session: {
            isAuthenticated: false,
            webvpnReady: false,
            studentId: normalized.studentId,
          },
          status: 'two_factor',
          twoFactorApproaches: approaches,
        };
      }

      // 5. 没有 2FA — 直接接续主链
      return await this.completeAfterIdAuth(normalized, idResponse);
    } catch (error) {
      return this.errorResult(
        error instanceof Error ? error.message : '登录异常',
      );
    }
  }

  async verifyTwoFactor(
    credentials: CampusCredentials,
    type: TwoFactorApproach['type'],
    code: string,
    trustDevice = true,
  ): Promise<LoginResult> {
    try {
      const redirectHtml = await this.submitTwoFactorCode(
        credentials,
        type,
        code,
        trustDevice,
      );
      this.pendingTwoFactor = null;
      return await this.completeAfterIdAuth(credentials, redirectHtml);
    } catch (error) {
      return this.errorResult(
        error instanceof Error ? error.message : '二次认证失败',
      );
    }
  }

  /**
   * 提交 2FA 验证码并跟随 redirect，返回 id 登录成功页 HTML。
   * roam 内联二次认证与 verifyTwoFactor 共用。
   */
  private async submitTwoFactorCode(
    credentials: CampusCredentials,
    type: TwoFactorApproach['type'],
    code: string,
    trustDevice = true,
  ): Promise<string> {
    this.addTrace(`2fa-verify type=${type}`);
    const action = type === 'totp' ? 'VERITY_TOTP_CODE' : 'VERITY_CODE';
    const verifyResponse = await webvpnTransport.fetchText(ENDPOINTS.doubleAuth, {
      body: {
        action,
        type,
        vericode: code,
      },
    });

    let parsed: {
      result?: string;
      msg?: string;
      object?: {redirectUrl?: string};
    };
    try {
      parsed = JSON.parse(verifyResponse);
    } catch {
      throw new Error('验证码错误或已过期');
    }
    if (parsed.result !== 'success') {
      throw new Error(parsed.msg || '验证码错误或已过期');
    }
    this.addTrace('2fa-ok');

    if (trustDevice) {
      try {
        await webvpnTransport.fetchText(ENDPOINTS.saveFinger, {
          body: {
            fingerprint: credentials.fingerprint,
            deviceName: 'CampusOS',
            radioVal: '是',
          },
        });
        this.addTrace('saveFinger');
      } catch {
        // ignore
      }
    }

    if (!parsed.object?.redirectUrl) {
      throw new Error('2FA 返回缺少 redirectUrl');
    }

    const redirectHtml = await webvpnTransport.fetchText(
      `${ID_HOST_URL}${parsed.object.redirectUrl}`,
    );
    this.addTrace(`2fa-redirect=${redirectHtml.length}`);
    return redirectHtml;
  }

  /**
   * thu-info-lib roam 内遇到 2FA 时 inline 再跑一轮 twoFactorAuth。
   * 需要 LoginScreen 通过 setTwoFactorHandler 提供第二轮验证码。
   */
  private async performTwoFactor(
    credentials: CampusCredentials,
    reason: string,
  ): Promise<string> {
    if (!this.twoFactorHandler) {
      throw new RoamTwoFactorError(reason);
    }
    const approaches = await this.fetchTwoFactorApproaches();
    const input = await this.twoFactorHandler({approaches, reason});
    if (!input) {
      throw new Error('二次认证已取消');
    }
    return this.submitTwoFactorCode(
      credentials,
      input.type,
      input.code,
      true,
    );
  }

  async fetchTwoFactorApproaches(): Promise<TwoFactorApproach[]> {
    try {
      const response = await webvpnTransport.fetchText(ENDPOINTS.doubleAuth, {
        body: {action: 'FIND_APPROACHES'},
      });
      const parsed = JSON.parse(response) as {
        result?: string;
        object?: {
          hasWeChatBool?: boolean;
          phone?: string | null;
          hasTotp?: boolean;
        };
      };
      if (parsed.result === 'success' && parsed.object) {
        const approaches: TwoFactorApproach[] = [];
        if (parsed.object.hasWeChatBool) {
          approaches.push({type: 'wechat', label: '微信验证'});
        }
        if (parsed.object.phone) {
          approaches.push({type: 'mobile', label: '短信验证'});
        }
        if (parsed.object.hasTotp) {
          approaches.push({type: 'totp', label: 'TOTP 验证'});
        }
        if (approaches.length) {
          return approaches;
        }
      }
    } catch {
      // ignore
    }
    return [
      {type: 'mobile', label: '短信验证'},
      {type: 'wechat', label: '微信验证'},
      {type: 'totp', label: 'TOTP 验证'},
    ];
  }

  async sendTwoFactorCode(type: TwoFactorApproach['type']): Promise<void> {
    const response = await webvpnTransport.fetchText(ENDPOINTS.doubleAuth, {
      body: {action: 'SEND_CODE', type},
    });
    const parsed = JSON.parse(response) as {result?: string; msg?: string};
    if (parsed.result !== 'success') {
      throw new Error(parsed.msg || '发送验证码失败');
    }
  }

  // ============================================================
  // 主链共享尾巴：完成 webvpn auth → info portal → learn
  // ============================================================

  private async completeAfterIdAuth(
    credentials: CampusCredentials,
    idResponse: string,
  ): Promise<LoginResult> {
    if (!idResponse.includes(LOGIN_SUCCESS_MARK)) {
      const note = extractMsgNote(idResponse);
      return this.errorResult(
        note || `登录失败（resp head: ${idResponse.slice(0, 60)}）`,
      );
    }
    const callbackUrl = extractFirstAnchorHref(idResponse);
    if (!callbackUrl) {
      return this.errorResult('未提取到 callback href');
    }
    this.addTrace(`cb=${callbackUrl.slice(0, 40)}`);

    // 关键修复：与 thu-info-lib getRedirectUrl 一致，**只用 XHR 跟随一次** callback chain
    // （callback URL 内含一次性 SSO ticket，重复消费会让 webvpn 后端清掉刚建立的会话）
    const finalCbUrl = await webvpnTransport.syncCookiesViaXhr(callbackUrl, 20000);
    this.addTrace(`cb-final=${finalCbUrl.slice(0, 40)}`);

    // === 建立 info.tsinghua.edu.cn 后端会话（校园通用门户漫游）===
    try {
      await this.roamIdPolicy(credentials, INFO_PORTAL_YYFWID);
      this.addTrace('info-roam');
    } catch (e) {
      if (e instanceof RoamTwoFactorError) {
        this.pendingTwoFactor = {credentials};
        return {
          session: {
            isAuthenticated: false,
            webvpnReady: false,
            studentId: credentials.studentId,
          },
          status: 'two_factor',
          twoFactorApproaches: await this.fetchTwoFactorApproaches(),
          error: '校园门户漫游需要再次二次认证，请重新验证',
        };
      }
      return this.errorResult(
        `info portal 漫游失败：${(e as Error).message}`,
      );
    }

    // === 校验 info portal session 真的生效（命中 USER_DATA 看 ryh 是否等于学号）===
    try {
      const verified = await this.verifyInfoSession(credentials.studentId);
      if (!verified) {
        return this.errorResult(
          `info portal 会话验证失败：USER_DATA 未返回正确的 ryh`,
        );
      }
      this.addTrace('verified');
    } catch (e) {
      return this.errorResult(
        `info portal 会话验证异常：${(e as Error).message}`,
      );
    }

    // === 激活 learn（独立 yyfwid 拿一张 learn ticket）===
    let csrf = '';
    try {
      csrf = await this.activateLearn(credentials);
      this.addTrace('learn-ok');
    } catch (e) {
      // 不致命：learn 失败时校园仍可用
      this.addTrace(`learn-fail:${(e as Error).message.slice(0, 40)}`);
    }
    this.csrfToken = csrf;

    // 缓存凭证，供 roamDefault 在会话掉线时主动重新激活 info portal
    this.cachedCredentials = credentials;

    return {
      session: {
        isAuthenticated: true,
        studentId: credentials.studentId,
        authenticatedAt: new Date().toISOString(),
        webvpnReady: true,
      },
      status: 'authenticated',
      csrfToken: csrf,
    };
  }

  /**
   * 命中 info.tsinghua.edu.cn 的 USER_DATA 端点，确认 info portal session 已在 webvpn 后端 jar 里。
   * 对应 thu-info-lib core.ts verifyAndReLogin 的探针逻辑。
   */
  private async verifyInfoSession(expectedUserId: string): Promise<boolean> {
    const csrf = await webvpnTransport.getCsrfToken();
    const url = `${ENDPOINTS.infoUserData}?_csrf=${encodeURIComponent(csrf)}`;
    const text = await webvpnTransport.fetchText(url);
    try {
      const parsed = JSON.parse(text);
      return parsed?.object?.ryh === expectedUserId;
    } catch {
      // 非 JSON 通常意味着拿到登录页 HTML
      throw new Error(
        `USER_DATA 返回非 JSON (head: ${text.slice(0, 100)})`,
      );
    }
  }

  // ============================================================
  // 通用 roam("id" | "cab" | "card") — 对应 upstream core.ts:case "id"/"cab"/"card"
  // ============================================================

  /**
   * thu-info-lib `roam(helper, "id", payload)`：
   *   循环最多 2 次：GET ID_BASE_URL + payload → POST id_login_check
   *   拿 callback href → wrapWebVPNUrl 包成 oauth lbredirect → fetch
   *
   * @returns 最终页面 HTML（用于上层判定）
   */
  async roamIdPolicy(
    credentials: CampusCredentials,
    payload: string,
  ): Promise<string> {
    let response = '';
    for (let i = 0; i < 2; i += 1) {
      const formHtml = await webvpnTransport.fetchText(
        `${ID_BASE_URL}${payload}`,
      );
      const publicKey = extractSm2PublicKey(formHtml);
      if (!publicKey) {
        throw new Error(
          `roamId(${payload}): missing sm2publicKey (form len=${formHtml.length})`,
        );
      }
      const encryptedPassword = encryptPassword(credentials.password, publicKey);
      response = await webvpnTransport.fetchText(ID_LOGIN_URL, {
        body: {
          i_user: credentials.studentId,
          i_pass: encryptedPassword,
          fingerPrint: credentials.fingerprint,
          fingerGenPrint: '',
          fingerGenPrint3: '',
          i_captcha: '',
        },
      });
      if (response.includes(TWO_FACTOR_MARK)) {
        response = await this.performTwoFactor(
          credentials,
          '校园门户漫游需要再次二次认证，请重新验证',
        );
        if (response.includes(TWO_FACTOR_MARK)) {
          throw new RoamTwoFactorError(payload);
        }
        if (response.includes(LOGIN_SUCCESS_MARK)) {
          break;
        }
      }
      if (response.includes(LOGIN_SUCCESS_MARK)) {
        break;
      }
    }
    if (!response.includes(LOGIN_SUCCESS_MARK)) {
      throw new Error(
        `roamId(${payload}): login failed (resp head: ${response.slice(0, 60)})`,
      );
    }

    const callbackHref = extractFirstAnchorHref(response);
    if (!callbackHref) {
      throw new Error(`roamId(${payload}): no callback href`);
    }
    const wrapped = wrapWebVPNUrl(callbackHref);

    // 关键修复：与 upstream `return await uFetch(redirectUrl)` 一致，**只调一次**。
    // 此前的 fetch + XHR 双保险会让一次性 SSO ticket 被消费两次，第二次失败时
    // webvpn 后端 jar 会清掉刚刚为该 ticket 建立的子系统 session。
    const html = await webvpnTransport.fetchText(wrapped);

    // 内容校验：只检查 sm2publicKey 这一最权威的"落回 id 登录页"标记，
    // 不再校验 "用户未登录" / "用户登陆超时" — 这些字样可能合法出现在
    // 子系统页面的 JS / 错误提示模板里，误判会让所有 roam 都挂掉。
    if (html.includes('id="sm2publicKey"')) {
      throw new Error(
        `roamId(${payload}): lbredirect 落回 id 登录页 (htmlLen=${html.length})`,
      );
    }
    return html;
  }

  // ============================================================
  // 激活 learn 会话（直连 learn.tsinghua.edu.cn）
  // ============================================================

  private async activateLearn(credentials: CampusCredentials): Promise<string> {
    let response = '';
    for (let i = 0; i < 2; i += 1) {
      const formHtml = await webvpnTransport.fetchText(
        `${ID_BASE_URL}${LEARN_LOGIN_YYFWID}`,
      );
      const publicKey = extractSm2PublicKey(formHtml);
      if (!publicKey) {
        throw new Error('learn: missing sm2publicKey');
      }
      const encryptedPassword = encryptPassword(credentials.password, publicKey);
      response = await webvpnTransport.fetchText(ID_LOGIN_URL, {
        body: {
          i_user: credentials.studentId,
          i_pass: encryptedPassword,
          fingerPrint: credentials.fingerprint,
          fingerGenPrint: '',
          fingerGenPrint3: '',
          i_captcha: '',
        },
      });
      if (response.includes(TWO_FACTOR_MARK)) {
        throw new Error('learn: 2FA reappeared');
      }
      if (response.includes(LOGIN_SUCCESS_MARK)) {
        break;
      }
    }
    if (!response.includes(LOGIN_SUCCESS_MARK)) {
      throw new Error('learn: id login failed');
    }
    const callbackUrl = extractFirstAnchorHref(response);
    if (!callbackUrl) {
      throw new Error('learn: no callback href');
    }
    const ticket = callbackUrl.split('=').slice(-1)[0];
    if (!ticket) {
      throw new Error('learn: no ticket in callback');
    }
    const learnResp = await webvpnTransport.fetch(
      `${ENDPOINTS.learnAuthRoam}?ticket=${ticket}`,
    );
    if (learnResp.status !== 200) {
      throw new Error(`learn: roam HTTP ${learnResp.status}`);
    }
    const studentHomeHtml = await webvpnTransport.fetchText(
      ENDPOINTS.learnStudentHome,
    );
    const csrfMatches = [...studentHomeHtml.matchAll(/&_csrf=(\S+?)["'&]/g)];
    const csrf = csrfMatches[0]?.[1] ?? '';
    if (!csrf) {
      throw new Error('learn: no _csrf in student home');
    }
    return csrf;
  }

  // ============================================================
  // 课表前置：拿 zhjw ticket → 激活 zhjw acegi 会话
  // ============================================================

  async activateRegistrar(): Promise<void> {
    const ticketResponse = await webvpnTransport.fetch(
      ENDPOINTS.registrarTicket +
        (this.csrfToken ? `?_csrf=${this.csrfToken}` : ''),
      {
        body: {appId: 'ALL_ZHJW'},
      },
    );
    let ticket = await ticketResponse.text();
    if (ticket.startsWith('"')) ticket = ticket.substring(1, ticket.length - 1);
    if (!ticket) {
      throw new Error('无法获取 zhjw ticket');
    }
    await webvpnTransport.fetch(`${ENDPOINTS.registrarAuthPrefix}${ticket}`);
  }

  // ============================================================
  // 校园通用门户 default 漫游（自动会话兜底）
  // ============================================================

  async roamDefault(payload: string): Promise<string> {
    return this.withSessionRecovery(
      () => webvpnTransport.roamDefault(payload),
      undefined,
      `roamDefault(${payload})`,
    );
  }

  /**
   * 两层会话兜底（对应上游 `roamingWrapper` + `verifyAndReLogin` 的合体）：
   *   1. 直跑 operation
   *   2. 失败 → 跑 `onReroam`（默认是 INFO_PORTAL_YYFWID）刷新该子系统 → 重跑 operation
   *   3. 还失败 → 完整重新 login()（清 cookies / 走完整 OAuth 链）→ 跑 onReroam → 重跑 operation
   *   4. 全失败 → 抛 originalError
   *
   * 与 `wengine_vpn_ticket` 过期、id JSESSIONID 漂走、info portal session 被回收
   * 这三种"半小时后就挂"的常见状况都能自动恢复。
   *
   * @param onReroam 恢复阶段的子系统 roam；不传则默认刷新 info portal。
   *                 图书馆 / cab 各自传自己的 reroam（librarySeat yyfwid / cabLogin）。
   */
  async withSessionRecovery<T>(
    operation: () => Promise<T>,
    onReroam?: () => Promise<void>,
    label = 'op',
  ): Promise<T> {
    let firstError: unknown;
    try {
      return await operation();
    } catch (e) {
      firstError = e;
      this.addTrace(
        `${label}-fail-1: ${(e as Error).message?.slice(0, 40)}`,
      );
    }

    const creds = await this.hydrateCredentials();
    if (!creds) throw firstError;

    const reroam =
      onReroam ?? (async () => this.roamIdPolicy(creds, INFO_PORTAL_YYFWID));

    // Layer 1: 重新激活子系统 session
    try {
      await reroam();
      this.addTrace(`${label}-reroam`);
      return await operation();
    } catch (e) {
      this.addTrace(
        `${label}-fail-2: ${(e as Error).message?.slice(0, 40)}`,
      );
    }

    // Layer 2: 完整重登录 → 重新 roam → 重试
    try {
      await this.ensureFullReLogin(creds);
      this.addTrace(`${label}-relogin`);
      await reroam();
      this.addTrace(`${label}-reroam-2`);
      return await operation();
    } catch (e) {
      this.addTrace(
        `${label}-fail-3: ${(e as Error).message?.slice(0, 40)}`,
      );
      throw firstError;
    }
  }

  /** 完整重登录；同一时刻只允许一个并发的 login Promise，避免多个操作同时失败时挤兑。 */
  private async ensureFullReLogin(
    credentials: CampusCredentials,
  ): Promise<void> {
    if (this.reloginInflight) {
      return this.reloginInflight;
    }
    this.reloginInflight = (async () => {
      try {
        const result = await this.login(credentials);
        if (result.status !== 'authenticated') {
          throw new Error(
            `完整重登录失败：${result.error ?? result.status}`,
          );
        }
      } finally {
        this.reloginInflight = null;
      }
    })();
    return this.reloginInflight;
  }

  // ============================================================
  // 给 CampusEntryScreen 调用：按子系统建立 SSO 会话
  // ============================================================

  /**
   * 为 WebView 即将打开的某个子系统建立 SSO 会话。
   *
   * 不依赖 redux：UI 直接传 credentials（来自 Keychain）和 yyfwid。
   *
   * - kind="id"：调 roamIdPolicy（宿舍 / 电费 / 图书馆座位 / 等等 thu-info-lib roam("id", payload) 那类）
   * - kind="cab"：调 cabLogin（研讨间预约）
   */
  async ensureSubsystemSession(
    credentials: CampusCredentials,
    kind: 'id' | 'cab',
    payload?: string,
  ): Promise<void> {
    if (kind === 'id') {
      if (!payload) {
        throw new Error('ensureSubsystemSession: payload required for id');
      }
      await this.roamIdPolicy(credentials, payload);
      return;
    }
    if (kind === 'cab') {
      await this.cabLogin(credentials);
      return;
    }
  }

  /**
   * thu-info-lib library.ts `cabLogin`：
   *   GET LIB_ROOM_BOOKING_QUERY_AUTH_ADDRESS_URL  → 文本就是一个 https://cab... 地址
   *   replace host → 走 webvpn 包装
   *   follow redirect 拿到 .../login/form/<payload> 的最终 URL
   *   extract payload → roam("cab", payload)
   */
  async cabLogin(credentials: CampusCredentials): Promise<void> {
    const rawAddress = (
      await webvpnTransport.fetchText(ENDPOINTS.libRoomBookingQueryAuthAddress)
    ).trim();
    const wrapped = rawAddress.replace(
      'https://cab.lib.tsinghua.edu.cn',
      ENDPOINTS.libRoomBookingRoot,
    );
    // 跟随 wrapped 拿到最终的 .../login/form/<payload> URL
    const finalUrl = await webvpnTransport.syncCookiesViaXhr(wrapped, 15000);
    const m = /\/login\/form\/(.+)$/.exec(finalUrl || wrapped);
    if (!m || !m[1]) {
      throw new Error(`cabLogin: no payload in finalUrl (${finalUrl})`);
    }
    await this.roamIdPolicy(credentials, m[1]);
  }

  private errorResult(message: string): LoginResult {
    this.pendingTwoFactor = null;
    const trace = this.getLastTrace();
    return {
      session: {isAuthenticated: false, webvpnReady: false},
      status: 'error',
      // 把 trace 直接拼到 error 里，UI 上能一眼看到走到哪一步
      error: trace ? `${message}\n\n[trace] ${trace}` : message,
      diagnostic: trace,
    };
  }
}

// ============================================================
// URL 包装：照搬 thu-info-lib core.ts getWebVPNUrl
// ============================================================

export function wrapWebVPNUrl(urlIn: string): string {
  if (urlIn.includes('oauth.tsinghua.edu.cn')) {
    return urlIn;
  }
  const m = /^(https?):\/\/([^\/:?#]+)(?::(\d+))?(\/[^?#]*)?(\?[^#]*)?(#.*)?$/.exec(
    urlIn,
  );
  if (!m) {
    return urlIn;
  }
  const scheme = m[1];
  const host = m[2];
  const port = m[3] || (scheme === 'https' ? '443' : '80');
  const path = m[4] || '/';
  const search = m[5] || '';
  const hash = m[6] || '';
  const uri = path + search + hash;
  // raw 拼接，与 thu-info-lib 一致：uri 不做 encode
  return `${OAUTH_LBREDIRECT_PREFIX}?scheme=${scheme}&host=${host}&port=${port}&uri=${uri}`;
}

export const tsinghuaAuthService = new TsinghuaAuthService();

// 兼容旧导出
export const LEARN_BASE_EXPORT = LEARN_BASE;
