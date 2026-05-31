import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {BottomTabScreenProps} from '@react-navigation/bottom-tabs';
import LinearGradient from 'react-native-linear-gradient';
import {useDispatch, useSelector} from 'react-redux';
import {useTranslation} from '../../app/i18n';
import {RootTabParamList} from '../../app/navigation/types';
import {colors, radii, spacing, typography} from '../../app/theme';
import {PersonalEvent} from '../../domain/schedule';
import {
  mergeScheduleForDate,
  MergedScheduleItem,
  scheduleForWeekDates,
  selectCampusSchedule,
  selectLearning,
  selectLearningLoading,
  selectLearningSchedule,
  selectPersonalEvents,
} from '../../state/selectors';
import {AppDispatch} from '../../state/store';
import {addPersonalEvent, removePersonalEvent} from '../../state/slices/scheduleSlice';
import {clearScheduleError} from '../../state/slices/scheduleSlice';
import {syncCampusData} from '../../state/thunks/syncCampusData';
import {
  defaultScheduleDateInWeek,
  formatWeekRange,
  todayLocalISO,
  weekDatesContaining,
  weekdayLabelForDate,
} from '../../utils/weekDates';
import {Badge, EmptyState, ScreenHeader} from '../common/components/Ui';
import {PrimaryButton} from '../common/components/Buttons';
import {
  buildGridBlocksForWeek,
  buildGridBlocksFromFlatEvents,
  computeDisplayStartHour,
  computeDisplayStartHourFlat,
  GridBlock,
} from './gridProjection';
import {ScheduleWeekGrid} from './ScheduleWeekGrid';
import {
  buildWeekSliceViews,
  currentSemesterWeekIndex,
  flattenSchedulesToEvents,
  weekDatesForIndex,
} from '../../services/campus/scheduleModel';

type Props = BottomTabScreenProps<RootTabParamList, 'Schedule'>;

function newEventId(): string {
  return `pe-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function ScheduleRow({
  item,
  onDelete,
}: {
  item: MergedScheduleItem;
  onDelete?: () => void;
}) {
  const isPersonal = item.kind === 'personal';
  const title = item.event.title;
  const location = item.event.location;
  const time = `${item.event.startTime}–${item.event.endTime}`;
  const note = isPersonal ? item.event.note : undefined;

  return (
    <Pressable
      style={[styles.dayRow, isPersonal && styles.dayRowPersonal]}
      onLongPress={isPersonal ? onDelete : undefined}>
      <View style={styles.scheduleTime}>
        <Text style={styles.scheduleStart}>{item.event.startTime}</Text>
        <Text style={styles.scheduleEnd}>{item.event.endTime}</Text>
      </View>
      <LinearGradient
        colors={
          isPersonal
            ? [colors.warning, colors.warning]
            : [colors.primary, colors.primaryDark]
        }
        style={styles.scheduleBar}
      />
      <View style={styles.scheduleBody}>
        <View style={styles.rowTop}>
          <Text style={styles.scheduleTitle} numberOfLines={1}>
            {title}
          </Text>
          <Badge label={isPersonal ? '备忘' : '课程'} tone={isPersonal ? 'warning' : 'default'} />
        </View>
        {location ? (
          <Text style={styles.scheduleLoc} numberOfLines={1}>
            {location}
          </Text>
        ) : null}
        {note ? <Text style={styles.scheduleNote}>{note}</Text> : null}
        {!location && !note ? (
          <Text style={styles.scheduleLoc}>{time}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

export function ScheduleScreen({navigation}: Props) {
  const t = useTranslation();
  const dispatch = useDispatch<AppDispatch>();
  const {height: windowHeight} = useWindowDimensions();
  const flatCourses = useSelector(selectLearningSchedule);
  const personalEvents = useSelector(selectPersonalEvents);
  const {error: learningError} = useSelector(selectLearning);
  const {calendar, baseSchedule, scheduleError} = useSelector(selectCampusSchedule);
  const loading = useSelector(selectLearningLoading);
  const [syncing, setSyncing] = useState(false);
  const [naturalWeekOffset, setNaturalWeekOffset] = useState(0);
  const [selectedDate, setSelectedDate] = useState(() => todayLocalISO());
  const [userPickedDate, setUserPickedDate] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formLocation, setFormLocation] = useState('');
  const [formStart, setFormStart] = useState('09:00');
  const [formEnd, setFormEnd] = useState('10:00');
  const [formNote, setFormNote] = useState('');

  const hasSemesterSchedule = Boolean(calendar && baseSchedule.length > 0);
  const currentSemesterIndex = useMemo(
    () =>
      calendar
        ? currentSemesterWeekIndex(calendar.firstDay, calendar.weekCount)
        : 0,
    [calendar],
  );
  const weekIndex = useMemo(() => {
    if (!calendar) {
      return naturalWeekOffset;
    }
    return Math.max(
      0,
      Math.min(calendar.weekCount - 1, currentSemesterIndex + naturalWeekOffset),
    );
  }, [calendar, currentSemesterIndex, naturalWeekOffset]);

  const weekDates = useMemo(
    () =>
      calendar
        ? weekDatesForIndex(calendar.firstDay, weekIndex)
        : weekDatesContaining(todayLocalISO(), naturalWeekOffset),
    [calendar, naturalWeekOffset, weekIndex],
  );

  const semesterWeekViews = useMemo(
    () =>
      calendar && baseSchedule.length > 0
        ? buildWeekSliceViews(
            baseSchedule,
            calendar.firstDay,
            calendar.weekCount,
            weekIndex,
          )
        : [],
    [baseSchedule, calendar, weekIndex],
  );

  const courses = useMemo(
    () =>
      hasSemesterSchedule
        ? flattenSchedulesToEvents(baseSchedule)
        : flatCourses,
    [baseSchedule, flatCourses, hasSemesterSchedule],
  );

  const weekCourses = useMemo(
    () => scheduleForWeekDates(courses, weekDates),
    [courses, weekDates],
  );

  useEffect(() => {
    setNaturalWeekOffset(0);
    setUserPickedDate(false);
  }, [calendar?.semesterId]);

  const hasItemsOnDate = useCallback(
    (dateISO: string) =>
      mergeScheduleForDate(dateISO, courses, personalEvents).length > 0,
    [courses, personalEvents],
  );

  useEffect(() => {
    setUserPickedDate(false);
  }, [naturalWeekOffset]);

  useEffect(() => {
    if (!weekDates.length) {
      return;
    }
    if (!weekDates.includes(selectedDate)) {
      setSelectedDate(defaultScheduleDateInWeek(weekDates, hasItemsOnDate));
      return;
    }
    if (
      !userPickedDate &&
      courses.length > 0 &&
      mergeScheduleForDate(selectedDate, courses, personalEvents).length === 0
    ) {
      const better = defaultScheduleDateInWeek(weekDates, hasItemsOnDate);
      if (better !== selectedDate && hasItemsOnDate(better)) {
        setSelectedDate(better);
      }
    }
  }, [
    weekDates,
    selectedDate,
    courses,
    personalEvents,
    hasItemsOnDate,
    userPickedDate,
  ]);

  useEffect(() => {
    if (courses.length > 0) {
      dispatch(clearScheduleError());
    }
  }, [courses.length, dispatch]);

  const dayItems = useMemo(
    () => mergeScheduleForDate(selectedDate, courses, personalEvents),
    [selectedDate, courses, personalEvents],
  );

  const displayStartHour = useMemo(
    () =>
      hasSemesterSchedule
        ? computeDisplayStartHour(semesterWeekViews, personalEvents, weekDates)
        : computeDisplayStartHourFlat(courses, personalEvents, weekDates),
    [courses, hasSemesterSchedule, personalEvents, semesterWeekViews, weekDates],
  );

  const gridBlocks = useMemo(
    () =>
      hasSemesterSchedule
        ? buildGridBlocksForWeek(
            semesterWeekViews,
            personalEvents,
            weekDates,
            displayStartHour,
          )
        : buildGridBlocksFromFlatEvents(
            courses,
            weekDates,
            personalEvents,
            displayStartHour,
          ),
    [
      courses,
      displayStartHour,
      hasSemesterSchedule,
      personalEvents,
      semesterWeekViews,
      weekDates,
    ],
  );

  const handleSync = useCallback(async () => {
    setSyncing(true);
    try {
      await dispatch(syncCampusData());
    } finally {
      setSyncing(false);
    }
  }, [dispatch]);

  const handleAdd = () => {
    const title = formTitle.trim();
    if (!title) {
      Alert.alert(t.schedule.addTitle, '请填写标题');
      return;
    }
    const event: PersonalEvent = {
      id: newEventId(),
      date: selectedDate || (weekDates[0] ?? ''),
      title,
      location: formLocation.trim() || undefined,
      startTime: formStart.trim() || '09:00',
      endTime: formEnd.trim() || '10:00',
      note: formNote.trim() || undefined,
      createdAt: new Date().toISOString(),
    };
    dispatch(addPersonalEvent(event));
    setModalOpen(false);
    setFormTitle('');
    setFormLocation('');
    setFormNote('');
  };

  const handleDelete = (id: string, title: string) => {
    Alert.alert(t.schedule.deleteTitle, `删除「${title}」？`, [
      {text: t.ai.cancel, style: 'cancel'},
      {
        text: t.schedule.deleteConfirm,
        style: 'destructive',
        onPress: () => dispatch(removePersonalEvent(id)),
      },
    ]);
  };

  const onBlockPress = (block: GridBlock) => {
    if (block.kind === 'personal') {
      Alert.alert(block.title, [
        `${block.startTime}–${block.endTime}`,
        block.location,
        block.note,
      ]
        .filter(Boolean)
        .join('\n'), [
        {text: t.ai.cancel, style: 'cancel'},
        {
          text: t.schedule.deleteConfirm,
          style: 'destructive',
          onPress: () => handleDelete(block.eventId, block.title),
        },
      ]);
      return;
    }
    setUserPickedDate(true);
    setSelectedDate(block.dateISO);
  };

  const openAI = () => {
    navigation.navigate('AI', {
      initialQuestion: '帮我看看这周日程，有什么安排？',
    });
  };

  const weekLabel =
    calendar
      ? `第 ${weekIndex + 1} 周 · ${formatWeekRange(weekDates)}`
      : formatWeekRange(weekDates) || t.schedule.thisWeek;
  const hasCourses = courses.length > 0;
  const weekHasItems = weekCourses.length > 0 || gridBlocks.length > 0;
  const canGoPrev = !calendar || weekIndex > 0;
  const canGoNext = !calendar || weekIndex < calendar.weekCount - 1;
  const showTodayJump = calendar
    ? weekIndex !== currentSemesterIndex
    : naturalWeekOffset !== 0;
  const subtitle = hasCourses
    ? hasSemesterSchedule && calendar
      ? weekCourses.length > 0
        ? `${calendar.semesterName} · ${weekLabel} · ${weekCourses.length} 节课`
        : `${calendar.semesterName} · ${weekLabel} 暂无课程`
      : weekCourses.length > 0
        ? `本周 ${weekCourses.length} 节课 · ${weekLabel}`
        : `已加载 ${courses.length} 条课表，本周暂无匹配 · ${weekLabel}`
    : learningError ?? scheduleError ?? '请先在首页同步校园数据';

  const syncBusy = syncing || loading;
  const weekGridHeight = Math.min(560, Math.max(430, windowHeight * 0.48));

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.pageScroll}
        contentContainerStyle={styles.pageContent}
        showsVerticalScrollIndicator={false}>
        <View style={styles.headerArea}>
          <ScreenHeader
            eyebrow={t.tabs.schedule}
            title={t.schedule.title}
            subtitle={subtitle}
            right={
              <View style={styles.headerActions}>
                <Pressable onPress={handleSync} hitSlop={8} disabled={syncBusy}>
                  <Text
                    style={[styles.headerLink, syncBusy && styles.headerLinkDim]}>
                    {syncBusy ? '同步中…' : '同步'}
                  </Text>
                </Pressable>
                <Pressable onPress={openAI} hitSlop={8}>
                  <Text style={styles.headerLink}>{t.schedule.askAi}</Text>
                </Pressable>
              </View>
            }
          />

          <View style={styles.weekNav}>
            <Pressable
              style={[styles.weekBtn, !canGoPrev && styles.weekBtnDisabled]}
              disabled={!canGoPrev}
              onPress={() => {
                if (!canGoPrev) {
                  return;
                }
                setUserPickedDate(false);
                setNaturalWeekOffset(o => o - 1);
              }}>
              <Text style={styles.weekBtnText}>‹</Text>
            </Pressable>
            <Text style={styles.weekLabel}>{weekLabel}</Text>
            <Pressable
              style={[styles.weekBtn, !canGoNext && styles.weekBtnDisabled]}
              disabled={!canGoNext}
              onPress={() => {
                if (!canGoNext) {
                  return;
                }
                setUserPickedDate(false);
                setNaturalWeekOffset(o => o + 1);
              }}>
              <Text style={styles.weekBtnText}>›</Text>
            </Pressable>
            {showTodayJump ? (
              <Pressable
                onPress={() => {
                  setUserPickedDate(false);
                  setNaturalWeekOffset(0);
                  setSelectedDate(todayLocalISO());
                }}
                hitSlop={8}>
                <Text style={styles.todayJump}>{t.schedule.backToday}</Text>
              </Pressable>
            ) : null}
            <Pressable onPress={() => setModalOpen(true)} hitSlop={8}>
              <Text style={styles.addLink}>{t.schedule.add}</Text>
            </Pressable>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.dayStrip}>
            {weekDates.map(date => {
              const active = date === selectedDate;
              const hasDay =
                mergeScheduleForDate(date, courses, personalEvents).length > 0;
              return (
                <Pressable
                  key={date}
                  style={[styles.dayChip, active && styles.dayChipActive]}
                  onPress={() => {
                    setUserPickedDate(true);
                    setSelectedDate(date);
                  }}>
                  <Text
                    style={[styles.dayChipDow, active && styles.dayChipTextActive]}>
                    {weekdayLabelForDate(date)}
                  </Text>
                  <Text
                    style={[styles.dayChipDate, active && styles.dayChipTextActive]}>
                    {date.slice(5)}
                  </Text>
                  {hasDay ? <View style={styles.dayDot} /> : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {learningError && !hasCourses ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{learningError}</Text>
          </View>
        ) : null}

        {gridBlocks.length > 0 ? (
          <View style={[styles.gridFlex, {height: weekGridHeight}]}>
            <ScheduleWeekGrid
              weekDates={weekDates}
              blocks={gridBlocks}
              displayStartHour={displayStartHour}
              selectedDate={selectedDate}
              onDayPress={date => {
                setUserPickedDate(true);
                setSelectedDate(date);
              }}
              onBlockPress={onBlockPress}
            />
          </View>
        ) : null}

        <View style={styles.listContent}>
          <Text style={styles.listHeading}>
            {weekdayLabelForDate(selectedDate)} · {selectedDate}
          </Text>
          {dayItems.length === 0 ? (
            <>
              <EmptyState
                title={
                  weekHasItems
                    ? `${weekdayLabelForDate(selectedDate)}暂无课程`
                    : t.schedule.emptyWeek
                }
                description={
                  hasCourses
                    ? weekCourses.length > 0
                      ? '请点击上方有圆点的日期（如周五）查看课程'
                      : '课表日期与本周不匹配，可切换上一周/下一周，或重新同步'
                    : '请打开首页点击同步，或在此点击「同步」拉取课表'
                }
              />
              {weekCourses.length > 0 ? (
                <View style={styles.weekOverview}>
                  <Text style={styles.weekOverviewTitle}>本周其它安排</Text>
                  {weekDates.map(date => {
                    const items = mergeScheduleForDate(
                      date,
                      courses,
                      personalEvents,
                    );
                    if (!items.length) {
                      return null;
                    }
                    return (
                      <View key={date} style={styles.weekDayBlock}>
                        <Pressable
                          onPress={() => {
                            setUserPickedDate(true);
                            setSelectedDate(date);
                          }}>
                          <Text style={styles.weekDayHeading}>
                            {weekdayLabelForDate(date)} · {date.slice(5)}
                          </Text>
                        </Pressable>
                        {items.map((item, idx) => (
                          <Text key={`${date}-${idx}`} style={styles.weekDayLine}>
                            {item.event.startTime}–{item.event.endTime}{' '}
                            {item.event.title}
                          </Text>
                        ))}
                      </View>
                    );
                  })}
                </View>
              ) : null}
            </>
          ) : (
            <View style={styles.todayCard}>
              {dayItems.map((item, idx) => (
                <View key={`${item.kind}-${item.event.id}-${idx}`}>
                  {idx > 0 ? <View style={styles.scheduleDivider} /> : null}
                  <ScheduleRow
                    item={item}
                    onDelete={
                      item.kind === 'personal'
                        ? () => handleDelete(item.event.id, item.event.title)
                        : undefined
                    }
                  />
                </View>
              ))}
            </View>
          )}
          {!weekHasItems && !hasCourses ? (
            <PrimaryButton
              label={syncBusy ? '同步中…' : '同步课表'}
              onPress={handleSync}
              disabled={syncBusy}
            />
          ) : null}
        </View>
      </ScrollView>

      <Modal visible={modalOpen} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>{t.schedule.addTitle}</Text>
            <Text style={styles.modalDate}>
              {selectedDate
                ? `${weekdayLabelForDate(selectedDate)} · ${selectedDate}`
                : weekLabel}
            </Text>
            <TextInput
              style={styles.input}
              placeholder={t.schedule.fieldTitle}
              placeholderTextColor={colors.textMuted}
              value={formTitle}
              onChangeText={setFormTitle}
            />
            <View style={styles.timeRow}>
              <TextInput
                style={[styles.input, styles.timeInput]}
                placeholder="09:00"
                placeholderTextColor={colors.textMuted}
                value={formStart}
                onChangeText={setFormStart}
              />
              <Text style={styles.timeSep}>–</Text>
              <TextInput
                style={[styles.input, styles.timeInput]}
                placeholder="10:00"
                placeholderTextColor={colors.textMuted}
                value={formEnd}
                onChangeText={setFormEnd}
              />
            </View>
            <TextInput
              style={styles.input}
              placeholder={t.schedule.fieldLocation}
              placeholderTextColor={colors.textMuted}
              value={formLocation}
              onChangeText={setFormLocation}
            />
            <TextInput
              style={[styles.input, styles.noteInput]}
              placeholder={t.schedule.fieldNote}
              placeholderTextColor={colors.textMuted}
              value={formNote}
              onChangeText={setFormNote}
              multiline
            />
            <View style={styles.modalActions}>
              <PrimaryButton
                label={t.ai.cancel}
                variant="ghost"
                onPress={() => setModalOpen(false)}
              />
              <PrimaryButton label={t.schedule.save} onPress={handleAdd} />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background},
  pageScroll: {flex: 1},
  pageContent: {paddingBottom: 112},
  headerArea: {paddingHorizontal: spacing.lg, paddingTop: spacing.sm},
  headerActions: {flexDirection: 'row', gap: spacing.md, alignItems: 'center'},
  headerLink: {...typography.caption, color: colors.primary, fontWeight: '600'},
  headerLinkDim: {opacity: 0.5},
  weekNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  weekBtn: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekBtnDisabled: {opacity: 0.35},
  weekBtnText: {fontSize: 20, color: colors.text, fontWeight: '600'},
  weekLabel: {...typography.body, color: colors.text, flex: 1},
  todayJump: {...typography.caption, color: colors.primary},
  addLink: {...typography.caption, color: colors.primary, fontWeight: '600'},
  dayStrip: {gap: spacing.sm, paddingBottom: spacing.sm},
  dayChip: {
    minWidth: 52,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle,
  },
  dayChipActive: {
    backgroundColor: colors.primaryMuted,
    borderColor: colors.primary,
  },
  dayChipDow: {...typography.caption, color: colors.textMuted},
  dayChipDate: {...typography.label, color: colors.text, marginTop: 2},
  dayChipTextActive: {color: colors.primary, fontWeight: '600'},
  dayDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
    marginTop: 4,
  },
  errorBox: {marginHorizontal: spacing.lg, marginBottom: spacing.sm},
  errorText: {...typography.caption, color: colors.error},
  gridFlex: {
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.lg,
    overflow: 'hidden',
  },
  listContent: {paddingHorizontal: spacing.lg, paddingBottom: spacing.xl},
  listHeading: {
    ...typography.label,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  todayCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  dayRowPersonal: {opacity: 0.95},
  scheduleDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  scheduleTime: {width: 52, alignItems: 'flex-start'},
  scheduleStart: {
    ...typography.label,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  scheduleEnd: {
    ...typography.caption,
    color: colors.textMuted,
    fontVariant: ['tabular-nums'],
    marginTop: 2,
  },
  scheduleBar: {width: 3, alignSelf: 'stretch', borderRadius: 2},
  scheduleBody: {flex: 1, gap: 2},
  rowTop: {flexDirection: 'row', alignItems: 'center', gap: spacing.sm},
  scheduleTitle: {
    ...typography.body,
    color: colors.text,
    fontWeight: '500',
    flex: 1,
  },
  scheduleLoc: {...typography.caption, color: colors.textSecondary},
  scheduleNote: {...typography.caption, color: colors.textMuted},
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  modalTitle: {...typography.h2, color: colors.text},
  modalDate: {...typography.caption, color: colors.textMuted, marginBottom: spacing.xs},
  input: {
    backgroundColor: colors.background,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle,
  },
  timeRow: {flexDirection: 'row', alignItems: 'center', gap: spacing.sm},
  timeInput: {flex: 1},
  timeSep: {color: colors.textMuted},
  noteInput: {minHeight: 72, textAlignVertical: 'top'},
  modalActions: {flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md},
  weekOverview: {marginTop: spacing.lg, gap: spacing.md},
  weekOverviewTitle: {...typography.label, color: colors.textSecondary},
  weekDayBlock: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle,
    gap: spacing.xs,
  },
  weekDayHeading: {...typography.body, color: colors.primary, fontWeight: '600'},
  weekDayLine: {...typography.caption, color: colors.text},
});
