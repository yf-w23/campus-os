import React, {useCallback, useRef, useState} from 'react';
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
import {WebView, WebViewMessageEvent} from 'react-native-webview';
import {colors, radii, spacing, typography} from '../../app/theme';
import {DetailHeader} from '../common/components/Ui';
import {PrimaryButton} from '../common/components/Buttons';
import {RootStackParamList} from '../../app/navigation/types';
import {MAIL_PORTAL_URL} from '../../services/campus/campusEndpoints';

type Props = NativeStackScreenProps<RootStackParamList, 'CampusMailCompose'>;

export function CampusMailComposeScreen({route, navigation}: Props) {
  const params = route.params ?? {};
  const webRef = useRef<WebView>(null);
  const [to, setTo] = useState(params.to ?? '');
  const [cc, setCc] = useState(params.cc ?? '');
  const [bcc, setBcc] = useState(params.bcc ?? '');
  const [subject, setSubject] = useState(params.subject ?? '');
  const [content, setContent] = useState(params.content ?? '');
  const [sending, setSending] = useState(false);

  const canSend = to.trim().length > 0 && !sending;

  const injectSend = useCallback(() => {
    webRef.current?.injectJavaScript(
      composeBridgeScript({
        to,
        cc,
        bcc,
        subject,
        content,
      }),
    );
  }, [bcc, cc, content, subject, to]);

  const doSend = async () => {
    setSending(true);
    setTimeout(injectSend, 50);
  };

  const handleBridgeMessage = useCallback(
    (event: WebViewMessageEvent) => {
      try {
        const payload = JSON.parse(event.nativeEvent.data);
        if (payload.type === 'mailSendSuccess') {
          setSending(false);
          Alert.alert('发送成功', '邮件已提交给清华邮箱系统发送。', [
            {text: '好', onPress: () => navigation.goBack()},
          ]);
        } else if (payload.type === 'mailSendError') {
          setSending(false);
          Alert.alert('发送失败', payload.message || '发送失败');
        }
      } catch {
        // Ignore non-bridge messages.
      }
    },
    [navigation],
  );

  const confirmSend = () => {
    if (!canSend) {
      return;
    }
    Alert.alert(
      '确认发送邮件',
      `收件人：${to}\n主题：${subject || '(无主题)'}\n\n发送后将通过清华邮箱正式投递。`,
      [
        {text: '取消', style: 'cancel'},
        {text: '确认发送', onPress: () => doSend().catch(() => undefined)},
      ],
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <WebView
        ref={webRef}
        source={{uri: MAIL_PORTAL_URL}}
        pointerEvents="none"
        containerStyle={styles.bridgeWebViewContainer}
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        javaScriptEnabled
        domStorageEnabled
        originWhitelist={['*']}
        onLoadEnd={() => {
          if (sending) {
            injectSend();
          }
        }}
        onMessage={handleBridgeMessage}
        style={styles.bridgeWebView}
      />
      <DetailHeader
        title={params.mode === 'reply' ? '回复邮件' : params.mode === 'forward' ? '转发邮件' : '写信'}
        onBack={() => navigation.goBack()}
        rightLabel={sending ? undefined : '发送'}
        onRight={confirmSend}
      />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Field label="收件人" value={to} onChangeText={setTo} placeholder="name@tsinghua.edu.cn" />
        <Field label="抄送" value={cc} onChangeText={setCc} placeholder="可选" />
        <Field label="密送" value={bcc} onChangeText={setBcc} placeholder="可选" />
        <Field label="主题" value={subject} onChangeText={setSubject} placeholder="邮件主题" />
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
          <Text style={styles.noticeTitle}>附件与富文本</Text>
          <Text style={styles.noticeText}>
            当前原生写信支持纯文本正文。附件上传、富文本排版和模板信仍可通过官方邮箱页完成。
          </Text>
        </View>

        <PrimaryButton
          label={sending ? '发送中…' : '发送邮件'}
          onPress={confirmSend}
          disabled={!canSend}
          loading={sending}
        />
        {sending ? <ActivityIndicator color={colors.primary} style={styles.indicator} /> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function composeBridgeScript(draft: {
  to: string;
  cc: string;
  bcc: string;
  subject: string;
  content: string;
}): string {
  return `
    (function () {
      var draft = ${JSON.stringify({
        ...draft,
        content: draft.content.replace(/\n/g, '<br>'),
      })};
      function post(data) {
        window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(data));
      }
      function sid() {
        var match = location.href.match(/[?&]sid=([^&#]+)/);
        return match ? decodeURIComponent(match[1]) : '';
      }
      function parse(text) {
        try { return JSON.parse(text); } catch (e) { return null; }
      }
      function messageOf(parsed) {
        if (!parsed) return '邮箱接口响应无法解析';
        var msg = '';
        if (Array.isArray(parsed.messages)) {
          msg = parsed.messages.map(function (item) { return item && item.summary; }).filter(Boolean).join('；');
        }
        return parsed.errorMsg || parsed.message || msg || parsed.code || '邮箱发送失败';
      }
      function xhrForm(func, body, callback) {
        var xhr = new XMLHttpRequest();
        xhr.open('POST', location.origin + '/coremail/s?sid=' + encodeURIComponent(sid()) + '&func=' + encodeURIComponent(func));
        xhr.withCredentials = true;
        xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded; charset=UTF-8');
        xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
        xhr.onreadystatechange = function () {
          if (xhr.readyState === 4) {
            callback(xhr.status >= 200 && xhr.status < 300 ? null : new Error('HTTP ' + xhr.status), xhr.responseText || '');
          }
        };
        xhr.onerror = function () { callback(new Error('网络请求失败'), ''); };
        xhr.send(Object.keys(body).map(function (key) {
          return encodeURIComponent(key) + '=' + encodeURIComponent(body[key] == null ? '' : body[key]);
        }).join('&'));
      }
      function xhrJson(func, body, callback) {
        var xhr = new XMLHttpRequest();
        xhr.open('POST', location.origin + '/coremail/s/json?sid=' + encodeURIComponent(sid()) + '&func=' + encodeURIComponent(func));
        xhr.withCredentials = true;
        xhr.setRequestHeader('Content-Type', 'application/json;charset=UTF-8');
        xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
        xhr.onreadystatechange = function () {
          if (xhr.readyState === 4) {
            callback(xhr.status >= 200 && xhr.status < 300 ? null : new Error('HTTP ' + xhr.status), xhr.responseText || '');
          }
        };
        xhr.onerror = function () { callback(new Error('网络请求失败'), ''); };
        xhr.send(JSON.stringify(body));
      }
      function composeWith(func) {
        xhrForm(func, {ctype: 'normal'}, function (err, text) {
          if (err && func === '!compose') {
            composeWith('compose');
            return;
          }
          if (err) {
            post({type: 'mailSendError', message: err.message});
            return;
          }
          var parsed = parse(text);
          if (parsed && parsed.code && /^FA_/.test(parsed.code)) {
            if (func === '!compose') {
              composeWith('compose');
            } else {
              post({type: 'mailSendError', message: messageOf(parsed)});
            }
            return;
          }
          var payload = parsed && (parsed.var || parsed.object || parsed.data || parsed);
          var composeId = payload && (payload.id || payload.composeId || (payload.compose && payload.compose.id) || (payload.data && payload.data.id));
          if (!composeId) {
            post({type: 'mailSendError', message: '邮箱写信草稿初始化失败'});
            return;
          }
          xhrJson('mbox:compose', {
            id: composeId,
            attrs: {
              to: draft.to,
              cc: draft.cc || '',
              bcc: draft.bcc || '',
              subject: draft.subject || '',
              content: draft.content || ''
            },
            returnInfo: true,
            action: 'deliver',
            autosaveHitCounter: true
          }, function (sendErr, sendText) {
            if (sendErr) {
              post({type: 'mailSendError', message: sendErr.message});
              return;
            }
            var sendParsed = parse(sendText);
            if (sendParsed && sendParsed.code && /^FA_/.test(sendParsed.code)) {
              post({type: 'mailSendError', message: messageOf(sendParsed)});
              return;
            }
            post({type: 'mailSendSuccess'});
          });
        });
      }
      if (!/\\/coremail\\//.test(location.href)) {
        post({type: 'mailSendError', message: '邮箱会话还在准备中，请稍后再点发送'});
        return true;
      }
      try {
        composeWith('!compose');
      } catch (e) {
        post({type: 'mailSendError', message: e && e.message ? e.message : '发送失败'});
      }
      return true;
    })();
  `;
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
  bridgeWebViewContainer: {
    position: 'absolute',
    flex: 0,
    top: -1200,
    left: -1200,
    width: 1,
    height: 1,
    opacity: 0,
    zIndex: -1,
    elevation: -1,
    overflow: 'hidden',
  },
  bridgeWebView: {
    flex: 0,
    width: 1,
    height: 1,
    opacity: 0,
  },
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
