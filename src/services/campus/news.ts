import {load} from 'cheerio';
import {
  ChannelTag,
  NewsDetail,
  NewsSlice,
  NewsSubscription,
} from '../../domain/news';
import {stripHtml} from '../../utils/html';
import {tsinghuaAuthService} from '../auth/tsinghuaAuth';
import {ENDPOINTS, withCsrf} from '../webvpn/constants';
import {webvpnTransport} from '../webvpn/transport';

type RawNewsRow = {
  bt?: string;
  url?: string;
  xxid?: string;
  time?: string;
  dwmc_show?: string;
  yxzd?: string | null;
  lmid?: ChannelTag;
  sfsc?: boolean;
};

type NewsListResponse = {
  object?: {
    dataList?: RawNewsRow[];
    resultsList?: RawNewsRow[];
    resultList?: RawNewsRow[];
    totalPages?: number;
  };
};

const CHANNEL_LABELS: Record<string, string> = {
  LM_BGTG: '办公通知',
  LM_ZYGG: '重要公告',
  LM_YQFKZT: '疫情防控专题',
  LM_JWGG: '教务通知',
  LM_KYTZ: '科研通知',
  LM_HB: '海报',
  LM_XJ_XTWBGTZ: '校团委通知',
  LM_XSBGGG: '学生工作通知',
  LM_TTGGG: '图书馆信息',
  LM_JYGG: '学生社区通知',
  LM_XJ_XSSQDT: '学生社区动态',
  LM_BYJYXX: '就业通知',
  LM_JYZPXX: '招聘信息',
  LM_XJ_GJZZSXRZ: '国际组织实习任职',
};

export function getNewsChannelLabel(channel?: ChannelTag): string {
  if (!channel) {
    return '全部';
  }
  return CHANNEL_LABELS[channel] ?? String(channel);
}

async function withNewsSession<T>(operation: () => Promise<T>): Promise<T> {
  return tsinghuaAuthService.withSessionRecovery(
    operation,
    undefined,
    'campus-news',
  );
}

async function infoCsrf(): Promise<string> {
  return webvpnTransport.getCsrfToken();
}

function decodeText(value: unknown): string {
  return String(value ?? '')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) =>
      String.fromCharCode(parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, dec: string) =>
      String.fromCharCode(parseInt(dec, 10)),
    )
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function normalizeNewsRow(row: RawNewsRow, topped = true): NewsSlice {
  return {
    name: decodeText(row.bt),
    xxid: String(row.xxid ?? ''),
    url: decodeText(row.url),
    date: String(row.time ?? ''),
    source: decodeText(row.dwmc_show),
    topped: topped && String(row.yxzd ?? '').includes('1-'),
    channel: row.lmid ?? '',
    inFav: Boolean(row.sfsc),
  };
}

function normalizeRows(rows: RawNewsRow[] | undefined, topped = true): NewsSlice[] {
  return (rows ?? [])
    .map(row => normalizeNewsRow(row, topped))
    .filter(item => item.name.length > 0 && item.url.length > 0);
}

function channelToLmmc(channel: ChannelTag): string {
  return CHANNEL_LABELS[channel] ?? String(channel);
}

function buildNewsDetailUrl(url: string): string {
  const value = decodeText(url);
  if (value.startsWith('http://info.tsinghua.edu.cn')) {
    return value.replace('http://info.tsinghua.edu.cn', ENDPOINTS.newsRedirectBase);
  }
  if (value.startsWith('https://info.tsinghua.edu.cn')) {
    return value.replace('https://info.tsinghua.edu.cn', ENDPOINTS.newsRedirectBase);
  }
  if (value.startsWith('http')) {
    return value;
  }
  return `${ENDPOINTS.newsRedirectBase}${value.startsWith('/') ? '' : '/'}${value}`;
}

function adaptNewsHtml(html: string): {title: string; content: string; brief: string} {
  const $ = load(html);
  const title =
    decodeText($('title').first().text()) ||
    decodeText($('h1,h2,h3').first().text()) ||
    '新闻详情';
  const body = $('body').html() ?? html;
  return {
    title,
    content: body,
    brief: stripHtml(body).slice(0, 240),
  };
}

function fixNewsAssets(html: string): string {
  return html
    .replace(
      /src=(["'])\/b\/ckeditor\/downloadFiles/g,
      `src=$1${ENDPOINTS.newsRedirectBase}/b/ckeditor/downloadFiles`,
    )
    .replace(
      /href=(["'])\/b\/info\/wj\/download/g,
      `href=$1${ENDPOINTS.newsRedirectBase}/b/info/wj/download`,
    );
}

export async function getNewsList(
  page: number,
  length: number,
  channel?: ChannelTag,
): Promise<NewsSlice[]> {
  return withNewsSession(async () => {
    const csrf = await infoCsrf();
    const params = [
      `lmid=${encodeURIComponent(channel ?? 'all')}`,
      `currentPage=${encodeURIComponent(String(page))}`,
      `length=${encodeURIComponent(String(length))}`,
    ].join('&');
    const data = await webvpnTransport.fetchJson<NewsListResponse>(
      `${withCsrf(ENDPOINTS.newsList, csrf)}&${params}`,
    );
    return normalizeRows(data.object?.dataList);
  });
}

export async function searchNewsList(
  page: number,
  key: string,
  channel?: ChannelTag,
  exactMatch?: boolean,
): Promise<NewsSlice[]> {
  const trimmed = key.trim();
  if (!trimmed) {
    return getNewsList(page, 30, channel);
  }
  return withNewsSession(async () => {
    const csrf = await infoCsrf();
    const data = await webvpnTransport.fetchJson<NewsListResponse>(
      withCsrf(ENDPOINTS.newsSearch, csrf),
      {
        body: {
          esParamClass: JSON.stringify({
            params: {bt: trimmed, tag: trimmed, xxfl: trimmed},
            filterParams: channel ? {lmmcgroup: channelToLmmc(channel)} : {},
            orderMap: {sort: 'time'},
            matchExact: exactMatch ? '是' : '否',
            currentPage: page,
          }),
        },
      },
    );
    return normalizeRows(data.object?.resultsList, false).map(item => ({
      ...item,
      name: stripHtml(item.name),
      topped: false,
    }));
  });
}

export async function getNewsSubscriptionList(): Promise<NewsSubscription[]> {
  return withNewsSession(async () => {
    const csrf = await infoCsrf();
    const data = await webvpnTransport.fetchJson<{
      object?: {
        id?: string;
        fbdwmcList?: string[];
        lmmcList?: string[];
        pxz?: number;
        titile?: string;
        bt?: string | null;
      }[];
    }>(withCsrf(ENDPOINTS.newsSubscriptionList, csrf));
    return (data.object ?? []).map(item => ({
      id: String(item.id ?? ''),
      channel: item.lmmcList?.[0],
      source: item.fbdwmcList?.[0],
      keyword: item.bt ?? '',
      title: item.titile ?? '',
      order: item.pxz ?? 0,
    }));
  });
}

export async function getNewsSourceList(): Promise<
  {sourceId: string; sourceName: string}[]
> {
  return withNewsSession(async () => {
    const csrf = await infoCsrf();
    const data = await webvpnTransport.fetchJson<{
      object?: {id?: string; text?: string}[];
    }>(`${withCsrf(ENDPOINTS.newsSourceList, csrf)}&lmid=`);
    return (data.object ?? []).map(item => ({
      sourceId: String(item.id ?? ''),
      sourceName: decodeText(item.text),
    }));
  });
}

export async function getNewsChannelList(
  needEnglish = false,
): Promise<{id: ChannelTag; title: string}[]> {
  return withNewsSession(async () => {
    const csrf = await infoCsrf();
    const data = await webvpnTransport.fetchJson<{
      object?: {
        lmlist?: {id?: ChannelTag; title_zh?: string; title_en?: string}[];
      };
    }>(withCsrf(ENDPOINTS.newsChannelList, csrf));
    return (data.object?.lmlist ?? [])
      .filter(item => item.id)
      .map(item => ({
        id: item.id as ChannelTag,
        title: decodeText(needEnglish ? item.title_en : item.title_zh),
      }));
  });
}

export async function addNewsSubscription(
  channelId?: ChannelTag,
  sourceId?: string,
  keyword?: string,
): Promise<boolean> {
  if (!channelId && !sourceId) {
    return false;
  }
  return withNewsSession(async () => {
    const csrf = await infoCsrf();
    const data = await webvpnTransport.fetchJson<{result?: string}>(
      withCsrf(ENDPOINTS.newsAddSubscription, csrf),
      {
        body: {
          dygz: JSON.stringify({
            lmid: channelId,
            fbdwnm: sourceId,
            bt: keyword ?? '',
          }),
          mkid: 'XXFB',
        },
      },
    );
    return data.result === 'success';
  });
}

export async function removeNewsSubscription(
  subscriptionId: string,
): Promise<boolean> {
  return withNewsSession(async () => {
    const csrf = await infoCsrf();
    const url = ENDPOINTS.newsRemoveSubscription
      .replace('{id}', encodeURIComponent(subscriptionId))
      .replace('{csrf}', encodeURIComponent(csrf));
    const data = await webvpnTransport.fetchJson<{result?: string}>(url);
    return data.result === 'success';
  });
}

export async function getNewsListBySubscription(
  page: number,
  subscriptionId: string,
): Promise<NewsSlice[]> {
  if (!subscriptionId || subscriptionId === '0') {
    return getNewsList(page, 30);
  }
  return withNewsSession(async () => {
    const csrf = await infoCsrf();
    const data = await webvpnTransport.fetchJson<NewsListResponse>(
      withCsrf(ENDPOINTS.newsListBySubscription, csrf),
      {
        body: {
          currentPage: String(page),
          dyid: subscriptionId,
        },
      },
    );
    return normalizeRows(data.object?.resultList, false);
  });
}

export async function getNewsDetail(url: string): Promise<NewsDetail> {
  return withNewsSession(async () => {
    const html = await webvpnTransport.fetchText(buildNewsDetailUrl(url));
    const xxid = /var\s+xxid\s*=\s*["'](.*?)["']/.exec(html)?.[1];
    if (!xxid) {
      return adaptNewsHtml(html);
    }

    const csrf = await infoCsrf();
    const data = await webvpnTransport.fetchJson<{
      object?: {
        xxDto?: {
          bt?: string;
          nr?: string;
          fjs_template?: {wjid?: string; wjmc?: string}[];
        };
      };
    }>(
      `${withCsrf(ENDPOINTS.newsDetail, csrf)}&xxid=${encodeURIComponent(
        xxid,
      )}&preview=`,
    );
    const detail = data.object?.xxDto;
    if (!detail) {
      return adaptNewsHtml(html);
    }

    const title = decodeText(detail.bt) || '新闻详情';
    let content = `<div>${fixNewsAssets(decodeText(detail.nr))}`;
    for (const file of detail.fjs_template ?? []) {
      if (!file.wjid) {
        continue;
      }
      content += `<p><a href="${ENDPOINTS.newsFileDownload}${encodeURIComponent(
        file.wjid,
      )}?_csrf=${encodeURIComponent(csrf)}">附件：${decodeText(
        file.wjmc,
      )}</a></p>`;
    }
    content += '</div>';
    return {
      title,
      content,
      brief: stripHtml(content).slice(0, 240),
    };
  });
}

export async function addNewsToFav(news: NewsSlice): Promise<boolean> {
  if (!news.xxid) {
    return false;
  }
  return withNewsSession(async () => {
    const csrf = await infoCsrf();
    const data = await webvpnTransport.fetchJson<{result?: string}>(
      `${ENDPOINTS.newsAddFavorite}${encodeURIComponent(
        news.xxid,
      )}?_csrf=${encodeURIComponent(csrf)}`,
    );
    return data.result === 'success';
  });
}

export async function removeNewsFromFav(news: NewsSlice): Promise<boolean> {
  if (!news.xxid) {
    return false;
  }
  return withNewsSession(async () => {
    const csrf = await infoCsrf();
    const data = await webvpnTransport.fetchJson<{result?: string}>(
      `${ENDPOINTS.newsRemoveFavorite}${encodeURIComponent(
        news.xxid,
      )}?_csrf=${encodeURIComponent(csrf)}`,
    );
    return data.result === 'success';
  });
}

export async function getFavNewsList(
  page = 1,
): Promise<{list: NewsSlice[]; totalPages: number}> {
  return withNewsSession(async () => {
    const csrf = await infoCsrf();
    const data = await webvpnTransport.fetchJson<NewsListResponse>(
      withCsrf(ENDPOINTS.newsFavoriteList, csrf),
      {body: {currentPage: String(page)}},
    );
    return {
      list: normalizeRows(data.object?.resultList, false),
      totalPages: data.object?.totalPages ?? 1,
    };
  });
}
