/**
 * 校园模块各服务的 webvpn 包装 URL，与 thu-info-lib/src/constants/strings.ts 严格一致。
 * 由 InAppViewer 直接加载（依赖原生 Cookie 池中已有的 webvpn 会话）；
 * 各入口的 SUBSYSTEM_KIND 标记决定打开前是否要先做 SSO 漫游建立后端会话。
 */
import {SUBSYSTEM_YYFWID} from '../webvpn/constants';

const ZHJW_TOKEN =
  '77726476706e69737468656265737421eaff4b8b69336153301c9aa596522b20bc86e6e559a9b290';
const DORM_TOKEN =
  '77726476706e69737468656265737421fdb94c852f3f6555301c9aa596522b20e7a45e0b22fda391';
const ELE_TOKEN =
  '77726476706e69737468656265737421fdee49932a3526446d0187ab9040227bca90a6e14cc9';
const LIB_TOKEN =
  '77726476706e69737468656265737421e3f24088693c6152301c9aa596522b204c02212b859d0a19';
const ROOM_BOOKING_TOKEN =
  '77726476706e69737468656265737421f3f643d22b396a1e6a1b80a29f5d363409e413829737d1';
const INFO_TOKEN =
  '77726476706e69737468656265737421f9f9479369247b59700f81b9991b2631506205de';
// 体育馆预约（场馆预约时用）
export const SPORTS_TOKEN =
  '77726476706e69737468656265737421f6f6571f29396a1e75469ea69b';

const WEBVPN_BASE = 'https://webvpn.tsinghua.edu.cn';

/** 成绩 — 本科生 */
export const GRADE_BKS_URL = `${WEBVPN_BASE}/http/${ZHJW_TOKEN}/cj.cjCjbAll.do?m=bks_cjdcx&cjdlx=zw`;
/** 成绩 — 研究生 */
export const GRADE_YJS_URL = `${WEBVPN_BASE}/http/${ZHJW_TOKEN}/cj.cjCjbAll.do?m=yjs_cjdcx&cjdlx=zw`;
/** 教室查询主页 */
export const CLASSROOM_LIST_URL = `${WEBVPN_BASE}/http/${ZHJW_TOKEN}/portal3rd.do?url=/portal3rd.do&m=jasJy_Xs_Js_index`;
/** 体测页面 */
export const PHYSICAL_EXAM_HOME_URL = `${WEBVPN_BASE}/http/${ZHJW_TOKEN}/portal3rd.do?url=/portal3rd.do&m=tyjx_index`;
/**
 * 宿舍电费充值：对应 thu-info-lib `RECHARGE_ELE_URL`（GET 着陆页 + 表单），
 * 不是 `recharge_pay_ele.aspx`（POST 提交端点，GET 它会被服务器拒）。
 */
export const DORM_ELE_URL = `${WEBVPN_BASE}/http/${ELE_TOKEN}/netweb_user/recharge_ele.aspx`;
/** 宿舍电费余额详情（只读余额信息）*/
export const DORM_ELE_DETAIL_URL = `${WEBVPN_BASE}/http/${ELE_TOKEN}/Netweb_List/Netweb_Home_electricity_Detail.aspx`;
/** 宿舍健康打卡 */
export const DORM_HEALTH_URL = `${WEBVPN_BASE}/https/${DORM_TOKEN}/weixin/weixin_user_authenticate.aspx`;
/** 图书馆 */
export const LIBRARY_URL = `${WEBVPN_BASE}/https/${LIB_TOKEN}/home/web/f_second`;
/** 图书馆研讨间 */
export const LIBRARY_ROOM_URL = `${WEBVPN_BASE}/https/${ROOM_BOOKING_TOKEN}/`;
/** 清华邮箱：经信息门户 yyfwid 漫游到 Coremail，进入后可收信 / 写信。 */
export const MAIL_PORTAL_URL = `${WEBVPN_BASE}/https/${INFO_TOKEN}/f/info/portal_fg/common/roamingToApp?yyfwid=${SUBSYSTEM_YYFWID.mail}`;

/**
 * 子系统会话激活方式：
 * - "default-roam"：服务端走 thu-info-lib roamingWrapper("default", yyfwid)，由 native 代码直接 fetch（grades / classroom / pe）
 * - "id-roam"：WebView 入口；打开前先 roamIdPolicy(payload) 建立子系统 ASP.NET / portal 会话
 * - "cab-login"：研讨间；打开前先走 cabLogin 拿动态 payload 再 roam
 * - "none"：不需要额外漫游（默认）
 */
export type SubsystemKind = 'default-roam' | 'id-roam' | 'cab-login' | 'none';

export interface SubsystemEntry {
  url: string;
  kind: SubsystemKind;
  payload?: string;
}

/** 入口 URL ↔ 激活方式 的映射，CampusEntryScreen 据此分发到 tsinghuaAuthService 的对应方法。 */
export const SUBSYSTEM_ENTRIES: Record<string, SubsystemEntry> = {
  [DORM_ELE_URL]: {
    url: DORM_ELE_URL,
    kind: 'id-roam',
    payload: SUBSYSTEM_YYFWID.dormElectricity,
  },
  [DORM_ELE_DETAIL_URL]: {
    url: DORM_ELE_DETAIL_URL,
    kind: 'id-roam',
    payload: SUBSYSTEM_YYFWID.dormElectricity,
  },
  [DORM_HEALTH_URL]: {
    url: DORM_HEALTH_URL,
    kind: 'id-roam',
    payload: SUBSYSTEM_YYFWID.dormHealth,
  },
  [LIBRARY_URL]: {
    url: LIBRARY_URL,
    kind: 'id-roam',
    payload: SUBSYSTEM_YYFWID.librarySeat,
  },
  [LIBRARY_ROOM_URL]: {
    url: LIBRARY_ROOM_URL,
    kind: 'cab-login',
  },
  [MAIL_PORTAL_URL]: {
    url: MAIL_PORTAL_URL,
    kind: 'id-roam',
    payload: SUBSYSTEM_YYFWID.infoPortal,
  },
};
