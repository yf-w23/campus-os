import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {
  AgentUIAction,
  AgentUIBlock,
  AgentUITaskPlanItem,
} from '../../domain/agentUi';
import {colors, radii, spacing, typography} from '../../app/theme';

interface AgentUIRendererProps {
  blocks: AgentUIBlock[];
  onAction?: (action: AgentUIAction) => void;
}

function formatNumber(value: number | undefined, digits = 0): string {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '--';
  }
  return value.toFixed(digits);
}

function toneColor(tone?: 'default' | 'success' | 'warning' | 'error'): string {
  if (tone === 'success') {
    return colors.success;
  }
  if (tone === 'warning') {
    return colors.warning;
  }
  if (tone === 'error') {
    return colors.error;
  }
  return colors.primary;
}

function ActionRow({
  actions,
  onAction,
}: {
  actions?: AgentUIAction[];
  onAction?: (action: AgentUIAction) => void;
}) {
  if (!actions?.length) {
    return null;
  }
  return (
    <View style={styles.actionRow}>
      {actions.map(action => (
        <Pressable
          key={action.id}
          onPress={() => onAction?.(action)}
          style={({pressed}) => [
            styles.actionButton,
            pressed && styles.actionButtonPressed,
          ]}>
          <Text style={styles.actionLabel} numberOfLines={1}>
            {action.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function BlockShell({
  block,
  children,
}: {
  block: AgentUIBlock;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.block}>
      <View style={styles.blockHeader}>
        <View style={styles.blockTitleWrap}>
          <Text style={styles.blockTitle}>{block.title}</Text>
          {block.subtitle ? (
            <Text style={styles.blockSubtitle}>{block.subtitle}</Text>
          ) : null}
        </View>
      </View>
      {children}
    </View>
  );
}

function BriefingBlock({
  block,
  onAction,
}: {
  block: Extract<AgentUIBlock, {type: 'briefing'}>;
  onAction?: (action: AgentUIAction) => void;
}) {
  return (
    <BlockShell block={block}>
      <Text style={styles.summary}>{block.summary}</Text>
      <View style={styles.metricRow}>
        {block.metrics.map(metric => (
          <View key={metric.label} style={styles.metric}>
            <Text style={[styles.metricValue, {color: toneColor(metric.tone)}]}>
              {metric.value}
            </Text>
            <Text style={styles.metricLabel}>{metric.label}</Text>
          </View>
        ))}
      </View>
      <ActionRow actions={block.actions} onAction={onAction} />
    </BlockShell>
  );
}

function WeatherDetail({label, value}: {label: string; value: string}) {
  return (
    <View style={styles.weatherPill}>
      <Text style={styles.weatherPillLabel}>{label}</Text>
      <Text style={styles.weatherPillValue}>{value}</Text>
    </View>
  );
}

function WeatherBlock({
  block,
  onAction,
}: {
  block: Extract<AgentUIBlock, {type: 'weather'}>;
  onAction?: (action: AgentUIAction) => void;
}) {
  const tempLabel =
    typeof block.temperature === 'number'
      ? `${formatNumber(block.temperature)}°`
      : block.loading
      ? '--'
      : '--';
  const rangeLabel =
    typeof block.temperatureMin === 'number' ||
    typeof block.temperatureMax === 'number'
      ? `${formatNumber(block.temperatureMin)}°/${formatNumber(
          block.temperatureMax,
        )}°`
      : undefined;

  return (
    <BlockShell block={block}>
      <View style={styles.weatherTop}>
        <View style={styles.weatherMain}>
          <Text style={styles.weatherTemp}>{tempLabel}</Text>
          <View style={styles.weatherCopy}>
            <Text style={styles.weatherCondition}>{block.condition}</Text>
            <Text style={styles.weatherLocation}>{block.location}</Text>
          </View>
        </View>
        {rangeLabel ? (
          <Text style={styles.weatherRange}>{rangeLabel}</Text>
        ) : null}
      </View>
      <View style={styles.weatherGrid}>
        {typeof block.precipitationProbability === 'number' ? (
          <WeatherDetail
            label={block.labels?.precipitation ?? 'Rain'}
            value={`${formatNumber(block.precipitationProbability)}%`}
          />
        ) : null}
        {typeof block.uvIndex === 'number' ? (
          <WeatherDetail
            label={block.labels?.uv ?? 'UV'}
            value={formatNumber(block.uvIndex, 1)}
          />
        ) : null}
        {typeof block.windSpeed === 'number' ? (
          <WeatherDetail
            label={block.labels?.wind ?? 'Wind'}
            value={`${formatNumber(block.windSpeed)} km/h`}
          />
        ) : null}
        {typeof block.humidity === 'number' ? (
          <WeatherDetail
            label={block.labels?.humidity ?? 'Humidity'}
            value={`${formatNumber(block.humidity)}%`}
          />
        ) : null}
      </View>
      <View style={styles.adviceList}>
        {block.advice.map((item, index) => (
          <View key={`${block.id}-advice-${index}`} style={styles.adviceRow}>
            <View style={styles.adviceDot} />
            <Text style={styles.adviceText}>{item}</Text>
          </View>
        ))}
      </View>
      {block.source ? (
        <Text style={styles.sourceText}>
          {block.updatedAt
            ? `${block.source} · ${block.updatedAt}`
            : block.source}
        </Text>
      ) : null}
      <ActionRow actions={block.actions} onAction={onAction} />
    </BlockShell>
  );
}

function TaskItem({
  item,
  onAction,
}: {
  item: AgentUITaskPlanItem;
  onAction?: (action: AgentUIAction) => void;
}) {
  const content = (
    <View style={styles.taskItem}>
      <View style={[styles.taskDot, {backgroundColor: toneColor(item.tone)}]} />
      <View style={styles.taskCopy}>
        <Text style={styles.taskTitle}>{item.title}</Text>
        {item.detail ? (
          <Text style={styles.taskDetail}>{item.detail}</Text>
        ) : null}
      </View>
      {item.action ? (
        <Text style={styles.taskAction}>{item.action.label}</Text>
      ) : null}
    </View>
  );

  if (!item.action) {
    return content;
  }
  return (
    <Pressable
      onPress={() => onAction?.(item.action!)}
      style={({pressed}) => pressed && styles.taskPressed}>
      {content}
    </Pressable>
  );
}

function TaskPlanBlock({
  block,
  onAction,
}: {
  block: Extract<AgentUIBlock, {type: 'task_plan'}>;
  onAction?: (action: AgentUIAction) => void;
}) {
  return (
    <BlockShell block={block}>
      <View style={styles.taskList}>
        {block.items.map(item => (
          <TaskItem key={item.id} item={item} onAction={onAction} />
        ))}
      </View>
      <ActionRow actions={block.actions} onAction={onAction} />
    </BlockShell>
  );
}

export function AgentUIRenderer({blocks, onAction}: AgentUIRendererProps) {
  return (
    <View style={styles.wrap}>
      {blocks.map(block => {
        if (block.type === 'briefing') {
          return (
            <BriefingBlock key={block.id} block={block} onAction={onAction} />
          );
        }
        if (block.type === 'weather') {
          return (
            <WeatherBlock key={block.id} block={block} onAction={onAction} />
          );
        }
        return (
          <TaskPlanBlock key={block.id} block={block} onAction={onAction} />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
  },
  block: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: spacing.md,
    gap: spacing.sm,
  },
  blockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  blockTitleWrap: {
    flex: 1,
    gap: 2,
  },
  blockTitle: {
    ...typography.h3,
    color: colors.text,
  },
  blockSubtitle: {
    ...typography.caption,
    color: colors.textMuted,
  },
  summary: {
    ...typography.body,
    color: colors.textSecondary,
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  metric: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    gap: 2,
  },
  metricValue: {
    ...typography.h2,
    fontVariant: ['tabular-nums'],
  },
  metricLabel: {
    ...typography.micro,
    color: colors.textMuted,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  actionButton: {
    backgroundColor: colors.primaryMuted,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  actionButtonPressed: {
    opacity: 0.72,
  },
  actionLabel: {
    ...typography.label,
    color: colors.primary,
  },
  weatherTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  weatherMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  weatherTemp: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '700',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  weatherCopy: {
    flex: 1,
    gap: 2,
  },
  weatherCondition: {
    ...typography.label,
    color: colors.text,
  },
  weatherLocation: {
    ...typography.caption,
    color: colors.textMuted,
  },
  weatherRange: {
    ...typography.caption,
    color: colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  weatherGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  weatherPill: {
    minWidth: 68,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    gap: 1,
  },
  weatherPillLabel: {
    ...typography.micro,
    color: colors.textMuted,
  },
  weatherPillValue: {
    ...typography.caption,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  adviceList: {
    gap: spacing.xs,
  },
  adviceRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  adviceDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
    marginTop: 7,
  },
  adviceText: {
    ...typography.caption,
    color: colors.textSecondary,
    flex: 1,
  },
  sourceText: {
    ...typography.micro,
    color: colors.textMuted,
  },
  taskList: {
    gap: spacing.xs,
  },
  taskPressed: {
    opacity: 0.72,
  },
  taskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  taskDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  taskCopy: {
    flex: 1,
    gap: 2,
  },
  taskTitle: {
    ...typography.body,
    color: colors.text,
    fontWeight: '500',
  },
  taskDetail: {
    ...typography.caption,
    color: colors.textMuted,
  },
  taskAction: {
    ...typography.micro,
    color: colors.primary,
    fontWeight: '700',
  },
});
