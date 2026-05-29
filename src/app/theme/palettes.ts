/**
 * 双调色板 — 深色 / 浅色。
 *
 * 设计：两套调色板共用 token key，颜色值不同。
 * 强调色（accent）在两个调色板里都用同一种紫色，保证品牌一致；
 * 浅色模式下的 surface 用极淡的灰带蓝调（off-white），不刺眼。
 */

export type ColorScheme = 'dark' | 'light';

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

export const darkColors: Palette = {
  primary: '#A78BFA',
  primaryDark: '#8B6EF6',
  primaryMuted: 'rgba(167, 139, 250, 0.14)',

  accent: '#A78BFA',
  accentLight: '#C4B5FD',
  accentMuted: 'rgba(167, 139, 250, 0.12)',

  gradientStart: '#1B1B20',
  gradientEnd: '#2A2238',

  background: '#0A0A0B',
  surface: '#141417',
  surfaceAlt: '#1C1C20',
  surfaceElevated: '#1F1F23',

  text: '#F5F5F7',
  textSecondary: '#A8A8AD',
  textMuted: '#6E6E73',
  textInvert: '#0A0A0B',

  border: '#26262B',
  borderSubtle: 'rgba(255, 255, 255, 0.06)',
  divider: 'rgba(255, 255, 255, 0.06)',

  success: '#4ADE80',
  successMuted: 'rgba(74, 222, 128, 0.14)',
  warning: '#FBBF24',
  warningMuted: 'rgba(251, 191, 36, 0.14)',
  error: '#F87171',
  errorMuted: 'rgba(248, 113, 113, 0.14)',

  shadowSoft: 'rgba(0, 0, 0, 0.25)',
  shadowMedium: 'rgba(0, 0, 0, 0.4)',
  cardShadow: 'rgba(0, 0, 0, 0.3)',
  overlay: 'rgba(0, 0, 0, 0.6)',
};

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

export function getPalette(scheme: ColorScheme): Palette {
  return scheme === 'light' ? lightColors : darkColors;
}
