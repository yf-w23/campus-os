import React from 'react';
import {
  Image,
  ImageSourcePropType,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {colors, radii, spacing, typography} from '../../app/theme';
import {ScreenHeader} from '../common/components/Ui';
import {RootStackParamList} from '../../app/navigation/types';
import {uiImages} from '../../app/assets/uiImages';

interface Props {
  navigation: any;
}

interface Entry {
  key: keyof RootStackParamList;
  title: string;
  subtitle: string;
  icon: ImageSourcePropType;
}

const entries: Entry[] = [
  {
    key: 'CampusClassroom',
    title: '教室查询',
    subtitle: '查看教室占用情况',
    icon: uiImages.campusClassroom,
  },
  {
    key: 'CampusGrades',
    title: '成绩查询',
    subtitle: '本学期与历史成绩',
    icon: uiImages.campusGrades,
  },
  {
    key: 'CampusPEtest',
    title: '体测成绩',
    subtitle: '体测详情与历史',
    icon: uiImages.campusPEtest,
  },
  {
    key: 'CampusDormitory',
    title: '宿舍服务',
    subtitle: '电费、健康打卡',
    icon: uiImages.campusDormitory,
  },
  {
    key: 'CampusFinance',
    title: '校园财务',
    subtitle: '校园卡余额与近期流水',
    icon: uiImages.campusFinance,
  },
  {
    key: 'CampusNetwork',
    title: '校园网',
    subtitle: '余额、账号与在线设备',
    icon: uiImages.campusNetwork,
  },
  {
    key: 'CampusReservation',
    title: '图书馆预约',
    subtitle: '座位查询与预约、研读间',
    icon: uiImages.campusReservation,
  },
];

export function CampusScreen({navigation}: Props) {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <ScreenHeader
          eyebrow="校园"
          title="清华校园服务"
          subtitle="教室 · 成绩 · 体测 · 宿舍 · 图书馆"
        />

        <View style={styles.list}>
          {entries.map((entry, idx) => (
            <Pressable
              key={entry.key}
              style={({pressed}) => [
                styles.row,
                idx > 0 && styles.rowDivider,
                pressed && styles.rowPressed,
              ]}
              onPress={() => navigation.navigate(entry.key)}>
              <View style={styles.iconWrap}>
                <Image source={entry.icon} style={styles.icon} />
              </View>
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle}>{entry.title}</Text>
                <Text style={styles.rowSub}>{entry.subtitle}</Text>
              </View>
              <Text style={styles.chev}>›</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
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
  list: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  rowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  rowPressed: {
    backgroundColor: colors.surfaceAlt,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle,
  },
  icon: {
    width: 40,
    height: 40,
    resizeMode: 'cover',
  },
  rowBody: {flex: 1, gap: 2},
  rowTitle: {
    ...typography.body,
    color: colors.text,
    fontWeight: '500',
  },
  rowSub: {
    ...typography.caption,
    color: colors.textMuted,
  },
  chev: {
    fontSize: 22,
    color: colors.textMuted,
    fontWeight: '300',
  },
});
