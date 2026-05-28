import React, {useMemo, useRef, useState} from 'react';
import {Linking, Platform, StyleSheet, View} from 'react-native';
import {WebView, WebViewMessageEvent, WebViewNavigation} from 'react-native-webview';
import {wrapAsDocument} from '../../../utils/html';

interface Props {
  /** 原始 HTML 字符串（来自 learn 接口） */
  html: string;
  /** 给链接补 csrf token 的 base URL（学堂域）*/
  baseUrl?: string;
  /** 最小高度 */
  minHeight?: number;
}

/**
 * 借鉴 learnX/AutoHeightWebView：用 WebView 渲染富文本，自动测量高度自适应。
 * 点击外链交给系统浏览器；其他保持在 WebView 内。
 */
export function HtmlContent({html, baseUrl, minHeight = 80}: Props) {
  const [height, setHeight] = useState(minHeight);
  const webRef = useRef<WebView>(null);

  const source = useMemo(
    () => ({
      html: wrapAsDocument(html),
      baseUrl: baseUrl ?? 'https://learn.tsinghua.edu.cn',
    }),
    [html, baseUrl],
  );

  const onMessage = (e: WebViewMessageEvent) => {
    const measured = parseInt(e.nativeEvent.data, 10);
    if (!isNaN(measured) && measured > minHeight) {
      setHeight(Math.min(measured + 8, 5000));
    }
  };

  const onNavigationStateChange = (nav: WebViewNavigation) => {
    if (nav.navigationType === 'click') {
      webRef.current?.stopLoading();
      Linking.openURL(nav.url).catch(() => undefined);
    }
  };

  return (
    <View style={[styles.wrap, {height}]}>
      <WebView
        ref={webRef}
        source={source}
        injectedJavaScriptBeforeContentLoaded={INJECTED_SCRIPT}
        javaScriptEnabled
        domStorageEnabled
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        originWhitelist={['*']}
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        scalesPageToFit={false}
        scrollEnabled={false}
        onMessage={onMessage}
        onNavigationStateChange={onNavigationStateChange}
        style={styles.web}
      />
    </View>
  );
}

const INJECTED_SCRIPT = `
  function postH() {
    if (!window.ReactNativeWebView || !window.ReactNativeWebView.postMessage) {
      setTimeout(postH, 100);
      return;
    }
    var h = Math.max(
      document.documentElement && document.documentElement.scrollHeight || 0,
      document.documentElement && document.documentElement.clientHeight || 0,
      document.body && document.body.scrollHeight || 0,
      document.body && document.body.clientHeight || 0
    );
    window.ReactNativeWebView.postMessage(String(h));
  }
  window.addEventListener('load', postH);
  setTimeout(postH, 200);
  setTimeout(postH, 800);
  true;
`;

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  web: {
    flex: 1,
    backgroundColor: 'transparent',
    // Android 上 transparent + opacity 0.99 解决黑屏闪烁
    opacity: Platform.OS === 'android' ? 0.99 : 1,
  },
});

