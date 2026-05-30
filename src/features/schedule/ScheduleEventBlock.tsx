import React, {useState} from 'react';
import {Pressable, StyleSheet, Text} from 'react-native';

interface Props {
  dayIndex: number;
  begin: number;
  end: number;
  title: string;
  location: string;
  gridHeight: number;
  gridWidth: number;
  color: string;
  onPress?: () => void;
  onLongPress?: () => void;
}

const MARGIN = 2;

export function ScheduleEventBlock(props: Props) {
  const [overflow, setOverflow] = useState(false);
  const [titleH, setTitleH] = useState(0);
  const [locH, setLocH] = useState(0);

  const left = props.dayIndex * props.gridWidth + MARGIN;
  const top = props.begin * props.gridHeight + MARGIN;
  const right = (props.dayIndex + 1) * props.gridWidth - MARGIN;
  const bottom = props.end * props.gridHeight - MARGIN;
  const width = right - left;
  const height = bottom - top;

  if (titleH + locH > height && !overflow) {
    setOverflow(true);
  }

  return (
    <Pressable
      style={[
        styles.block,
        {
          left,
          top,
          width,
          height,
          backgroundColor: props.color,
        },
      ]}
      onPress={props.onPress}
      onLongPress={props.onLongPress}>
      <Text
        onLayout={e => setTitleH(e.nativeEvent.layout.height)}
        numberOfLines={overflow ? 2 : 4}
        style={[styles.title, overflow && {maxHeight: Math.max(12, height - locH - 8)}]}>
        {props.title}
      </Text>
      {props.location ? (
        <Text
          onLayout={e => setLocH(e.nativeEvent.layout.height)}
          numberOfLines={2}
          style={styles.location}>
          @{props.location}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  block: {
    position: 'absolute',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 4,
    overflow: 'hidden',
  },
  title: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
  },
  location: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 9,
    marginTop: 2,
  },
});
