export type ChannelTag = 'LM_BGTG' | 'LM_ZYGG' | 'LM_YQFKZT' | 'LM_JWGG' | 'LM_KYTZ' | 'LM_HB' | 'LM_XJ_XTWBGTG' | 'LM_XSBGGG' | 'LM_TTGGG' | 'LM_JYGG' | 'LM_JYZPXX' | 'LM_XJ_GJZZSXRZ' | string;

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
