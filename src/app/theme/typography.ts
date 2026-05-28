import {TextStyle} from 'react-native';

const w = (v: number) => String(v) as TextStyle['fontWeight'];

export const typography = {
  // Display: 大标题（如登录页/Hero）
  display: {fontSize: 32, fontWeight: w(700), letterSpacing: -0.5},
  // 页面主标题
  h1: {fontSize: 26, fontWeight: w(700), letterSpacing: -0.3},
  // 区块标题
  h2: {fontSize: 20, fontWeight: w(600), letterSpacing: -0.2},
  // 卡片标题
  h3: {fontSize: 16, fontWeight: w(600)},
  // 标签 / 列表标题
  label: {fontSize: 14, fontWeight: w(600)},
  // 正文
  body: {fontSize: 15, fontWeight: w(400), lineHeight: 22},
  // 说明 / 次要
  caption: {fontSize: 12, fontWeight: w(400), lineHeight: 18},
  // 微型 (标签/角标)
  micro: {fontSize: 11, fontWeight: w(500), letterSpacing: 0.3},
} as const;
