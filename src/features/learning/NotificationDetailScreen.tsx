import React, {useMemo} from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useSelector} from 'react-redux';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {colors, radii, shadows, spacing, typography} from '../../app/theme';
import {Badge, DetailHeader, InfoRow} from '../common/components/Ui';
import {EmptyHint} from '../common/components/Status';
import {HtmlContent} from '../common/components/HtmlContent';
import {PrimaryButton} from '../common/components/Buttons';
import {selectLearning} from '../../state/selectors';
import {RootStackParamList} from '../../app/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'NotificationDetail'>;

export function NotificationDetailScreen({route, navigation}: Props) {
  const {id} = route.params;
  const {snapshot} = useSelector(selectLearning);
  const item = useMemo(
    () => snapshot?.notifications.find(n => n.id === id),
    [snapshot, id],
  );

  if (!item) {
    return (
      <SafeAreaView style={styles.container}>
        <DetailHeader title="通知详情" onBack={() => navigation.goBack()} />
        <EmptyHint
          title="通知不存在"
          message="当前本地快照里没有这条通知，可以返回首页重新同步。"
          style={styles.fullEmpty}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <DetailHeader title="通知详情" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <View style={styles.heroRow}>
            {!item.hasRead ? <Badge label="未读" tone="warning" /> : null}
            {item.expired ? <Badge label="已过期" tone="default" /> : null}
          </View>
          <Text style={styles.heroTitle}>{item.title}</Text>
        </View>

        <View style={styles.section}>
          <InfoRow label="课程" value={item.courseName} />
          <InfoRow label="发布人" value={item.publisher} />
          <InfoRow label="发布时间" value={item.publishTime} mono />
          {item.expireTime ? (
            <InfoRow label="截止时间" value={item.expireTime} mono />
          ) : null}
        </View>

        <View style={styles.contentCard}>
          <Text style={styles.contentLabel}>正文</Text>
          {item.content ? (
            <HtmlContent html={item.content} />
          ) : (
            <Text style={styles.empty}>（无内容）</Text>
          )}
        </View>

        {item.attachment ? (
          <Pressable
            style={({pressed}) => [styles.attachment, pressed && styles.pressed]}
            onPress={() =>
              navigation.navigate('InAppViewer', {
                url: item.attachment!.downloadUrl,
                title: item.attachment!.name,
              })
            }>
            <View style={styles.attIcon}>
              <Text style={styles.attIconText}>📎</Text>
            </View>
            <View style={{flex: 1}}>
              <Text style={styles.attTitle}>{item.attachment.name}</Text>
              <Text style={styles.attMeta}>{item.attachment.size} · 点击查看</Text>
            </View>
          </Pressable>
        ) : null}

        <PrimaryButton
          label="查看课程其它通知"
          variant="ghost"
          onPress={() => navigation.navigate('CourseDetail', {id: item.courseId})}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background},
  content: {padding: spacing.lg, paddingBottom: spacing.xxl},
  fullEmpty: {flex: 1},
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
  section: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    marginBottom: spacing.md,
    ...shadows.soft,
  },
  contentCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.soft,
  },
  contentLabel: {
    ...typography.micro,
    color: colors.textMuted,
    paddingLeft: spacing.sm,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
  },
  empty: {...typography.body, color: colors.textMuted, padding: spacing.md},
  attachment: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
    ...shadows.soft,
    borderWidth: 1,
    borderColor: colors.primaryMuted,
  },
  attIcon: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attIconText: {fontSize: 22},
  attTitle: {...typography.label, color: colors.text},
  attMeta: {...typography.caption, color: colors.textSecondary, marginTop: 2},
  pressed: {opacity: 0.8},
});
