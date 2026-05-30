/**
 * 作业详情 native 抓取 —— 对照 thu-learn-lib `parseHomeworkAtUrl`。
 *
 * 抓取网络学堂 viewCj 页面（HomeworkItem.url）的 HTML 并解析出：
 *   - 作业说明 / 答案说明 / 上交作业内容（富文本 HTML）
 *   - 作业附件 / 答案附件 / 上交作业附件 / 评语附件（提供下载链接）
 *   - 发布对象（best-effort 文本解析）
 *
 * 截止日期、完成方式、提交日期、批阅老师 / 时间 / 成绩 / 评语等结构化字段
 * 已在 learningAdapter 列表 JSON 阶段拿到，直接挂在 HomeworkItem 上。
 */
import {parse, HTMLElement} from 'node-html-parser';
import {webvpnTransport} from '../webvpn/transport';
import {tsinghuaAuthService} from '../auth/tsinghuaAuth';
import {LEARN_BASE} from '../webvpn/constants';
import {HomeworkDetail, HomeworkItem, RemoteFile} from '../../domain/learning';

/** 从 query 串里取参数（RN 内置 URLSearchParams.get 不可靠，手写解析）*/
function getQueryParam(query: string, key: string): string | undefined {
  for (const pair of query.split('&')) {
    const eq = pair.indexOf('=');
    const k = eq >= 0 ? pair.slice(0, eq) : pair;
    if (k === key) {
      const v = eq >= 0 ? pair.slice(eq + 1) : '';
      try {
        return decodeURIComponent(v);
      } catch {
        return v;
      }
    }
  }
  return undefined;
}

function parseHomeworkFile(div: HTMLElement | undefined): RemoteFile | undefined {
  if (!div) return undefined;
  const anchor =
    div.querySelector('.ftitle a') ??
    div.querySelector('.fl a') ??
    div.querySelector('a');
  if (!anchor) return undefined;
  const href = anchor.getAttribute('href') ?? '';
  if (!href) return undefined;

  const queryPart = href.split('?').slice(-1)[0];
  const fileId =
    getQueryParam(queryPart, 'fileId') ?? getQueryParam(queryPart, 'wjid') ?? '';

  const absolutize = (p: string) =>
    p.startsWith('http') ? p : `${LEARN_BASE}${p.startsWith('/') ? '' : '/'}${p}`;

  let downloadUrl = absolutize(href);
  const dl = getQueryParam(queryPart, 'downloadUrl');
  if (dl) {
    downloadUrl = absolutize(dl);
  }

  const name = anchor.text.trim() || '附件';
  const sizeNode = div.querySelector('.fl span') ?? div.querySelector('span');
  const size = sizeNode ? sizeNode.text.trim() : '';

  return {
    id: fileId,
    name,
    downloadUrl,
    previewUrl: fileId
      ? `${LEARN_BASE}/f/wlxt/kc/wj_wjb/student/beforePlay?wjid=${fileId}&mk=mk_kczy&browser=-1&sfgk=0&pageType=all`
      : downloadUrl,
    size,
  };
}

/** best-effort：在页面里找"发布对象"标签，取其同级 / 右侧内容 */
function extractPublishTarget(root: HTMLElement): string | undefined {
  const candidates = [
    ...root.querySelectorAll('div'),
    ...root.querySelectorAll('td'),
    ...root.querySelectorAll('span'),
  ];
  for (const el of candidates) {
    const text = el.text.trim();
    if (text === '发布对象' || text === '发布对象：' || text === '发布对象:') {
      const sib = el.nextElementSibling;
      if (sib) {
        const v = sib.text.trim();
        if (v) return v;
      }
      const parent = el.parentNode as HTMLElement | null;
      if (parent) {
        const right =
          parent.querySelector('.fl.right') ??
          parent.querySelector('.right') ??
          parent.querySelector('.c55');
        if (right) {
          const v = right.text.trim();
          if (v && v !== text) return v;
        }
      }
    }
  }
  return undefined;
}

function trimOrUndefined(value: string | undefined | null): string | undefined {
  const v = (value ?? '').trim();
  return v ? v : undefined;
}

function parseHomeworkHtml(html: string): HomeworkDetail {
  const root = parse(html);

  const fileDivs = root.querySelectorAll('div.list.fujian.clearfix');
  const c55 = root.querySelectorAll(
    'div.list.calendar.clearfix > div.fl.right > div.c55',
  );

  // 上交作业内容：第 2 个 div.boxbox 内的第 3 个 div.right（对齐 thu-learn-lib）
  let submittedContent: string | undefined;
  const boxboxes = root.querySelectorAll('div.boxbox');
  if (boxboxes[1]) {
    const rights = boxboxes[1].querySelectorAll('div.right');
    submittedContent = trimOrUndefined(rights[2]?.innerHTML);
  }

  return {
    description: trimOrUndefined(c55[0]?.innerHTML),
    answerContent: trimOrUndefined(c55[1]?.innerHTML),
    submittedContent,
    attachment: parseHomeworkFile(fileDivs[0]),
    answerAttachment: parseHomeworkFile(fileDivs[1]),
    submittedAttachment: parseHomeworkFile(fileDivs[2]),
    gradeAttachment: parseHomeworkFile(fileDivs[3]),
    publishTarget: extractPublishTarget(root),
  };
}

/**
 * 抓取并解析单条作业的详情页。
 * 经 withSessionRecovery 包裹：会话过期时用 Keychain 凭证静默重登后重试。
 */
export async function fetchHomeworkDetail(
  item: Pick<HomeworkItem, 'url'>,
): Promise<HomeworkDetail> {
  return tsinghuaAuthService.withSessionRecovery(
    async () => {
      const html = await webvpnTransport.fetchText(item.url);
      return parseHomeworkHtml(html);
    },
    undefined,
    'homework-detail',
  );
}
