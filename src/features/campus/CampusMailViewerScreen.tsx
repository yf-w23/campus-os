import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {WebView, WebViewNavigation} from 'react-native-webview';
import CookieManager from '@react-native-cookies/cookies';
import {colors, spacing, typography} from '../../app/theme';
import {RootStackParamList} from '../../app/navigation/types';
import {InlineLoader, StateBlock} from '../common/components/Status';
import {loadCredentials} from '../../storage/secureStorage';
import {CampusCredentials} from '../../domain/campus';
import {tsinghuaAuthService} from '../../services/auth/tsinghuaAuth';
import {MAIL_PORTAL_URL} from '../../services/campus/campusEndpoints';
import {
  ID_HOST_URL,
  INFO_PORTAL_YYFWID,
  LEARN_BASE,
  WEBVPN_ROOT_URL,
} from '../../services/webvpn/constants';

type Props = NativeStackScreenProps<RootStackParamList, 'CampusMailViewer'>;

const COOKIE_DOMAINS = [
  LEARN_BASE,
  ID_HOST_URL,
  WEBVPN_ROOT_URL,
  'https://info.tsinghua.edu.cn',
  'https://mails.tsinghua.edu.cn',
];

const WEBVIEW_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function loadCachedCredentials(): Promise<CampusCredentials | null> {
  const saved = await loadCredentials();
  if (!saved) {
    return null;
  }
  return {
    studentId: saved.studentId,
    password: saved.password,
    fingerprint: saved.fingerprint,
  };
}

async function buildCookieHeader(): Promise<string> {
  const seen = new Set<string>();
  const parts: string[] = [];
  for (const domain of COOKIE_DOMAINS) {
    try {
      const cookies = await CookieManager.get(domain);
      for (const [name, meta] of Object.entries(cookies)) {
        if (seen.has(name)) {
          continue;
        }
        seen.add(name);
        parts.push(`${name}=${meta.value}`);
      }
    } catch {
      // Ignore a single-domain cookie read failure.
    }
  }
  return parts.join('; ');
}

function targetScript(view: RootStackParamList['CampusMailViewer']['view']) {
  if (view === 'home') {
    return '';
  }
  if (view === 'inbox') {
    return `
      if (!location.hash.startsWith('#mail.list')) {
        location.hash = 'mail.list|%7B%22fid%22%3A1%7D';
      }
    `;
  }
  return `
    if (!location.hash.startsWith('#mail.compose')) {
      var btn = document.querySelector('button.btn-compose[data-op="compose"]');
      if (btn) {
        btn.click();
      }
    }
  `;
}

export function CampusMailViewerScreen({route, navigation}: Props) {
  const {view, title} = route.params;
  const webRef = useRef<WebView>(null);
  const [preparing, setPreparing] = useState(true);
  const [cookieHeader, setCookieHeader] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentUrl, setCurrentUrl] = useState(MAIL_PORTAL_URL);

  const injection = useMemo(() => {
    const script = targetScript(view);
    if (!script) {
      return '';
    }
    return `
      (function () {
        if (!/\\/coremail\\//.test(location.href)) return true;
        if (window.__campusMailTarget === ${JSON.stringify(view)}) return true;
        window.__campusMailTarget = ${JSON.stringify(view)};
        setTimeout(function () {
          try {
            ${script}
          } catch (e) {}
        }, 450);
        return true;
      })();
    `;
  }, [view]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setPreparing(true);
      setError(null);
      try {
        const credentials = await loadCachedCredentials();
        if (!credentials?.password) {
          throw new Error('未找到登录凭证，请退出演示模式并重新登录。');
        }
        await tsinghuaAuthService.ensureSubsystemSession(
          credentials,
          'id',
          INFO_PORTAL_YYFWID,
        );
        const header = await buildCookieHeader();
        if (mounted) {
          setCookieHeader(header);
        }
      } catch (e) {
        if (mounted) {
          setError(e instanceof Error ? e.message : '清华邮箱会话准备失败');
          setCookieHeader('');
        }
      } finally {
        if (mounted) {
          setPreparing(false);
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const injectTarget = useCallback(() => {
    if (injection) {
      webRef.current?.injectJavaScript(injection);
    }
  }, [injection]);

  const handleNavChange = useCallback(
    (state: WebViewNavigation) => {
      setCurrentUrl(state.url);
      injectTarget();
    },
    [injectTarget],
  );

  if (preparing || cookieHeader === null) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Header title={title || '清华邮箱'} onBack={() => navigation.goBack()} />
        <InlineLoader label="正在激活邮箱会话..." style={styles.loading} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header
        title={title || '清华邮箱'}
        onBack={() => navigation.goBack()}
        onExternal={() => Linking.openURL(currentUrl).catch(() => undefined)}
      />
      <View style={styles.webWrap}>
        {error ? (
          <StateBlock
            title="邮箱会话准备失败"
            message={error}
            tone="error"
            style={styles.statusBlock}
          />
        ) : (
          <WebView
            ref={webRef}
            source={{
              uri: MAIL_PORTAL_URL,
              headers: cookieHeader ? {Cookie: cookieHeader} : undefined,
            }}
            userAgent={WEBVIEW_USER_AGENT}
            sharedCookiesEnabled
            thirdPartyCookiesEnabled
            javaScriptEnabled
            domStorageEnabled
            originWhitelist={['*']}
            startInLoadingState
            injectedJavaScript={injection || undefined}
            onLoadStart={() => setLoading(true)}
            onLoadEnd={() => {
              setLoading(false);
              injectTarget();
            }}
            onNavigationStateChange={handleNavChange}
            style={styles.web}
          />
        )}
        {loading && !error ? (
          <InlineLoader label="加载邮箱..." style={styles.loading} />
        ) : null}
      </View>
    </SafeAreaView>
  );
}

function Header({
  title,
  onBack,
  onExternal,
}: {
  title: string;
  onBack: () => void;
  onExternal?: () => void;
}) {
  return (
    <View style={styles.header}>
      <Pressable onPress={onBack} hitSlop={12} style={styles.back}>
        <Text style={styles.chevron}>‹</Text>
      </Pressable>
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      {onExternal ? (
        <Pressable onPress={onExternal} hitSlop={12} style={styles.external}>
          <Text style={styles.externalText}>浏览器</Text>
        </Pressable>
      ) : (
        <View style={styles.external} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background,
    gap: spacing.sm,
    minHeight: 52,
  },
  back: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -spacing.xs,
  },
  chevron: {
    fontSize: 32,
    color: colors.text,
    lineHeight: 32,
    marginTop: -4,
    fontWeight: '300',
  },
  title: {...typography.h3, color: colors.text, flex: 1, textAlign: 'center'},
  external: {
    minWidth: 60,
    height: 40,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  externalText: {...typography.body, color: colors.primary},
  webWrap: {flex: 1, backgroundColor: colors.background},
  web: {flex: 1, backgroundColor: 'transparent'},
  loading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(10, 10, 11, 0.6)',
    gap: spacing.sm,
  },
  statusBlock: {margin: spacing.lg},
});
