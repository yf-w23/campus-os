/**
 * 成绩查询 — 对照 thu-info-lib basics.ts getReport。
 * 工作流：
 *   1) roamDefault('B7EF0ADF9406335AD7905B30CD7B49B1') 激活 zhjw 漫游
 *   2) GET cj.cjCjbAll.do?m=bks_cjdcx&cjdlx=zw&flag=di1
 *   3) cheerio-like 解析 <table cellspacing=1> 表格
 */
import {webvpnTransport} from '../webvpn/transport';
import {tsinghuaAuthService} from '../auth/tsinghuaAuth';
import {loadHtml, childText} from './htmlSelect';

const WEBVPN_BASE = 'https://webvpn.tsinghua.edu.cn';
const ZHJW_TOKEN =
  '77726476706e69737468656265737421eaff4b8b69336153301c9aa596522b20bc86e6e559a9b290';

const GET_BKS_REPORT_URL = `${WEBVPN_BASE}/http/${ZHJW_TOKEN}/cj.cjCjbAll.do?m=bks_cjdcx&cjdlx=zw`;
const GET_YJS_REPORT_URL = `${WEBVPN_BASE}/http/${ZHJW_TOKEN}/cj.cjCjbAll.do?m=yjs_cjdcx&cjdlx=zw`;

const BKS_REPORT_YYFWID = 'B7EF0ADF9406335AD7905B30CD7B49B1';
const YJS_REPORT_YYFWID = 'E35232808C08C8C5F199F13BF6B7F5D0';

const SYSTEM_TIMEOUT_MSG = 'time out用户登陆超时或访问内容不存在';
const WEBVPN_TITLE = '<title>清华大学WebVPN</title>';

/** thu-info-lib gradeToOldGPA */
const gradeToOldGPA: Record<string, number> = {
  'A+': 4.0, A: 4.0, 'A-': 3.7,
  'B+': 3.3, B: 3.0, 'B-': 2.7,
  'C+': 2.3, C: 2.0, 'C-': 1.7,
  'D+': 1.3, D: 1.0,
};

export interface GradeCourse {
  name: string;
  credit: number;
  grade: string;
  point: number;
  semester: string;
}

export interface GradeReportResult {
  courses: GradeCourse[];
  /** 学分绩（只算非 P/F 课程） */
  gpa: number;
  /** 计入学分绩的总学分 */
  totalCredit: number;
  /** 含 P/F 课的全部已修学分 */
  allCredit: number;
  bySemester: Record<string, GradeCourse[]>;
}

/**
 * 计算 GPA（与上游 thu-info-app `ui/home/report.tsx:prepareData` 一致）：
 *   - **跳过 point 为 NaN 的课程**（P/F、EX、CR 这类 pass/fail 课不计入学分绩）
 *   - totalCredit 与 totalPoint 都只累计有数值绩点的课
 *   - allCredit 是含 P/F 课在内的全部已修学分（"总学分"概念）
 */
function computeGpa(courses: GradeCourse[]): {
  gpa: number;
  totalCredit: number;
  allCredit: number;
} {
  let totalCredit = 0;
  let totalPoint = 0;
  let allCredit = 0;
  for (const c of courses) {
    const credit = Number(c.credit) || 0;
    if (credit <= 0) continue;
    allCredit += credit;
    // 关键：point 是 NaN 表示该课不计入学分绩（P/F 等），不要把 NaN 当 0 计算
    if (isNaN(c.point)) continue;
    totalCredit += credit;
    totalPoint += credit * c.point;
  }
  return {
    gpa: totalCredit > 0 ? totalPoint / totalCredit : 0,
    totalCredit,
    allCredit,
  };
}

function groupBySemester(courses: GradeCourse[]): Record<string, GradeCourse[]> {
  const map: Record<string, GradeCourse[]> = {};
  for (const c of courses) {
    const key = c.semester || '未分类';
    if (!map[key]) map[key] = [];
    map[key].push(c);
  }
  return map;
}

export async function fetchGradeReport(
  options: {graduate?: boolean; newGPA?: boolean; flag?: number} = {},
): Promise<GradeReportResult> {
  const {graduate = false, newGPA = true, flag = 1} = options;

  // 1) 激活漫游会话
  await tsinghuaAuthService.roamDefault(graduate ? YJS_REPORT_YYFWID : BKS_REPORT_YYFWID);

  // 2) 拉成绩 HTML
  const url = graduate
    ? GET_YJS_REPORT_URL
    : `${GET_BKS_REPORT_URL}&flag=di${flag}`;
  const html = await webvpnTransport.fetchText(url);

  if (html.includes(SYSTEM_TIMEOUT_MSG)) {
    throw new Error('教务系统会话超时，请重新登录');
  }
  if (html.includes(WEBVPN_TITLE)) {
    throw new Error('WebVPN 会话失效，请重新登录');
  }

  // 3) 解析 <table cellspacing=1>
  const $ = loadHtml(html);
  const rows = $('[cellspacing="1"] tr').slice(1);

  const courses: GradeCourse[] = [];
  rows.each((_, tr) => {
    try {
      const name = childText(tr, 3);
      const creditStr = childText(tr, 5);
      const grade = childText(tr, graduate ? 9 : 7);
      const pointStr = childText(tr, graduate ? 11 : 9);
      const semester = childText(tr, graduate ? 13 : 11);
      let point = Number(pointStr);
      if (!newGPA && grade in gradeToOldGPA) {
        point = gradeToOldGPA[grade];
      }
      if (!name) return;
      courses.push({
        name,
        credit: Number(creditStr) || 0,
        grade,
        // 关键：保留 NaN — 表示 P/F 等不计学分绩课程；UI / GPA 计算据此处理
        point,
        semester,
      });
    } catch {
      // 单行解析失败跳过
    }
  });

  if (courses.length === 0 && !html.includes('table1')) {
    throw new Error('未解析到成绩数据');
  }

  const {gpa, totalCredit, allCredit} = computeGpa(courses);
  return {
    courses,
    gpa,
    totalCredit,
    allCredit,
    bySemester: groupBySemester(courses),
  };
}
