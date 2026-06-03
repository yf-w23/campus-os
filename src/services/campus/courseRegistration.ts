/**
 * 选课系统 API — 对照 thu-info-lib cr.ts。
 * 所有接口通过 WebVPN 访问清华选课系统，GBK 编码由 transport 自动处理。
 */
import {parse} from 'node-html-parser';
import {tsinghuaAuthService} from '../auth/tsinghuaAuth';
import {webvpnTransport} from '../webvpn/transport';
import {
  CrRemainingInfo,
  CrSemester,
  SelectedCourse,
  Will,
  Priority,
} from '../../domain/courseRegistration';

const WEBVPN_BASE = 'https://webvpn.tsinghua.edu.cn';
const CR_TOKEN = 'eaff4b8b3f3b2653770bc7b88b5c2d320506b1aec738590a49ba';

const CR_MAIN_URL = `${WEBVPN_BASE}/https/${CR_TOKEN}/xkBks.vxkBksXkbBs.do?m=main`;
const CR_TREE_URL = `${WEBVPN_BASE}/https/${CR_TOKEN}/xkBks.vxkBksXkbBs.do?m=showTree&p_xnxq=`;
const CR_SEARCH_URL = `${WEBVPN_BASE}/https/${CR_TOKEN}/xkBks.vxkBksJxjhBs.do`;
const CR_SELECT_URL = `${WEBVPN_BASE}/https/${CR_TOKEN}/xkBks.vxkBksXkbBs.do`;

const CR_ROAM_PAYLOAD = '';

function assertCrHtml(html: string): void {
  if (html.includes('<title>清华大学WebVPN</title>')) {
    throw new Error('选课系统未登录，请返回首页点击同步校园数据后重试');
  }
  if (html.includes('用户登陆超时或访问内容不存在')) {
    throw new Error('选课系统会话超时，请重新登录');
  }
}

async function crFetch(
  url: string,
  post?: Record<string, string>,
): Promise<string> {
  const result = await webvpnTransport.fetchText(url, post ? {body: post} : undefined);
  assertCrHtml(result);
  return result;
}

async function ensureCrSession(): Promise<void> {
  await tsinghuaAuthService.roamDefault(CR_ROAM_PAYLOAD);
}

async function withCrSession<T>(
  operation: () => Promise<T>,
  label: string,
): Promise<T> {
  return tsinghuaAuthService.withSessionRecovery(
    async () => {
      await ensureCrSession();
      return operation();
    },
    ensureCrSession,
    label,
  );
}

export async function getCrAvailableSemesters(): Promise<CrSemester[]> {
  return withCrSession(async () => {
    const root = await crFetch(CR_MAIN_URL);
    const baseSemMatch = /m=showTree&p_xnxq=(\d\d\d\d-\d\d\d\d-\d)/.exec(root);
    if (!baseSemMatch) {
      throw new Error('未找到学期信息');
    }
    const treeHtml = await crFetch(CR_TREE_URL + baseSemMatch[1]);
    const document = parse(treeHtml);
    return document.querySelectorAll('option').map(e => ({
      id: e.getAttribute('value') ?? '',
      name: (e.text ?? '').trim(),
    }));
  }, 'cr-available-semesters');
}

export interface CrRemainingSearchResult {
  currPage: number;
  totalPage: number;
  totalCount: number;
  courses: CrRemainingInfo[];
}

function parseFooter(document: ReturnType<typeof parse>): [number, number, number] {
  const footer = document.querySelector('p.yeM');
  if (!footer) {
    return [1, 1, 0];
  }
  const footerText = (footer.text ?? '').replace(/,/g, '');
  const regResult = /第\s*(\d+)\s*页\s*\/\s*共\s*(\d+)\s*页（共\s*(\d+)\s*条记录）/.exec(footerText);
  if (!regResult || regResult.length !== 4) {
    return [1, 1, 0];
  }
  return [Number(regResult[1]), Number(regResult[2]), Number(regResult[3])];
}

export async function searchCrRemaining(params: {
  semester: string;
  page?: number;
  id?: string;
  name?: string;
  dayOfWeek?: number;
  period?: number;
}): Promise<CrRemainingSearchResult> {
  return withCrSession(async () => {
    const document = await crFetch(CR_SEARCH_URL, {
      m: 'kylSearch',
      page: String(params.page ?? -1),
      'p_sort.p1': '',
      'p_sort.p2': '',
      'p_sort.asc1': 'true',
      'p_sort.asc2': 'true',
      p_xnxq: params.semester,
      pathContent: '课余量查询',
      p_kch: params.id ?? '',
      p_kxh: '',
      p_kcm: params.name ?? '',
      p_skxq: params.dayOfWeek != null ? String(params.dayOfWeek) : '',
      p_skjc: params.period != null ? String(params.period) : '',
      goPageNumber: String(params.page ?? 1),
    }).then(parse);

    const [currPage, totalPage, totalCount] = parseFooter(document);

    const courses: CrRemainingInfo[] = [];
    const rows = document.querySelectorAll('.trr2');
    for (let i = 0; i < rows.length; i++) {
      const tds = rows[i].querySelectorAll('td');
      if (tds.length < 6) {
        continue;
      }
      const hasQueueInfo = tds.length >= 8;
      courses.push({
        id: (tds[0]?.text ?? '').trim(),
        seq: Number((tds[1]?.text ?? '').trim()),
        name: (tds[2]?.text ?? '').trim(),
        capacity: Number((tds[3]?.text ?? '').trim()),
        remaining: Number((tds[4]?.text ?? '').trim()),
        queue: hasQueueInfo ? Number((tds[5]?.text ?? '').trim()) : 0,
        teacher: (tds[hasQueueInfo ? 6 : 5]?.text ?? '').trim(),
        time: (tds[hasQueueInfo ? 7 : 6]?.text ?? '').trim(),
      });
    }

    return {currPage, totalPage, totalCount, courses};
  }, 'cr-search-remaining');
}

/**
 * 提交选课。
 * @param semesterId 学期 ID，如 "2024-2025-2"
 * @param priority 选课类型：bx=必修, xx=限选, rx=任选, ty=体育
 * @param courseId 课程号
 * @param courseSeq 课序号
 * @param will 志愿：1/2/3
 */
export async function selectCourse(
  semesterId: string,
  priority: Priority,
  courseId: string,
  courseSeq: string,
  will: Will,
): Promise<string> {
  return withCrSession(async () => {
    const mainHtml = await crFetch(
      `${CR_SELECT_URL}?m=${priority}Search&p_xnxq=${semesterId}&tokenPriFlag=${priority}`,
    );
    const $ = parse(mainHtml);
    const m = `save${priority[0].toUpperCase()}${priority[1]}Kc`;
    const tokenInput = $.querySelector('input[name=token]');
    if (!tokenInput) {
      throw new Error('选课表单缺少 token');
    }
    const token = tokenInput.getAttribute('value') ?? '';
    const fieldKey =
      priority === 'rx' ? 'rx' :
      priority === 'ty' ? 'rxTy' :
      priority + 'k';

    const post: Record<string, string> = {
      m,
      token,
      p_xnxq: semesterId,
      tokenPriFlag: priority,
    };
    post[`p_${fieldKey}_id`] = `${semesterId};${courseId};${courseSeq};`;
    post[`p_${fieldKey}_xkzy`] = String(will);

    const responseHtml = await crFetch(CR_SELECT_URL, post);
    const responseMsg = /showMsg\("(.+?)"\);/g.exec(responseHtml);
    if (!responseMsg) {
      throw new Error('选课响应解析失败');
    }
    return responseMsg[1];
  }, 'cr-select-course');
}

/**
 * 删除已选课程。
 */
export async function deleteCourse(
  semesterId: string,
  courseId: string,
  courseSeq: string,
): Promise<string> {
  return withCrSession(async () => {
    const yxHtml = await crFetch(
      `${CR_SELECT_URL}?m=yxSearchTab&p_xnxq=${semesterId}&tokenPriFlag=yx`,
    );
    const $ = parse(yxHtml);
    const tokenInput = $.querySelector('input[name=token]');
    if (!tokenInput) {
      throw new Error('已选课程页缺少 token');
    }
    const token = tokenInput.getAttribute('value') ?? '';
    const post: Record<string, string> = {
      m: 'deleteYxk',
      token,
      p_xnxq: semesterId,
      tokenPriFlag: 'yx',
    };
    post['p_del_id'] = `${semesterId};${courseId};${courseSeq};`;
    const responseHtml = await crFetch(CR_SELECT_URL, post);
    const responseMsg = /showMsg\("(.+?)"\);/g.exec(responseHtml);
    if (!responseMsg) {
      throw new Error('删除选课响应解析失败');
    }
    return responseMsg[1];
  }, 'cr-delete-course');
}

function willStringToNumber(will: string): Will {
  switch (will) {
    case '第一志愿':
      return 1;
    case '第二志愿':
      return 2;
    default:
      return 3;
  }
}

/**
 * 获取已选课程列表。
 */
export async function getSelectedCourses(
  semesterId: string,
): Promise<SelectedCourse[]> {
  return withCrSession(async () => {
    const yxHtml = await crFetch(
      `${CR_SELECT_URL}?m=yxSearchTab&p_xnxq=${semesterId}&tokenPriFlag=yx`,
    );
    const $ = parse(yxHtml);
    const rows = $.querySelectorAll('.trr2 tbody tr, .trr2');
    if (rows.length === 0) {
      return [];
    }
    const result: SelectedCourse[] = [];
    for (let i = 0; i < rows.length; i++) {
      const tds = rows[i].querySelectorAll('.tdd2, td');
      if (tds.length < 9) {
        continue;
      }
      result.push({
        type: (tds[1]?.text ?? '').trim(),
        will: willStringToNumber((tds[2]?.text ?? '').trim()),
        id: (tds[3]?.text ?? '').trim(),
        seq: (tds[5]?.text ?? '').trim(),
        name: (tds[4]?.text ?? '').trim(),
        time: (tds[6]?.text ?? '').trim(),
        teacher: (tds[7]?.text ?? '').trim(),
        credit: Number((tds[8]?.text ?? '').trim()),
        secondary: (tds[9]?.text ?? '').trim() === '是',
      });
    }
    return result;
  }, 'cr-selected-courses');
}
