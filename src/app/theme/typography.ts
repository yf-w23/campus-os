import {TextStyle} from 'react-native';

const w = (v: number) => String(v) as TextStyle['fontWeight'];

/**
 * Typography hierarchy — clear & spacious.
 * - 大标题用负字距 + 700，承担 hero / 屏幕标题
 * - 区块用 600，正文 400，副本 muted
 * - 行高偏大 → 阅读感更"premium"
 */
export const typography = {
  display: {fontSize: 34, fontWeight: w(700), letterSpacing: -0.6, lineHeight: 40},
  h1: {fontSize: 28, fontWeight: w(700), letterSpacing: -0.4, lineHeight: 34},
  h2: {fontSize: 20, fontWeight: w(600), letterSpacing: -0.2, lineHeight: 26},
  h3: {fontSize: 16, fontWeight: w(600), lineHeight: 22},
  label: {fontSize: 14, fontWeight: w(600), lineHeight: 20},
  body: {fontSize: 15, fontWeight: w(400), lineHeight: 22},
  caption: {fontSize: 13, fontWeight: w(400), lineHeight: 18},
  micro: {fontSize: 11, fontWeight: w(500), letterSpacing: 0.3, lineHeight: 14},
} as const;
