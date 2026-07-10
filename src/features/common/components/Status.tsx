import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import {colors, radii, spacing, typography} from '../../../app/theme';

type StatusTone = 'neutral' | 'info' | 'success' | 'warning' | 'error';

interface StateBlockProps {
  title: string;
  message?: string | null;
  children?: React.ReactNode;
  tone?: StatusTone;
  actionLabel?: string;
  onAction?: () => void;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}

const toneMap: Record<
  StatusTone,
  {backgroundColor: string; borderColor: string; accentColor: string}
> = {
  neutral: {
    backgroundColor: colors.surface,
    borderColor: colors.borderSubtle,
    accentColor: colors.textMuted,
  },
  info: {
    backgroundColor: colors.primaryMuted,
    borderColor: 'rgba(124, 92, 250, 0.22)',
    accentColor: colors.primary,
  },
  success: {
    backgroundColor: colors.successMuted,
    borderColor: 'rgba(22, 163, 74, 0.22)',
    accentColor: colors.success,
  },
  warning: {
    backgroundColor: colors.warningMuted,
    borderColor: 'rgba(217, 119, 6, 0.24)',
    accentColor: colors.warning,
  },
  error: {
    backgroundColor: colors.errorMuted,
    borderColor: 'rgba(220, 38, 38, 0.24)',
    accentColor: colors.error,
  },
};

export function StateBlock({
  title,
  message,
  children,
  tone = 'neutral',
  actionLabel,
  onAction,
  compact,
  style,
}: StateBlockProps) {
  const toneStyle = toneMap[tone];

  return (
    <View
      style={[
        styles.block,
        compact && styles.blockCompact,
        {
          backgroundColor: toneStyle.backgroundColor,
          borderColor: toneStyle.borderColor,
        },
        style,
      ]}>
      <View
        style={[
          styles.accent,
          compact && styles.accentCompact,
          {backgroundColor: toneStyle.accentColor},
        ]}
      />
      <View style={styles.blockBody}>
        <Text style={[styles.blockTitle, {color: toneStyle.accentColor}]}>
          {title}
        </Text>
        {message ? <Text style={styles.blockMessage}>{message}</Text> : null}
        {children ? <View style={styles.children}>{children}</View> : null}
        {actionLabel && onAction ? (
          <Pressable
            onPress={onAction}
            hitSlop={8}
            style={({pressed}) => [
              styles.actionButton,
              pressed && styles.actionButtonPressed,
            ]}>
            <Text
              style={[styles.actionText, {color: toneStyle.accentColor}]}>
              {actionLabel}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

interface InlineLoaderProps {
  label?: string;
  style?: StyleProp<ViewStyle>;
}

export function InlineLoader({label = '加载中...', style}: InlineLoaderProps) {
  return (
    <View style={[styles.inlineLoader, style]}>
      <ActivityIndicator color={colors.primary} />
      <Text style={styles.inlineText}>{label}</Text>
    </View>
  );
}

interface EmptyHintProps {
  title: string;
  message?: string;
  style?: StyleProp<ViewStyle>;
}

export function EmptyHint({title, message, style}: EmptyHintProps) {
  return (
    <View style={[styles.empty, style]}>
      <Text style={styles.emptyTitle}>{title}</Text>
      {message ? <Text style={styles.emptyMessage}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    borderRadius: radii.lg,
    borderWidth: 1,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  blockCompact: {
    borderRadius: radii.md,
  },
  accent: {
    width: 4,
  },
  accentCompact: {
    width: 3,
  },
  blockBody: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  blockTitle: {
    ...typography.label,
  },
  blockMessage: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  children: {
    marginTop: spacing.xs,
    gap: spacing.sm,
  },
  actionButton: {
    alignSelf: 'flex-start',
    paddingTop: spacing.xs,
  },
  actionButtonPressed: {
    opacity: 0.65,
  },
  actionText: {
    ...typography.label,
  },
  inlineLoader: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  inlineText: {
    ...typography.caption,
    color: colors.textMuted,
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
    gap: spacing.xs,
  },
  emptyTitle: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
  },
  emptyMessage: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
