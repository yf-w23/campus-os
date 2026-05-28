import React from 'react';
import {Pressable, StyleSheet, Text, TextStyle, View, ViewStyle} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {colors, radii, shadows, spacing, typography} from '../../../app/theme';

interface GradientCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

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
  neutral: colors.border,
} as const;

/**
 * shadcn 风格列表卡：左侧细色彩条 + 极淡阴影 + 按下微缩放。
 */
export function ListCard({children, onPress, accent = 'neutral', style}: ListCardProps) {
  const Inner = (
    <View style={[styles.listCard, shadows.soft, style]}>
      <View style={[styles.listCardBar, {backgroundColor: accentMap[accent]}]} />
      <View style={styles.listCardBody}>{children}</View>
    </View>
  );
  if (!onPress) {
    return Inner;
  }
  return (
    <Pressable
      onPress={onPress}
      style={({pressed}) => [pressed && styles.cardPressed, styles.cardOuter]}>
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
      <Pressable onPress={onBack} hitSlop={12} style={styles.headerSide}>
        <Text style={styles.headerSideText}>← 返回</Text>
      </Pressable>
      <Text style={styles.headerTitle} numberOfLines={1}>
        {title}
      </Text>
      {rightLabel ? (
        <Pressable onPress={onRight} hitSlop={12} style={styles.headerSide}>
          <Text style={styles.headerSideText}>{rightLabel}</Text>
        </Pressable>
      ) : (
        <View style={styles.headerSide} />
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
    ...shadows.medium,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  sectionTitle: {...typography.h2, color: colors.text},
  action: {...typography.label, color: colors.primary},
  badge: {
    ...typography.micro,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.xs,
  },
  emptyTitle: {...typography.body, color: colors.textSecondary, textAlign: 'center'},
  emptyDesc: {...typography.caption, color: colors.textMuted, textAlign: 'center'},
  cardOuter: {marginBottom: spacing.sm},
  cardPressed: {opacity: 0.85, transform: [{scale: 0.99}]},
  listCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  listCardBar: {width: 3},
  listCardBody: {flex: 1, padding: spacing.md, gap: spacing.xs},
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  headerSide: {minWidth: 64, paddingVertical: 4},
  headerSideText: {...typography.body, color: colors.primary},
  headerTitle: {...typography.h3, color: colors.text, flex: 1, textAlign: 'center'},
  infoRow: {
    flexDirection: 'row',
    paddingVertical: spacing.sm,
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
