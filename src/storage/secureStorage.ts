import * as Keychain from 'react-native-keychain';

const SERVICE = 'com.campusos.credentials';
const AI_SERVICE = 'com.campusos.ai';
const MAIL_SERVICE = 'com.campusos.mail.client';

export async function saveCredentials(
  studentId: string,
  password: string,
  fingerprint: string,
): Promise<void> {
  await Keychain.setGenericPassword(
    studentId,
    JSON.stringify({password, fingerprint}),
    {service: SERVICE},
  );
}

export async function loadCredentials(): Promise<{
  studentId: string;
  password: string;
  fingerprint: string;
} | null> {
  try {
    const result = await Keychain.getGenericPassword({service: SERVICE});
    if (!result) {
      return null;
    }
    const parsed = JSON.parse(result.password) as {
      password: string;
      fingerprint: string;
    };
    return {
      studentId: result.username,
      password: parsed.password,
      fingerprint: parsed.fingerprint,
    };
  } catch {
    return null;
  }
}

export async function clearCredentials(): Promise<void> {
  await Keychain.resetGenericPassword({service: SERVICE});
}

export async function saveAIApiKey(
  providerId: string,
  apiKey: string,
): Promise<void> {
  await Keychain.setGenericPassword(providerId, apiKey, {
    service: `${AI_SERVICE}.${providerId}`,
  });
}

export async function loadAIApiKey(providerId: string): Promise<string | null> {
  try {
    const result = await Keychain.getGenericPassword({
      service: `${AI_SERVICE}.${providerId}`,
    });
    if (!result) {
      return null;
    }
    return result.password;
  } catch {
    return null;
  }
}

export async function clearAIApiKeys(): Promise<void> {
  try {
    await Keychain.resetGenericPassword({service: `${AI_SERVICE}.openai`});
    await Keychain.resetGenericPassword({service: `${AI_SERVICE}.deepseek`});
    await Keychain.resetGenericPassword({service: `${AI_SERVICE}.qwen`});
    await Keychain.resetGenericPassword({service: `${AI_SERVICE}.moonshot`});
    await Keychain.resetGenericPassword({service: `${AI_SERVICE}.custom`});
  } catch {
    // best-effort
  }
}

export interface MailClientSecret {
  username: string;
  password: string;
  imapHost: string;
  imapPort: number;
  smtpHost: string;
  smtpPort: number;
}

export async function saveMailClientSecret(
  secret: MailClientSecret,
): Promise<void> {
  await Keychain.setGenericPassword(secret.username, JSON.stringify(secret), {
    service: MAIL_SERVICE,
  });
}

export async function loadMailClientSecret(): Promise<MailClientSecret | null> {
  try {
    const result = await Keychain.getGenericPassword({service: MAIL_SERVICE});
    if (!result) {
      return null;
    }
    const parsed = JSON.parse(result.password) as MailClientSecret;
    return {
      username: parsed.username || result.username,
      password: parsed.password,
      imapHost: parsed.imapHost || 'mails.tsinghua.edu.cn',
      imapPort: Number(parsed.imapPort || 993),
      smtpHost: parsed.smtpHost || 'mails.tsinghua.edu.cn',
      smtpPort: Number(parsed.smtpPort || 465),
    };
  } catch {
    return null;
  }
}

export async function clearMailClientSecret(): Promise<void> {
  await Keychain.resetGenericPassword({service: MAIL_SERVICE});
}
