export interface CampusCredentials {
  studentId: string;
  password: string;
  fingerprint: string;
}

export interface CampusSession {
  isAuthenticated: boolean;
  studentId?: string;
  displayName?: string;
  authenticatedAt?: string;
  webvpnReady: boolean;
}

export type RoamTarget = 'info' | 'learn' | 'id';

export interface WebVPNConfig {
  baseUrl: string;
  oauthLoginUrl: string;
  roamingUrl: string;
  cookieSyncUrl: string;
}
