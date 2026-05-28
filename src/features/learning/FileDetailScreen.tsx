import React, {useCallback, useMemo} from 'react';
import {Alert, Linking, ScrollView, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useSelector} from 'react-redux';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {colors, radii, shadows, spacing, typography} from '../../app/theme';
import {Badge, DetailHeader, EmptyState, InfoRow} from '../common/components/Ui';
import {PrimaryButton} from '../common/components/Buttons';
import {selectLearning} from '../../state/selectors';
import {RootStackParamList} from '../../app/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'FileDetail'>;

export function FileDetailScreen({route, navigation}: Props) {
  const {id} = route.params;
  const {snapshot} = useSelector(selectLearning);
  const item = useMemo(
    () => snapshot?.files.find(f => f.id === id),
    [snapshot, id],
  );

  const openInBrowser = useCallback(async (url: string) => {
    try {
      const ok = await Linking.canOpenURL(url);
      if (ok) {
        await Linking.openURL(url);
      } else {
        Alert.alert('无法打开', '系统未找到可处理该链接的应用');
      }
    } catch (e) {
      Alert.alert('打开失败', e instanceof Error ? e.message : String(e));
    }
  }, []);

  if (!item) {
    return (
      <SafeAreaView style={styles.container}>
        <DetailHeader title="资料详情" onBack={() => navigation.goBack()} />
        <EmptyState title="资料不存在" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <DetailHeader title="资料详情" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <View style={styles.heroRow}>
            {item.isNew ? <Badge label="NEW" tone="success" /> : null}
            {item.fileType ? (
              <Badge label={String(item.fileType).toUpperCase()} tone="default" />
            ) : null}
          </View>
          <Text style={styles.heroTitle}>{item.title}</Text>
          <Text style={styles.heroMeta}>{item.courseName}</Text>
        </View>

        <View style={styles.section}>
          <InfoRow label="类型" value={String(item.fileType).toUpperCase()} />
          <InfoRow label="大小" value={item.size} />
          <InfoRow label="上传时间" value={item.uploadTime} mono />
        </View>

        {item.description ? (
          <View style={styles.descCard}>
            <Text style={styles.descLabel}>说明</Text>
            <Text style={styles.descBody}>{item.description}</Text>
          </View>
        ) : null}

        <PrimaryButton
          label="App 内预览"
          onPress={() =>
            navigation.navigate('InAppViewer', {url: item.previewUrl, title: item.title})
          }
        />
        <View style={{height: spacing.sm}} />
        <PrimaryButton
          label="系统下载器下载"
          variant="ghost"
          onPress={() => openInBrowser(item.downloadUrl)}
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
    marginBottom: spacing.md,
    ...shadows.soft,
  },
  descCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.soft,
  },
  descLabel: {
    ...typography.micro,
    color: colors.textMuted,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
  },
  descBody: {...typography.body, color: colors.text},
});
