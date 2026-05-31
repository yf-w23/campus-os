import React from 'react';
import {
  ActivityIndicator,
  Image,
  ImageSourcePropType,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {colors, radii, spacing, typography} from '../../../app/theme';

interface TabIconProps {
  focused: boolean;
  source: ImageSourcePropType;
  label: string;
}

/**
 * Tab 图标按 iOS app-icon 瓷砖渲染：圆角方块 + 细 hairline 边框，
 * 图标自带的白色画布即是瓷砖面。tintColor 会把整张白底也染色变成纯色块，
 * 这里不用 tint。
 */
export function TabIcon({focused, source, label}: TabIconProps) {
  return (
    <View style={styles.tabItem}>
      <View
        style={[
          styles.tabIconWrap,
          {opacity: focused ? 1 : 0.55, transform: [{scale: focused ? 1 : 0.94}]},
        ]}>
        <View
          style={[
            styles.tabIconTile,
            focused ? styles.tabIconTileFocused : styles.tabIconTileDefault,
          ]}>
          <Image source={source} style={styles.tabIconImg} />
        </View>
      </View>
      <Text style={[styles.tabLabel, focused && styles.tabLabelFocused]}>{label}</Text>
      <View style={[styles.tabDot, focused && styles.tabDotFocused]} />
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
  const isGhost = variant === 'ghost';

  return (
    <Pressable
      style={({pressed}) => [
        styles.button,
        isGhost ? styles.buttonGhost : styles.buttonPrimary,
        isDisabled && styles.buttonDisabled,
        pressed && !isDisabled && styles.buttonPressed,
      ]}
      onPress={onPress}
      disabled={isDisabled}
      android_ripple={{color: 'rgba(255,255,255,0.06)'}}
      hitSlop={8}>
      {loading ? (
        <ActivityIndicator color={isGhost ? colors.text : colors.textInvert} />
      ) : (
        <Text
          style={[
            styles.buttonText,
            isGhost ? styles.buttonTextGhost : styles.buttonTextPrimary,
          ]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // tab bar item
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    minWidth: 56,
    paddingTop: 2,
  },
  tabIconWrap: {},
  tabIconTile: {
    width: 28,
    height: 28,
    borderRadius: 7,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle,
  },
  tabIconTileFocused: {
    borderColor: colors.primary,
    ...Platform.select({
      ios: {
        shadowColor: colors.primary,
        shadowOffset: {width: 0, height: 2},
        shadowOpacity: 0.35,
        shadowRadius: 6,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  tabIconTileDefault: {},
  tabIconImg: {
    width: 28,
    height: 28,
    resizeMode: 'cover',
  },
  tabLabel: {
    fontSize: 10,
    letterSpacing: 0.2,
    color: colors.textMuted,
    fontWeight: '500',
  },
  tabLabelFocused: {
    color: colors.primary,
    fontWeight: '600',
  },
  tabDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'transparent',
    marginTop: 1,
  },
  tabDotFocused: {
    backgroundColor: colors.primary,
  },

  // primary button — pill 矩形混合，大圆角 + 实色填充
  button: {
    minHeight: 52,
    borderRadius: radii.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPrimary: {
    backgroundColor: colors.primary,
  },
  buttonGhost: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonPressed: {
    opacity: 0.85,
    transform: [{scale: 0.99}],
  },
  buttonText: {
    ...typography.label,
    letterSpacing: 0.1,
  },
  buttonTextPrimary: {
    color: colors.textInvert,
    fontWeight: '600',
  },
  buttonTextGhost: {
    color: colors.text,
  },
});
