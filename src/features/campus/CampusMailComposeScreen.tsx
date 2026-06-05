import React, {useState} from 'react';
import {
  ActivityIndicator,
  Alert,
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
import {sendNativeMailMessage} from '../../services/campus/nativeMail';

type Props = NativeStackScreenProps<RootStackParamList, 'CampusMailCompose'>;

export function CampusMailComposeScreen({route, navigation}: Props) {
  const params = route.params ?? {};
  const [to, setTo] = useState(params.to ?? '');
  const [cc, setCc] = useState(params.cc ?? '');
  const [bcc, setBcc] = useState(params.bcc ?? '');
  const [subject, setSubject] = useState(params.subject ?? '');
  const [content, setContent] = useState(params.content ?? '');
  const [sending, setSending] = useState(false);

  const canSend = to.trim().length > 0 && !sending;

  const doSend = async () => {
    setSending(true);
    try {
      await sendNativeMailMessage({to, cc, bcc, subject, content});
      Alert.alert('发送成功', '邮件已通过清华 SMTP 投递。', [
        {text: '好', onPress: () => navigation.goBack()},
      ]);
    } catch (e) {
      Alert.alert('发送失败', e instanceof Error ? e.message : '发送失败');
    } finally {
      setSending(false);
    }
  };

  const confirmSend = () => {
    if (!canSend) return;
    Alert.alert(
      '确认发送邮件',
      `收件人：${to}\n主题：${
        subject || '(无主题)'
      }\n\n发送后将通过清华 SMTP 正式投递。`,
      [
        {text: '取消', style: 'cancel'},
        {text: '确认发送', onPress: () => doSend().catch(() => undefined)},
      ],
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <DetailHeader
        title={
          params.mode === 'reply'
            ? '回复邮件'
            : params.mode === 'forward'
            ? '转发邮件'
            : '写信'
        }
        onBack={() => navigation.goBack()}
        rightLabel={sending ? undefined : '发送'}
        onRight={confirmSend}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled">
        <Field
          label="收件人"
          value={to}
          onChangeText={setTo}
          placeholder="name@tsinghua.edu.cn"
        />
        <Field
          label="抄送"
          value={cc}
          onChangeText={setCc}
          placeholder="可选"
        />
        <Field
          label="密送"
          value={bcc}
          onChangeText={setBcc}
          placeholder="可选"
        />
        <Field
          label="主题"
          value={subject}
          onChangeText={setSubject}
          placeholder="邮件主题"
        />
        <View style={styles.bodyWrap}>
          <Text style={styles.label}>正文</Text>
          <TextInput
            value={content}
            onChangeText={setContent}
            placeholder="输入邮件正文"
            placeholderTextColor={colors.textMuted}
            multiline
            textAlignVertical="top"
            style={styles.bodyInput}
          />
        </View>

        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>发送方式</Text>
          <Text style={styles.noticeText}>
            当前使用清华 SMTP 原生发送，正文会同时包含纯文本和 HTML
            版本。附件发送需要接入系统文件选择器后启用。
          </Text>
        </View>

        <PrimaryButton
          label={sending ? '发送中…' : '发送邮件'}
          onPress={confirmSend}
          disabled={!canSend}
          loading={sending}
        />
        {sending ? (
          <ActivityIndicator color={colors.primary} style={styles.indicator} />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        autoCapitalize="none"
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background},
  content: {padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md},
  field: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: 4,
  },
  label: {...typography.caption, color: colors.textMuted},
  input: {...typography.body, color: colors.text, padding: 0, minHeight: 32},
  bodyWrap: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: spacing.md,
    gap: spacing.sm,
  },
  bodyInput: {
    ...typography.body,
    color: colors.text,
    minHeight: 220,
    padding: 0,
    lineHeight: 23,
  },
  notice: {
    padding: spacing.md,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    gap: 4,
  },
  noticeTitle: {...typography.label, color: colors.text},
  noticeText: {...typography.caption, color: colors.textSecondary},
  indicator: {marginTop: spacing.sm},
});
