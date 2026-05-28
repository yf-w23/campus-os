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
import {colors, radii, shadows, spacing, typography} from '../../app/theme';
import {RootStackParamList} from '../../app/navigation/types';

interface Props {
  navigation: any;
}

interface Entry {
  key: keyof RootStackParamList;
  title: string;
  subtitle: string;
  icon: ImageSourcePropType;
  accent: string;
}

const entries: Entry[] = [
  {
    key: 'CampusClassroom',
    title: '教室查询',
    subtitle: '查看教室占用情况',
    icon: require('../../assets/campus/classroom.png'),
    accent: '#3B82F6',
  },
  {
    key: 'CampusGrades',
    title: '成绩查询',
    subtitle: '本学期与历史成绩',
    icon: require('../../assets/campus/grades.png'),
    accent: '#10B981',
  },
  {
    key: 'CampusPEtest',
    title: '体测成绩',
    subtitle: '体育测试详情与历史',
    icon: require('../../assets/campus/petest.png'),
    accent: '#F59E0B',
  },
  {
    key: 'CampusDormitory',
    title: '宿舍信息',
    subtitle: '电费、报修、健康打卡',
    icon: require('../../assets/campus/dormitory.png'),
    accent: '#8B5CF6',
  },
  {
    key: 'CampusReservation',
    title: '场馆预约',
    subtitle: '图书馆、体育馆等',
    icon: require('../../assets/campus/reservation.png'),
    accent: '#06B6D4',
  },
];

export function CampusScreen({navigation}: Props) {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>校园</Text>
      <Text style={styles.subtitle}>清华校园生活服务一站式入口</Text>

      <View style={styles.grid}>
        {entries.map(entry => (
          <Pressable
            key={entry.key}
            style={({pressed}) => [styles.card, pressed && styles.cardPressed]}
            onPress={() => navigation.navigate(entry.key)}>
            <View style={[styles.iconWrap, {backgroundColor: entry.accent + '1A'}]}>
              <Image source={entry.icon} style={styles.icon} />
            </View>
            <Text style={styles.cardTitle}>{entry.title}</Text>
            <Text style={styles.cardSub}>{entry.subtitle}</Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background},
  content: {padding: spacing.lg, paddingBottom: spacing.xxl + spacing.xl},
  title: {...typography.h1, color: colors.text},
  subtitle: {...typography.caption, color: colors.textSecondary, marginBottom: spacing.lg},
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  card: {
    width: '47.5%',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.sm,
    ...shadows.soft,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  cardPressed: {opacity: 0.85, transform: [{scale: 0.98}]},
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  icon: {width: 36, height: 36, resizeMode: 'contain'},
  cardTitle: {...typography.h3, color: colors.text},
  cardSub: {...typography.caption, color: colors.textSecondary},
});
