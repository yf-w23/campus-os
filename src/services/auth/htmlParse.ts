/**
 * 极轻量 HTML 字段抽取工具，规避在 RN/Metro 上加载 cheerio v1（ESM）的兼容性问题。
 * 仅覆盖清华登录页所需字段。
 */

/** 抽取 `<xx id="sm2publicKey">...</xx>` 的文本 */
export function extractElementTextById(html: string, id: string): string {
  const re = new RegExp(`id\\s*=\\s*["']${id}["'][^>]*>([\\s\\S]*?)<`, 'i');
  const match = re.exec(html);
  return (match?.[1] ?? '').trim();
}

/** 抽取页面中第一个 `<a href="...">` 的 href */
export function extractFirstAnchorHref(html: string): string {
  const match = /<a[^>]+href\s*=\s*["']([^"']+)["']/i.exec(html);
  return match?.[1] ?? '';
}

/** 抽取登录失败提示 #msg_note 文本 */
export function extractMsgNote(html: string): string {
  return extractElementTextById(html, 'msg_note');
}
