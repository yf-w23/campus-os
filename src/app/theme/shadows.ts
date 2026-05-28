import {Platform, ViewStyle} from 'react-native';
import {colors} from './colors';

/**
 * 精细 elevation：参考 shadcn — 不堆叠粗阴影，用极淡 layer。
 */
export const shadows: Record<'none' | 'soft' | 'medium' | 'card', ViewStyle> = {
  none: {},
  soft: Platform.select({
    ios: {
      shadowColor: colors.shadowSoft,
      shadowOffset: {width: 0, height: 1},
      shadowOpacity: 1,
      shadowRadius: 2,
    },
    android: {elevation: 1},
    default: {},
  })!,
  medium: Platform.select({
    ios: {
      shadowColor: colors.shadowMedium,
      shadowOffset: {width: 0, height: 4},
      shadowOpacity: 1,
      shadowRadius: 8,
    },
    android: {elevation: 3},
    default: {},
  })!,
  card: Platform.select({
    ios: {
      shadowColor: colors.cardShadow,
      shadowOffset: {width: 0, height: 6},
      shadowOpacity: 1,
      shadowRadius: 14,
    },
    android: {elevation: 2},
    default: {},
  })!,
};

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
} as const;
