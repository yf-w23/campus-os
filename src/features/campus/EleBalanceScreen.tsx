import React, {useCallback, useEffect, useState} from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {colors, spacing, typography} from '../../app/theme';
import {DetailHeader, HeroMetricCard, InfoRow, SurfaceGroup} from '../common/components/Ui';
import {PrimaryButton} from '../common/components/Buttons';
import {StateBlock} from '../common/components/Status';
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
        <HeroMetricCard
          label="当前剩余电量"
          loading={loading}
          error={Boolean(error)}
          value={remainder ? remainder.remainder : '—'}
          unit="度"
          footer={remainder?.updateTime ? `更新于 ${remainder.updateTime}` : undefined}
        />

        {error ? (
          <StateBlock
            title="电费余额加载失败"
            message={error}
            tone="error"
            actionLabel="用网页查看"
            onAction={() =>
              navigation.navigate('InAppViewer', {
                url: ELE_BALANCE_WEB_URL,
                title: '电费余额',
              })
            }
            style={styles.statusBlock}
          />
        ) : null}

        {/* 房间信息 */}
        {room ? (
          <>
            <Text style={styles.sectionTitle}>房间信息</Text>
            <SurfaceGroup>
              <InfoRow label="户名" value={room.userName} />
              <InfoRow label="楼号" value={room.building} />
              <InfoRow label="房间" value={room.room} />
              <InfoRow label="学号" value={room.studentId} mono />
            </SurfaceGroup>
          </>
        ) : null}

        {/* 缴费记录 */}
        {records.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>缴费记录</Text>
            <SurfaceGroup>
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
            </SurfaceGroup>
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
  statusBlock: {marginTop: spacing.md},
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
  recordRow: {paddingVertical: spacing.md - 2, gap: 4},
  recordDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  recordTime: {...typography.body, color: colors.text, fontWeight: '500'},
  recordMetaRow: {flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm},
  recordCell: {...typography.micro, color: colors.textMuted},
});
