import React from 'react';
import {StyleProp, ViewStyle} from 'react-native';
import Animated, {FadeInDown} from 'react-native-reanimated';

interface FadeInProps {
  children: React.ReactNode;
  delay?: number;
  style?: StyleProp<ViewStyle>;
}

/** 入场动画 — 用 Reanimated，避免 Moti 在 Release 包内 React 上下文冲突白屏 */
export function FadeIn({children, delay = 0, style}: FadeInProps) {
  return (
    <Animated.View
      entering={FadeInDown.delay(delay).duration(420)}
      style={style}>
      {children}
    </Animated.View>
  );
}

interface StaggerItemProps {
  children: React.ReactNode;
  index: number;
  style?: StyleProp<ViewStyle>;
}

export function StaggerItem({children, index, style}: StaggerItemProps) {
  return (
    <Animated.View
      entering={FadeInDown.delay(index * 60).duration(380)}
      style={style}>
      {children}
    </Animated.View>
  );
}
