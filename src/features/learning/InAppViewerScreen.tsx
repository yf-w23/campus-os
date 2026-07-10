import React, {useCallback, useEffect, useState} from 'react';
import {
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {WebView, WebViewNavigation} from 'react-native-webview';
import CookieManager from '@react-native-cookies/cookies';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {colors, spacing, typography} from '../../app/theme';
import {RootStackParamList} from '../../app/navigation/types';
import {InlineLoader} from '../common/components/Status';
import {LEARN_BASE} from '../../services/webvpn/constants';

const COOKIE_DOMAINS = [
  LEARN_BASE,
  'https://id.tsinghua.edu.cn',
  'https://webvpn.tsinghua.edu.cn',
];

type Props = NativeStackScreenProps<RootStackParamList, 'InAppViewer'>;

const WEBVIEW_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * App 内 WebView 文件 / 网页查看器。
 * 关键：与 learnX/AutoHeightWebView 一致，**主动读取 learn 域 cookies 注入到 WebView headers**，
 * 避免 RN-Android 共享 Cookie 在 redirect/跨子域时丢失导致 500 / 权限不足。
 */
export function InAppViewerScreen({route, navigation}: Props) {
  const {url, title} = route.params;
  const [loading, setLoading] = useState(true);
  const [cookieHeader, setCookieHeader] = useState<string | null>(null);
  const [currentUrl, setCurrentUrl] = useState(url);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // 合并三个域的 cookies（learn / id / webvpn），由登录链事先注入到 system jar
        const seen = new Set<string>();
        const parts: string[] = [];
        for (const domain of COOKIE_DOMAINS) {
          try {
            const cookies = await CookieManager.get(domain);
            for (const [name, meta] of Object.entries(cookies)) {
              if (seen.has(name)) continue;
              seen.add(name);
              parts.push(`${name}=${meta.value}`);
            }
          } catch {
            // ignore single-domain failure
          }
        }
        if (mounted) {
          setCookieHeader(parts.join('; '));
        }
      } catch {
        if (mounted) {
          setCookieHeader('');
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, [url]);

  const handleNavChange = useCallback((state: WebViewNavigation) => {
    setCurrentUrl(state.url);
  }, []);

  // 等 cookie 同步完成再渲染 WebView，避免无 session 的首次请求被服务器拒绝
  if (cookieHeader === null) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Header title={title || '查看'} onBack={() => navigation.goBack()} />
        <InlineLoader label="同步会话..." style={styles.loading} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header
        title={title || '查看'}
        onBack={() => navigation.goBack()}
        onExternal={() => Linking.openURL(currentUrl).catch(() => undefined)}
      />

      <View style={styles.webWrap}>
        <WebView
          source={{
            uri: url,
            headers: cookieHeader ? {Cookie: cookieHeader} : undefined,
          }}
          userAgent={WEBVIEW_USER_AGENT}
          sharedCookiesEnabled
          thirdPartyCookiesEnabled
          javaScriptEnabled
          domStorageEnabled
          originWhitelist={['*']}
          startInLoadingState
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          onNavigationStateChange={handleNavChange}
          style={styles.web}
        />
        {loading ? (
          <InlineLoader label="加载中..." style={styles.loading} />
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
});
