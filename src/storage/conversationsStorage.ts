import AsyncStorage from '@react-native-async-storage/async-storage';
import {Conversation} from '../domain/agent';

const KEY = '@campusos/ai_conversations';
const ACTIVE_KEY = '@campusos/ai_active_conversation';

/** 持久化上限：最多保留最近 N 个会话，避免无限增长 */
const MAX_CONVERSATIONS = 50;

export interface PersistedConversations {
  conversations: Conversation[];
  activeConversationId: string | null;
}

export async function loadConversations(): Promise<PersistedConversations> {
  try {
    const [raw, activeId] = await Promise.all([
      AsyncStorage.getItem(KEY),
      AsyncStorage.getItem(ACTIVE_KEY),
    ]);
    const conversations = raw ? (JSON.parse(raw) as Conversation[]) : [];
    // 清掉任何残留的 streaming 标记（上次异常退出时可能未清）
    for (const conv of conversations) {
      for (const message of conv.messages) {
        if (message.streaming) {
          message.streaming = false;
        }
      }
    }
    return {
      conversations,
      activeConversationId: activeId || null,
    };
  } catch {
    return {conversations: [], activeConversationId: null};
  }
}

export async function saveConversations(
  conversations: Conversation[],
  activeConversationId: string | null,
): Promise<void> {
  try {
    // 只持久化有消息的会话，丢弃空「新对话」占位
    const trimmed = conversations
      .filter(c => c.messages.length > 0)
      .slice(0, MAX_CONVERSATIONS);
    await AsyncStorage.setItem(KEY, JSON.stringify(trimmed));
    if (activeConversationId) {
      await AsyncStorage.setItem(ACTIVE_KEY, activeConversationId);
    } else {
      await AsyncStorage.removeItem(ACTIVE_KEY);
    }
  } catch {
    // 持久化失败不致命：下次再存
  }
}
