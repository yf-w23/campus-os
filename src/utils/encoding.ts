/**
 * 字符编码工具 — 针对清华内网的老 ASP/Java 后端常用 GBK / GB2312。
 *
 * `gb2312PercentEncode` 与 thu-info-lib `utils/network.ts:arbitraryEncode(_, "gb2312")` 行为完全一致：
 *   - **只对 CJK 统一汉字 `[\u4e00-\u9fa5]` 做 GBK 字节级 percent-encode**
 *   - 其它字符（包括 ASCII、`%`、数字、字母、URL 保留字符）原样穿透 — 不再二次 escape
 *
 * 这与之前的实现的关键区别：
 *   - 旧版用 `cp < 0x80` 当分界并对 ASCII 调 `encodeURIComponent(ch)`，
 *     会把 `%` 重新编成 `%25`，导致 href 上抓下来的已编码串（`%C1%F9%BD%CC`）二次破坏。
 *   - 旧版也把所有非 ASCII 字符（含日文、emoji、扩展 B/C 区汉字）当 GBK 处理，超出 GBK 表的字符默认会落到 `?`。
 *
 * 现在的语义：传 raw 中文 → 输出 `%XX%XX...`；传已编码串 → 原样返回（适合直接拼到 URL）。
 *
 * 内部用 iconv-lite。需要 Buffer 全局 polyfill（在 src/polyfills.ts 中已设置）。
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const iconv = require('iconv-lite');

const CJK_RE = /^[\u4e00-\u9fa5]$/;

/** 单字节十进制转大写 %XX（URL 编码大小写不敏感，但大写更通用） */
function pct(b: number): string {
  const h = (b & 0xff).toString(16).padStart(2, '0');
  return `%${h.toUpperCase()}`;
}

/**
 * 把字符串里的 CJK 汉字按 GBK 编码逐字节 percent-encode；其余字符原样保留。
 *
 * 例：
 *   "六教"                → "%C1%F9%BD%CC"
 *   "%C1%F9%BD%CC"        → "%C1%F9%BD%CC"   ← 已编码穿透
 *   "六教_2024"           → "%C1%F9%BD%CC_2024"
 */
export function gb2312PercentEncode(input: string): string {
  if (!input) return '';
  let out = '';
  for (const ch of input) {
    if (CJK_RE.test(ch)) {
      try {
        const bytes = iconv.encode(ch, 'gbk') as Uint8Array | {length: number};
        const len = (bytes as any).length;
        for (let i = 0; i < len; i += 1) {
          out += pct((bytes as any)[i]);
        }
        continue;
      } catch {
        // iconv 失败兜底：退回 UTF-8 percent-encode（极少发生）
        out += encodeURIComponent(ch);
        continue;
      }
    }
    out += ch;
  }
  return out;
}

/**
 * 把形如 `%C1%F9%BD%CC` 的 GBK percent-encoded 串还原为原文（"六教"）。
 *
 * 支持混合输入：
 *   "%C1%F9%BD%CC"   → "六教"
 *   "六教"            → "六教"（不含 % 时原样返回）
 *   "%C1%F9_v2"      → "六_v2"（只解码 % 段，其它原样）
 *
 * 旧实现错误地对非 `%` 字符用 `charCodeAt & 0xff` 取低字节，
 * 对多字节 Unicode（如中文）会得到错误的 GBK 字节，导致解码后乱码。
 * 新实现按段处理：碰到 `%XX` 才走 GBK 解码，其它字符原样拼接。
 */
export function gb2312PercentDecode(input: string): string {
  if (!input) return '';
  let out = '';
  let i = 0;
  while (i < input.length) {
    if (input[i] === '%' && i + 2 < input.length) {
      // 连续收集 %XX 字节序列，一并 iconv-decode（GBK 是变长，单字节解会乱码）
      const bytes: number[] = [];
      while (
        input[i] === '%' &&
        i + 2 < input.length &&
        /[0-9a-f]{2}/i.test(input.slice(i + 1, i + 3))
      ) {
        bytes.push(parseInt(input.slice(i + 1, i + 3), 16));
        i += 3;
      }
      if (bytes.length > 0) {
        try {
          out += iconv.decode(Buffer.from(bytes), 'gbk') as string;
        } catch {
          // 解码失败兜底：按原文塞回（带上 % 号）
          for (const b of bytes) {
            out += `%${b.toString(16).padStart(2, '0').toUpperCase()}`;
          }
        }
        continue;
      }
    }
    out += input[i];
    i += 1;
  }
  return out;
}
