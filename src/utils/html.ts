/**
 * 把 HTML 字符串清洗成纯文本（用于列表预览）。
 * 不依赖原生 DOM，纯字符串操作。
 */
export function stripHtml(html: string | null | undefined): string {
  if (!html) return '';
  return html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<\/(p|div|br|li|tr|h\d)>/gi, '$&\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * 把 learn 接口返回的内容包装成完整 HTML 文档（用于 WebView 渲染）。
 * 注入移动端 viewport + 中文字体 + 暗色/亮色样式。
 */
export function wrapAsDocument(
  body: string,
  options: {dark?: boolean; baseFontSize?: number} = {},
): string {
  const dark = options.dark ?? false;
  const fontSize = options.baseFontSize ?? 15;
  const bg = dark ? '#0F172A' : '#FFFFFF';
  const fg = dark ? '#E2E8F0' : '#1A1A2E';
  const link = dark ? '#60A5FA' : '#1E88E5';

  return `<!DOCTYPE html>
<html lang="zh-cmn-Hans">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<meta http-equiv="Content-Security-Policy" content="upgrade-insecure-requests" />
<style>
  html, body {
    margin: 0;
    padding: 16px;
    background: ${bg};
    color: ${fg};
    font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
    font-size: ${fontSize}px;
    line-height: 1.7;
    word-break: break-word;
    -webkit-text-size-adjust: 100%;
  }
  img, video {
    max-width: 100%;
    height: auto;
    border-radius: 8px;
    margin: 8px 0;
  }
  a { color: ${link}; }
  table {
    border-collapse: collapse;
    max-width: 100%;
    margin: 12px 0;
  }
  table, th, td {
    border: 1px solid ${dark ? '#334155' : '#E2E8F0'};
  }
  th, td { padding: 6px 10px; }
  pre, code {
    background: ${dark ? '#1E293B' : '#F1F5F9'};
    padding: 2px 6px;
    border-radius: 4px;
    font-family: ui-monospace, "SF Mono", Menlo, monospace;
  }
  pre { padding: 12px; overflow-x: auto; }
  p { margin: 0 0 0.8em; }
  p:first-child { margin-top: 0; }
  p:last-child { margin-bottom: 0; }
  /* 清华页面常用的 line-height 单位异常，统一 */
  [style*="line-height"] { line-height: 1.7 !important; }
</style>
</head>
<body>${body}</body>
</html>`;
}
