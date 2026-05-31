import React from 'react';
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
  const destructive =
    spec?.destructive ||
    tool?.risk === 'payment' ||
    tool?.risk === 'write_irreversible' ||
    tool?.risk === 'credential';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.eyebrow}>AI 操作确认</Text>
          <Text style={styles.title}>
            {spec?.title ?? tool?.title ?? '确认执行操作'}
          </Text>
          <Text style={styles.message}>
            {spec?.message ?? '确认后将执行该校园工具。'}
          </Text>

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
                {preview.reversible ? '可通过对应取消/撤销工具恢复' : '该操作可能不可直接撤销'}
              </Text>
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
              <Text style={styles.riskNote}>{riskNotes[tool.risk]}</Text>
            </View>
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
              style={({pressed}) => [
                styles.button,
                destructive ? styles.dangerButton : styles.confirmButton,
                pressed && styles.pressed,
              ]}>
              <Text style={styles.confirmText}>
                {spec?.confirmLabel ?? '确认执行'}
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
  riskNote: {
    ...typography.micro,
    color: colors.textMuted,
    marginTop: spacing.xs,
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
