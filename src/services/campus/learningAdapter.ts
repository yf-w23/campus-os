import {
  CourseFile,
  CourseInfo,
  HomeworkItem,
  HomeworkStatus,
  LearningSnapshot,
  NotificationItem,
  ScheduleEvent,
} from '../../domain/learning';
import {webvpnTransport} from '../webvpn/transport';
import {
  ENDPOINTS,
  LEARN_BASE,
  learnCourseListUrl,
  learnFileListUrl,
  learnHomeworkListUrl,
  learnNotificationListUrl,
  withCsrf,
} from '../webvpn/constants';
import {tsinghuaAuthService} from '../auth/tsinghuaAuth';
import {parseJsonpSchedule, mapScheduleRows} from './scheduleParser';

/** 兼容旧 API（已废弃，但 thunks 还在调） */
export function clearLearnSessionCache(): void {
  // no-op：csrf 现在挂在 tsinghuaAuthService 上，由登录流程提供
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"');
}

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * 网络学堂的时间字段（jzsj、fbsj、scsj 等）可能是：
 *   - number：毫秒 Unix 时间戳
 *   - string："2026-05-22 16:00:00" / "2026-05-22T16:00:00.000Z"
 *   - null/undefined
 * 统一格式化为 "YYYY-MM-DD HH:mm" 字符串。
 */
function formatDateTime(value: unknown): string {
  if (value == null || value === '') {
    return '';
  }
  if (typeof value === 'number') {
    const d = new Date(value);
    if (isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  const text = String(value);
  // 已经是日期字符串：保留主体
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
    return text.replace('T', ' ').slice(0, 16);
  }
  // 纯数字字符串
  if (/^\d{10,13}$/.test(text)) {
    const num = Number(text);
    const ts = text.length === 10 ? num * 1000 : num;
    return formatDateTime(ts);
  }
  return text;
}

function classifyHomework(
  submitted: boolean,
  graded: boolean,
  deadline: string,
): HomeworkStatus {
  if (graded) {
    return 'graded';
  }
  if (submitted) {
    return 'submitted';
  }
  if (deadline) {
    const ts = Date.parse(deadline.replace(' ', 'T'));
    if (!isNaN(ts) && ts < Date.now()) {
      return 'overdue';
    }
  }
  return 'pending';
}

function getCsrf(): string {
  const token = tsinghuaAuthService.getCsrfToken();
  if (!token) {
    throw new Error('未登录，无 CSRF token');
  }
  return token;
}

async function postLearnAoData(path: string, courseId?: string): Promise<any> {
  const csrf = getCsrf();
  const aoData = JSON.stringify(courseId ? [{name: 'wlkcid', value: courseId}] : []);
  const form = new FormData();
  form.append('aoData', aoData);
  return webvpnTransport.fetchJson(withCsrf(`${LEARN_BASE}${path}`, csrf), {
    body: form,
  });
}

// ====== 课表（通过 zhjw）======
function formatScheduleDate(date: Date): string {
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
}

export async function fetchScheduleRange(
  startDate: string,
  endDate: string,
): Promise<ScheduleEvent[]> {
  // 与 thu-learn-lib getCalendar 一致：先激活 zhjw 会话
  await tsinghuaAuthService.activateRegistrar();
  const url = `${ENDPOINTS.registrarCalendar}?m=bks_jxrl_all&p_start_date=${startDate}&p_end_date=${endDate}&jsoncallback=m`;
  const raw = await webvpnTransport.fetchText(url);
  return mapScheduleRows(parseJsonpSchedule(raw));
}

// ====== 课程列表 ======
export async function fetchCourses(): Promise<CourseInfo[]> {
  const csrf = getCsrf();
  const semesterUrl = withCsrf(ENDPOINTS.learnCurrentSemester, csrf);
  const semesterJson = (await webvpnTransport.fetchJson(semesterUrl)) as any;
  if (semesterJson?.message !== 'success' || !semesterJson?.result?.id) {
    throw new Error('未获取到当前学期');
  }
  const semesterId = semesterJson.result.id;

  const listUrl = withCsrf(learnCourseListUrl(semesterId, 'zh'), csrf);
  const listJson = (await webvpnTransport.fetchJson(listUrl)) as any;
  const rows: any[] = listJson?.resultList ?? [];

  return rows.map(row => ({
    id: row.wlkcid,
    name: decodeHtmlEntities(row.kcm ?? row.zywkcm ?? ''),
    teacherName: row.jsm ?? '',
    timeAndLocation: [],
    courseNumber: row.kch ?? '',
  }));
}

// ====== 作业 ======
async function fetchHomeworkForCourse(course: CourseInfo): Promise<HomeworkItem[]> {
  const items: HomeworkItem[] = [];
  const endpoints = [
    {suffix: 'Wj' as const, submitted: false, graded: false},
    {suffix: 'Yjwg' as const, submitted: true, graded: false},
    {suffix: 'Ypg' as const, submitted: true, graded: true},
  ];

  for (const ep of endpoints) {
    try {
      const json = await postLearnAoData(
        `/b/wlxt/kczy/zy/student/zyList${ep.suffix}`,
        course.id,
      );
      const rows: any[] = json?.object?.aaData ?? [];
      for (const row of rows) {
        const deadline = formatDateTime(row.jzsj);
        const lateDeadline = formatDateTime(row.bjjzsj);
        // 对齐 learnX URLS.LEARN_HOMEWORK_PAGE: wlkcid + xszyid 都不能少
        const wlkcid = row.wlkcid ?? course.id;
        items.push({
          id: row.xszyid,
          baseId: row.zyid,
          courseId: course.id,
          courseName: course.name,
          title: decodeHtmlEntities(row.bt ?? ''),
          deadline,
          lateSubmissionDeadline: lateDeadline || undefined,
          submitted: ep.submitted,
          graded: ep.graded,
          isLateSubmission: row.sfbj === '是',
          status: classifyHomework(ep.submitted, ep.graded, deadline),
          grade: row.cj != null ? Number(row.cj) : undefined,
          url: `${LEARN_BASE}/f/wlxt/kczy/zy/student/viewCj?wlkcid=${wlkcid}&xszyid=${row.xszyid}`,
        });
      }
    } catch {
      // 单门课某状态失败跳过
    }
  }
  return items;
}

export async function fetchHomework(courses: CourseInfo[]): Promise<HomeworkItem[]> {
  const batches = await Promise.all(courses.map(c => fetchHomeworkForCourse(c)));
  // 按截止日期倒序：未来作业靠前；过期作业越远越靠后
  return batches.flat().sort((a, b) => {
    const ta = a.deadline ? new Date(a.deadline.replace(' ', 'T')).getTime() : 0;
    const tb = b.deadline ? new Date(b.deadline.replace(' ', 'T')).getTime() : 0;
    return tb - ta;
  });
}

// ====== 通知 ======
async function fetchNotificationsForCourse(course: CourseInfo): Promise<NotificationItem[]> {
  const items: NotificationItem[] = [];
  for (const expired of [false, true]) {
    try {
      const json = await postLearnAoData(
        learnNotificationListUrl(expired).replace(LEARN_BASE, ''),
        course.id,
      );
      const rows: any[] = json?.object?.aaData ?? json?.object?.resultsList ?? [];
      for (const row of rows) {
        // 网络学堂通知内容是 Base64 编码
        let content = '';
        try {
          content =
            typeof atob === 'function'
              ? decodeURIComponent(escape(atob(row.ggnr ?? '')))
              : decodeHtmlEntities(row.ggnr ?? '');
        } catch {
          content = decodeHtmlEntities(row.ggnr ?? '');
        }
        items.push({
          id: row.ggid,
          courseId: course.id,
          courseName: course.name,
          title: decodeHtmlEntities(row.bt ?? ''),
          content,
          publishTime: formatDateTime(row.fbsj),
          expireTime: formatDateTime(row.jzsj),
          hasRead: row.sfyd === '是',
          expired,
          publisher: row.fbrxm ?? '',
        });
      }
    } catch {
      // skip
    }
  }
  return items;
}

export async function fetchNotifications(
  courses: CourseInfo[],
): Promise<NotificationItem[]> {
  const batches = await Promise.all(courses.map(c => fetchNotificationsForCourse(c)));
  return batches
    .flat()
    .sort((a, b) => new Date(b.publishTime).getTime() - new Date(a.publishTime).getTime());
}

// ====== 课件文件 ======
async function fetchFilesForCourse(course: CourseInfo): Promise<CourseFile[]> {
  const items: CourseFile[] = [];
  try {
    const csrf = getCsrf();
    const url = withCsrf(learnFileListUrl(course.id), csrf);
    const json = (await webvpnTransport.fetchJson(url)) as any;
    const rows: any[] = json?.object?.resultsList ?? json?.object ?? [];
    for (const row of rows) {
      const fileId = row.wjid ?? row[7];
      const title = decodeHtmlEntities(row.bt ?? row[1] ?? '');
      items.push({
        id: row.kjxxid ?? row[0],
        fileId,
        courseId: course.id,
        courseName: course.name,
        title,
        description: decodeHtmlEntities(row.ms ?? row[2] ?? ''),
        uploadTime: formatDateTime(row.scsj ?? row[4]),
        size: String(row.fileSize ?? row.wjdx ?? ''),
        fileType: String(row.wjlx ?? row[8] ?? ''),
        isNew: row.isNew === true || row.sfqd === '是',
        downloadUrl: `${LEARN_BASE}/b/wlxt/kj/wlkc_kjxxb/student/downloadFile?sfgk=0&wjid=${fileId}`,
        // 对齐 learnX LEARN_FILE_PREVIEW：mk=mk_kcwj & browser=-1 & sfgk=0 & pageType=all
        previewUrl: `${LEARN_BASE}/f/wlxt/kc/wj_wjb/student/beforePlay?wjid=${fileId}&mk=mk_kcwj&browser=-1&sfgk=0&pageType=all`,
      });
    }
  } catch {
    // skip
  }
  return items;
}

export async function fetchCourseFiles(courses: CourseInfo[]): Promise<CourseFile[]> {
  const batches = await Promise.all(courses.map(c => fetchFilesForCourse(c)));
  return batches.flat();
}

// ====== 聚合 ======
export async function fetchLearningCoreSnapshot(): Promise<LearningSnapshot> {
  // 1) 拉课程
  const courses = await fetchCourses();

  // 2) 拉课表（zhjw 漫游）
  let schedule: ScheduleEvent[] = [];
  try {
    const today = new Date();
    const end = new Date(today);
    end.setDate(end.getDate() + 21);
    schedule = await fetchScheduleRange(
      formatScheduleDate(today),
      formatScheduleDate(end),
    );
  } catch {
    // 课表失败不阻塞
  }

  // 3) 拉作业
  let homework: HomeworkItem[] = [];
  if (courses.length) {
    homework = await fetchHomework(courses);
  }

  return {
    courses,
    schedule,
    notifications: [],
    homework,
    files: [],
    fetchedAt: new Date().toISOString(),
  };
}

export async function fetchLearningExtras(
  courses: CourseInfo[],
): Promise<Pick<LearningSnapshot, 'notifications' | 'files'>> {
  if (courses.length === 0) {
    return {notifications: [], files: []};
  }
  try {
    const [notifications, files] = await Promise.all([
      fetchNotifications(courses),
      fetchCourseFiles(courses),
    ]);
    return {notifications, files};
  } catch {
    return {notifications: [], files: []};
  }
}

export async function fetchLearningSnapshot(): Promise<LearningSnapshot> {
  const core = await fetchLearningCoreSnapshot();
  const extras = await fetchLearningExtras(core.courses);
  return {...core, ...extras, fetchedAt: new Date().toISOString()};
}
