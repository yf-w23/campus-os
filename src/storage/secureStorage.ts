import * as Keychain from 'react-native-keychain';

const SERVICE = 'com.campusos.credentials';
const AI_SERVICE = 'com.campusos.ai';

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
}

export async function clearCredentials(): Promise<void> {
  await Keychain.resetGenericPassword({service: SERVICE});
}

export async function saveAIApiKey(providerId: string, apiKey: string): Promise<void> {
  await Keychain.setGenericPassword(providerId, apiKey, {service: AI_SERVICE});
}

export async function loadAIApiKey(providerId: string): Promise<string | null> {
  const result = await Keychain.getGenericPassword({service: AI_SERVICE});
  if (!result || result.username !== providerId) {
    return null;
  }
  return result.password;
}

export async function clearAIApiKeys(): Promise<void> {
  await Keychain.resetGenericPassword({service: AI_SERVICE});
}
