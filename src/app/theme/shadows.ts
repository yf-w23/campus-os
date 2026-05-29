import {ViewStyle} from 'react-native';

/**
 * 深色 UI 不靠阴影做层级，靠 surface 颜色差。
 * 这里全部 noop，仅保留 key 兼容旧引用。
 */
export const shadows: Record<'none' | 'soft' | 'medium' | 'card', ViewStyle> = {
  none: {},
  soft: {},
  medium: {},
  card: {},
};

/**
 * 大圆角 — large rounded corners，符合 ChatGPT / Copilot mobile / Linear 视觉。
 */
export const radii = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
  pill: 999,
} as const;
