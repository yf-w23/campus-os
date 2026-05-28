import {sm2} from 'sm-crypto';
import {extractElementTextById} from './htmlParse';

const SM2_PREFIX = '04';

export function encryptPassword(password: string, publicKey: string): string {
  return SM2_PREFIX + sm2.doEncrypt(password, publicKey);
}

export function extractSm2PublicKey(html: string): string | null {
  const value = extractElementTextById(html, 'sm2publicKey');
  return value || null;
}
