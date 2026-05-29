import React from 'react';
import {Pressable, StyleSheet, Text} from 'react-native';
import {colors, radii, spacing, typography} from '../../../app/theme';

interface ChipProps {
  label: string;
  onPress: () => void;
  variant?: 'default' | 'accent';
}

export function Chip({label, onPress, variant = 'default'}: ChipProps) {
  const isAccent = variant === 'accent';

  return (
    <Pressable
      onPress={onPress}
      style={({pressed}) => [
        styles.chip,
        isAccent ? styles.chipAccent : styles.chipDefault,
        pressed && styles.chipPressed,
      ]}
      hitSlop={4}>
      <Text style={[styles.label, isAccent && styles.labelAccent]} numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    maxWidth: '100%',
  },
  chipDefault: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  chipAccent: {
    backgroundColor: colors.primaryMuted,
    borderColor: 'rgba(167, 139, 250, 0.35)',
  },
  chipPressed: {
    opacity: 0.75,
    transform: [{scale: 0.98}],
  },
  label: {
    ...typography.caption,
    color: colors.text,
    fontWeight: '500',
  },
  labelAccent: {
    color: colors.primary,
  },
});
