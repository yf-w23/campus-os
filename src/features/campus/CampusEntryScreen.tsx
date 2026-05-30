import React, {useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ImageSourcePropType,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {colors, radii, shadows, spacing, typography} from '../../app/theme';
import {DetailHeader} from '../common/components/Ui';
import {tsinghuaAuthService} from '../../services/auth/tsinghuaAuth';
import {RootStackParamList} from '../../app/navigation/types';
import {loadCredentials} from '../../storage/secureStorage';
import {
  SubsystemKind,
  SUBSYSTEM_ENTRIES,
} from '../../services/campus/campusEndpoints';
import {CampusCredentials} from '../../domain/campus';

interface EntryItem {
  title: string;
  subtitle: string;
  url: string;
  accent: string;
  /** 若提供则跳转到对应 native 屏幕（跳过 WebView 与子系统激活）*/
  navigateTo?: keyof RootStackParamList;
}

interface Props {
  navigation: any;
  pageTitle: string;
  heroIcon: ImageSourcePropType;
  heroTitle: string;
  heroSubtitle: string;
  entries: EntryItem[];
}

async function loadCachedCredentials(): Promise<CampusCredentials | null> {
  const saved = await loadCredentials();
  if (!saved) return null;
  return {
    studentId: saved.studentId,
    password: saved.password,
    fingerprint: saved.fingerprint,
  };
}

/**
 * 按子系统 kind 在打开 WebView 前建立对应的 SSO 后端会话。
 *
 * - id-roam：thu-info-lib `roam("id", payload)` —— 经由 oauth.tsinghua.edu.cn/lb-auth/lbredirect
 *   把子系统的 ASP.NET / portal 会话挂到 webvpn 后端 jar 上
 * - cab-login：研讨间 — 先 fetch authAddress 拿动态 payload，再 roam("cab", payload)
 * - none / default-roam：直接打开（webvpn 主会话已够）
 */
async function ensureSubsystemSession(
  kind: SubsystemKind,
  payload: string | undefined,
): Promise<void> {
  if (kind === 'none' || kind === 'default-roam') {
    return;
  }
  const credentials = await loadCachedCredentials();
  if (!credentials || !credentials.password) {
    throw new Error('未找到登录凭证（可能仍在演示模式）');
  }
  if (kind === 'id-roam') {
    if (!payload) {
      throw new Error('id-roam 需要 yyfwid payload');
    }
    await tsinghuaAuthService.ensureSubsystemSession(credentials, 'id', payload);
    return;
  }
  if (kind === 'cab-login') {
    await tsinghuaAuthService.ensureSubsystemSession(credentials, 'cab');
    return;
  }
}

export function CampusEntryScreen({
  navigation,
  pageTitle,
  heroIcon,
  heroTitle,
  heroSubtitle,
  entries,
}: Props) {
  const [activating, setActivating] = useState(false);
  const [activatingHint, setActivatingHint] = useState('正在准备会话…');

  const open = async (item: EntryItem) => {
    // native 子页面：直接跳转，会话由目标屏幕自行激活
    if (item.navigateTo) {
      navigation.navigate(item.navigateTo);
      return;
    }
    const entryConfig = SUBSYSTEM_ENTRIES[item.url] ?? {
      url: item.url,
      kind: 'none' as SubsystemKind,
    };

    setActivating(true);
    setActivatingHint(
      entryConfig.kind === 'cab-login'
        ? '正在激活研讨间预约会话…'
        : entryConfig.kind === 'id-roam'
        ? '正在激活子系统 SSO 会话…'
        : '正在准备会话…',
    );
    try {
      await ensureSubsystemSession(entryConfig.kind, entryConfig.payload);
    } catch (e) {
      const msg = (e as Error).message ?? '激活失败';
      Alert.alert(
        '子系统会话激活失败',
        `${msg}\n\n你可以继续进入，但页面可能提示"未登录"。请回到登录页重新登录后再试。`,
        [
          {text: '继续进入', onPress: () => doNavigate(item)},
          {text: '取消', style: 'cancel'},
        ],
      );
      setActivating(false);
      return;
    } finally {
      setActivating(false);
    }
    doNavigate(item);
  };

  const doNavigate = (item: EntryItem) => {
    navigation.navigate('InAppViewer', {url: item.url, title: item.title});
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <DetailHeader title={pageTitle} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <View style={styles.heroIconWrap}>
            <Image source={heroIcon} style={styles.heroIcon} />
          </View>
          <Text style={styles.heroTitle}>{heroTitle}</Text>
          <Text style={styles.heroSubtitle}>{heroSubtitle}</Text>
        </View>

        {entries.map(item => (
          <Pressable
            key={item.url}
            style={({pressed}) => [styles.entryCard, pressed && styles.pressed]}
            onPress={() => open(item)}>
            <View style={[styles.dot, {backgroundColor: item.accent}]} />
            <View style={{flex: 1}}>
              <Text style={styles.entryTitle}>{item.title}</Text>
              <Text style={styles.entrySubtitle}>{item.subtitle}</Text>
            </View>
            <Text style={styles.arrow}>›</Text>
          </Pressable>
        ))}

        <Text style={styles.footer}>
          所有服务通过清华统一身份认证与 WebVPN 转发，首次打开会激活子系统会话，可能耗时数秒。
        </Text>
      </ScrollView>

      {activating ? (
        <View style={styles.overlay}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.overlayText}>{activatingHint}</Text>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

export type EntryScreenProps<K extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, K>;

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background},
  content: {padding: spacing.lg, paddingBottom: spacing.xxl},
  hero: {alignItems: 'center', paddingVertical: spacing.lg},
  heroIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle,
    marginBottom: spacing.md,
  },
  heroIcon: {width: 72, height: 72, resizeMode: 'cover'},
  heroTitle: {...typography.h1, color: colors.text},
  heroSubtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
    paddingHorizontal: spacing.lg,
  },
  entryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginTop: spacing.sm,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  pressed: {opacity: 0.7},
  dot: {width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary},
  entryTitle: {...typography.body, color: colors.text, fontWeight: '500'},
  entrySubtitle: {...typography.caption, color: colors.textMuted, marginTop: 2},
  arrow: {fontSize: 22, color: colors.textMuted, fontWeight: '300'},
  footer: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xl,
    paddingHorizontal: spacing.md,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.overlay,
    gap: spacing.sm,
  },
  overlayText: {...typography.body, color: colors.text},
});
