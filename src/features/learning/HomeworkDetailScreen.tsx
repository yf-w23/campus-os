import React, {useMemo} from 'react';
import {Linking, ScrollView, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useSelector} from 'react-redux';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {colors, radii, shadows, spacing, typography} from '../../app/theme';
import {Badge, DetailHeader, EmptyState, InfoRow} from '../common/components/Ui';
import {PrimaryButton} from '../common/components/Buttons';
import {selectLearning} from '../../state/selectors';
import {HomeworkStatus} from '../../domain/learning';
import {RootStackParamList} from '../../app/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'HomeworkDetail'>;

const labelMap: Record<HomeworkStatus, string> = {
  pending: '待提交',
  submitted: '已提交',
  graded: '已批改',
  overdue: '已逾期',
};
const toneMap: Record<HomeworkStatus, 'default' | 'success' | 'warning' | 'error'> = {
  pending: 'warning',
  submitted: 'default',
  graded: 'success',
  overdue: 'error',
};

export function HomeworkDetailScreen({route, navigation}: Props) {
  const {id} = route.params;
  const {snapshot} = useSelector(selectLearning);
  const item = useMemo(
    () => snapshot?.homework.find(h => h.id === id),
    [snapshot, id],
  );

  if (!item) {
    return (
      <SafeAreaView style={styles.container}>
        <DetailHeader title="作业详情" onBack={() => navigation.goBack()} />
        <EmptyState title="作业信息不存在" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <DetailHeader title="作业详情" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <View style={styles.heroRow}>
            <Badge label={labelMap[item.status]} tone={toneMap[item.status]} />
            {item.graded && item.grade != null ? (
              <Badge label={`成绩 ${item.grade}`} tone="success" />
            ) : null}
          </View>
          <Text style={styles.heroTitle}>{item.title}</Text>
          <Text style={styles.heroMeta}>{item.courseName}</Text>
        </View>

        <View style={styles.section}>
          <InfoRow label="截止时间" value={item.deadline} mono />
          {item.lateSubmissionDeadline ? (
            <InfoRow label="补交截止" value={item.lateSubmissionDeadline} mono />
          ) : null}
          <InfoRow
            label="提交状态"
            value={
              (item.submitted ? '已提交' : '未提交') +
              (item.isLateSubmission ? '（迟交）' : '')
            }
          />
          {item.graded ? (
            <InfoRow label="批改状态" value="已批改" />
          ) : null}
        </View>

        <PrimaryButton
          label="在 App 内查看详情"
          onPress={() =>
            navigation.navigate('InAppViewer', {url: item.url, title: item.title})
          }
        />
        <View style={{height: spacing.sm}} />
        <PrimaryButton
          label="用浏览器打开"
          variant="ghost"
          onPress={() => Linking.openURL(item.url)}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background},
  content: {padding: spacing.lg, paddingBottom: spacing.xxl},
  hero: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.soft,
    gap: spacing.sm,
  },
  heroRow: {flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs},
  heroTitle: {...typography.h1, color: colors.text},
  heroMeta: {...typography.caption, color: colors.textSecondary},
  section: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    marginBottom: spacing.lg,
    ...shadows.soft,
  },
});
