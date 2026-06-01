import AsyncStorage from '@react-native-async-storage/async-storage';
import {AuditRecord} from '../domain/actions';

const KEY = '@campusos/action_audit_records';
const MAX_RECORDS = 200;
const MAX_STRING_LENGTH = 500;
const MAX_ARRAY_LENGTH = 20;
const MAX_DEPTH = 5;

const SENSITIVE_KEY_PATTERN =
  /(password|passwd|pwd|secret|token|cookie|captcha|verification|api.?key|credential|fingerprint|trade.?password|transaction.?password|phone|mobile|email|student.?id|owner.?id|user.?id|member.*id|idserial|card.?id|account|acc.?no|identity|idcard|mac|ip4|ip6)/i;

function makeAuditId(): string {
  return `audit_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function maskString(value: string): string {
  if (value === undefined || value === null) {
    return '[REDACTED]';
  }
  if (value.length === 0) {
    return '';
  }
  if (/^\d{11}$/.test(value)) {
    return `${value.slice(0, 3)}****${value.slice(-4)}`;
  }
  if (value.length <= 4) {
    return '[REDACTED]';
  }
  return `${value.slice(0, 2)}***${value.slice(-2)}`;
}

function truncateString(value: string): string {
  if (value.length <= MAX_STRING_LENGTH) {
    return value;
  }
  return `${value.slice(0, MAX_STRING_LENGTH)}...`;
}

export function sanitizeAuditValue(
  value: unknown,
  keyHint = '',
  depth = 0,
  visited: WeakSet<object> = new WeakSet(),
): unknown {
  if (SENSITIVE_KEY_PATTERN.test(keyHint)) {
    return typeof value === 'string' ? maskString(value) : '[REDACTED]';
  }
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof value === 'string') {
    return truncateString(value);
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (depth >= MAX_DEPTH) {
    return '[TRUNCATED]';
  }
  if (Array.isArray(value)) {
    if (visited.has(value)) {
      return '[CIRCULAR]';
    }
    visited.add(value);
    const items = value
      .slice(0, MAX_ARRAY_LENGTH)
      .map(item => sanitizeAuditValue(item, keyHint, depth + 1, visited));
    if (value.length > MAX_ARRAY_LENGTH) {
      items.push(`[${value.length - MAX_ARRAY_LENGTH} more items]`);
    }
    return items;
  }
  if (typeof value === 'object') {
    if (visited.has(value)) {
      return '[CIRCULAR]';
    }
    visited.add(value);
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      out[key] = sanitizeAuditValue(item, key, depth + 1, visited);
    }
    return out;
  }
  return String(value);
}

function normalizeRecord(record: AuditRecord): AuditRecord {
  return {
    ...record,
    params: sanitizeAuditValue(record.params),
    preview: sanitizeAuditValue(record.preview) as AuditRecord['preview'],
  };
}

export async function loadActionAuditRecords(): Promise<AuditRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as AuditRecord[]) : [];
  } catch {
    return [];
  }
}

export async function appendActionAuditRecord(
  record: Omit<AuditRecord, 'id' | 'createdAt'> &
    Partial<Pick<AuditRecord, 'id' | 'createdAt'>>,
): Promise<AuditRecord> {
  const next = normalizeRecord({
    ...record,
    id: record.id ?? makeAuditId(),
    createdAt: record.createdAt ?? new Date().toISOString(),
  });
  const records = await loadActionAuditRecords();
  await AsyncStorage.setItem(
    KEY,
    JSON.stringify([next, ...records].slice(0, MAX_RECORDS)),
  );
  return next;
}

export async function clearActionAuditRecords(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}
