// 与 thu-info-lib core.ts parseUrl 完全对齐
const HOST_MAP: Record<string, string> = {
  'zhjw.cic': '77726476706e69737468656265737421eaff4b8b69336153301c9aa596522b20bc86e6e559a9b290',
  'jxgl.cic': '77726476706e69737468656265737421faef469069336153301c9aa596522b20e33c1eb39606919f',
  'zhjwxk.cic': '77726476706e69737468656265737421faef469069336153301c9aa596522b20e33c1eb39606919f',
  ecard: '77726476706e69737468656265737421f5f4408e237e7c4377068ea48d546d303341e9882a',
  learn: '77726476706e69737468656265737421fcf2408e297e7c4377068ea48d546d30ca8cc97bcc',
  mails: '77726476706e69737468656265737421fdf64890347e7c4377068ea48d546d3011ff591d40',
  '50': '77726476706e69737468656265737421a5a70f8834396657761d88e29d51367b6a00',
  '166.111.14.8': '77726476706e69737468656265737421a1a117d27661391e2f5cc7f4',
  'fa-online': '77726476706e69737468656265737421f6f60c93293c615e7b469dbf915b243daf0f96e17deaf447b4',
  dzpj: '77726476706e69737468656265737421f4ed519669247b59700f81b9991b2631aee63c51',
  jjhyhdf: '77726476706e69737468656265737421fafd49852f346e1e6a1b80a29f5d36342bb9c40cf69277',
  yhdf: '77726476706e69737468656265737421e9ff459a69247b59700f81b9991b26317dbd36ae',
  usereg: '77726476706e69737468656265737421e5e4448e223726446d0187ab9040227b54b6c80fcd73',
  thos: '77726476706e69737468656265737421e4ff4e8f69247b59700f81b9991b2631ca359dd4',
};

const WEBVPN_BASE = 'https://webvpn.tsinghua.edu.cn';

/**
 * 严格照搬 thu-info-lib core.ts 的 parseUrl：把任意清华内网 URL 包装成 webvpn URL。
 */
export function parseUrlToWebVPN(originalUrl: string): string {
  // 已是 webvpn 包装后的 URL：直接返回
  if (originalUrl.startsWith(WEBVPN_BASE)) {
    return originalUrl;
  }

  // IP 形式：http://IP:PORT/path
  const ipMatch = /http:\/\/(\d+\.\d+\.\d+\.\d+):(\d+)\/(.+)/.exec(originalUrl);
  if (ipMatch?.[1] && ipMatch[2] && ipMatch[3]) {
    const token = HOST_MAP[ipMatch[1]];
    if (token) {
      return `${WEBVPN_BASE}/http-${ipMatch[2]}/${token}/${ipMatch[3]}`;
    }
    return originalUrl;
  }

  // 域名形式：scheme://host.tsinghua.edu.cn(:port)/path
  const colonIdx = originalUrl.indexOf(':');
  if (colonIdx < 0) return originalUrl;
  const protocol = originalUrl.substring(0, colonIdx);
  const regRes = /:\/\/(.+?)\.tsinghua\.edu\.cn(:(\d+))?\/(.+)/.exec(originalUrl);
  if (!regRes?.[1] || !regRes[4]) return originalUrl;
  const host = regRes[1];
  const port = regRes[3];
  const protocolFull = port ? `${protocol}-${port}` : protocol;
  const path = regRes[4];
  const token = HOST_MAP[host];
  if (!token) return originalUrl;
  return `${WEBVPN_BASE}/${protocolFull}/${token}/${path}`;
}
