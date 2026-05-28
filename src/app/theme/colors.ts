// 颜色调色板：受 shadcn / Tailwind 影响，使用中性色 + 单一品牌强调色
export const colors = {
  // 品牌主色 — 清华蓝
  primary: '#1E88E5',
  primaryDark: '#1565C0',
  primaryMuted: 'rgba(30, 136, 229, 0.12)',

  // 副色
  accent: '#00BCD4',
  accentLight: '#4DD0E1',
  accentMuted: 'rgba(0, 188, 212, 0.12)',

  // 渐变（顶部 hero / 重点 CTA）
  gradientStart: '#2196F3',
  gradientEnd: '#22D3EE',

  // 背景 / 表面层次（shadcn 0/50/100）
  background: '#F8FAFC',
  surface: '#FFFFFF',
  surfaceAlt: '#F1F5F9',
  surfaceElevated: '#FFFFFF',

  // 文本层次
  text: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#94A3B8',
  textInvert: '#F8FAFC',

  // 边界 / 分隔
  border: '#E2E8F0',
  borderSubtle: 'rgba(15, 23, 42, 0.06)',
  divider: '#F1F5F9',

  // 状态色
  success: '#10B981',
  successMuted: 'rgba(16, 185, 129, 0.12)',
  warning: '#F59E0B',
  warningMuted: 'rgba(245, 158, 11, 0.12)',
  error: '#EF4444',
  errorMuted: 'rgba(239, 68, 68, 0.12)',

  // 阴影（不同高度）
  shadowSoft: 'rgba(15, 23, 42, 0.06)',
  shadowMedium: 'rgba(15, 23, 42, 0.10)',
  cardShadow: 'rgba(30, 136, 229, 0.08)',
  overlay: 'rgba(15, 23, 42, 0.55)',
} as const;
