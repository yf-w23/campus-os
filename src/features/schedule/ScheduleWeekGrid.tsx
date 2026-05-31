import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  Dimensions,
  LayoutChangeEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {colors, spacing, typography} from '../../app/theme';
import {todayLocalISO, WEEKDAY_LABELS} from '../../utils/weekDates';
import {GridBlock} from './gridProjection';
import {PERIOD_BEGIN_TIMES, PERIOD_END_TIMES} from './schedulePeriods';
import {ScheduleEventBlock} from './ScheduleEventBlock';

const TIME_LABEL_WIDTH = 40;
const TIME_AXIS_WIDTH = 8;
const HOUR_SPAN = 13.75;
const MIN_DAY_WIDTH = 82;
const MIN_HOUR_HEIGHT = 48;

interface Props {
  weekDates: string[];
  blocks: GridBlock[];
  displayStartHour: number;
  onBlockPress: (block: GridBlock) => void;
  onDayPress: (dateISO: string) => void;
  selectedDate: string;
}

export function ScheduleWeekGrid({
  weekDates,
  blocks,
  displayStartHour,
  onBlockPress,
  onDayPress,
  selectedDate,
}: Props) {
  const [gridHeight, setGridHeight] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const headerScrollRef = useRef<ScrollView>(null);
  const bodyScrollRef = useRef<ScrollView>(null);

  const viewportH =
    gridHeight > 0 ? gridHeight : Dimensions.get('window').height * 0.52;
  const hourHeight = Math.max(MIN_HOUR_HEIGHT, viewportH / HOUR_SPAN);
  const minuteHeight = hourHeight / 60;
  const gutterWidth = TIME_LABEL_WIDTH + TIME_AXIS_WIDTH;
  const bodyViewportWidth = Math.max(0, containerWidth - gutterWidth);
  const bodyContentWidth = Math.max(
    bodyViewportWidth,
    MIN_DAY_WIDTH * weekDates.length,
  );
  const unitWidth = bodyContentWidth / 7;
  const totalHeight = (24 - displayStartHour) * hourHeight;

  const today = todayLocalISO();

  const periodMarkers = useMemo(() => {
    const startBase = displayStartHour * 60;
    const markers: {top: number; key: string}[] = [];
    for (let i = 1; i < PERIOD_BEGIN_TIMES.length; i++) {
      const t = PERIOD_BEGIN_TIMES[i];
      if (!t) {
        continue;
      }
      const [h, m] = t.split(':').map(Number);
      const minutes = h * 60 + m;
      if (minutes < startBase) {
        continue;
      }
      markers.push({
        key: `b-${i}`,
        top: (minutes - startBase) * minuteHeight - 3,
      });
    }
    for (let i = 1; i < PERIOD_END_TIMES.length; i++) {
      const t = PERIOD_END_TIMES[i];
      if (!t) {
        continue;
      }
      const [h, m] = t.split(':').map(Number);
      const minutes = h * 60 + m;
      if (minutes < startBase) {
        continue;
      }
      markers.push({
        key: `e-${i}`,
        top: (minutes - startBase) * minuteHeight - 3,
      });
    }
    return markers;
  }, [displayStartHour, minuteHeight]);

  const onGridLayout = (e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    if (h > 0 && Math.abs(h - gridHeight) > 2) {
      setGridHeight(h);
    }
  };

  const onWrapLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && Math.abs(w - containerWidth) > 2) {
      setContainerWidth(w);
    }
  };

  useEffect(() => {
    const selectedIndex = weekDates.indexOf(selectedDate);
    if (
      selectedIndex < 0 ||
      bodyViewportWidth <= 0 ||
      bodyContentWidth <= bodyViewportWidth
    ) {
      return;
    }
    const centeredX =
      selectedIndex * unitWidth - (bodyViewportWidth - unitWidth) / 2;
    const maxX = bodyContentWidth - bodyViewportWidth;
    const x = Math.max(0, Math.min(maxX, centeredX));
    bodyScrollRef.current?.scrollTo({x, animated: true});
    headerScrollRef.current?.scrollTo({x, animated: true});
  }, [bodyContentWidth, bodyViewportWidth, selectedDate, unitWidth, weekDates]);

  return (
    <View style={styles.wrap} onLayout={onWrapLayout}>
      <View style={styles.frozenHeader}>
        <View style={{width: gutterWidth}} />
        <ScrollView
          horizontal
          ref={headerScrollRef}
          scrollEnabled={false}
          showsHorizontalScrollIndicator={false}
          style={{width: bodyViewportWidth}}>
          <View style={[styles.dayHeaderRow, {width: bodyContentWidth}]}>
            {weekDates.map((date, i) => {
              const active = date === selectedDate;
              const isToday = date === today;
              return (
                <PressableDayHeader
                  key={date}
                  label={WEEKDAY_LABELS[i]}
                  sub={date.slice(5).replace('-', '/')}
                  active={active}
                  isToday={isToday}
                  onPress={() => onDayPress(date)}
                />
              );
            })}
          </View>
        </ScrollView>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
        onLayout={onGridLayout}>
        <View style={[styles.gridRow, {height: Math.max(totalHeight, 400)}]}>
          <View style={[styles.timeCol, {height: totalHeight}]}>
            {Array.from({length: 25 - displayStartHour}, (_, k) => displayStartHour + k).map(
              hour => (
                <Text
                  key={hour}
                  style={[
                    styles.hourLabel,
                    {top: (hour - displayStartHour) * hourHeight - 6},
                  ]}>
                  {String(hour).padStart(2, '0')}:00
                </Text>
              ),
            )}
          </View>

          <View style={[styles.axisCol, {height: totalHeight}]}>
            <View style={styles.axisLine} />
            {periodMarkers.map(m => (
              <View key={m.key} style={[styles.axisDot, {top: m.top}]} />
            ))}
          </View>

          <ScrollView
            horizontal
            ref={bodyScrollRef}
            style={{width: bodyViewportWidth, height: totalHeight}}
            contentContainerStyle={{width: bodyContentWidth}}
            nestedScrollEnabled
            showsHorizontalScrollIndicator={false}
            scrollEventThrottle={16}
            onScroll={e => {
              headerScrollRef.current?.scrollTo({
                x: e.nativeEvent.contentOffset.x,
                animated: false,
              });
            }}>
            <View style={[styles.body, {height: totalHeight, width: bodyContentWidth}]}>
              {Array.from({length: 25 - displayStartHour}, (_, k) => displayStartHour + k).map(
                hour => (
                  <View
                    key={`line-${hour}`}
                    style={[
                      styles.hourLine,
                      {top: (hour - displayStartHour) * hourHeight},
                    ]}
                  />
                ),
              )}
              {blocks.map(block => (
                <ScheduleEventBlock
                  key={block.key}
                  dayIndex={block.dayIndex}
                  begin={block.begin}
                  end={block.end}
                  title={block.title}
                  location={block.location}
                  gridHeight={minuteHeight}
                  gridWidth={unitWidth}
                  color={block.color}
                  onPress={() => onBlockPress(block)}
                />
              ))}
            </View>
          </ScrollView>
        </View>
      </ScrollView>
    </View>
  );
}

function PressableDayHeader({
  label,
  sub,
  active,
  isToday,
  onPress,
}: {
  label: string;
  sub: string;
  active: boolean;
  isToday: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.dayCell} onPress={onPress}>
      <Text style={[styles.dayWeek, active && styles.dayWeekActive]}>{label}</Text>
      {isToday ? <View style={styles.todayBar} /> : <View style={styles.todayBarSpacer} />}
      <Text style={[styles.daySub, active && styles.daySubActive]}>{sub}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {flex: 1, overflow: 'hidden'},
  frozenHeader: {
    flexDirection: 'row',
    height: 44,
    backgroundColor: colors.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSubtle,
  },
  dayHeaderRow: {flexDirection: 'row'},
  dayCell: {flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 4},
  dayWeek: {...typography.caption, color: colors.textMuted, fontSize: 11},
  dayWeekActive: {color: colors.primary, fontWeight: '700'},
  todayBar: {
    width: 18,
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.primary,
    marginVertical: 2,
  },
  todayBarSpacer: {height: 2, marginVertical: 2},
  daySub: {fontSize: 9, color: colors.textMuted},
  daySubActive: {color: colors.primary, fontWeight: '600'},
  scroll: {flex: 1},
  scrollContent: {paddingBottom: spacing.sm},
  gridRow: {
    flexDirection: 'row',
    paddingVertical: spacing.sm,
  },
  timeCol: {
    width: TIME_LABEL_WIDTH,
    position: 'relative',
  },
  hourLabel: {
    position: 'absolute',
    width: TIME_LABEL_WIDTH,
    textAlign: 'center',
    fontSize: 10,
    color: colors.textMuted,
  },
  axisCol: {
    width: TIME_AXIS_WIDTH,
    position: 'relative',
  },
  axisLine: {
    position: 'absolute',
    left: TIME_AXIS_WIDTH / 2,
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: colors.borderSubtle,
  },
  axisDot: {
    position: 'absolute',
    left: TIME_AXIS_WIDTH / 2 - 3,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  body: {
    flex: 1,
    position: 'relative',
  },
  hourLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.borderSubtle,
  },
});
