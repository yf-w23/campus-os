import React, {useCallback, useMemo, useState} from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useFocusEffect} from '@react-navigation/native';
import {RootStackParamList} from '../../app/navigation/types';
import {colors, radii, spacing, typography} from '../../app/theme';
import {AGENT_TOOLS} from '../../services/ai/tools';
import {
  loadDisabledAIPermissions,
  saveDisabledAIPermissions,
  setAIPermissionEnabled,
} from '../../storage/aiPermissionsStorage';
import {DetailHeader, Badge} from '../common/components/Ui';
import {ToolRisk} from '../../domain/actions';

type Props = NativeStackScreenProps<RootStackParamList, 'AIPermissions'>;

interface PermissionGroup {
  permission: string;
  title: string;
  risk: ToolRisk;
  requiresConfirmation: boolean;
  tools: typeof AGENT_TOOLS;
}

const riskOrder: Record<ToolRisk, number> = {
  read: 0,
  write_reversible: 1,
  write_irreversible: 2,
  payment: 3,
  credential: 4,
};

function riskLabel(risk: ToolRisk): string {
  switch (risk) {
    case 'read':
      return '只读';
    case 'write_reversible':
      return '可撤销写入';
    case 'write_irreversible':
      return '高风险写入';
    case 'payment':
      return '支付';
    case 'credential':
      return '凭证';
  }
}

function riskTone(risk: ToolRisk): 'default' | 'success' | 'warning' | 'error' {
  if (risk === 'read') {
    return 'success';
  }
  if (risk === 'write_reversible') {
    return 'warning';
  }
  return 'error';
}

function permissionTitle(permission: string, tools: typeof AGENT_TOOLS): string {
  const domain = permission.split('.').slice(0, -1).join('.');
  const firstTitle = tools[0]?.title ?? permission;
  switch (domain) {
    case 'campus.news':
      return '校园新闻';
    case 'campus.mail':
      return '清华邮箱';
    case 'campus.course':
      return '选课系统';
    case 'campus.card':
      return '校园卡';
    case 'campus.network':
      return '校园网';
    case 'campus.library':
      return '图书馆';
    case 'campus.libraryRoom':
      return '研读间';
    case 'campus.sports':
      return '体育场馆';
    case 'campus.weather':
      return '海淀天气';
    case 'learning.homework':
      return '作业与 DDL';
    case 'learning.deadline':
      return '自建 DDL';
    case 'schedule.personal':
      return '个人备忘';
    case 'schedule':
      return '课表';
    case 'ai.memory':
      return 'AI 记忆';
    default:
      return firstTitle;
  }
}

function buildGroups(): PermissionGroup[] {
  const map = new Map<string, typeof AGENT_TOOLS>();
  for (const tool of AGENT_TOOLS) {
    const list = map.get(tool.permission) ?? [];
    list.push(tool);
    map.set(tool.permission, list);
  }
  return Array.from(map.entries())
    .map(([permission, tools]) => {
      const risk = tools.reduce<ToolRisk>(
        (max, tool) =>
          riskOrder[tool.risk] > riskOrder[max] ? tool.risk : max,
        tools[0].risk,
      );
      return {
        permission,
        title: permissionTitle(permission, tools),
        risk,
        requiresConfirmation: tools.some(tool => tool.requiresConfirmation),
        tools,
      };
    })
    .sort((a, b) => {
      const rc = riskOrder[a.risk] - riskOrder[b.risk];
      if (rc !== 0) {
        return rc;
      }
      return a.title.localeCompare(b.title);
    });
}

export function AIPermissionsScreen({navigation}: Props) {
  const [disabled, setDisabled] = useState<string[]>([]);
  const groups = useMemo(buildGroups, []);
  const disabledSet = useMemo(() => new Set(disabled), [disabled]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      loadDisabledAIPermissions().then(keys => {
        if (active) {
          setDisabled(keys);
        }
      });
      return () => {
        active = false;
      };
    }, []),
  );

  const toggle = async (permission: string, enabled: boolean) => {
    const next = await setAIPermissionEnabled(permission, enabled);
    setDisabled(next);
  };

  const enabledCount = groups.filter(group => !disabledSet.has(group.permission)).length;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <DetailHeader title="AI 权限" onBack={navigation.goBack} />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <Text style={styles.summary}>
          已启用 {enabledCount}/{groups.length} 类能力。关闭某类权限后，AI
          不会再收到对应工具，也无法调用该类校园能力。
        </Text>
        <View style={styles.groupList}>
          {groups.map((group, index) => {
            const enabled = !disabledSet.has(group.permission);
            return (
              <View
                key={group.permission}
                style={[styles.row, index > 0 && styles.rowDivider]}>
                <View style={styles.rowBody}>
                  <View style={styles.rowTop}>
                    <Text style={styles.rowTitle}>{group.title}</Text>
                    <Badge label={riskLabel(group.risk)} tone={riskTone(group.risk)} />
                  </View>
                  <Text style={styles.permission}>{group.permission}</Text>
                  <Text style={styles.desc}>
                    {group.tools.map(tool => tool.title).join('、')}
                  </Text>
                  {group.requiresConfirmation ? (
                    <Text style={styles.confirmNote}>写操作会继续要求二次确认</Text>
                  ) : null}
                </View>
                <Switch
                  value={enabled}
                  onValueChange={value => toggle(group.permission, value)}
                  trackColor={{false: colors.surfaceAlt, true: colors.primary}}
                  thumbColor={colors.text}
                />
              </View>
            );
          })}
        </View>
        <Pressable
          onPress={async () => {
            await saveDisabledAIPermissions([]);
            setDisabled([]);
          }}
          style={({pressed}) => [styles.reset, pressed && styles.pressed]}>
          <Text style={styles.resetText}>恢复全部权限</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background},
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  summary: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  groupList: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  rowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  rowBody: {flex: 1, gap: 4},
  rowTop: {flexDirection: 'row', alignItems: 'center', gap: spacing.sm},
  rowTitle: {...typography.body, color: colors.text, fontWeight: '600', flex: 1},
  permission: {...typography.micro, color: colors.textMuted},
  desc: {...typography.caption, color: colors.textSecondary},
  confirmNote: {...typography.micro, color: colors.warning, fontWeight: '600'},
  reset: {
    marginTop: spacing.md,
    minHeight: 48,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {opacity: 0.72},
  resetText: {...typography.label, color: colors.primary},
});
