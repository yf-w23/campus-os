import {NativeModules, Platform} from 'react-native';
import {
  clearMailClientSecret,
  loadMailClientSecret,
  MailClientSecret,
  saveMailClientSecret,
} from '../../storage/secureStorage';
import {
  ComposeDraft,
  MAIL_FOLDERS,
  MailAttachment,
  MailFolder,
  MailMessageDetail,
  MailMessageSummary,
} from './mail';

type NativeMailModule = {
  testConnection(config: MailClientSecret): Promise<{ok: boolean}>;
  listFolders(config: MailClientSecret): Promise<NativeFolder[]>;
  listMessages(
    config: MailClientSecret,
    folderName: string,
    limit: number,
  ): Promise<{total: number; messages: NativeSummary[]}>;
  readMessage(
    config: MailClientSecret,
    folderName: string,
    uid: string,
  ): Promise<NativeDetail>;
  setFlag(
    config: MailClientSecret,
    folderName: string,
    uid: string,
    flag: 'seen' | 'flagged' | 'deleted',
    value: boolean,
  ): Promise<{ok: boolean}>;
  moveMessage(
    config: MailClientSecret,
    fromFolderName: string,
    uid: string,
    toFolderName: string,
  ): Promise<{ok: boolean}>;
  downloadAttachment(
    config: MailClientSecret,
    folderName: string,
    uid: string,
    partId: string,
  ): Promise<{path: string; uri: string; name: string; size: number}>;
  sendMessage(
    config: MailClientSecret,
    draft: ComposeDraft,
  ): Promise<{ok: boolean}>;
};

interface NativeFolder {
  name: string;
  fullName: string;
  separator: string;
}

interface NativeContact {
  name?: string;
  address?: string;
}

interface NativeSummary {
  id: string;
  folderName: string;
  subject: string;
  from?: NativeContact[];
  to?: NativeContact[];
  dateMs?: number;
  unread?: boolean;
  flagged?: boolean;
  hasAttachment?: boolean;
  brief?: string;
}

interface NativeDetail extends NativeSummary {
  cc?: NativeContact[];
  contentText?: string;
  contentHtml?: string;
  attachments?: Array<
    MailAttachment & {mimeType?: string; inline?: boolean; contentId?: string}
  >;
  inlineImages?: Record<string, string>;
}

export interface MailFolderBinding extends MailFolder {
  folderName: string;
}

export interface NativeMailStatus {
  configured: boolean;
  username?: string;
}

const NativeMail = NativeModules.NativeMail as NativeMailModule | undefined;

export async function getNativeMailStatus(): Promise<NativeMailStatus> {
  const config = await loadMailClientSecret();
  return {configured: Boolean(config), username: config?.username};
}

export async function saveNativeMailConfig(secret: Partial<MailClientSecret>) {
  const username = String(secret.username || '').trim();
  const password = String(secret.password || '');
  if (!username || !password) {
    throw new Error('请填写邮箱账号和客户端专用密码');
  }
  const full: MailClientSecret = {
    username,
    password,
    imapHost: secret.imapHost || 'mails.tsinghua.edu.cn',
    imapPort: Number(secret.imapPort || 993),
    smtpHost: secret.smtpHost || 'mails.tsinghua.edu.cn',
    smtpPort: Number(secret.smtpPort || 465),
  };
  await requireNative().testConnection(full);
  await saveMailClientSecret(full);
}

export async function clearNativeMailConfig() {
  await clearMailClientSecret();
}

export async function listNativeMailFolders(): Promise<MailFolderBinding[]> {
  const config = await requireConfig();
  const folders = await requireNative().listFolders(config);
  return MAIL_FOLDERS.map(folder => ({
    ...folder,
    folderName: resolveFolderName(folder, folders),
  }));
}

export async function listNativeMailMessages(
  folder: MailFolderBinding,
  query = '',
  limit = 50,
): Promise<{messages: MailMessageSummary[]; total: number}> {
  const config = await requireConfig();
  const result = await requireNative().listMessages(
    config,
    folder.folderName,
    limit,
  );
  const needle = query.trim().toLowerCase();
  const messages = result.messages
    .map(raw => ({...toSummary(raw), fid: folder.id}))
    .filter(message => {
      if (!needle) {
        return true;
      }
      return `${message.subject} ${message.brief} ${message.from
        .map(contact => `${contact.name} ${contact.address}`)
        .join(' ')}`
        .toLowerCase()
        .includes(needle);
    });
  return {messages, total: result.total};
}

export async function readNativeMailMessage(
  folderName: string,
  id: string,
): Promise<MailMessageDetail & {inlineImages?: Record<string, string>}> {
  const config = await requireConfig();
  const detail = await requireNative().readMessage(config, folderName, id);
  return toDetail(detail);
}

export async function markNativeMailRead(
  folderName: string,
  id: string,
  read: boolean,
) {
  const config = await requireConfig();
  await requireNative().setFlag(config, folderName, id, 'seen', read);
}

export async function deleteNativeMailMessage(folderName: string, id: string) {
  const config = await requireConfig();
  await requireNative().setFlag(config, folderName, id, 'deleted', true);
}

export async function moveNativeMailMessage(
  fromFolderName: string,
  id: string,
  toFolderName: string,
) {
  const config = await requireConfig();
  await requireNative().moveMessage(config, fromFolderName, id, toFolderName);
}

export async function downloadNativeMailAttachment(
  folderName: string,
  id: string,
  partId: string,
) {
  const config = await requireConfig();
  return requireNative().downloadAttachment(config, folderName, id, partId);
}

export async function sendNativeMailMessage(draft: ComposeDraft) {
  const config = await requireConfig();
  await requireNative().sendMessage(config, draft);
}

function requireNative(): NativeMailModule {
  if (Platform.OS !== 'android' || !NativeMail) {
    throw new Error('当前平台暂不支持原生 IMAP/SMTP 邮箱');
  }
  return NativeMail;
}

async function requireConfig(): Promise<MailClientSecret> {
  const config = await loadMailClientSecret();
  if (!config) {
    throw new Error('请先配置清华邮箱客户端专用密码');
  }
  return config;
}

function resolveFolderName(
  folder: MailFolder,
  folders: NativeFolder[],
): string {
  const names = folders.map(item => item.fullName || item.name);
  const lowered = names.map(name => name.toLowerCase());
  const exact = (candidates: string[]) => {
    for (const candidate of candidates) {
      const index = lowered.indexOf(candidate.toLowerCase());
      if (index >= 0) {
        return names[index];
      }
    }
    return '';
  };
  const fuzzy = (keywords: string[]) => {
    const index = lowered.findIndex(name =>
      keywords.some(keyword => name.includes(keyword.toLowerCase())),
    );
    return index >= 0 ? names[index] : '';
  };
  switch (folder.system) {
    case 'inbox':
      return exact(['INBOX', '收件箱']) || names[0] || 'INBOX';
    case 'drafts':
      return (
        exact(['Drafts', '草稿箱']) || fuzzy(['draft', '草稿']) || 'Drafts'
      );
    case 'sent':
      return (
        exact(['Sent', 'Sent Messages', '已发送', '已发送邮件']) ||
        fuzzy(['sent', '已发送']) ||
        'Sent'
      );
    case 'deleted':
      return (
        exact(['Trash', 'Deleted Messages', '已删除', '已删除邮件']) ||
        fuzzy(['trash', 'deleted', '已删除']) ||
        'Trash'
      );
    case 'junk':
      return (
        exact(['Junk', 'Spam', '垃圾邮件']) ||
        fuzzy(['junk', 'spam', '垃圾']) ||
        'Junk'
      );
    default:
      return folder.name;
  }
}

function toSummary(raw: NativeSummary): MailMessageSummary {
  return {
    id: raw.id,
    fid: 0,
    from: normalizeContacts(raw.from),
    to: normalizeContacts(raw.to),
    subject: raw.subject || '(无主题)',
    date: raw.dateMs ? new Date(raw.dateMs).toISOString() : '',
    unread: Boolean(raw.unread),
    flagged: Boolean(raw.flagged),
    hasAttachment: Boolean(raw.hasAttachment),
    brief: raw.brief || '',
  };
}

function toDetail(
  raw: NativeDetail,
): MailMessageDetail & {inlineImages?: Record<string, string>} {
  return {
    ...toSummary(raw),
    cc: normalizeContacts(raw.cc),
    contentText: raw.contentText || '',
    contentHtml: raw.contentHtml || '',
    attachments: raw.attachments ?? [],
    inlineImages: raw.inlineImages ?? {},
  };
}

function normalizeContacts(list?: NativeContact[]) {
  return (list ?? [])
    .map(item => ({
      name: String(item.name || '').trim(),
      address: String(item.address || '').trim(),
    }))
    .filter(item => item.name || item.address);
}
