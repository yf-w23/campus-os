import React, {useEffect, useMemo, useState} from 'react';
import {Modal, Pressable, StyleSheet, Text, View} from 'react-native';
import {colors, radii, spacing, typography} from '../../app/theme';
import {ActionPreview, ConfirmationSpec, ToolRisk} from '../../domain/actions';
import {AgentTool} from '../../services/ai/tools';

const riskLabels: Record<ToolRisk, string> = {
  read: '只读',
  write_reversible: '可撤销写入',
  write_irreversible: '不可逆写入',
  payment: '支付',
  credential: '凭证',
};

const riskNotes: Record<ToolRisk, string> = {
  read: '该操作只读取校园数据，不会修改资源。',
  write_reversible: '该操作会修改资源，但通常可以撤销。',
  write_irreversible: '该操作可能不可逆，请确认影响范围。',
  payment: '该操作涉及支付或资金流转，不会静默完成。',
  credential: '该操作涉及账号或凭证，敏感信息不会写入审计日志。',
};

type RiskTone = 'safe' | 'warning' | 'danger';

const riskToneMap: Record<ToolRisk, RiskTone> = {
  read: 'safe',
  write_reversible: 'warning',
  write_irreversible: 'danger',
  payment: 'danger',
  credential: 'danger',
};

const riskBannerTitle: Record<ToolRisk, string> = {
  read: '只读查询',
  write_reversible: '将执行可撤销写入',
  write_irreversible: '将执行不可逆操作',
  payment: '将发起支付相关操作',
  credential: '将使用账号或凭证能力',
};

function recoveryText(preview?: ActionPreview): string {
  if (!preview) {
    return '执行前会记录本机审计日志。';
  }
  if (preview.reversible) {
    return '通常可通过对应取消/撤销工具恢复。';
  }
  return '该操作可能不可直接撤销。';
}

interface ActionConfirmationModalProps {
  visible: boolean;
  tool?: AgentTool;
  spec?: ConfirmationSpec;
  preview?: ActionPreview;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ActionConfirmationModal({
  visible,
  tool,
  spec,
  preview,
  onConfirm,
  onCancel,
}: ActionConfirmationModalProps) {
  const [reviewed, setReviewed] = useState(false);
  const destructive =
    spec?.destructive ||
    tool?.risk === 'payment' ||
    tool?.risk === 'write_irreversible' ||
    tool?.risk === 'credential';
  const risk = tool?.risk ?? 'read';
  const tone = riskToneMap[risk];
  const requiresReview = Boolean(
    destructive || preview?.reversible === false || preview?.requiresSecondFactor,
  );
  const confirmDisabled = requiresReview && !reviewed;
  const confirmLabel = useMemo(() => {
    if (spec?.confirmLabel) {
      return spec.confirmLabel;
    }
    if (risk === 'payment') {
      return '确认支付操作';
    }
    if (risk === 'write_irreversible') {
      return '确认不可逆操作';
    }
    if (risk === 'credential') {
      return '确认使用凭证';
    }
    return '确认执行';
  }, [risk, spec?.confirmLabel]);

  useEffect(() => {
    if (visible) {
      setReviewed(false);
    }
  }, [visible, tool?.name, spec?.title, preview?.summary]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.eyebrow}>AI 操作确认</Text>
            <Text style={styles.title}>
              {spec?.title ?? tool?.title ?? '确认执行操作'}
            </Text>
            <Text style={styles.message}>
              {spec?.message ?? '确认后将执行该校园工具。'}
            </Text>
          </View>

          {tool ? (
            <View
              style={[
                styles.riskBanner,
                tone === 'safe' && styles.riskBannerSafe,
                tone === 'warning' && styles.riskBannerWarning,
                tone === 'danger' && styles.riskBannerDanger,
              ]}>
              <View style={styles.riskBannerTop}>
                <Text
                  style={[
                    styles.riskBadge,
                    tone === 'safe' && styles.riskBadgeSafe,
                    tone === 'warning' && styles.riskBadgeWarning,
                    tone === 'danger' && styles.riskBadgeDanger,
                  ]}>
                  {riskLabels[tool.risk]}
                </Text>
                {requiresReview ? (
                  <Text style={styles.reviewRequired}>需核对</Text>
                ) : null}
              </View>
              <Text style={styles.riskBannerTitle}>{riskBannerTitle[tool.risk]}</Text>
              <Text style={styles.riskBannerText}>{riskNotes[tool.risk]}</Text>
            </View>
          ) : null}

          {preview ? (
            <View style={styles.previewBox}>
              <Text style={styles.previewTitle}>{preview.title}</Text>
              <Text style={styles.previewText}>{preview.summary}</Text>
              {preview.affectedResource ? (
                <Text style={styles.previewMeta}>
                  影响资源：{preview.affectedResource}
                </Text>
              ) : null}
              {preview.accountLabel ? (
                <Text style={styles.previewMeta}>
                  使用账号：{preview.accountLabel}
                </Text>
              ) : null}
              <Text style={styles.previewMeta}>
                可恢复性：{recoveryText(preview)}
              </Text>
              {preview.requiresSecondFactor ? (
                <Text style={styles.previewMeta}>
                  二次验证：可能需要在官方页面或短信/验证码中继续确认
                </Text>
              ) : null}
            </View>
          ) : null}

          {tool ? (
            <View style={styles.metaBox}>
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>工具</Text>
                <Text style={styles.metaValue}>{tool.title}</Text>
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>风险</Text>
                <Text
                  style={[
                    styles.metaValue,
                    destructive ? styles.metaDanger : styles.metaNormal,
                  ]}>
                  {riskLabels[tool.risk]}
                </Text>
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>权限</Text>
                <Text style={styles.metaValue}>{tool.permission}</Text>
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>审计</Text>
                <Text style={styles.metaValue}>
                  将写入本机 AI 操作记录，敏感字段会脱敏
                </Text>
              </View>
            </View>
          ) : null}

          {requiresReview ? (
            <Pressable
              onPress={() => setReviewed(value => !value)}
              style={({pressed}) => [
                styles.reviewBox,
                reviewed && styles.reviewBoxChecked,
                pressed && styles.pressed,
              ]}>
              <View style={[styles.checkBox, reviewed && styles.checkBoxOn]}>
                {reviewed ? <Text style={styles.checkMark}>✓</Text> : null}
              </View>
              <View style={styles.reviewCopy}>
                <Text style={styles.reviewTitle}>我已核对影响范围</Text>
                <Text style={styles.reviewText}>
                  已确认目标资源、账号、可恢复性和可能的后续验证步骤。
                </Text>
              </View>
            </Pressable>
          ) : null}

          <View style={styles.actions}>
            <Pressable
              onPress={onCancel}
              style={({pressed}) => [
                styles.button,
                styles.cancelButton,
                pressed && styles.pressed,
              ]}>
              <Text style={styles.cancelText}>{spec?.cancelLabel ?? '取消'}</Text>
            </Pressable>
            <Pressable
              onPress={onConfirm}
              disabled={confirmDisabled}
              style={({pressed}) => [
                styles.button,
                destructive ? styles.dangerButton : styles.confirmButton,
                confirmDisabled && styles.buttonDisabled,
                pressed && !confirmDisabled && styles.pressed,
              ]}>
              <Text style={styles.confirmText}>
                {confirmLabel}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(16, 24, 40, 0.36)',
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    gap: spacing.md,
  },
  header: {
    gap: spacing.xs,
  },
  eyebrow: {
    ...typography.micro,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  title: {
    ...typography.h2,
    color: colors.text,
  },
  message: {
    ...typography.body,
    color: colors.textSecondary,
  },
  riskBanner: {
    borderRadius: radii.lg,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  riskBannerSafe: {
    backgroundColor: colors.successMuted,
    borderColor: colors.successMuted,
  },
  riskBannerWarning: {
    backgroundColor: colors.warningMuted,
    borderColor: colors.warningMuted,
  },
  riskBannerDanger: {
    backgroundColor: colors.errorMuted,
    borderColor: colors.errorMuted,
  },
  riskBannerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  riskBadge: {
    ...typography.micro,
    borderRadius: radii.pill,
    paddingHorizontal: 9,
    paddingVertical: 4,
    overflow: 'hidden',
    fontWeight: '700',
  },
  riskBadgeSafe: {
    color: colors.success,
    backgroundColor: colors.surface,
  },
  riskBadgeWarning: {
    color: colors.warning,
    backgroundColor: colors.surface,
  },
  riskBadgeDanger: {
    color: colors.error,
    backgroundColor: colors.surface,
  },
  reviewRequired: {
    ...typography.micro,
    color: colors.textSecondary,
    fontWeight: '700',
  },
  riskBannerTitle: {
    ...typography.label,
    color: colors.text,
  },
  riskBannerText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  metaBox: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  previewBox: {
    backgroundColor: colors.primaryMuted,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: 4,
  },
  previewTitle: {
    ...typography.label,
    color: colors.text,
    fontWeight: '700',
  },
  previewText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  previewMeta: {
    ...typography.micro,
    color: colors.textMuted,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 3,
  },
  metaLabel: {
    ...typography.caption,
    color: colors.textMuted,
    width: 44,
  },
  metaValue: {
    ...typography.caption,
    color: colors.text,
    flex: 1,
  },
  metaNormal: {
    color: colors.success,
    fontWeight: '700',
  },
  metaDanger: {
    color: colors.error,
    fontWeight: '700',
  },
  reviewBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
  },
  reviewBoxChecked: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryMuted,
  },
  checkBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    marginTop: 1,
  },
  checkBoxOn: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  checkMark: {
    ...typography.micro,
    color: colors.textInvert,
    fontWeight: '700',
  },
  reviewCopy: {
    flex: 1,
    gap: 2,
  },
  reviewTitle: {
    ...typography.label,
    color: colors.text,
  },
  reviewText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  button: {
    flex: 1,
    minHeight: 48,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  confirmButton: {
    backgroundColor: colors.primary,
  },
  dangerButton: {
    backgroundColor: colors.error,
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  cancelText: {
    ...typography.label,
    color: colors.text,
  },
  confirmText: {
    ...typography.label,
    color: colors.textInvert,
  },
  pressed: {
    opacity: 0.8,
  },
});
