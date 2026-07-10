import React, {useEffect, useMemo, useState} from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {BottomTabScreenProps} from '@react-navigation/bottom-tabs';
import {CompositeScreenProps} from '@react-navigation/native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useDispatch, useSelector} from 'react-redux';
import {useTranslation} from '../../app/i18n';
import {RootStackParamList, RootTabParamList} from '../../app/navigation/types';
import {colors, radii, spacing, typography} from '../../app/theme';
import {
  Badge,
  ListCard,
  ScreenHeader,
  SegmentedControl,
} from '../common/components/Ui';
import {EmptyHint} from '../common/components/Status';
import {selectLearning, selectUpcomingDeadlines} from '../../state/selectors';
import {HomeworkStatus} from '../../domain/learning';
import {stripHtml} from '../../utils/html';
import {AppDispatch} from '../../state/store';
import {
  addManualDeadline,
  removeManualDeadline,
} from '../../state/slices/manualDeadlineSlice';

type TabKey = 'courses' | 'homework' | 'notifications' | 'files';
type Props = CompositeScreenProps<
  BottomTabScreenProps<RootTabParamList, 'Learning'>,
  NativeStackScreenProps<RootStackParamList>
>;

const statusTone: Record<
  HomeworkStatus,
  'default' | 'success' | 'warning' | 'error'
> = {
  pending: 'warning',
  submitted: 'default',
  graded: 'success',
  overdue: 'error',
};

const statusAccent: Record<
  HomeworkStatus,
  'primary' | 'success' | 'warning' | 'error' | 'neutral'
> = {
  pending: 'warning',
  submitted: 'primary',
  graded: 'success',
  overdue: 'error',
};

function newDeadlineId(): string {
  return `md-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function template(
  value: string,
  vars: Record<string, string | number>,
): string {
  return value.replace(/\{(\w+)\}/g, (_, key) => String(vars[key] ?? ''));
}

function isValidDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value.trim());
}

function isValidTime(value: string): boolean {
  return /^\d{1,2}:\d{2}$/.test(value.trim());
}

export function LearningScreen({navigation, route}: Props) {
  const t = useTranslation();
  const dispatch = useDispatch<AppDispatch>();
  const {snapshot} = useSelector(selectLearning);
  const deadlines = useSelector(selectUpcomingDeadlines);
  const [tab, setTab] = useState<TabKey>('courses');
  const [modalOpen, setModalOpen] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formDate, setFormDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [formTime, setFormTime] = useState('23:59');
  const [formCourse, setFormCourse] = useState('');
  const [formNote, setFormNote] = useState('');

  useEffect(() => {
    if (route.params?.initialTab) {
      setTab(route.params.initialTab);
    }
    if (route.params?.openAddDeadline) {
      setModalOpen(true);
      navigation.setParams({openAddDeadline: undefined});
    }
  }, [navigation, route.params?.initialTab, route.params?.openAddDeadline]);

  const tabs = useMemo(
    () =>
      [
        {key: 'courses' as const, label: t.learning.courses},
        {key: 'homework' as const, label: t.learning.homework},
        {key: 'notifications' as const, label: t.learning.notifications},
        {key: 'files' as const, label: t.learning.files},
      ] as const,
    [t],
  );

  const counts = {
    courses: snapshot?.courses.length ?? 0,
    homework: deadlines.length,
    notifications: snapshot?.notifications.length ?? 0,
    files: snapshot?.files.length ?? 0,
  };

  const saveManualDdl = () => {
    const title = formTitle.trim();
    if (!title) {
      Alert.alert(t.learning.addDdl, t.learning.missingTitle);
      return;
    }
    if (!isValidDate(formDate)) {
      Alert.alert(t.learning.addDdl, t.learning.missingDate);
      return;
    }
    if (!isValidTime(formTime)) {
      Alert.alert(t.learning.addDdl, t.learning.missingTime);
      return;
    }
    const [hour, minute] = formTime.trim().split(':');
    dispatch(
      addManualDeadline({
        id: newDeadlineId(),
        title,
        deadline: `${formDate.trim()}T${hour.padStart(2, '0')}:${minute}:00`,
        courseName: formCourse.trim() || undefined,
        note: formNote.trim() || undefined,
        createdAt: new Date().toISOString(),
      }),
    );
    setModalOpen(false);
    setFormTitle('');
    setFormCourse('');
    setFormNote('');
  };

  const confirmDeleteManual = (id: string, title: string) => {
    Alert.alert(
      t.learning.deleteDdl,
      template(t.learning.deleteDdlConfirm, {title}),
      [
        {text: t.learning.cancel, style: 'cancel'},
        {
          text: t.schedule.deleteConfirm,
          style: 'destructive',
          onPress: () => dispatch(removeManualDeadline(id)),
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <ScreenHeader
          eyebrow={t.tabs.learning}
          title={t.learning.title}
          subtitle={template(t.learning.learningSubtitle, counts)}
          right={
            <Pressable onPress={() => setModalOpen(true)} hitSlop={8}>
              <Text style={styles.addLink}>＋</Text>
            </Pressable>
          }
        />

        <SegmentedControl<TabKey>
          value={tab}
          onChange={setTab}
          options={tabs.map(item => ({
            value: item.key,
            label: item.label,
            count: counts[item.key],
          }))}
          style={styles.segment}
        />

        {tab === 'courses' ? (
          snapshot?.courses.length ? (
            snapshot.courses.map(course => (
              <ListCard
                key={course.id}
                accent="primary"
                onPress={() =>
                  navigation.navigate('CourseDetail', {id: course.id})
                }>
                <Text style={styles.cardTitle}>{course.name}</Text>
                {course.teacherName ? (
                  <Text style={styles.cardMeta}>{course.teacherName}</Text>
                ) : null}
                {course.courseNumber ? (
                  <Text style={styles.cardMeta}>
                    {template(t.learning.courseNumber, {
                      number: course.courseNumber,
                    })}
                  </Text>
                ) : null}
              </ListCard>
            ))
          ) : (
            <EmptyHint
              title={t.learning.noCourses}
              message="打开首页同步校园数据后，课程列表会显示在这里。"
              style={styles.emptyHint}
            />
          )
        ) : null}

        {tab === 'homework' ? (
          deadlines.length ? (
            deadlines.map(item => {
              if (item.kind === 'manual') {
                return (
                  <ListCard key={item.id} accent="warning">
                    <View style={styles.cardHeader}>
                      <Text style={styles.cardTitle} numberOfLines={2}>
                        {item.title}
                      </Text>
                      <Badge label={t.learning.manualDdl} tone="warning" />
                    </View>
                    {item.courseName ? (
                      <Text style={styles.cardMeta}>{item.courseName}</Text>
                    ) : null}
                    <Text style={styles.cardMeta}>
                      {template(t.learning.deadlinePrefix, {
                        deadline: item.deadline || '—',
                      })}
                    </Text>
                    {item.note ? (
                      <Text style={styles.cardBody} numberOfLines={2}>
                        {item.note}
                      </Text>
                    ) : null}
                    <Pressable
                      onPress={() => confirmDeleteManual(item.id, item.title)}
                      hitSlop={8}
                      style={styles.deleteInline}>
                      <Text style={styles.deleteInlineText}>
                        {t.schedule.deleteConfirm}
                      </Text>
                    </Pressable>
                  </ListCard>
                );
              }
              return (
                <ListCard
                  key={item.id}
                  accent={statusAccent[item.status]}
                  onPress={() =>
                    navigation.navigate('HomeworkDetail', {id: item.id})
                  }>
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle} numberOfLines={2}>
                      {item.title}
                    </Text>
                    <Badge
                      label={
                        item.status === 'pending'
                          ? t.learning.pending
                          : item.status === 'submitted'
                          ? t.learning.submitted
                          : item.status === 'graded'
                          ? t.learning.graded
                          : t.learning.overdue
                      }
                      tone={statusTone[item.status]}
                    />
                  </View>
                  <Text style={styles.cardMeta}>{item.courseName}</Text>
                  <Text style={styles.cardMeta}>
                    {template(t.learning.deadlinePrefix, {
                      deadline: item.deadline || '—',
                    })}
                  </Text>
                </ListCard>
              );
            })
          ) : (
            <EmptyHint
              title={t.learning.noHomework}
              message="老师布置的作业和你手动添加的 DDL 会显示在这里。"
              style={styles.emptyHint}
            />
          )
        ) : null}

        {tab === 'notifications' ? (
          snapshot?.notifications.length ? (
            snapshot.notifications.map(item => (
              <ListCard
                key={item.id}
                accent={!item.hasRead ? 'warning' : 'neutral'}
                onPress={() =>
                  navigation.navigate('NotificationDetail', {id: item.id})
                }>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle} numberOfLines={2}>
                    {item.title}
                  </Text>
                  {!item.hasRead ? <Badge label="NEW" tone="warning" /> : null}
                </View>
                <Text style={styles.cardMeta}>
                  {item.courseName} · {item.publisher} · {item.publishTime}
                </Text>
                <Text style={styles.cardBody} numberOfLines={2}>
                  {stripHtml(item.content).slice(0, 120) || '—'}
                </Text>
              </ListCard>
            ))
          ) : (
            <EmptyHint
              title={t.learning.noNotifications}
              message="课程通知同步后会显示在这里。"
              style={styles.emptyHint}
            />
          )
        ) : null}

        {tab === 'files' ? (
          snapshot?.files.length ? (
            snapshot.files.map(item => (
              <ListCard
                key={item.id}
                accent={item.isNew ? 'success' : 'neutral'}
                onPress={() =>
                  navigation.navigate('FileDetail', {id: item.id})
                }>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle} numberOfLines={2}>
                    {item.title}
                  </Text>
                  {item.isNew ? <Badge label="NEW" tone="success" /> : null}
                </View>
                <Text style={styles.cardMeta}>
                  {item.courseName} · {item.fileType.toUpperCase() || 'FILE'} ·{' '}
                  {item.size}
                </Text>
              </ListCard>
            ))
          ) : (
            <EmptyHint
              title={t.learning.noFiles}
              message="课程资料和附件同步后会显示在这里。"
              style={styles.emptyHint}
            />
          )
        ) : null}
      </ScrollView>

      <Modal visible={modalOpen} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>{t.learning.addDdl}</Text>
            <TextInput
              style={styles.input}
              placeholder={t.learning.fieldTitle}
              placeholderTextColor={colors.textMuted}
              value={formTitle}
              onChangeText={setFormTitle}
            />
            <View style={styles.formRow}>
              <TextInput
                style={[styles.input, styles.formHalf]}
                placeholder={t.learning.fieldDeadlineDate}
                placeholderTextColor={colors.textMuted}
                value={formDate}
                onChangeText={setFormDate}
              />
              <TextInput
                style={[styles.input, styles.formHalf]}
                placeholder={t.learning.fieldDeadlineTime}
                placeholderTextColor={colors.textMuted}
                value={formTime}
                onChangeText={setFormTime}
              />
            </View>
            <TextInput
              style={styles.input}
              placeholder={t.learning.fieldCourse}
              placeholderTextColor={colors.textMuted}
              value={formCourse}
              onChangeText={setFormCourse}
            />
            <TextInput
              style={[styles.input, styles.noteInput]}
              placeholder={t.learning.fieldNote}
              placeholderTextColor={colors.textMuted}
              value={formNote}
              onChangeText={setFormNote}
              multiline
            />
            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalButton, styles.modalButtonGhost]}
                onPress={() => setModalOpen(false)}>
                <Text style={styles.modalButtonGhostText}>
                  {t.learning.cancel}
                </Text>
              </Pressable>
              <Pressable style={styles.modalButton} onPress={saveManualDdl}>
                <Text style={styles.modalButtonText}>{t.learning.saveDdl}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background},
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl + spacing.xl,
  },
  addLink: {
    fontSize: 24,
    color: colors.primary,
    fontWeight: '600',
    lineHeight: 28,
  },
  segment: {
    marginBottom: spacing.lg,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  cardTitle: {...typography.label, color: colors.text, flex: 1, fontSize: 15},
  cardMeta: {...typography.caption, color: colors.textSecondary},
  cardBody: {...typography.caption, color: colors.textSecondary, marginTop: 2},
  emptyHint: {paddingVertical: spacing.xxl},
  deleteInline: {alignSelf: 'flex-start', paddingVertical: spacing.xs},
  deleteInlineText: {
    ...typography.caption,
    color: colors.error,
    fontWeight: '600',
  },
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
  modalTitle: {...typography.h2, color: colors.text, marginBottom: spacing.xs},
  input: {
    backgroundColor: colors.background,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle,
  },
  formRow: {flexDirection: 'row', gap: spacing.sm},
  formHalf: {flex: 1},
  noteInput: {minHeight: 72, textAlignVertical: 'top'},
  modalActions: {flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md},
  modalButton: {
    flex: 1,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
  },
  modalButtonGhost: {backgroundColor: colors.surfaceAlt},
  modalButtonText: {...typography.label, color: colors.textInvert},
  modalButtonGhostText: {...typography.label, color: colors.text},
});
