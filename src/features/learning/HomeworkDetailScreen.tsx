import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useSelector} from 'react-redux';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {colors, radii, shadows, spacing, typography} from '../../app/theme';
import {Badge, DetailHeader, InfoRow} from '../common/components/Ui';
import {EmptyHint, InlineLoader, StateBlock} from '../common/components/Status';
import {HtmlContent} from '../common/components/HtmlContent';
import {selectAuth, selectLearning} from '../../state/selectors';
import {HomeworkDetail, HomeworkStatus, RemoteFile} from '../../domain/learning';
import {fetchHomeworkDetail} from '../../services/campus/homeworkDetail';
import {stripHtml} from '../../utils/html';
import {RootStackParamList} from '../../app/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'HomeworkDetail'>;

const labelMap: Record<HomeworkStatus, string> = {
  pending: '待提交',
  submitted: '已提交',
  graded: '已批改',
  overdue: '已逾期',
};
const toneMap: Record<HomeworkStatus, 'default' | 'success' | 'warning' | 'error'> = {
  pending: 'warning',
  submitted: 'default',
  graded: 'success',
  overdue: 'error',
};

export function HomeworkDetailScreen({route, navigation}: Props) {
  const {id} = route.params;
  const {snapshot} = useSelector(selectLearning);
  const auth = useSelector(selectAuth);
  const studentId = auth.session.studentId;
  const demoMode = auth.demoMode;

  const item = useMemo(
    () => snapshot?.homework.find(h => h.id === id),
    [snapshot, id],
  );

  const [detail, setDetail] = useState<HomeworkDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const canFetch = Boolean(item && item.url && item.url !== '#' && !demoMode);
  const retryLoad = useCallback(() => {
    setReloadKey(value => value + 1);
  }, []);

  useEffect(() => {
    if (!item || !canFetch) {
      return;
    }
    let mounted = true;
    setLoading(true);
    setError(null);
    fetchHomeworkDetail(item)
      .then(result => {
        if (mounted) {
          setDetail(result);
        }
      })
      .catch((e: unknown) => {
        if (mounted) {
          setError(e instanceof Error ? e.message : '作业详情加载失败');
        }
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });
    return () => {
      mounted = false;
    };
  }, [item, canFetch, reloadKey]);

  if (!item) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <DetailHeader title="作业详情" onBack={() => navigation.goBack()} />
        <EmptyHint
          title="作业信息不存在"
          message="当前本地快照里没有这条作业，可以返回首页重新同步。"
          style={styles.fullEmpty}
        />
      </SafeAreaView>
    );
  }

  const openAttachment = (file: RemoteFile) => {
    // 可预览类型（PDF / Office / 图片 / 文本）走 beforePlay 预览页在 App 内查看；
    // zip / rar 等压缩包预览页无法渲染，改走下载链接（在 App 内触发下载）。
    const usePreview = isPreviewable(file.name) && Boolean(file.previewUrl);
    navigation.navigate('InAppViewer', {
      url: usePreview ? file.previewUrl : file.downloadUrl,
      title: file.name,
    });
  };

  const hasGrading =
    item.graded ||
    item.grade != null ||
    Boolean(item.gradeContent) ||
    Boolean(item.graderName) ||
    Boolean(detail?.gradeAttachment);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <DetailHeader title="作业详情" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content}>
        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.heroRow}>
            <Badge label={labelMap[item.status]} tone={toneMap[item.status]} />
            {item.graded && item.grade != null ? (
              <Badge label={`成绩 ${item.grade}`} tone="success" />
            ) : null}
          </View>
          <Text style={styles.heroTitle}>{item.title}</Text>
          <Text style={styles.heroMeta}>{item.courseName}</Text>
        </View>

        {loading ? (
          <InlineLoader label="正在加载作业详情..." style={styles.statusInline} />
        ) : null}
        {error ? (
          <StateBlock
            title="作业详情加载失败"
            message={error}
            tone="error"
            actionLabel="重试"
            onAction={retryLoad}
            compact
            style={styles.statusBlock}
          />
        ) : null}

        {/* === 作业内容及要求 === */}
        <SectionTitle text="作业内容及要求" />
        <View style={styles.card}>
          <InfoRow label="作业标题" value={item.title} />
          {detail?.publishTarget ? (
            <InfoRow label="发布对象" value={detail.publishTarget} />
          ) : null}
          <InfoRow label="完成方式" value={item.completionType} />
          <InfoRow label="截止日期" value={item.deadline} mono />
          {item.lateSubmissionDeadline ? (
            <InfoRow label="补交截止" value={item.lateSubmissionDeadline} mono />
          ) : null}

          <FieldBlock label="作业说明">
            <RichOrEmpty html={detail?.description} />
          </FieldBlock>

          <AttachmentField label="作业附件" file={detail?.attachment} onOpen={openAttachment} />

          {detail?.answerContent ? (
            <FieldBlock label="答案说明">
              <RichOrEmpty html={detail.answerContent} />
            </FieldBlock>
          ) : null}
          {detail?.answerAttachment ? (
            <AttachmentField
              label="答案附件"
              file={detail.answerAttachment}
              onOpen={openAttachment}
            />
          ) : null}
        </View>

        {/* === 本人提交的作业 === */}
        <SectionTitle text="本人提交的作业" />
        <View style={styles.card}>
          <InfoRow label="学号" value={studentId} mono />
          <InfoRow
            label="提交日期"
            value={item.submitTime ?? (item.submitted ? '已提交' : '未提交')}
            mono
          />
          <FieldBlock label="上交作业内容">
            <RichOrEmpty html={detail?.submittedContent} emptyText="未提交文字内容" />
          </FieldBlock>
          <AttachmentField
            label="上交作业附件"
            file={detail?.submittedAttachment}
            onOpen={openAttachment}
          />
        </View>

        {/* === 老师批阅结果 === */}
        <SectionTitle text="老师批阅结果" />
        <View style={styles.card}>
          {hasGrading ? (
            <>
              <InfoRow label="批阅老师" value={item.graderName} />
              <InfoRow label="批阅时间" value={item.gradeTime} mono />
              <InfoRow
                label="成绩"
                value={item.grade != null ? String(item.grade) : undefined}
              />
              <FieldBlock label="评语">
                <Text style={styles.plainText}>
                  {stripHtml(item.gradeContent) || '—'}
                </Text>
              </FieldBlock>
              <AttachmentField
                label="评语附件"
                file={detail?.gradeAttachment}
                onOpen={openAttachment}
              />
            </>
          ) : (
            <Text style={styles.plainText}>老师尚未批阅</Text>
          )}
        </View>

        <Pressable
          style={({pressed}) => [styles.browserBtn, pressed && styles.pressed]}
          onPress={() => Linking.openURL(item.url).catch(() => undefined)}>
          <Text style={styles.browserBtnText}>用浏览器打开原始页面</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

/** 网络学堂 beforePlay 预览页可渲染的类型；其余（zip/rar 等）走下载 */
const PREVIEWABLE_EXTS = new Set([
  'pdf',
  'doc',
  'docx',
  'ppt',
  'pptx',
  'xls',
  'xlsx',
  'txt',
  'jpg',
  'jpeg',
  'png',
  'gif',
  'bmp',
  'webp',
]);

function isPreviewable(name: string): boolean {
  const dot = name.lastIndexOf('.');
  if (dot < 0) {
    return false;
  }
  return PREVIEWABLE_EXTS.has(name.slice(dot + 1).toLowerCase());
}

function SectionTitle({text}: {text: string}) {
  return <Text style={styles.sectionTitle}>{text}</Text>;
}

function FieldBlock({label, children}: {label: string; children: React.ReactNode}) {
  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

function RichOrEmpty({
  html,
  emptyText = '无',
}: {
  html?: string | null;
  emptyText?: string;
}) {
  if (html && stripHtml(html)) {
    return <HtmlContent html={html} minHeight={32} />;
  }
  return <Text style={styles.plainText}>{emptyText}</Text>;
}

function AttachmentField({
  label,
  file,
  onOpen,
}: {
  label: string;
  file?: RemoteFile;
  onOpen: (file: RemoteFile) => void;
}) {
  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {file ? (
        <Pressable
          style={({pressed}) => [styles.fileRow, pressed && styles.pressed]}
          onPress={() => onOpen(file)}>
          <Text style={styles.fileIcon}>📎</Text>
          <View style={{flex: 1}}>
            <Text style={styles.fileName} numberOfLines={2}>
              {file.name}
            </Text>
            {file.size ? <Text style={styles.fileSize}>{file.size}</Text> : null}
          </View>
          <Text style={styles.fileAction}>
            {isPreviewable(file.name) ? '查看' : '下载'}
          </Text>
        </Pressable>
      ) : (
        <Text style={styles.plainText}>无附件</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background},
  content: {padding: spacing.lg, paddingBottom: spacing.xxl},
  fullEmpty: {flex: 1},
  hero: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    ...shadows.soft,
    gap: spacing.sm,
  },
  heroRow: {flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs},
  heroTitle: {...typography.h1, color: colors.text},
  heroMeta: {...typography.caption, color: colors.textSecondary},
  statusInline: {paddingVertical: spacing.sm},
  statusBlock: {marginBottom: spacing.sm},
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
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    ...shadows.soft,
  },
  fieldBlock: {
    paddingVertical: spacing.md - 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
    gap: spacing.xs,
  },
  fieldLabel: {...typography.caption, color: colors.textMuted},
  plainText: {...typography.body, color: colors.text, lineHeight: 22},
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginTop: 2,
  },
  fileIcon: {fontSize: 18},
  fileName: {...typography.body, color: colors.text},
  fileSize: {...typography.micro, color: colors.textMuted, marginTop: 2},
  fileAction: {...typography.label, color: colors.primary},
  pressed: {opacity: 0.7},
  browserBtn: {
    marginTop: spacing.xl,
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  browserBtnText: {...typography.body, color: colors.primary},
});
