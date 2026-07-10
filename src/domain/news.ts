export const channelTags = [
  'LM_BGTG',
  'LM_ZYGG',
  'LM_YQFKZT',
  'LM_JWGG',
  'LM_KYTZ',
  'LM_HB',
  'LM_XJ_XTWBGTZ',
  'LM_XSBGGG',
  'LM_TTGGG',
  'LM_JYGG',
  'LM_XJ_XSSQDT',
  'LM_BYJYXX',
  'LM_JYZPXX',
  'LM_XJ_GJZZSXRZ',
] as const;

export type KnownChannelTag = (typeof channelTags)[number];
export type ChannelTag = KnownChannelTag | string;

export interface NewsSlice {
  name: string;
  xxid: string;
  url: string;
  date: string;
  source: string;
  topped: boolean;
  channel: ChannelTag;
  inFav: boolean;
}

export interface NewsSubscription {
  id: string;
  channel?: string;
  source?: string;
  keyword?: string;
  title?: string;
  order?: number;
}

export interface NewsDetail {
  title: string;
  content: string;
  brief: string;
}
