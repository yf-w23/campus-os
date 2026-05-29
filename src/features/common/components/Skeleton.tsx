import React, {useEffect} from 'react';
import {StyleProp, StyleSheet, View, ViewStyle} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import {colors, radii, spacing} from '../../../app/theme';

interface SkeletonProps {
  width?: number | `${number}%`;
  height?: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}

export function Skeleton({
  width = '100%',
  height = 16,
  borderRadius = radii.sm,
  style,
}: SkeletonProps) {
  const pulse = useSharedValue(0.35);

  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(0.85, {duration: 900, easing: Easing.inOut(Easing.ease)}),
      -1,
      true,
    );
  }, [pulse]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: pulse.value,
  }));

  return (
    <Animated.View
      style={[
        styles.base,
        {width, height, borderRadius},
        animatedStyle,
        style,
      ]}
    />
  );
}

export function HomeLoadingSkeleton() {
  return (
    <View style={styles.block}>
      <Skeleton height={120} borderRadius={radii.lg} />
      <View style={styles.row}>
        <Skeleton height={88} borderRadius={radii.lg} style={styles.half} />
        <Skeleton height={88} borderRadius={radii.lg} style={styles.half} />
      </View>
      <Skeleton height={180} borderRadius={radii.lg} />
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.surfaceAlt,
  },
  block: {
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  half: {
    flex: 1,
  },
});
