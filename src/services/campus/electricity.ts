/**
 * 宿舍电费 native 服务 —— 对照 thu-info-lib `dorm.ts`。
 *
 * 只读查询（余额 / 房间信息 / 缴费记录）完全 native；
 * 充值最终走支付宝，这里实现 thu-info 的 pay-code 生成链，UI 拿到 payCode 后
 * 唤起支付宝。pay-code 链涉及 ASP.NET 多步表单 + GBK，属 best-effort，
 * 失败时 UI 兜底用网页充值。
 *
 * 子系统会话：roam("id", '0a993de7e533cd43a594459abdcab27d/1')。
 */
import {parse, HTMLElement} from 'node-html-parser';
import {webvpnTransport} from '../webvpn/transport';
import {tsinghuaAuthService} from '../auth/tsinghuaAuth';
import {SUBSYSTEM_YYFWID} from '../webvpn/constants';
import {DORM_ELE_DETAIL_URL, DORM_ELE_URL} from './campusEndpoints';

const WEBVPN_BASE = 'https://webvpn.tsinghua.edu.cn';
const ELE_TOKEN =
  'fdee49932a3526446d0187ab9040227bca90a6e14cc9';

/** 电费余额详情页（只读） */
const ELE_REMAINDER_URL = DORM_ELE_DETAIL_URL;
/** 充值着陆页（含房间信息表单） */
const RECHARGE_ELE_URL = DORM_ELE_URL;
/** 充值提交端点（POST 拿支付宝跳转） */
const RECHARGE_PAY_ELE_URL = `${WEBVPN_BASE}/http/${ELE_TOKEN}/netweb_user/recharge_pay_ele.aspx`;
/** 缴费记录 */
const ELE_PAY_RECORD_URL = `${WEBVPN_BASE}/http/${ELE_TOKEN}/Netweb_List/netweb_ele_pay_record.aspx`;

// =============================================================
// 会话保障（参照 library.ts withLibRetry）
// =============================================================

let eleSessionEnsured = false;

async function ensureEleSession(force = false): Promise<void> {
  if (eleSessionEnsured && !force) {
    return;
  }
  const creds = await tsinghuaAuthService.hydrateCredentials();
  if (!creds) {
    throw new Error('未登录，无法访问电费服务');
  }
  await tsinghuaAuthService.roamIdPolicy(creds, SUBSYSTEM_YYFWID.dormElectricity);
  eleSessionEnsured = true;
}

async function withEleRetry<T>(fn: () => Promise<T>): Promise<T> {
  return tsinghuaAuthService.withSessionRecovery(
    fn,
    async () => {
      eleSessionEnsured = false;
      await ensureEleSession(true);
    },
    'ele',
  );
}

export function clearEleSessionCache(): void {
  eleSessionEnsured = false;
}

// =============================================================
// 解析辅助
// =============================================================

function inputValue(root: HTMLElement, name: string): string {
  return root.querySelector(`input[name="${name}"]`)?.getAttribute('value') ?? '';
}

function isLoginPage(root: HTMLElement): boolean {
  // 余额页 / 充值页未登录时会落回 net_Default 登录控件
  return Boolean(root.querySelector('#net_Default_LoginCtrl1_txtUserName'));
}

// =============================================================
// 余额 / 房间信息 / 缴费记录（只读）
// =============================================================

export interface EleRemainder {
  /** 剩余电量（度）*/
  remainder: number;
  /** 更新时间 */
  updateTime: string;
}

export async function getEleRemainder(): Promise<EleRemainder> {
  await ensureEleSession();
  return withEleRetry(async () => {
    const html = await webvpnTransport.fetchText(ELE_REMAINDER_URL);
    const root = parse(html);
    if (isLoginPage(root)) {
      throw new Error('电费会话失效');
    }
    const remainderText = root
      .querySelector('#Netweb_Home_electricity_DetailCtrl1_lblele')
      ?.text.trim();
    if (!remainderText) {
      throw new Error('未解析到电费余额');
    }
    const updateTime =
      root
        .querySelector('#Netweb_Home_electricity_DetailCtrl1_lbltime')
        ?.text.trim() ?? '';
    return {remainder: Number(remainderText), updateTime};
  });
}

export interface EleRoomInfo {
  userName: string;
  building: string;
  room: string;
  studentId: string;
}

export async function getEleRoomInfo(): Promise<EleRoomInfo> {
  await ensureEleSession();
  return withEleRetry(async () => {
    const html = await webvpnTransport.fetchText(RECHARGE_ELE_URL);
    const root = parse(html);
    if (isLoginPage(root)) {
      throw new Error('电费会话失效');
    }
    return {
      userName: inputValue(root, 'username'),
      building: inputValue(root, 'louhao'),
      room: inputValue(root, 'room'),
      studentId: inputValue(root, 'student_id'),
    };
  });
}

/** 缴费记录：每行 6 列（对照 thu-info-lib getElePayRecord：.myTable tr，去头尾）*/
export async function getElePayRecords(): Promise<string[][]> {
  await ensureEleSession();
  return withEleRetry(async () => {
    const html = await webvpnTransport.fetchText(ELE_PAY_RECORD_URL);
    const root = parse(html);
    if (isLoginPage(root)) {
      throw new Error('电费会话失效');
    }
    const rows = root.querySelectorAll('.myTable tr');
    if (rows.length <= 2) {
      return [];
    }
    return rows.slice(1, rows.length - 1).map(tr =>
      tr
        .querySelectorAll('td')
        .map(td => td.text.replace(/\s+/g, ' ').trim()),
    );
  });
}

// =============================================================
// 充值 → 支付宝 pay code（best-effort）
// =============================================================

function serializeForm(formEl: HTMLElement): Record<string, string> {
  const data: Record<string, string> = {};
  for (const input of formEl.querySelectorAll('input')) {
    const name = input.getAttribute('name');
    if (name) {
      data[name] = input.getAttribute('value') ?? '';
    }
  }
  return data;
}

/**
 * 生成支付宝充值 pay code。对照 thu-info-lib `getEleRechargePayCode`：
 *   recharge_ele.aspx (GET 表单)
 *     → recharge_pay_ele.aspx (POST，拿 #banksubmit 跳转表单)
 *       → 支付宝下单页 (POST)
 *         → 解析 input[name=qrCode]，取末段为 payCode
 *
 * 注意：这些端点是 GBK 的 ASP.NET 后端，请求体里的中文（如"支付宝支付"）
 * 在当前 transport 下按 UTF-8 百分号编码，可能与后端不完全匹配；
 * 因此本函数为 best-effort，UI 需对失败做网页兜底。
 */
export async function getEleRechargePayCode(money: number): Promise<string> {
  await ensureEleSession();
  return withEleRetry(async () => {
    // 1) 着陆页拿 viewstate + 房间信息
    const landingHtml = await webvpnTransport.fetchText(RECHARGE_ELE_URL);
    const landing = parse(landingHtml);
    if (isLoginPage(landing)) {
      throw new Error('电费会话失效');
    }

    // 2) POST 充值，拿支付宝跳转表单 #banksubmit
    const payHtml = await webvpnTransport.fetchText(RECHARGE_PAY_ELE_URL, {
      body: {
        __EVENTTARGET: '',
        __EVENTARGUMENT: '',
        __VIEWSTATE: landing.querySelector('#__VIEWSTATE')?.getAttribute('value') ?? '',
        __VIEWSTATEGENERATOR:
          landing.querySelector('#__VIEWSTATEGENERATOR')?.getAttribute('value') ?? '',
        recharge_eleCtrl1$RadioButtonList1: '支付宝支付',
        write_money: String(money),
        username: inputValue(landing, 'username'),
        louhao: inputValue(landing, 'louhao'),
        room: inputValue(landing, 'room'),
        student_id: inputValue(landing, 'student_id'),
        banktype: 'alipay',
      },
    });
    const bankForm = parse(payHtml).querySelector('#banksubmit');
    if (!bankForm) {
      throw new Error('充值提交未返回支付宝跳转表单');
    }
    const action = bankForm.getAttribute('action');
    if (!action) {
      throw new Error('支付宝跳转表单缺少 action');
    }

    // 3) POST 支付宝下单页，解析 pay code
    const alipayHtml = await webvpnTransport.fetchText(action, {
      body: serializeForm(bankForm),
    });
    const qrCode = parse(alipayHtml)
      .querySelector('input[name=qrCode]')
      ?.getAttribute('value');
    if (!qrCode) {
      throw new Error('支付宝下单页未返回 qrCode');
    }
    return qrCode.substring(qrCode.lastIndexOf('/') + 1);
  });
}

/** 支付宝唤起 deep link（对照 thu-info-app doAlipay）*/
export function buildAlipayUrl(payCode: string): string {
  return (
    'alipayqr://platformapi/startapp?saId=10000007&qrcode=https%3A%2F%2Fqr.alipay.com%2F' +
    payCode
  );
}

/** 给 InAppViewer 兜底用的官方充值网页地址 */
export const ELE_RECHARGE_WEB_URL = RECHARGE_ELE_URL;
export const ELE_BALANCE_WEB_URL = ELE_REMAINDER_URL;
