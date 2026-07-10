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
import {DetailHeader, HeroMetricCard, InfoRow, SurfaceGroup} from '../common/components/Ui';
import {PrimaryButton} from '../common/components/Buttons';
import {Chip} from '../common/components/Chip';
import {EmptyHint, InlineLoader, StateBlock} from '../common/components/Status';
import {RootStackParamList} from '../../app/navigation/types';
import {
  CampusCardInfo,
  CampusCardTransaction,
  getCampusCardInfo,
  getCampusCardTransactions,
  rechargeCampusCardAlipay,
} from '../../services/campus/campusCard';

type Props = NativeStackScreenProps<RootStackParamList, 'CampusFinance'>;

function mask(value?: string): string {
  if (!value) {
    return '—';
  }
  if (value.length <= 4) {
    return '****';
  }
  return `${value.slice(0, 2)}***${value.slice(-2)}`;
}

function formatDate(value?: string): string {
  if (!value) {
    return '—';
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    return value;
  }
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hour = String(d.getHours()).padStart(2, '0');
  const minute = String(d.getMinutes()).padStart(2, '0');
  return `${month}-${day} ${hour}:${minute}`;
}

function isoDateOffset(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

export function CampusFinanceScreen({navigation}: Props) {
  const [info, setInfo] = useState<CampusCardInfo | null>(null);
  const [transactions, setTransactions] = useState<CampusCardTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [rechargeAmount, setRechargeAmount] = useState('');
  const [recharging, setRecharging] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const cardInfo = await getCampusCardInfo();
      setInfo(cardInfo);
      const rows = await getCampusCardTransactions({
        start: isoDateOffset(-7),
        end: isoDateOffset(0),
        type: -1,
      });
      setTransactions(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : '校园财务加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const rawAmount = Number(rechargeAmount);
  const validAmount = /^(([1-9]+\d*)|0)(\.\d{0,2})?$/.test(rechargeAmount) && rawAmount >= 10 && rawAmount <= 200;
  const quickAmounts = [10, 50, 100];

  const handleQuickAmount = (amount: number) => {
    setRechargeAmount(String(amount));
  };

  const handleRecharge = async () => {
    if (!validAmount || recharging) {
      return;
    }
    setRecharging(true);
    try {
      const result = await rechargeCampusCardAlipay(rawAmount);
      if (result.ok && result.alipayUrl) {
        await Linking.openURL(result.alipayUrl);
      } else {
        Alert.alert('充值失败', result.message);
      }
    } catch (e) {
      Alert.alert(
        '支付宝唤起失败',
        e instanceof Error ? e.message : '请确认已安装支付宝 App 后重试。',
      );
    } finally {
      setRecharging(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <DetailHeader
        title="校园财务"
        onBack={() => navigation.goBack()}
        rightLabel={loading ? undefined : '刷新'}
        onRight={load}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <HeroMetricCard
          label="校园卡余额"
          loading={loading}
          error={Boolean(error)}
          value={info ? info.balance.toFixed(2) : '—'}
          unit="元"
          footer={
            info?.lastTransactionTimestamp
              ? `最近交易 ${formatDate(info.lastTransactionTimestamp)}`
              : undefined
          }
        />

        {error ? (
          <StateBlock
            title="校园财务加载失败"
            message={error}
            tone="error"
            actionLabel="重试"
            onAction={load}
            style={styles.statusBlock}
          />
        ) : null}

        {info ? (
          <>
            <Text style={styles.sectionTitle}>校园卡信息</Text>
            <SurfaceGroup>
              <InfoRow label="姓名" value={info.userName || '—'} />
              <InfoRow label="院系" value={info.departmentName || '—'} />
              <InfoRow label="卡号" value={mask(info.cardId)} mono />
              <InfoRow label="状态" value={info.cardStatus || '—'} />
              <InfoRow
                label="单笔限额"
                value={
                  info.maxOneTimeTransactionAmount != null
                    ? `${info.maxOneTimeTransactionAmount.toFixed(2)} 元`
                    : '—'
                }
              />
              <InfoRow
                label="日限额"
                value={
                  info.maxDailyTransactionAmount != null
                    ? `${info.maxDailyTransactionAmount.toFixed(2)} 元`
                  : '—'
                }
              />
            </SurfaceGroup>
          </>
        ) : null}

        <Text style={styles.sectionTitle}>近 7 天流水</Text>
        <SurfaceGroup>
          {loading ? (
            <InlineLoader label="正在读取近期流水" />
          ) : transactions.length === 0 ? (
            <EmptyHint
              title="暂无近期流水"
              message="近 7 天没有查询到校园卡交易记录。"
            />
          ) : (
            transactions.slice(0, 30).map((item, index) => (
              <View
                key={`${item.id}-${index}`}
                style={[styles.txRow, index > 0 && styles.divider]}>
                <View style={styles.txTop}>
                  <Text style={styles.txTitle} numberOfLines={1}>
                    {item.name || item.summary || item.txName || '校园卡交易'}
                  </Text>
                  <Text
                    style={[
                      styles.txAmount,
                      item.amount >= 0 ? styles.txIncome : styles.txExpense,
                    ]}>
                    {item.amount >= 0 ? '+' : ''}
                    {item.amount.toFixed(2)}
                  </Text>
                </View>
                <Text style={styles.txMeta} numberOfLines={1}>
                  {formatDate(item.timestamp)} · 余额 {item.balance.toFixed(2)}
                  {item.address ? ` · ${item.address}` : ''}
                </Text>
              </View>
            ))
          )}
        </SurfaceGroup>

        <Text style={styles.sectionTitle}>校园卡充值</Text>
        <SurfaceGroup>
          <View style={styles.rechargeQuickRow}>
            {quickAmounts.map(amount => (
              <Chip
                key={amount}
                label={`${amount} 元`}
                variant={Number(rechargeAmount) === amount ? 'accent' : 'default'}
                onPress={() => handleQuickAmount(amount)}
              />
            ))}
          </View>
          <View style={styles.rechargeInputRow}>
            <Text style={styles.rechargeCurrency}>￥</Text>
            <TextInput
              style={styles.rechargeInput}
              keyboardType="numeric"
              placeholder="输入金额"
              placeholderTextColor={colors.textMuted}
              value={rechargeAmount}
              onChangeText={setRechargeAmount}
              editable={!recharging}
            />
          </View>
          <View style={styles.rechargeHintRow}>
            <Text style={styles.rechargeHint}>
              金额 10–200 元，单日累计不超过 400 元
            </Text>
          </View>
          <PrimaryButton
            label={recharging ? '生成付款链接…' : '支付宝充值'}
            onPress={handleRecharge}
            disabled={!validAmount || recharging}
            loading={recharging}
            variant="primary"
          />
        </SurfaceGroup>

        <Pressable
          onPress={() => navigation.navigate('CampusEleBalance')}
          style={({pressed}) => [styles.linkRow, pressed && styles.pressed]}>
          <View>
            <Text style={styles.linkTitle}>宿舍电费记录</Text>
            <Text style={styles.linkSub}>查看电费余额与缴费记录</Text>
          </View>
          <Text style={styles.chev}>›</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background},
  content: {padding: spacing.lg, paddingBottom: spacing.xxl},
  statusBlock: {
    marginTop: spacing.md,
  },
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
  txRow: {paddingVertical: spacing.md - 2, gap: 4},
  divider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  txTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  txTitle: {...typography.body, color: colors.text, flex: 1, fontWeight: '600'},
  txAmount: {...typography.body, fontWeight: '700'},
  txIncome: {color: colors.success},
  txExpense: {color: colors.text},
  txMeta: {...typography.caption, color: colors.textMuted},
  notice: {
    marginTop: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    gap: 4,
  },
  noticeTitle: {...typography.label, color: colors.text},
  noticeText: {...typography.caption, color: colors.textSecondary},
  rechargeQuickRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  rechargeInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    paddingBottom: spacing.xs,
  },
  rechargeCurrency: {
    ...typography.h2,
    color: colors.text,
    marginRight: spacing.sm,
  },
  rechargeInput: {
    flex: 1,
    ...typography.h2,
    color: colors.text,
    padding: 0,
  },
  rechargeHintRow: {
    marginBottom: spacing.md,
  },
  rechargeHint: {
    ...typography.caption,
    color: colors.textMuted,
  },
  linkRow: {
    marginTop: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pressed: {opacity: 0.75},
  linkTitle: {...typography.body, color: colors.text, fontWeight: '600'},
  linkSub: {...typography.caption, color: colors.textMuted, marginTop: 2},
  chev: {fontSize: 22, color: colors.textMuted, fontWeight: '300'},
});
