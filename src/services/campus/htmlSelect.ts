/**
 * cheerio-like 极简包装，基于 node-html-parser。
 * 满足校园模块解析需要的 select / text / attr / each / find。
 */
import {parse, HTMLElement} from 'node-html-parser';

export type DomNode = HTMLElement;

export interface DomCollection {
  /** 当前匹配到的全部元素 */
  nodes: HTMLElement[];
  length: number;
  text: () => string;
  attr: (name?: string) => string | undefined | Record<string, string>;
  find: (selector: string) => DomCollection;
  each: (cb: (i: number, el: HTMLElement) => void) => DomCollection;
  map: <T>(cb: (i: number, el: HTMLElement) => T) => T[];
  get: () => HTMLElement[];
  first: () => DomCollection;
  eq: (i: number) => DomCollection;
  slice: (start: number, end?: number) => DomCollection;
  toArray: () => HTMLElement[];
}

function wrap(nodes: HTMLElement[]): DomCollection {
  return {
    nodes,
    length: nodes.length,
    text: () => nodes.map(n => n.text).join(''),
    attr: (name?: string) => {
      const first = nodes[0];
      if (!first) return undefined;
      if (name === undefined) {
        return first.attributes;
      }
      return first.getAttribute(name);
    },
    find: (selector: string) => {
      const found: HTMLElement[] = [];
      for (const n of nodes) {
        found.push(...n.querySelectorAll(selector));
      }
      return wrap(found);
    },
    each: (cb: (i: number, el: HTMLElement) => void) => {
      nodes.forEach((n, i) => cb(i, n));
      return wrap(nodes);
    },
    map: <T,>(cb: (i: number, el: HTMLElement) => T) => nodes.map((n, i) => cb(i, n)),
    get: () => nodes,
    first: () => wrap(nodes.slice(0, 1)),
    eq: (i: number) => wrap(nodes.slice(i, i + 1)),
    slice: (start: number, end?: number) => wrap(nodes.slice(start, end)),
    toArray: () => [...nodes],
  };
}

export type LoadedDom = (selector: string) => DomCollection;

export function loadHtml(html: string): LoadedDom {
  const root = parse(html);
  const $ = (selector: string) => wrap(root.querySelectorAll(selector));
  ($ as any).root = root;
  return $;
}

/** 取一个元素的纯文本（去除前后空白） */
export function nodeText(el: HTMLElement | undefined | null): string {
  return el?.text?.trim() ?? '';
}

/**
 * 与 thu-info-lib utils/cheerio.ts `getCheerioText(element, index)` 严格对齐：
 *   `(element as Tag).children[index]` 在 cheerio/domhandler 里返回的是**包含文本节点的原始子节点**，
 *   不是 DOM 风格的"只算 element"。
 *
 * 之前的实现把 nodeType !== 1 的子节点过滤掉了，于是 `childText(tr, 3)` 取到的是第 4 个 `<td>`，
 * 而不是第 2 个 `<td>`。成绩报表的列序因此整列错位。
 *
 * 注：node-html-parser 的 `childNodes` 与 cheerio 一致，包含 TextNode + HTMLElement，
 * 所以这里直接用 `el.childNodes[idx]` 即可。
 */
export function childText(el: HTMLElement, idx: number): string {
  const target = el.childNodes[idx];
  if (!target) return '';
  // HTMLElement 用 .text；TextNode 在 node-html-parser 里也有 .text / .rawText 字段
  const raw =
    (target as unknown as {text?: string}).text ??
    (target as unknown as {rawText?: string}).rawText ??
    '';
  return String(raw).trim();
}
