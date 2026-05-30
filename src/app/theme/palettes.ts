/**
 * 单一浅色调色板。
 *
 * App 仅保留浅色模式：surface 用极淡的灰带蓝调（off-white），不刺眼，
 * 强调色（accent）统一用品牌紫，保证一致。
 * `ColorScheme` 类型保留为字面量 'light'，仅为兼容历史调用签名。
 */

export type ColorScheme = 'light';

export interface Palette {
  primary: string;
  primaryDark: string;
  primaryMuted: string;

  accent: string;
  accentLight: string;
  accentMuted: string;

  gradientStart: string;
  gradientEnd: string;

  background: string;
  surface: string;
  surfaceAlt: string;
  surfaceElevated: string;

  text: string;
  textSecondary: string;
  textMuted: string;
  textInvert: string;

  border: string;
  borderSubtle: string;
  divider: string;

  success: string;
  successMuted: string;
  warning: string;
  warningMuted: string;
  error: string;
  errorMuted: string;

  shadowSoft: string;
  shadowMedium: string;
  cardShadow: string;
  overlay: string;
}

export const lightColors: Palette = {
  // 同色系强调色 — 在浅底上稍稍加深以保持对比度
  primary: '#7C5CFA',
  primaryDark: '#5B3EE0',
  primaryMuted: 'rgba(124, 92, 250, 0.10)',

  accent: '#7C5CFA',
  accentLight: '#A78BFA',
  accentMuted: 'rgba(124, 92, 250, 0.08)',

  gradientStart: '#F4F2FF',
  gradientEnd: '#E8E3FF',

  background: '#FAFAFB',
  surface: '#FFFFFF',
  surfaceAlt: '#F2F2F4',
  surfaceElevated: '#FFFFFF',

  text: '#0A0A0B',
  textSecondary: '#5C5C61',
  textMuted: '#8E8E93',
  textInvert: '#FFFFFF',

  border: '#E2E2E5',
  borderSubtle: 'rgba(10, 10, 11, 0.08)',
  divider: 'rgba(10, 10, 11, 0.06)',

  success: '#16A34A',
  successMuted: 'rgba(22, 163, 74, 0.12)',
  warning: '#D97706',
  warningMuted: 'rgba(217, 119, 6, 0.12)',
  error: '#DC2626',
  errorMuted: 'rgba(220, 38, 38, 0.10)',

  shadowSoft: 'rgba(15, 23, 42, 0.06)',
  shadowMedium: 'rgba(15, 23, 42, 0.10)',
  cardShadow: 'rgba(15, 23, 42, 0.06)',
  overlay: 'rgba(15, 23, 42, 0.45)',
};

export function getPalette(_scheme: ColorScheme = 'light'): Palette {
  return lightColors;
}
