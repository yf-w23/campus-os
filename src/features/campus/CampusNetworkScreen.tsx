import React, {useCallback, useEffect, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
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
import {EmptyHint, InlineLoader, StateBlock} from '../common/components/Status';
import {RootStackParamList} from '../../app/navigation/types';
import {
  NetworkAccountInfo,
  NetworkBalance,
  NetworkDevice,
  fetchNetworkCaptchaBase64,
  getNetworkSnapshot,
  isNetworkCaptchaRequiredError,
  loginNetworkWithCaptcha,
  logoutNetworkDevice,
} from '../../services/campus/network';
import {appendActionAuditRecord} from '../../storage/actionAuditStorage';

type Props = NativeStackScreenProps<RootStackParamList, 'CampusNetwork'>;

function mask(value?: string): string {
  if (!value) {
    return '—';
  }
  if (value.length <= 4) {
    return '****';
  }
  return `${value.slice(0, 2)}***${value.slice(-2)}`;
}

export function CampusNetworkScreen({navigation}: Props) {
  const [balance, setBalance] = useState<NetworkBalance | null>(null);
  const [account, setAccount] = useState<NetworkAccountInfo | null>(null);
  const [devices, setDevices] = useState<NetworkDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [captchaRequired, setCaptchaRequired] = useState(false);
  const [captchaBase64, setCaptchaBase64] = useState('');
  const [captchaInput, setCaptchaInput] = useState('');
  const [captchaLoading, setCaptchaLoading] = useState(false);
  const [captchaSubmitting, setCaptchaSubmitting] = useState(false);

  const refreshCaptcha = useCallback(async () => {
    setCaptchaLoading(true);
    try {
      setCaptchaBase64(await fetchNetworkCaptchaBase64());
    } catch (e) {
      setError(e instanceof Error ? e.message : '验证码加载失败');
    } finally {
      setCaptchaLoading(false);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const snapshot = await getNetworkSnapshot();
      setCaptchaRequired(false);
      setCaptchaInput('');
      setBalance(snapshot.balance);
      setAccount(snapshot.account);
      setDevices(snapshot.devices);
    } catch (e) {
      if (isNetworkCaptchaRequiredError(e)) {
        setCaptchaRequired(true);
        setError('校园网需要验证码登录。请输入下方验证码后继续加载。');
        refreshCaptcha().catch(() => undefined);
      } else {
        setError(e instanceof Error ? e.message : '校园网信息加载失败');
      }
    } finally {
      setLoading(false);
    }
  }, [refreshCaptcha]);

  useEffect(() => {
    load();
  }, [load]);

  const submitCaptcha = async () => {
    setCaptchaSubmitting(true);
    setError(null);
    try {
      await loginNetworkWithCaptcha(captchaInput);
      setCaptchaRequired(false);
      setCaptchaInput('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '校园网验证码登录失败');
      await refreshCaptcha();
    } finally {
      setCaptchaSubmitting(false);
    }
  };

  const confirmLogout = (device: NetworkDevice) => {
    Alert.alert(
      '注销校园网设备',
      `${device.authPermission}\n${mask(device.ip4)} · ${mask(
        device.mac,
      )}\n\n设备可能会立刻断网，需要重新认证后才能联网。`,
      [
        {
          text: '取消',
          style: 'cancel',
          onPress: () => {
            appendActionAuditRecord({
              toolName: 'ui_logout_network_device',
              toolTitle: '注销校园网设备',
              risk: 'write_reversible',
              permission: 'campus.network.devices.write',
              params: {key: device.key, mac: device.mac},
              preview: {
                title: '注销校园网设备',
                summary: `${device.authPermission} · ${mask(device.ip4)}`,
                affectedResource: mask(device.mac),
                reversible: false,
              },
              confirmation: 'denied',
              status: 'cancelled',
              resultSummary: '用户取消',
            }).catch(() => undefined);
          },
        },
        {
          text: '确认注销',
          style: 'destructive',
          onPress: () => {
            doLogout(device).catch(() => undefined);
          },
        },
      ],
    );
  };

  const doLogout = async (device: NetworkDevice) => {
    setBusyKey(device.key);
    try {
      const result = await logoutNetworkDevice({
        key: device.key,
        mac: device.mac,
      });
      await appendActionAuditRecord({
        toolName: 'ui_logout_network_device',
        toolTitle: '注销校园网设备',
        risk: 'write_reversible',
        permission: 'campus.network.devices.write',
        params: {key: device.key, mac: device.mac},
        preview: {
          title: '注销校园网设备',
          summary: `${device.authPermission} · ${mask(device.ip4)}`,
          affectedResource: mask(device.mac),
          reversible: false,
        },
        confirmation: 'approved',
        status: result.ok ? 'success' : 'error',
        resultSummary: result.message,
      });
      Alert.alert(result.ok ? '已注销' : '注销失败', result.message);
      await load();
    } catch (e) {
      const message = e instanceof Error ? e.message : '注销失败';
      await appendActionAuditRecord({
        toolName: 'ui_logout_network_device',
        toolTitle: '注销校园网设备',
        risk: 'write_reversible',
        permission: 'campus.network.devices.write',
        params: {key: device.key, mac: device.mac},
        confirmation: 'approved',
        status: 'error',
        errorMessage: message,
      });
      Alert.alert('注销失败', message);
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <DetailHeader
        title="校园网"
        onBack={() => navigation.goBack()}
        rightLabel={loading ? undefined : '刷新'}
        onRight={load}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <HeroMetricCard
          label="账户余额"
          loading={loading}
          error={Boolean(error)}
          value={balance?.accountBalance || '—'}
          unit="元"
          footer={balance?.settlementDate ? `结算日 ${balance.settlementDate}` : undefined}
        />

        {error ? (
          <StateBlock
            title={captchaRequired ? '校园网需要验证码' : '校园网信息加载失败'}
            message={error}
            tone={captchaRequired ? 'warning' : 'error'}
            actionLabel={captchaRequired ? undefined : '重试'}
            onAction={captchaRequired ? undefined : load}
            style={styles.statusBlock}>
            {captchaRequired ? (
              <View style={styles.captchaBox}>
                <View style={styles.captchaRow}>
                  {captchaLoading ? (
                    <ActivityIndicator color={colors.primary} />
                  ) : captchaBase64 ? (
                    <Image
                      source={{uri: `data:image/png;base64,${captchaBase64}`}}
                      style={styles.captchaImg}
                    />
                  ) : (
                    <Text style={styles.captchaEmpty}>验证码未加载</Text>
                  )}
                  <Pressable
                    onPress={refreshCaptcha}
                    disabled={captchaLoading || captchaSubmitting}
                    style={({pressed}) => [
                      styles.refreshBtn,
                      pressed && styles.pressed,
                    ]}>
                    <Text style={styles.refreshText}>换一张</Text>
                  </Pressable>
                </View>
                <TextInput
                  value={captchaInput}
                  onChangeText={setCaptchaInput}
                  placeholder="输入验证码"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  editable={!captchaSubmitting}
                  style={styles.captchaInput}
                />
                <PrimaryButton
                  label={captchaSubmitting ? '登录中...' : '提交验证码并刷新'}
                  onPress={submitCaptcha}
                  disabled={captchaSubmitting || !captchaInput.trim()}
                />
              </View>
            ) : null}
          </StateBlock>
        ) : null}

        {balance ? (
          <>
            <Text style={styles.sectionTitle}>使用情况</Text>
            <SurfaceGroup>
              <InfoRow label="套餐" value={balance.productName || '—'} />
              <InfoRow label="已用流量" value={balance.usedBytes || '—'} />
              <InfoRow label="已用时长" value={balance.usedSeconds || '—'} />
            </SurfaceGroup>
          </>
        ) : null}

        {account ? (
          <>
            <Text style={styles.sectionTitle}>账号信息</Text>
            <SurfaceGroup>
              <InfoRow label="状态" value={account.status || '—'} />
              <InfoRow label="用户组" value={account.userGroup || '—'} />
              <InfoRow label="允许设备" value={`${account.allowedDevices}`} />
              <InfoRow label="用户名" value={mask(account.username)} mono />
              <InfoRow label="邮箱" value={mask(account.contactEmail)} />
              <InfoRow label="手机号" value={mask(account.contactPhone)} />
            </SurfaceGroup>
          </>
        ) : null}

        <Text style={styles.sectionTitle}>在线设备</Text>
        <SurfaceGroup>
          {loading ? (
            <InlineLoader label="正在读取在线设备" />
          ) : devices.length === 0 ? (
            <EmptyHint
              title="暂无在线设备"
              message="当前账号没有查询到在线设备。"
            />
          ) : (
            devices.map((device, index) => (
              <View
                key={device.key}
                style={[styles.deviceRow, index > 0 && styles.divider]}>
                <View style={styles.deviceBody}>
                  <Text style={styles.deviceTitle} numberOfLines={1}>
                    {device.authPermission || '在线设备'}
                  </Text>
                  <Text style={styles.deviceMeta} numberOfLines={2}>
                    IPv4 {mask(device.ip4)} · MAC {mask(device.mac)}
                  </Text>
                  <Text style={styles.deviceMeta}>登录 {device.loggedAt || '—'}</Text>
                </View>
                <Pressable
                  disabled={busyKey === device.key}
                  onPress={() => confirmLogout(device)}
                  style={({pressed}) => [
                    styles.logoutBtn,
                    pressed && styles.pressed,
                    busyKey === device.key && styles.disabled,
                  ]}>
                  <Text style={styles.logoutText}>
                    {busyKey === device.key ? '处理中' : '注销'}
                  </Text>
                </Pressable>
              </View>
            ))
          )}
        </SurfaceGroup>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background},
  content: {padding: spacing.lg, paddingBottom: spacing.xxl},
  statusBlock: {marginTop: spacing.md},
  captchaBox: {gap: spacing.sm},
  captchaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  captchaImg: {
    width: 120,
    height: 44,
    resizeMode: 'contain',
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
  },
  captchaEmpty: {...typography.caption, color: colors.textMuted, flex: 1},
  captchaInput: {
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  refreshBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
  },
  refreshText: {...typography.caption, color: colors.primary, fontWeight: '700'},
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
  divider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  deviceBody: {flex: 1, gap: 3},
  deviceTitle: {...typography.body, color: colors.text, fontWeight: '600'},
  deviceMeta: {...typography.caption, color: colors.textMuted},
  logoutBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.errorMuted,
  },
  logoutText: {...typography.caption, color: colors.error, fontWeight: '700'},
  pressed: {opacity: 0.75},
  disabled: {opacity: 0.45},
});
