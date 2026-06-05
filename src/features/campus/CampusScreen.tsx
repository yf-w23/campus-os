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
import {useTranslation} from '../../app/i18n';
import {colors, radii, spacing, typography} from '../../app/theme';
import {ScreenHeader} from '../common/components/Ui';
import {RootStackParamList} from '../../app/navigation/types';
import {uiImages} from '../../app/assets/uiImages';

interface Props {
  navigation: any;
}

interface Entry {
  key: keyof RootStackParamList;
  i18nKey:
    | 'classroom'
    | 'grades'
    | 'petest'
    | 'dormitory'
    | 'finance'
    | 'network'
    | 'reservation'
    | 'mail';
  icon: ImageSourcePropType;
}

const entries: Entry[] = [
  {
    key: 'CampusClassroom',
    i18nKey: 'classroom',
    icon: uiImages.campusClassroom,
  },
  {
    key: 'CampusGrades',
    i18nKey: 'grades',
    icon: uiImages.campusGrades,
  },
  {
    key: 'CampusPEtest',
    i18nKey: 'petest',
    icon: uiImages.campusPEtest,
  },
  {
    key: 'CampusDormitory',
    i18nKey: 'dormitory',
    icon: uiImages.campusDormitory,
  },
  {
    key: 'CampusFinance',
    i18nKey: 'finance',
    icon: uiImages.campusFinance,
  },
  {
    key: 'CampusNetwork',
    i18nKey: 'network',
    icon: uiImages.campusNetwork,
  },
  {
    key: 'CampusReservation',
    i18nKey: 'reservation',
    icon: uiImages.campusReservation,
  },
  {
    key: 'CampusMail',
    i18nKey: 'mail',
    icon: uiImages.campusMail,
  },
];

export function CampusScreen({navigation}: Props) {
  const t = useTranslation();
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <ScreenHeader
          eyebrow={t.tabs.campus}
          title={t.campus.title}
          subtitle={t.campus.subtitle}
        />

        <View style={styles.list}>
          {entries.map((entry, idx) => (
            <EntryRow
              key={entry.key}
              entry={entry}
              label={t.campus.entries[entry.i18nKey]}
              index={idx}
              onPress={() => navigation.navigate(entry.key)}
            />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function EntryRow({
  entry,
  label,
  index,
  onPress,
}: {
  entry: Entry;
  label: {title: string; subtitle: string};
  index: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({pressed}) => [
        styles.row,
        index > 0 && styles.rowDivider,
        pressed && styles.rowPressed,
      ]}
      onPress={onPress}>
      <View style={styles.iconWrap}>
        <Image source={entry.icon} style={styles.icon} />
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle}>{label.title}</Text>
        <Text style={styles.rowSub}>{label.subtitle}</Text>
      </View>
      <Text style={styles.chev}>›</Text>
    </Pressable>
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
