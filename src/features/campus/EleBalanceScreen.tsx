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
import {DetailHeader, InfoRow} from '../common/components/Ui';
import {PrimaryButton} from '../common/components/Buttons';
import {RootStackParamList} from '../../app/navigation/types';
import {
  EleRemainder,
  EleRoomInfo,
  ELE_BALANCE_WEB_URL,
  getElePayRecords,
  getEleRemainder,
  getEleRoomInfo,
} from '../../services/campus/electricity';

type Props = NativeStackScreenProps<RootStackParamList, 'CampusEleBalance'>;

const RECORD_COLUMNS = ['充值时间', '充值', '充值前', '充值后', '操作员', '备注'];

export function EleBalanceScreen({navigation}: Props) {
  const [remainder, setRemainder] = useState<EleRemainder | null>(null);
  const [room, setRoom] = useState<EleRoomInfo | null>(null);
  const [records, setRecords] = useState<string[][]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 余额是核心，单独 await；房间信息与记录失败不阻塞
      const balance = await getEleRemainder();
      setRemainder(balance);
      const [roomResult, recordsResult] = await Promise.allSettled([
        getEleRoomInfo(),
        getElePayRecords(),
      ]);
      if (roomResult.status === 'fulfilled') {
        setRoom(roomResult.value);
      }
      if (recordsResult.status === 'fulfilled') {
        setRecords(recordsResult.value);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '电费余额加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <DetailHeader
        title="电费余额"
        onBack={() => navigation.goBack()}
        rightLabel={loading ? undefined : '刷新'}
        onRight={load}
      />
      <ScrollView contentContainerStyle={styles.content}>
        {/* 余额 hero */}
        <View style={styles.hero}>
          <Text style={styles.heroLabel}>当前剩余电量</Text>
          {loading ? (
            <ActivityIndicator color={colors.primary} style={{marginVertical: 12}} />
          ) : error ? (
            <Text style={styles.heroError}>加载失败</Text>
          ) : (
            <View style={styles.heroValueRow}>
              <Text style={styles.heroValue}>
                {remainder ? remainder.remainder : '—'}
              </Text>
              <Text style={styles.heroUnit}>度</Text>
            </View>
          )}
          {remainder?.updateTime ? (
            <Text style={styles.heroTime}>更新于 {remainder.updateTime}</Text>
          ) : null}
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable
              onPress={() =>
                navigation.navigate('InAppViewer', {
                  url: ELE_BALANCE_WEB_URL,
                  title: '电费余额',
                })
              }>
              <Text style={styles.link}>用网页查看 ›</Text>
            </Pressable>
          </View>
        ) : null}

        {/* 房间信息 */}
        {room ? (
          <>
            <Text style={styles.sectionTitle}>房间信息</Text>
            <View style={styles.card}>
              <InfoRow label="户名" value={room.userName} />
              <InfoRow label="楼号" value={room.building} />
              <InfoRow label="房间" value={room.room} />
              <InfoRow label="学号" value={room.studentId} mono />
            </View>
          </>
        ) : null}

        {/* 缴费记录 */}
        {records.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>缴费记录</Text>
            <View style={styles.card}>
              {records.map((row, idx) => (
                <View
                  key={idx}
                  style={[styles.recordRow, idx > 0 && styles.recordDivider]}>
                  <Text style={styles.recordTime}>{row[0] ?? '—'}</Text>
                  <View style={styles.recordMetaRow}>
                    {row.slice(1).map((cell, i) => (
                      <Text key={i} style={styles.recordCell}>
                        {RECORD_COLUMNS[i + 1] ?? ''}
                        {cell ? ` ${cell}` : ' —'}
                      </Text>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          </>
        ) : null}

        <View style={{height: spacing.lg}} />
        <PrimaryButton
          label="去充值"
          onPress={() => navigation.navigate('CampusEleRecharge')}
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
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    gap: spacing.xs,
  },
  heroLabel: {...typography.caption, color: colors.textMuted},
  heroValueRow: {flexDirection: 'row', alignItems: 'baseline', gap: 6},
  heroValue: {fontSize: 44, fontWeight: '700', color: colors.primary},
  heroUnit: {...typography.body, color: colors.textSecondary},
  heroError: {...typography.h3, color: colors.error, marginVertical: 8},
  heroTime: {...typography.micro, color: colors.textMuted, marginTop: 4},
  errorBox: {
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.errorMuted,
    borderRadius: radii.md,
    gap: spacing.xs,
  },
  errorText: {...typography.caption, color: colors.error},
  link: {...typography.body, color: colors.primary},
  sectionTitle: {
    ...typography.label,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    fontSize: 12,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    paddingLeft: spacing.xs,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  recordRow: {paddingVertical: spacing.md - 2, gap: 4},
  recordDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  recordTime: {...typography.body, color: colors.text, fontWeight: '500'},
  recordMetaRow: {flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm},
  recordCell: {...typography.micro, color: colors.textMuted},
});
