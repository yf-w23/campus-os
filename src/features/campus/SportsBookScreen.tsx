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
import {DetailHeader} from '../common/components/Ui';
import {PrimaryButton} from '../common/components/Buttons';
import {RootStackParamList} from '../../app/navigation/types';
import {
  fetchSportsCaptchaBase64,
  getSportsCaptchaUrl,
  makeSportsReservation,
  openSportsAlipay,
} from '../../services/campus/sports';

type Props = NativeStackScreenProps<RootStackParamList, 'CampusSportsBook'>;

export function SportsBookScreen({navigation, route}: Props) {
  const {info, date, phone: initialPhone, period, field} = route.params;
  const [phone, setPhone] = useState(initialPhone);
  const [captcha, setCaptcha] = useState('');
  const [captchaB64, setCaptchaB64] = useState('');
  const [loadingCaptcha, setLoadingCaptcha] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const refreshCaptcha = useCallback(async () => {
    setLoadingCaptcha(true);
    try {
      void getSportsCaptchaUrl();
      const b64 = await fetchSportsCaptchaBase64();
      setCaptchaB64(b64);
      setCaptcha('');
    } catch {
      Alert.alert('验证码', '加载失败，请重试');
    } finally {
      setLoadingCaptcha(false);
    }
  }, []);

  useEffect(() => {
    refreshCaptcha();
  }, [refreshCaptcha]);

  const handleSubmit = async () => {
    if (!/^1[3-9]\d{9}$/.test(phone.trim())) {
      Alert.alert('请填写正确手机号');
      return;
    }
    if (!captcha.trim()) {
      Alert.alert('请填写验证码');
      return;
    }
    setSubmitting(true);
    try {
      const result = await makeSportsReservation({
        totalCost: field.cost,
        phone: phone.trim(),
        gymId: info.gymId,
        itemId: info.itemId,
        date,
        captcha: captcha.trim(),
        resHashId: field.id,
      });
      if (!result.ok) {
        Alert.alert('预约失败', result.message);
        await refreshCaptcha();
        return;
      }
      if (result.payCode) {
        const opened = await openSportsAlipay(result.payCode);
        Alert.alert(
          '预约成功',
          opened ? '已唤起支付宝，请完成支付' : '请在订单页完成支付',
          [{text: '好的', onPress: () => navigation.popToTop()}],
        );
      } else {
        Alert.alert('预约成功', result.message, [
          {text: '好的', onPress: () => navigation.popToTop()},
        ]);
      }
    } catch (e) {
      Alert.alert('错误', e instanceof Error ? e.message : '提交失败');
      await refreshCaptcha();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <DetailHeader title="确认预约" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Row label="场馆" value={info.name} />
          <Row label="日期" value={date} />
          <Row label="时段" value={period} />
          <Row label="场地" value={`${field.name}（${field.cost} 元）`} />
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>手机号</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            placeholder="预约联系电话"
            placeholderTextColor={colors.textMuted}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>验证码（区分大小写）</Text>
          <TextInput
            style={styles.input}
            value={captcha}
            onChangeText={setCaptcha}
            autoCapitalize="none"
            placeholder="输入图中字符"
            placeholderTextColor={colors.textMuted}
          />
          <View style={styles.captchaRow}>
            {loadingCaptcha ? (
              <ActivityIndicator color={colors.primary} />
            ) : captchaB64 ? (
              <Image
                source={{uri: `data:image/jpeg;base64,${captchaB64}`}}
                style={styles.captchaImg}
              />
            ) : null}
            <Pressable onPress={refreshCaptcha}>
              <Text style={styles.refresh}>刷新验证码</Text>
            </Pressable>
          </View>
        </View>

        <PrimaryButton
          label={submitting ? '提交中…' : '确认预约'}
          onPress={handleSubmit}
          loading={submitting}
          disabled={submitting}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({label, value}: {label: string; value: string}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background},
  content: {padding: spacing.lg, gap: spacing.md},
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    gap: spacing.sm,
  },
  row: {flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md},
  rowLabel: {...typography.caption, color: colors.textMuted},
  rowValue: {...typography.body, color: colors.text, flex: 1, textAlign: 'right'},
  label: {...typography.caption, color: colors.textMuted},
  input: {
    backgroundColor: colors.background,
    borderRadius: radii.md,
    padding: spacing.sm,
    color: colors.text,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle,
  },
  captchaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  captchaImg: {width: 120, height: 40, resizeMode: 'contain'},
  refresh: {...typography.caption, color: colors.primary},
});
