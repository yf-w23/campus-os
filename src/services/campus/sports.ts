/**
 * 体育场馆预约 — 对照 thu-info-lib `sports.ts`。
 * 需 `roamDefault('5539ECF8…')` 激活体育馆子系统；页面默认 GBK 编码。
 */
import {parse} from 'node-html-parser';
import {Linking} from 'react-native';
import {
  SportsReservationRecord,
  SportsResource,
  SportsResourcesInfo,
  SportsVenueInfo,
} from '../../domain/sports';
import {tsinghuaAuthService} from '../auth/tsinghuaAuth';
import {webvpnTransport} from '../webvpn/transport';
import {buildAlipayUrl} from './electricity';

/** thu-info-lib sports.ts `roamingWrapper` default payload */
const SPORTS_ROAM_PAYLOAD = '5539ECF8CD815C7D3F5A8EE0A2D72441';

const WEBVPN_LOGIN_MARKERS = [
  '<title>清华大学WebVPN</title>',
  'user login',
  '用户登陆超时',
  '登录超时',
];

const WEBVPN_BASE = 'https://webvpn.tsinghua.edu.cn';

export const SPORTS_BASE_URL = `${WEBVPN_BASE}/http/77726476706e69737468656265737421a5a70f8834396657761d88e29d51367b6a00/gymbook/gymBookAction.do?ms=viewGymBook&viewType=m`;
export const SPORTS_DETAIL_URL = `${WEBVPN_BASE}/http/77726476706e69737468656265737421a5a70f8834396657761d88e29d51367b6a00/gymsite/cacheAction.do?ms=viewBook&userType=1`;
export const SPORTS_UNPAID_URL = `${WEBVPN_BASE}/http/77726476706e69737468656265737421a5a70f8834396657761d88e29d51367b6a00/pay/payAction.do?ms=getOrdersForNopay`;
export const SPORTS_PAID_URL = `${WEBVPN_BASE}/http/77726476706e69737468656265737421a5a70f8834396657761d88e29d51367b6a00/pay/payAction.do?ms=getOrdersForUnpay`;
export const SPORTS_UNSUBSCRIBE_URL = `${WEBVPN_BASE}/http/77726476706e69737468656265737421a5a70f8834396657761d88e29d51367b6a00/gymbook/gymBookAction.do?ms=unsubscribe`;
export const SPORTS_QUERY_PHONE_URL = `${WEBVPN_BASE}/http/77726476706e69737468656265737421a5a70f8834396657761d88e29d51367b6a00/gymbook/gymBookAction.do?ms=hadContactOrNot`;
export const SPORTS_CAPTCHA_BASE_URL = `${WEBVPN_BASE}/http/77726476706e69737468656265737421a5a70f8834396657761d88e29d51367b6a00/Kaptcha.jpg`;
export const SPORTS_MAKE_ORDER_URL = `${WEBVPN_BASE}/http/77726476706e69737468656265737421a5a70f8834396657761d88e29d51367b6a00/gymbook/gymbook/gymBookAction.do?vpn-12-o1-50.tsinghua.edu.cn=&ms=saveGymBook`;
export const SPORTS_MAKE_PAYMENT_URL = `${WEBVPN_BASE}/http/77726476706e69737468656265737421a5a70f8834396657761d88e29d51367b6a00/pay/payAction.do?ms=newPay`;
export const SPORTS_MAKE_PAYMENT_LATER_URL = `${WEBVPN_BASE}/http/77726476706e69737468656265737421a5a70f8834396657761d88e29d51367b6a00/pay/payAction.do?ms=newPayForLater`;
export const SPORTS_PAYMENT_CHECK_URL = `${WEBVPN_BASE}/http/77726476706e69737468656265737421f6f60c93293c615e7b469dbf915b243daf0f96e17deaf447b4/zjjsfw/zjjs/check.do`;
export const SPORTS_PAYMENT_ACTION_URL = `${WEBVPN_BASE}/http/77726476706e69737468656265737421f6f60c93293c615e7b469dbf915b243daf0f96e17deaf447b4/zjjsfw/zjjs/webPay.do`;

export const sportsIdInfoList: SportsVenueInfo[] = [
  {name: '气膜馆羽毛球场', gymId: '3998000', itemId: '4045681'},
  {name: '气膜馆乒乓球场', gymId: '3998000', itemId: '4037036'},
  {name: '综体篮球场', gymId: '4797914', itemId: '4797898'},
  {name: '综体羽毛球场', gymId: '4797914', itemId: '4797899'},
  {name: '西体羽毛球场', gymId: '4836273', itemId: '4836196'},
  {name: '西体台球', gymId: '4836273', itemId: '14567218'},
  {name: '紫荆网球场', gymId: '5843934', itemId: '5845263'},
  {name: '西网球场', gymId: '5843934', itemId: '10120539'},
];

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

export function sportsDateString(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function assertSportsHtml(html: string): void {
  if (WEBVPN_LOGIN_MARKERS.some(m => html.includes(m))) {
    throw new Error('体育场馆未登录，请返回首页点击同步校园数据后重试');
  }
}

function matchSportsLimitVar(html: string, name: string): number | null {
  const patterns = [
    new RegExp(`var\\s+${name}\\s*=\\s*'(\\d+)'`, 'i'),
    new RegExp(`var\\s+${name}\\s*=\\s*"(\\d+)"`, 'i'),
    new RegExp(`var\\s+${name}\\s*=\\s*(\\d+)`, 'i'),
    new RegExp(`${name}\\s*=\\s*'(\\d+)'`, 'i'),
  ];
  for (const re of patterns) {
    const m = re.exec(html);
    if (m?.[1] != null) {
      return Number(m[1]);
    }
  }
  return null;
}

async function ensureSportsSession(): Promise<void> {
  await tsinghuaAuthService.roamDefault(SPORTS_ROAM_PAYLOAD);
}

async function withSportsSession<T>(
  operation: () => Promise<T>,
  label: string,
): Promise<T> {
  return tsinghuaAuthService.withSessionRecovery(
    async () => {
      await ensureSportsSession();
      return operation();
    },
    ensureSportsSession,
    label,
  );
}

async function getSportsResourceLimit(
  gymId: string,
  itemId: string,
  date: string,
): Promise<{count: number; init: number}> {
  const rawHtml = await webvpnTransport.fetchText(
    `${SPORTS_BASE_URL}&gymnasium_id=${gymId}&item_id=${itemId}&time_date=${date}`,
  );
  assertSportsHtml(rawHtml);
  const count = matchSportsLimitVar(rawHtml, 'limitBookCount');
  const init = matchSportsLimitVar(rawHtml, 'limitBookInit');
  if (count == null || init == null) {
    throw new Error('无法获取体育场馆预约限额');
  }
  return {count, init};
}

async function getSportsResourceData(
  gymId: string,
  itemId: string,
  date: string,
): Promise<SportsResource[]> {
  const rawHtml = await webvpnTransport.fetchText(
    `${SPORTS_DETAIL_URL}&gymnasium_id=${gymId}&item_id=${itemId}&time_date=${date}`,
  );
  const result: Record<string, SportsResource> = {};
  const p1 =
    /resourceArray\.push\({id:'(.*?)',time_session:'(.*?)',field_name:'(.*?)',overlaySize:'(.*?)',can_net_book:'(.*?)'}\);[\s\S]+?resourcesm\.put\('(.*?)', '(.*?)'\)/gm;
  for (let r1 = p1.exec(rawHtml); r1 != null; r1 = p1.exec(rawHtml)) {
    if (r1[1] === r1[6]) {
      result[r1[1]] = {
        resId: r1[1],
        resHash: r1[7],
        timeSession: r1[2],
        fieldName: r1[3],
        overlaySize: Number(r1[4]),
        canNetBook: r1[5] === '1',
      };
    }
  }
  const p2 = /addCost\('(.*?)','(.*?)'\);/g;
  for (let r2 = p2.exec(rawHtml); r2 != null; r2 = p2.exec(rawHtml)) {
    if (result[r2[1]]) {
      result[r2[1]].cost = Number(r2[2]);
    }
  }
  const p3 = /markResStatus\('(.*?)','(.*?)','(.*?)'\);/g;
  for (let r3 = p3.exec(rawHtml); r3 != null; r3 = p3.exec(rawHtml)) {
    if (result[r3[2]]) {
      result[r3[2]].bookId = r3[1];
      result[r3[2]].locked = r3[3] === '1';
    }
  }
  const p4 = /markStatusColor\('(.*?)','(.*?)','(.*?)','(.*?)'\);/g;
  for (let r4 = p4.exec(rawHtml); r4 != null; r4 = p4.exec(rawHtml)) {
    if (result[r4[1]]) {
      result[r4[1]].userType = r4[2];
      result[r4[1]].paymentStatus = r4[3] === '1';
    }
  }
  return Object.values(result);
}

async function getSportsPhoneNumber(): Promise<string | undefined> {
  const msg = (await webvpnTransport.fetchText(SPORTS_QUERY_PHONE_URL)).trim();
  return msg === 'do_not' ? undefined : msg;
}

export function getSportsCaptchaUrl(): string {
  return `${SPORTS_CAPTCHA_BASE_URL}?${Math.floor(Math.random() * 100)}=`;
}

/** 拉取验证码图片 base64（供 Image uri 使用） */
export async function fetchSportsCaptchaBase64(): Promise<string> {
  return withSportsSession(async () => {
  const url = getSportsCaptchaUrl();
  const response = await webvpnTransport.fetch(url);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result === 'string') {
        const base64 = result.split(',')[1] ?? '';
        resolve(base64);
      } else {
        reject(new Error('验证码读取失败'));
      }
    };
    reader.onerror = () => reject(reader.error ?? new Error('验证码读取失败'));
    reader.readAsDataURL(blob);
  });
  }, 'sports-captcha');
}

export async function getSportsResources(
  gymId: string,
  itemId: string,
  date: string,
): Promise<SportsResourcesInfo> {
  return withSportsSession(async () => {
    const [{count, init}, phone, data] = await Promise.all([
      getSportsResourceLimit(gymId, itemId, date),
      getSportsPhoneNumber(),
      getSportsResourceData(gymId, itemId, date),
    ]);
    return {count, init, phone, data};
  }, 'sports-resources');
}

function serializeFormInputs(form: ReturnType<typeof parse>): Record<string, string> {
  const postForm: Record<string, string> = {};
  form.querySelectorAll('input').forEach(el => {
    const name = el.getAttribute('name');
    if (name) {
      postForm[name] = el.getAttribute('value') ?? '';
    }
  });
  return postForm;
}

async function generalGetPayCode(paymentHtml: string): Promise<string> {
  const root = parse(paymentHtml);
  const form = root.querySelector('form');
  if (!form) {
    throw new Error('支付页缺少 form');
  }
  const action = form.getAttribute('action');
  const biz = root.querySelector('[name=biz_content]')?.getAttribute('value');
  if (!action || !biz) {
    throw new Error('支付页缺少 action 或 biz_content');
  }
  const page = await webvpnTransport.fetchText(action, {body: {biz_content: biz}});
  const qrCode = parse(page).querySelector('input[name=qrCode]')?.getAttribute('value');
  if (!qrCode) {
    throw new Error('支付页未返回 qrCode');
  }
  return qrCode.substring(qrCode.lastIndexOf('/') + 1);
}

export async function makeSportsReservation(params: {
  totalCost: number;
  phone: string;
  gymId: string;
  itemId: string;
  date: string;
  captcha: string;
  resHashId: string;
  skipPayment?: boolean;
  receiptTitle?: string;
}): Promise<{ok: boolean; message: string; payCode?: string}> {
  return withSportsSession(async () => {
  const orderText = await webvpnTransport.fetchText(SPORTS_MAKE_ORDER_URL, {
    body: {
      'bookData.totalCost': String(params.totalCost),
      'bookData.book_person_zjh': '',
      'bookData.book_person_name': '',
      'bookData.book_person_phone': params.phone,
      'bookData.book_mode': 'from-phone',
      gymnasium_idForCache: params.gymId,
      item_idForCache: params.itemId,
      time_dateForCache: params.date,
      userTypeNumForCache: '1',
      putongRes: 'putongRes',
      code: params.captcha,
      selectedPayWay: '1',
      allFieldTime: `${params.resHashId}#${params.date}`,
    },
  });
  let orderResult: {msg?: string};
  try {
    orderResult = JSON.parse(orderText);
  } catch {
    return {ok: false, message: orderText.slice(0, 120) || '下单响应异常'};
  }
  if (orderResult.msg !== '预定成功') {
    return {ok: false, message: orderResult.msg ?? '预约失败'};
  }
  if (params.totalCost === 0 || params.skipPayment) {
    return {ok: true, message: '预约成功'};
  }
  const paymentHtml = await webvpnTransport.fetchText(SPORTS_MAKE_PAYMENT_URL, {
    body: {
      is_jsd: params.receiptTitle ? '1' : '0',
      xm: params.receiptTitle ?? '清华大学',
      gymnasium_idForCache: params.gymId,
      item_idForCache: params.itemId,
      time_dateForCache: params.date,
      userTypeNumForCache: '1',
      allFieldTime: `${params.resHashId}#${params.date}`,
    },
    timeoutMs: 60000,
  });
  const payForm = parse(paymentHtml).querySelector('form');
  if (!payForm?.getAttribute('action')) {
    return {ok: true, message: '预约成功，但未获取到支付表单'};
  }
  const action = payForm.getAttribute('action')!;
  const formBody = serializeFormInputs(payForm);
  const paymentApiHtml = await webvpnTransport.fetchText(action, {
    body: formBody,
    timeoutMs: 60000,
  });
  const searchResult = /var id = '(.*)?';\s*?var token = '(.*)?';/.exec(paymentApiHtml);
  if (!searchResult?.[1] || !searchResult[2]) {
    return {ok: true, message: '预约成功，支付参数获取失败'};
  }
  const checkText = await webvpnTransport.fetchText(SPORTS_PAYMENT_CHECK_URL, {
    body: {id: searchResult[1], token: searchResult[2]},
  });
  let checkResult: {code?: string; message?: string};
  try {
    checkResult = JSON.parse(checkText);
  } catch {
    return {ok: true, message: '预约成功，支付校验响应异常'};
  }
  if (checkResult.code !== '0') {
    return {ok: true, message: `预约成功，支付校验失败：${checkResult.message ?? ''}`};
  }
  const inputs = parse(paymentApiHtml).querySelectorAll('#payForm input');
  const postForm: Record<string, string> = {};
  inputs.forEach(el => {
    const name = el.getAttribute('name');
    if (name) {
      postForm[name] = el.getAttribute('value') ?? '';
    }
  });
  postForm.channelId = '0101';
  const payPage = await webvpnTransport.fetchText(SPORTS_PAYMENT_ACTION_URL, {
    body: postForm,
  });
  try {
    const payCode = await generalGetPayCode(payPage);
    return {ok: true, message: '预约成功，请完成支付', payCode};
  } catch {
    return {ok: true, message: '预约成功，支付宝码获取失败，请到订单页补付'};
  }
  }, 'sports-reserve');
}

export async function openSportsAlipay(payCode: string): Promise<boolean> {
  const url = buildAlipayUrl(payCode);
  const can = await Linking.canOpenURL(url);
  if (can) {
    await Linking.openURL(url);
  }
  return can;
}

function cellText(html: string, rowHtml: string, index: number): string {
  const row = parse(rowHtml);
  const tds = row.querySelectorAll('td');
  return (tds[index]?.text ?? '').trim();
}

async function getSportsReservationPaidRecords(): Promise<SportsReservationRecord[]> {
  const html = await webvpnTransport.fetchText(SPORTS_PAID_URL);
  const root = parse(html);
  return root.querySelectorAll('tr[style="display:none"]').map(e => {
    const contentRow = parse(e.innerHTML).querySelector('tbody tr');
    if (!contentRow) {
      return {
        name: '',
        field: '',
        time: '',
        price: '',
        method: '已支付',
      };
    }
    const items = contentRow.querySelectorAll('td');
    return {
      name: (items[2]?.text ?? '').trim(),
      field: (items[3]?.text ?? '').trim(),
      time: (items[4]?.text ?? '').trim(),
      price: (items[5]?.text ?? '').trim(),
      method: '已支付',
    };
  });
}

export async function getSportsReservationRecords(): Promise<
  SportsReservationRecord[]
> {
  const html = await webvpnTransport.fetchText(SPORTS_UNPAID_URL);
  const root = parse(html);
  const tables = root.querySelectorAll('table');
  if (tables.length === 0) {
    throw new Error('无法加载体育预约订单');
  }
  const unpaid: SportsReservationRecord[] = root.querySelectorAll('tbody tr').map(e => {
    const rowHtml = e.outerHTML;
    const method = cellText(html, rowHtml, 9);
    let payId: string | undefined;
    let bookId: string | undefined;
    if (method === '网上支付') {
      const payAction = e.querySelector('[onclick*="payNow"]')?.getAttribute('onclick') ?? '';
      const payRes = /payNow\('(.+?)'/.exec(payAction);
      if (payRes) {
        payId = payRes[1];
      }
      const unsubAction =
        e.querySelector('[onclick*="unsubscribeOnline"]')?.getAttribute('onclick') ?? '';
      const unsubRes = /unsubscribeOnline\('(.+?)'/.exec(unsubAction);
      if (unsubRes) {
        bookId = unsubRes[1];
      }
    } else if (method === '现场支付') {
      const unsubAction =
        e.querySelector('[onclick*="unsubscribe"]')?.getAttribute('onclick') ?? '';
      const unsubRes = /unsubscribe\('(.+?)'/.exec(unsubAction);
      if (unsubRes) {
        bookId = unsubRes[1];
      }
    }
    const timeSpan = e.querySelector('span[time]');
    const bookTimestampString = timeSpan?.getAttribute('time');
    return {
      name: cellText(html, rowHtml, 1),
      field: cellText(html, rowHtml, 3),
      time: cellText(html, rowHtml, 5),
      price: cellText(html, rowHtml, 7),
      method,
      bookTimestamp:
        bookTimestampString === undefined ? undefined : Number(bookTimestampString),
      bookId,
      payId,
    };
  });
  const paid = await getSportsReservationPaidRecords();
  return unpaid.concat(paid);
}

export async function paySportsReservationLater(
  payId: string,
  receiptTitle = '清华大学',
): Promise<string> {
  const paymentHtml = await webvpnTransport.fetchText(SPORTS_MAKE_PAYMENT_LATER_URL, {
    body: {book_ids: payId, xm: receiptTitle},
    timeoutMs: 60000,
  });
  const payForm = parse(paymentHtml).querySelector('form');
  if (!payForm?.getAttribute('action')) {
    throw new Error('补支付表单缺失');
  }
  const action = payForm.getAttribute('action')!;
  const formBody = serializeFormInputs(payForm);
  const paymentApiHtml = await webvpnTransport.fetchText(action, {
    body: formBody,
    timeoutMs: 60000,
  });
  const searchResult = /var id = '(.*)?';\s*?var token = '(.*)?';/.exec(paymentApiHtml);
  if (!searchResult?.[1] || !searchResult[2]) {
    throw new Error('补支付 id/token 缺失');
  }
  const checkText = await webvpnTransport.fetchText(SPORTS_PAYMENT_CHECK_URL, {
    body: {id: searchResult[1], token: searchResult[2]},
  });
  const checkResult = JSON.parse(checkText) as {code?: string; message?: string};
  if (checkResult.code !== '0') {
    throw new Error(checkResult.message ?? '支付校验失败');
  }
  const inputs = parse(paymentApiHtml).querySelectorAll('#payForm input');
  const postForm: Record<string, string> = {};
  inputs.forEach(el => {
    const name = el.getAttribute('name');
    if (name) {
      postForm[name] = el.getAttribute('value') ?? '';
    }
  });
  postForm.channelId = '0101';
  const payPage = await webvpnTransport.fetchText(SPORTS_PAYMENT_ACTION_URL, {
    body: postForm,
  });
  return generalGetPayCode(payPage);
}

export async function unsubscribeSportsReservation(bookId: string): Promise<void> {
  await webvpnTransport.fetchText(SPORTS_UNSUBSCRIBE_URL, {body: {bookId}});
}
