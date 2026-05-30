import React, {useCallback, useEffect, useState} from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {colors, radii, spacing, typography} from '../../app/theme';
import {DetailHeader, EmptyState} from '../common/components/Ui';
import {RootStackParamList} from '../../app/navigation/types';
import {
  getSportsReservationRecords,
  sportsIdInfoList,
} from '../../services/campus/sports';
import {SportsReservationRecord} from '../../domain/sports';

type Props = NativeStackScreenProps<RootStackParamList, 'CampusSports'>;

export function SportsScreen({navigation}: Props) {
  const [recordsLoading, setRecordsLoading] = useState(true);
  const [records, setRecords] = useState<SportsReservationRecord[]>([]);

  const loadRecords = useCallback(async () => {
    setRecordsLoading(true);
    try {
      const list = await getSportsReservationRecords();
      setRecords(list.slice(0, 5));
    } catch {
      setRecords([]);
    } finally {
      setRecordsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <DetailHeader title="体育场馆预约" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content}>
        {recordsLoading ? (
          <ActivityIndicator color={colors.primary} style={{marginVertical: spacing.md}} />
        ) : records[0] ? (
          <View style={styles.recordCard}>
            <Text style={styles.recordLabel}>最近订单</Text>
            <Text style={styles.recordTitle}>{records[0].name}</Text>
            <Text style={styles.recordMeta}>
              {records[0].field} · {records[0].time}
            </Text>
            <Text style={styles.recordMeta}>
              {records[0].price} · {records[0].method}
            </Text>
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>选择场馆</Text>
        {sportsIdInfoList.length === 0 ? (
          <EmptyState title="暂无场馆" description="场馆列表未配置" />
        ) : (
          sportsIdInfoList.map((info, idx) => (
            <Pressable
              key={info.name}
              style={[styles.row, idx > 0 && styles.rowBorder]}
              onPress={() => navigation.navigate('CampusSportsDetail', {info})}>
              <Text style={styles.rowTitle}>{info.name}</Text>
              <Text style={styles.chev}>›</Text>
            </Pressable>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background},
  content: {padding: spacing.lg, paddingBottom: spacing.xxl},
  recordCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  recordLabel: {...typography.caption, color: colors.textMuted},
  recordTitle: {...typography.h3, color: colors.text, marginTop: 4},
  recordMeta: {...typography.caption, color: colors.textSecondary, marginTop: 2},
  sectionTitle: {...typography.h3, color: colors.text, marginBottom: spacing.sm},
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  rowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  rowTitle: {...typography.body, color: colors.text},
  chev: {fontSize: 22, color: colors.textMuted},
});
