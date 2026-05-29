import React, {useMemo} from 'react';
import {StyleSheet, Text, TextStyle} from 'react-native';
import Markdown from 'react-native-markdown-display';
import {colors, radii, spacing, typography} from '../../../app/theme';

interface MarkdownTextProps {
  content: string;
  streaming?: boolean;
}

/**
 * react-native-markdown-display 在解析「半截 / 异常」Markdown 时可能抛
 * `Cannot read property 'map' of undefined` 之类的渲染错误。RN release 下
 * 未捕获的渲染错误会直接拖垮整个 JS 实例（表现为闪退）。
 * 用错误边界兜底：任何 Markdown 渲染异常都退化为纯文本，绝不崩。
 */
class MarkdownErrorBoundary extends React.Component<
  {fallback: React.ReactNode; children: React.ReactNode},
  {hasError: boolean}
> {
  constructor(props: {fallback: React.ReactNode; children: React.ReactNode}) {
    super(props);
    this.state = {hasError: false};
  }

  static getDerivedStateFromError() {
    return {hasError: true};
  }

  componentDidUpdate(prevProps: {children: React.ReactNode}) {
    // 内容变化后重置，给新内容一次正常渲染的机会
    if (prevProps.children !== this.props.children && this.state.hasError) {
      this.setState({hasError: false});
    }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

export function MarkdownText({content, streaming}: MarkdownTextProps) {
  const styles = useMemo(() => createMarkdownStyles(), []);
  const display = streaming && content.length === 0 ? '…' : content;

  const plain = (
    <Text style={styles.body}>
      {display}
      {streaming ? '▍' : ''}
    </Text>
  );

  // 流式过程中 Markdown AST 经常处于不完整状态，最易触发解析崩溃；
  // 此阶段直接用纯文本，流完后再渲染完整 Markdown（仍包错误边界兜底）。
  if (streaming) {
    return plain;
  }

  return (
    <MarkdownErrorBoundary fallback={plain}>
      <Markdown style={styles} mergeStyle>
        {display}
      </Markdown>
    </MarkdownErrorBoundary>
  );
}

function createMarkdownStyles() {
  const body: TextStyle = {
    ...typography.body,
    color: colors.text,
    lineHeight: 24,
  };

  return StyleSheet.create({
    body,
    paragraph: {
      marginTop: 0,
      marginBottom: spacing.sm,
    },
    bullet_list: {
      marginBottom: spacing.sm,
    },
    ordered_list: {
      marginBottom: spacing.sm,
    },
    list_item: {
      flexDirection: 'row',
      marginBottom: 4,
    },
    bullet_list_icon: {
      color: colors.primary,
      marginRight: spacing.sm,
    },
    ordered_list_icon: {
      color: colors.primary,
      marginRight: spacing.sm,
    },
    code_inline: {
      backgroundColor: colors.surfaceAlt,
      color: colors.accentLight,
      fontFamily: 'monospace',
      fontSize: 13,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: radii.sm,
    },
    fence: {
      backgroundColor: colors.surfaceAlt,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: radii.md,
      padding: spacing.md,
      marginVertical: spacing.sm,
    },
    code_block: {
      color: colors.text,
      fontFamily: 'monospace',
      fontSize: 13,
    },
    heading1: {
      ...typography.h2,
      color: colors.text,
      marginBottom: spacing.sm,
    },
    heading2: {
      ...typography.h3,
      color: colors.text,
      marginBottom: spacing.sm,
    },
    heading3: {
      ...typography.label,
      color: colors.text,
      marginBottom: spacing.xs,
    },
    strong: {
      fontWeight: '700',
      color: colors.text,
    },
    em: {
      fontStyle: 'italic',
      color: colors.textSecondary,
    },
    link: {
      color: colors.primary,
    },
    blockquote: {
      backgroundColor: colors.primaryMuted,
      borderLeftColor: colors.primary,
      borderLeftWidth: 3,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      marginVertical: spacing.sm,
    },
    hr: {
      backgroundColor: colors.divider,
      height: StyleSheet.hairlineWidth,
      marginVertical: spacing.md,
    },
  });
}
