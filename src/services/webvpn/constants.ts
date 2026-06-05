// 完全照搬 thu-learn-lib + thu-info-lib 的直连方式：不走 webvpn，直接经 SSO 访问 learn / zhjw
export const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.88 Safari/537.36';

export const ID_HOST_URL = 'https://id.tsinghua.edu.cn';
export const LEARN_BASE = 'https://learn.tsinghua.edu.cn';
export const REGISTRAR_BASE = 'https://zhjw.cic.tsinghua.edu.cn';

// webvpn / oauth
export const WEBVPN_ROOT_URL = 'https://webvpn.tsinghua.edu.cn';
export const WEBVPN_OAUTH_LOGIN_URL = `${WEBVPN_ROOT_URL}/login?oauth_login=true`;
export const OAUTH_LBREDIRECT_PREFIX =
  'https://oauth.tsinghua.edu.cn/lb-auth/lbredirect';

// id 域统一通路
export const ID_BASE_URL = `${ID_HOST_URL}/do/off/ui/auth/login/form/`;
export const ID_LOGIN_URL = `${ID_HOST_URL}/do/off/ui/auth/login/check`;

// thu-info-lib 主登录后立刻 roam 的 portal yyfwid（建立 info.tsinghua 后端会话）
export const INFO_PORTAL_YYFWID = '10000ea055dd8d81d09d5a1ba55d39ad';
// thu-learn-lib 中的固定 yyfwid，专用于 learn 网络学堂登录
export const LEARN_LOGIN_YYFWID = 'bb5df85216504820be7bba2b0ae1535b/0';

// 校园子系统 yyfwid（对照 thu-info-lib/src/lib/*.ts）
export const SUBSYSTEM_YYFWID = {
  // 信息门户首页：邮箱等门户应用要先建立这个后端会话，再走 roamingToApp。
  infoPortal: INFO_PORTAL_YYFWID,
  // 宿舍 / 电费（dorm.ts）
  dormElectricity: '0a993de7e533cd43a594459abdcab27d/1',
  dormHealth: '0a993de7e533cd43a594459abdcab27d/0',
  // 图书馆座位（library.ts getAccessToken）
  librarySeat: 'ef84f6d6784f6b834e5214f432d6173f/0?/api/id_tsinghua_callback',
  // 清华邮箱（信息门户“清华邮箱”入口）
  mail: 'F315577F5BF20E1B1668EDD594B2C04F',
} as const;

export const ENDPOINTS = {
  // === 清华统一身份认证 ===
  idLoginForm: `${ID_BASE_URL}${LEARN_LOGIN_YYFWID}`,
  idLoginCheck: ID_LOGIN_URL,
  doubleAuth: `${ID_HOST_URL}/b/doubleAuth/login`,
  saveFinger: `${ID_HOST_URL}/b/doubleAuth/personal/saveFinger`,

  // === 网络学堂 ===
  learnAuthRoam: `${LEARN_BASE}/b/j_spring_security_thauth_roaming_entry`,
  learnStudentHome: `${LEARN_BASE}/f/wlxt/index/course/student/`,
  learnCurrentSemester: `${LEARN_BASE}/b/kc/zhjw_v_code_xnxq/getCurrentAndNextSemester`,

  // === 教务系统（课表）===
  registrarTicket: `${LEARN_BASE}/b/wlxt/common/auth/gnt`,
  registrarAuthPrefix: `${REGISTRAR_BASE}/j_acegi_login.do?url=/&ticket=`,
  registrarCalendar: `${REGISTRAR_BASE}/jxmh_out.do`,

  // === info.tsinghua.edu.cn 用户基本信息（用于校验 info portal session）===
  infoUserData: `${WEBVPN_ROOT_URL}/https/77726476706e69737468656265737421f9f9479369247b59700f81b9991b2631506205de/b/info/gxfw_fg/common/grjbxx`,

  // === 培养方案 ===
  programRoot: `${WEBVPN_ROOT_URL}/https/77726476706e69737468656265737421faef5b8779`,
  programCompletion: `${WEBVPN_ROOT_URL}/https/77726476706e69737468656265737421faef5b8779/pyfa/main`,
  programList: `${WEBVPN_ROOT_URL}/https/77726476706e69737468656265737421faef5b8779/pyfa/list`,

  // === 研讨间 (cab) — 需要先 fetch authAddress 拿动态 payload 再 roam ===
  libRoomBookingRoot:
    `${WEBVPN_ROOT_URL}/https/77726476706e69737468656265737421f3f643d22b396a1e6a1b80a29f5d363409e413829737d1`,
  libRoomBookingQueryAuthAddress:
    `${WEBVPN_ROOT_URL}/https/77726476706e69737468656265737421f3f643d22b396a1e6a1b80a29f5d363409e413829737d1/ic-web/auth/address?finalAddress=https:%2F%2Fcab.lib.tsinghua.edu.cn&errPageUrl=https:%2F%2Fcab.lib.tsinghua.edu.cn%2F%23%2Ferror&manager=false&consoleType=16`,
  libRoomBookingUserInfo:
    `${WEBVPN_ROOT_URL}/https/77726476706e69737468656265737421f3f643d22b396a1e6a1b80a29f5d363409e413829737d1/ic-web/auth/userInfo`,
} as const;

export function learnCourseListUrl(semesterId: string, lang: 'zh' | 'en' = 'zh'): string {
  return `${LEARN_BASE}/b/wlxt/kc/v_wlkc_xs_xkb_kcb_extend/student/loadCourseBySemesterId/${semesterId}/${lang}`;
}

export function learnHomeworkListUrl(suffix: 'Wj' | 'Yjwg' | 'Ypg'): string {
  return `${LEARN_BASE}/b/wlxt/kczy/zy/student/zyList${suffix}`;
}

export function learnNotificationListUrl(expired: boolean): string {
  return `${LEARN_BASE}/b/wlxt/kcgg/wlkc_ggb/student/pageListXsby${expired ? 'Ygq' : 'Wgq'}`;
}

export function learnFileListUrl(courseId: string, size = 200): string {
  return `${LEARN_BASE}/b/wlxt/kj/wlkc_kjxxb/student/kjxxbByWlkcidAndSizeForStudent?wlkcid=${courseId}&size=${size}`;
}

export function learnCourseTimeLocationUrl(courseId: string): string {
  return `${LEARN_BASE}/b/kc/v_wlkc_xk_sjddb/detail?id=${courseId}`;
}

/** 给 learn 的 API URL 添加 _csrf 参数 */
export function withCsrf(url: string, csrf: string): string {
  return url + (url.includes('?') ? '&' : '?') + '_csrf=' + encodeURIComponent(csrf);
}
