export type AuthStatus =
  | 'idle'
  | 'authenticating'
  | 'two_factor'
  | 'authenticated'
  | 'error';

export interface TwoFactorApproach {
  type: 'wechat' | 'mobile' | 'totp';
  label: string;
}

export interface AuthState {
  status: AuthStatus;
  error?: string;
  twoFactorApproaches: TwoFactorApproach[];
  selectedTwoFactor?: TwoFactorApproach['type'];
}
