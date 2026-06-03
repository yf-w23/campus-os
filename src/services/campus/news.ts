import {NewsSlice, NewsSubscription, ChannelTag} from '../../domain/news';

export async function getNewsList(_page: number, _length: number, _channel?: ChannelTag): Promise<NewsSlice[]> {
  return [];
}

export async function searchNewsList(_page: number, _key: string, _channel?: ChannelTag, _exactMatch?: boolean): Promise<NewsSlice[]> {
  return [];
}

export async function getNewsSubscriptionList(): Promise<NewsSubscription[]> {
  return [];
}

export async function getNewsSourceList(): Promise<{sourceId: string; sourceName: string}[]> {
  return [];
}

export async function getNewsChannelList(): Promise<{id: ChannelTag; title: string}[]> {
  return [];
}

export async function addNewsSubscription(_channelId?: ChannelTag, _sourceId?: string, _keyword?: string): Promise<boolean> {
  return false;
}

export async function removeNewsSubscription(_subscriptionId: string): Promise<boolean> {
  return false;
}

export async function getNewsListBySubscription(_page: number, _subscriptionId: string): Promise<NewsSlice[]> {
  return [];
}

export async function getNewsDetail(_url: string): Promise<{title: string; content: string; brief: string}> {
  return {title: '', content: '', brief: ''};
}

export async function addNewsToFav(_news: NewsSlice): Promise<boolean> {
  return false;
}

export async function removeNewsFromFav(_news: NewsSlice): Promise<boolean> {
  return false;
}

export async function getFavNewsList(_page = 1): Promise<{list: NewsSlice[]; totalPages: number}> {
  return {list: [], totalPages: 1};
}
