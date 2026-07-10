import React, {useCallback, useEffect, useState} from 'react';
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {colors, radii, spacing, typography} from '../../app/theme';
import {DetailHeader, InfoRow, SurfaceGroup} from '../common/components/Ui';
import {PrimaryButton} from '../common/components/Buttons';
import {InlineLoader} from '../common/components/Status';
import {RootStackParamList} from '../../app/navigation/types';
import {
  EleRoomInfo,
  ELE_RECHARGE_WEB_URL,
  buildAlipayUrl,
  getEleRechargePayCode,
  getEleRemainder,
  getEleRoomInfo,
} from '../../services/campus/electricity';

type Props = NativeStackScreenProps<RootStackParamList, 'CampusEleRecharge'>;

const QUICK_AMOUNTS = [10, 20, 30, 50, 100];

export function EleRechargeScreen({navigation}: Props) {
  const [room, setRoom] = useState<EleRoomInfo | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const [amount, setAmount] = useState('');
  const [processing, setProcessing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [roomResult, balanceResult] = await Promise.allSettled([
      getEleRoomInfo(),
      getEleRemainder(),
    ]);
    if (roomResult.status === 'fulfilled') {
      setRoom(roomResult.value);
    }
    if (balanceResult.status === 'fulfilled') {
      setBalance(balanceResult.value.remainder);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const money = Number(amount);
  const valid = /^\d+$/.test(amount) && money > 0 && money <= 500;

  const openWebFallback = () => {
    navigation.navigate('InAppViewer', {
      url: ELE_RECHARGE_WEB_URL,
      title: '电费充值',
    });
  };

  const handleRecharge = async () => {
    if (!valid || processing) {
      return;
    }
    setProcessing(true);
    try {
      const payCode = await getEleRechargePayCode(money);
      const url = buildAlipayUrl(payCode);
      await Linking.openURL(url);
      setAmount('');
    } catch (e) {
      const msg = e instanceof Error ? e.message : '充值发起失败';
      Alert.alert('充值发起失败', `${msg}\n\n可改用网页完成支付。`, [
        {text: '用网页充值', onPress: openWebFallback},
        {text: '取消', style: 'cancel'},
      ]);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <DetailHeader title="电费充值" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content}>
        {/* 房间信息 + 余额 */}
        <SurfaceGroup>
          {loading ? (
            <InlineLoader label="正在读取房间信息..." style={styles.cardLoader} />
          ) : (
            <>
              <InfoRow label="户名" value={room?.userName} />
              <InfoRow label="楼号" value={room?.building} />
              <InfoRow label="房间" value={room?.room} />
              <InfoRow
                label="当前余额"
                value={balance != null ? `${balance} 度` : undefined}
              />
            </>
          )}
        </SurfaceGroup>

        {/* 充值金额 */}
        <Text style={styles.sectionTitle}>充值金额</Text>
        <View style={styles.chipRow}>
          {QUICK_AMOUNTS.map(v => {
            const active = amount === String(v);
            return (
              <Pressable
                key={v}
                onPress={() => setAmount(String(v))}
                disabled={processing}
                style={[styles.chip, active && styles.chipActive]}>
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {v} 元
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.amountInputWrap}>
          <Text style={styles.yen}>￥</Text>
          <TextInput
            style={styles.amountInput}
            keyboardType="number-pad"
            placeholder="输入充值金额"
            placeholderTextColor={colors.textMuted}
            value={amount}
            onChangeText={setAmount}
            editable={!processing}
            maxLength={3}
          />
        </View>
        <Text style={styles.hint}>支持 1–500 元整数；点击充值后将唤起支付宝完成支付。</Text>

        <View style={{height: spacing.lg}} />
        {processing ? (
          <InlineLoader label="正在发起支付..." style={styles.processingLoader} />
        ) : (
          <PrimaryButton
            label={valid ? `支付宝充值 ${money} 元` : '请输入充值金额'}
            onPress={handleRecharge}
          />
        )}

        <Pressable
          style={({pressed}) => [styles.webBtn, pressed && {opacity: 0.7}]}
          onPress={openWebFallback}>
          <Text style={styles.webBtnText}>用网页充值</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background},
  content: {padding: spacing.lg, paddingBottom: spacing.xxl},
  cardLoader: {paddingVertical: spacing.lg},
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
  chipRow: {flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm},
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.primaryMuted,
    borderColor: colors.primary,
  },
  chipText: {...typography.caption, color: colors.textSecondary},
  chipTextActive: {color: colors.primary, fontWeight: '600'},
  amountInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
  },
  yen: {fontSize: 20, color: colors.text},
  amountInput: {
    flex: 1,
    ...typography.h3,
    color: colors.text,
    paddingVertical: spacing.md,
    marginLeft: spacing.sm,
  },
  hint: {...typography.micro, color: colors.textMuted, marginTop: spacing.sm},
  processingLoader: {paddingVertical: spacing.md},
  webBtn: {alignItems: 'center', paddingVertical: spacing.md, marginTop: spacing.sm},
  webBtnText: {...typography.body, color: colors.primary},
});
