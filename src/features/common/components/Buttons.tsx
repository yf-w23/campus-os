import React from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {colors, spacing, typography} from '../../../app/theme';

interface TabIconProps {
  focused: boolean;
  source: number;
  label: string;
}

export function TabIcon({focused, source, label}: TabIconProps) {
  return (
    <View style={styles.container}>
      <Image
        source={source}
        style={[styles.icon, focused ? styles.iconFocused : styles.iconDefault]}
      />
      <Text style={[styles.label, focused && styles.labelFocused]}>{label}</Text>
    </View>
  );
}

interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'ghost' | 'accent';
}

export function PrimaryButton({
  label,
  onPress,
  disabled,
  loading,
  variant = 'primary',
}: PrimaryButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      style={({pressed}) => [
        styles.button,
        variant === 'ghost'
          ? styles.buttonGhost
          : variant === 'accent'
            ? styles.buttonAccent
            : styles.buttonPrimary,
        isDisabled && styles.buttonDisabled,
        pressed && !isDisabled && styles.buttonPressed,
      ]}
      onPress={onPress}
      disabled={isDisabled}
      android_ripple={{color: 'rgba(255,255,255,0.2)'}}
      hitSlop={8}>
      {loading ? (
        <ActivityIndicator color={variant === 'ghost' ? colors.primary : '#fff'} />
      ) : (
        <Text
          style={[
            styles.buttonText,
            variant === 'ghost' ? styles.buttonTextGhost : styles.buttonTextPrimary,
          ]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  icon: {
    width: 28,
    height: 28,
    resizeMode: 'contain',
  },
  iconFocused: {
    opacity: 1,
    transform: [{scale: 1.05}],
  },
  iconDefault: {
    opacity: 0.55,
  },
  label: {
    ...typography.caption,
    color: colors.textMuted,
  },
  labelFocused: {
    color: colors.primary,
    fontWeight: '600',
  },
  button: {
    minHeight: 48,
    borderRadius: 14,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPrimary: {
    backgroundColor: colors.primary,
  },
  buttonAccent: {
    backgroundColor: colors.accent,
  },
  buttonGhost: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonText: {
    ...typography.label,
  },
  buttonTextPrimary: {
    color: '#fff',
  },
  buttonTextGhost: {
    color: colors.text,
  },
});
