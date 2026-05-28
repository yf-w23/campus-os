import React, {useEffect, useRef, useState} from 'react';
import {
  DevSettings,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  ToastAndroid,
  View,
} from 'react-native';

function toast(msg: string) {
  if (Platform.OS === 'android') {
    ToastAndroid.show(msg, ToastAndroid.SHORT);
  }
}
import {SafeAreaView} from 'react-native-safe-area-context';
import {useDispatch, useSelector} from 'react-redux';
import {useTranslation} from '../../app/i18n';
import {colors, spacing, typography} from '../../app/theme';
import {PrimaryButton} from '../common/components/Buttons';
import {
  createFingerprint,
  tsinghuaAuthService,
} from '../../services/auth/tsinghuaAuth';
import {saveCredentials, loadCredentials} from '../../storage/secureStorage';
import {
  setAuthenticated,
  setAuthError,
  setAuthenticating,
  setDemoMode,
  setSelectedTwoFactor,
  setTwoFactor,
} from '../../state/slices/authSlice';
import {selectAuth} from '../../state/selectors';
import {setDemoMode as persistDemoMode} from '../../storage/preferencesStorage';
import {AppDispatch} from '../../state/store';
import {syncCampusData} from '../../state/thunks/syncCampusData';
import {resetLearningDemo} from '../../state/slices/learningSlice';
import {CampusCredentials} from '../../domain/campus';
import {TwoFactorApproach} from '../../domain/session';

export function LoginScreen() {
  const t = useTranslation();
  const dispatch = useDispatch<AppDispatch>();
  const auth = useSelector(selectAuth);
  const [studentId, setStudentId] = useState('');
  const [password, setPassword] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const credentialsRef = useRef<CampusCredentials | null>(null);

  useEffect(() => {
    loadCredentials().then(saved => {
      if (saved) {
        setStudentId(saved.studentId);
        setPassword(saved.password);
      }
    });
  }, []);

  const syncCampusDataAfterLogin = async () => {
    try {
      await dispatch(syncCampusData()).unwrap();
    } catch {
      // 错误已写入 learning slice
    }
  };

  /** 登录主链跑完后写入 redux 并触发后台同步 */
  const finishAuthenticated = async (id: string) => {
    dispatch(
      setAuthenticated({
        isAuthenticated: true,
        studentId: id,
        displayName: id,
        authenticatedAt: new Date().toISOString(),
        webvpnReady: true,
      }),
    );
    await persistDemoMode(false);
    await syncCampusDataAfterLogin();
  };

  const handlePasswordLogin = async () => {
    if (submitting) {
      return;
    }

    let fingerprint: string;
    let credentials: CampusCredentials;
    try {
      fingerprint = createFingerprint();
      credentials = {studentId: studentId.trim(), password, fingerprint};
      credentialsRef.current = credentials;
      setSubmitting(true);
      dispatch(setAuthenticating());
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      toast(`pre-login: ${msg.slice(0, 80)}`);
      dispatch(setAuthError(msg));
      return;
    }

    try {
      const result = await tsinghuaAuthService.login(credentials);
      if (result.status === 'authenticated') {
        await saveCredentials(credentials.studentId, credentials.password, fingerprint);
        await finishAuthenticated(credentials.studentId);
        return;
      }
      if (result.status === 'two_factor') {
        dispatch(
          setTwoFactor({
            approaches: result.twoFactorApproaches ?? [],
            studentId: credentials.studentId,
          }),
        );
        if (result.twoFactorApproaches?.[0]) {
          dispatch(setSelectedTwoFactor(result.twoFactorApproaches[0].type));
        }
        return;
      }
      dispatch(setAuthError(result.error ?? '登录失败'));
    } catch (error) {
      const msg = error instanceof Error ? error.message : '登录异常';
      dispatch(setAuthError(msg));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendTwoFactorCode = async () => {
    if (!auth.selectedTwoFactor || submitting) {
      return;
    }
    setSubmitting(true);
    try {
      await tsinghuaAuthService.sendTwoFactorCode(auth.selectedTwoFactor);
    } catch (error) {
      dispatch(
        setAuthError(error instanceof Error ? error.message : '发送验证码失败'),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyTwoFactor = async () => {
    const credentials = credentialsRef.current;
    if (
      !credentials ||
      !auth.selectedTwoFactor ||
      !twoFactorCode.trim() ||
      submitting
    ) {
      return;
    }

    setSubmitting(true);
    try {
      const result = await tsinghuaAuthService.verifyTwoFactor(
        credentials,
        auth.selectedTwoFactor,
        twoFactorCode.trim(),
        true,
      );
      if (result.status === 'authenticated') {
        await saveCredentials(
          credentials.studentId,
          credentials.password,
          credentials.fingerprint,
        );
        await finishAuthenticated(credentials.studentId);
        return;
      }
      dispatch(setAuthError(result.error ?? '二次认证失败'));
    } catch (error) {
      dispatch(
        setAuthError(error instanceof Error ? error.message : '二次认证失败'),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDemo = async () => {
    setSubmitting(true);
    try {
      dispatch(setDemoMode(true));
      dispatch(resetLearningDemo());
      await persistDemoMode(true);
    } finally {
      setSubmitting(false);
    }
  };

  const isTwoFactor = auth.status === 'two_factor';
  const isBusy = submitting;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.centerStage}
          keyboardShouldPersistTaps="handled">
          <View style={styles.panel}>
            <Image
              source={require('../../assets/illustrations/campus.png')}
              style={styles.hero}
            />
            <Text style={styles.title}>{t.appName}</Text>
            <Text style={styles.subtitle}>{t.auth.subtitle}</Text>

            {isTwoFactor ? (
              <View style={styles.twoFactorBox}>
                <Text style={styles.twoFactorTitle}>{t.auth.twoFactorTitle}</Text>
                <View style={styles.methodRow}>
                  {auth.twoFactorApproaches.map((approach: TwoFactorApproach) => (
                    <Pressable
                      key={approach.type}
                      style={[
                        styles.methodChip,
                        auth.selectedTwoFactor === approach.type && styles.methodChipActive,
                      ]}
                      onPress={() => dispatch(setSelectedTwoFactor(approach.type))}>
                      <Text
                        style={[
                          styles.methodChipText,
                          auth.selectedTwoFactor === approach.type &&
                            styles.methodChipTextActive,
                        ]}>
                        {approach.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <PrimaryButton
                  label={t.auth.sendCode}
                  onPress={handleSendTwoFactorCode}
                  loading={isBusy}
                  variant="ghost"
                />
                <TextInput
                  style={styles.input}
                  value={twoFactorCode}
                  onChangeText={setTwoFactorCode}
                  placeholder={t.auth.twoFactorCode}
                  keyboardType="number-pad"
                  autoCapitalize="none"
                />
                <PrimaryButton
                  label={t.auth.verify}
                  onPress={handleVerifyTwoFactor}
                  loading={isBusy}
                />
              </View>
            ) : (
              <View style={styles.form}>
                <TextInput
                  style={styles.input}
                  value={studentId}
                  onChangeText={setStudentId}
                  placeholder={t.auth.studentId}
                  keyboardType="number-pad"
                  autoCapitalize="none"
                />
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder={t.auth.password}
                  secureTextEntry
                  autoCapitalize="none"
                />
                <PrimaryButton
                  label={isBusy ? t.auth.loggingIn : t.auth.login}
                  onPress={handlePasswordLogin}
                  loading={isBusy}
                />
              </View>
            )}

            {!isTwoFactor ? (
              <View style={styles.actions}>
                <PrimaryButton
                  label={t.auth.demo}
                  onPress={handleDemo}
                  loading={isBusy}
                  variant="ghost"
                />
              </View>
            ) : null}

            {auth.error ? <Text style={styles.error}>{auth.error}</Text> : null}

            <Text style={styles.footerHint}>{t.auth.footerHint}</Text>

            {__DEV__ ? (
              <Pressable onPress={() => DevSettings.reload()} style={styles.devReload}>
                <Text style={styles.devReloadText}>{t.auth.reloadJs}</Text>
              </Pressable>
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  centerStage: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
  },
  panel: {
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
  },
  hero: {
    width: 112,
    height: 112,
    resizeMode: 'contain',
    marginBottom: spacing.md,
  },
  title: {
    ...typography.h1,
    color: colors.text,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
    lineHeight: 24,
  },
  form: {
    width: '100%',
    gap: spacing.sm,
  },
  twoFactorBox: {
    width: '100%',
    gap: spacing.sm,
  },
  twoFactorTitle: {
    ...typography.h3,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  methodRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    justifyContent: 'center',
  },
  methodChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  methodChipActive: {
    borderColor: colors.primary,
    backgroundColor: '#E3F2FD',
  },
  methodChipText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  methodChipTextActive: {
    color: colors.primary,
  },
  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    color: colors.text,
    ...typography.body,
  },
  actions: {
    width: '100%',
    marginTop: spacing.sm,
  },
  error: {
    ...typography.caption,
    color: colors.error,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  footerHint: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.lg,
    lineHeight: 20,
    paddingHorizontal: spacing.sm,
  },
  devReload: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  devReloadText: {
    ...typography.caption,
    color: colors.primary,
    textAlign: 'center',
  },
});
