import React from 'react';
import {Pressable, StyleSheet, Text, TextStyle, View, ViewStyle} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {colors, radii, spacing, typography} from '../../../app/theme';

interface GradientCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

/**
 * Hero / 重点卡。深色 UI 下使用极淡的 violet→surface 渐变 +
 * 细 hairline 边框，给出层级但不显"web dashboard"。
 */
export function GradientCard({children, style}: GradientCardProps) {
  return (
    <LinearGradient
      colors={[colors.gradientStart, colors.gradientEnd]}
      start={{x: 0, y: 0}}
      end={{x: 1, y: 1}}
      style={[styles.gradient, style]}>
      {children}
    </LinearGradient>
  );
}

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  right?: React.ReactNode;
}

/**
 * 统一屏幕标题。比 hero display 克制：~22px 标题 + 可选 eyebrow / 副标题，
 * 借小字距与层次营造「高级但不张扬」的观感。
 */
export function ScreenHeader({title, subtitle, eyebrow, right}: ScreenHeaderProps) {
  return (
    <View style={styles.screenHeader}>
      <View style={styles.screenHeaderText}>
        {eyebrow ? <Text style={styles.screenEyebrow}>{eyebrow}</Text> : null}
        <Text style={styles.screenTitle}>{title}</Text>
        {subtitle ? <Text style={styles.screenSubtitle}>{subtitle}</Text> : null}
      </View>
      {right ? <View style={styles.screenHeaderRight}>{right}</View> : null}
    </View>
  );
}

interface SectionHeaderProps {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function SectionHeader({title, actionLabel, onAction}: SectionHeaderProps) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {actionLabel ? (
        <Pressable hitSlop={8} onPress={onAction}>
          <Text style={styles.action}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

interface BadgeProps {
  label: string;
  tone?: 'default' | 'success' | 'warning' | 'error';
}

const badgeMap: Record<NonNullable<BadgeProps['tone']>, TextStyle> = {
  default: {backgroundColor: colors.primaryMuted, color: colors.primary},
  success: {backgroundColor: colors.successMuted, color: colors.success},
  warning: {backgroundColor: colors.warningMuted, color: colors.warning},
  error: {backgroundColor: colors.errorMuted, color: colors.error},
};

export function Badge({label, tone = 'default'}: BadgeProps) {
  return <Text style={[styles.badge, badgeMap[tone]]}>{label}</Text>;
}

interface EmptyStateProps {
  title: string;
  description?: string;
}

export function EmptyState({title, description}: EmptyStateProps) {
  return (
    <View style={styles.emptyWrap}>
      <Text style={styles.emptyTitle}>{title}</Text>
      {description ? <Text style={styles.emptyDesc}>{description}</Text> : null}
    </View>
  );
}

interface ListCardProps {
  children: React.ReactNode;
  onPress?: () => void;
  accent?: keyof typeof accentMap;
  style?: ViewStyle;
}

const accentMap = {
  primary: colors.primary,
  success: colors.success,
  warning: colors.warning,
  error: colors.error,
  neutral: 'transparent',
} as const;

/**
 * 列表卡：纯 surface + 1px hairline 边框 + 大圆角。
 * 左侧 2px 强调色条只在非 neutral 时显示，作为身份提示。
 */
export function ListCard({children, onPress, accent = 'neutral', style}: ListCardProps) {
  const showBar = accent !== 'neutral';
  const Inner = (
    <View style={[styles.listCard, style]}>
      {showBar ? (
        <View style={[styles.listCardBar, {backgroundColor: accentMap[accent]}]} />
      ) : null}
      <View style={[styles.listCardBody, showBar && styles.listCardBodyWithBar]}>
        {children}
      </View>
    </View>
  );
  if (!onPress) {
    return Inner;
  }
  return (
    <Pressable
      onPress={onPress}
      style={({pressed}) => [styles.cardOuter, pressed && styles.cardPressed]}>
      {Inner}
    </Pressable>
  );
}

interface DetailHeaderProps {
  title: string;
  onBack: () => void;
  rightLabel?: string;
  onRight?: () => void;
}

export function DetailHeader({title, onBack, rightLabel, onRight}: DetailHeaderProps) {
  return (
    <View style={styles.detailHeader}>
      <Pressable onPress={onBack} hitSlop={12} style={styles.headerBack}>
        <Text style={styles.headerChevron}>‹</Text>
      </Pressable>
      <Text style={styles.headerTitle} numberOfLines={1}>
        {title}
      </Text>
      {rightLabel ? (
        <Pressable onPress={onRight} hitSlop={12} style={styles.headerRight}>
          <Text style={styles.headerRightText}>{rightLabel}</Text>
        </Pressable>
      ) : (
        <View style={styles.headerRight} />
      )}
    </View>
  );
}

interface InfoRowProps {
  label: string;
  value?: string | null;
  mono?: boolean;
}

export function InfoRow({label, value, mono}: InfoRowProps) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, mono && styles.infoMono]}>{value || '—'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  gradient: {
    borderRadius: radii.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  screenHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  screenHeaderText: {flex: 1},
  screenHeaderRight: {paddingBottom: 2},
  screenEyebrow: {
    ...typography.micro,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.4,
    marginBottom: 6,
  },
  screenTitle: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.3,
    lineHeight: 28,
    color: colors.text,
  },
  screenSubtitle: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 5,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    ...typography.label,
    color: colors.textSecondary,
    letterSpacing: 0.2,
    textTransform: 'uppercase',
    fontSize: 12,
  },
  action: {...typography.label, color: colors.primary},
  badge: {
    ...typography.micro,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
    overflow: 'hidden',
    fontWeight: '600',
  },
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    gap: spacing.xs,
  },
  emptyTitle: {...typography.body, color: colors.textSecondary, textAlign: 'center'},
  emptyDesc: {...typography.caption, color: colors.textMuted, textAlign: 'center'},
  cardOuter: {marginBottom: spacing.sm},
  cardPressed: {opacity: 0.7},
  listCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  listCardBar: {width: 2},
  listCardBody: {flex: 1, padding: spacing.md, gap: 6},
  listCardBodyWithBar: {paddingLeft: spacing.md - 2},
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background,
    minHeight: 52,
  },
  headerBack: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -spacing.xs,
  },
  headerChevron: {
    fontSize: 32,
    color: colors.text,
    lineHeight: 32,
    marginTop: -4,
    fontWeight: '300',
  },
  headerRight: {
    minWidth: 60,
    height: 40,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  headerRightText: {...typography.body, color: colors.primary},
  headerTitle: {...typography.h3, color: colors.text, flex: 1, textAlign: 'center'},
  infoRow: {
    flexDirection: 'row',
    paddingVertical: spacing.md - 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
    gap: spacing.md,
  },
  infoLabel: {...typography.caption, color: colors.textMuted, width: 80},
  infoValue: {...typography.body, color: colors.text, flex: 1},
  infoMono: {
    fontFamily: 'monospace',
    fontSize: 13,
  },
});
