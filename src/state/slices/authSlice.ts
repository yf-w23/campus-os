import {createSlice, PayloadAction} from '@reduxjs/toolkit';
import {CampusSession} from '../../domain/campus';
import {AuthStatus, TwoFactorApproach} from '../../domain/session';

interface AuthSliceState {
  status: AuthStatus;
  session: CampusSession;
  error?: string;
  twoFactorApproaches: TwoFactorApproach[];
  twoFactorHint?: string;
  selectedTwoFactor?: TwoFactorApproach['type'];
  demoMode: boolean;
}

const initialState: AuthSliceState = {
  status: 'idle',
  session: {isAuthenticated: false, webvpnReady: false},
  twoFactorApproaches: [],
  demoMode: false,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setAuthenticating(state) {
      state.status = 'authenticating';
      state.error = undefined;
    },
    setAuthenticated(state, action: PayloadAction<CampusSession>) {
      state.status = 'authenticated';
      state.session = action.payload;
      state.demoMode = false;
      state.error = undefined;
    },
    setTwoFactor(
      state,
      action: PayloadAction<{
        approaches: TwoFactorApproach[];
        studentId: string;
        hint?: string;
      }>,
    ) {
      state.status = 'two_factor';
      state.error = undefined;
      state.twoFactorApproaches = action.payload.approaches;
      state.twoFactorHint = action.payload.hint;
      state.session = {
        isAuthenticated: false,
        webvpnReady: false,
        studentId: action.payload.studentId,
      };
    },
    setSelectedTwoFactor(state, action: PayloadAction<TwoFactorApproach['type']>) {
      state.selectedTwoFactor = action.payload;
    },
    setAuthError(state, action: PayloadAction<string>) {
      state.status = 'error';
      state.error = action.payload;
    },
    setDemoMode(state, action: PayloadAction<boolean>) {
      state.demoMode = action.payload;
      if (action.payload) {
        state.status = 'authenticated';
        state.session = {
          isAuthenticated: true,
          displayName: '演示用户',
          webvpnReady: false,
          authenticatedAt: new Date().toISOString(),
        };
      } else {
        state.status = 'idle';
        state.session = {isAuthenticated: false, webvpnReady: false};
      }
    },
    logout(state) {
      state.status = 'idle';
      state.session = {isAuthenticated: false, webvpnReady: false};
      state.demoMode = false;
      state.twoFactorApproaches = [];
      state.twoFactorHint = undefined;
      state.selectedTwoFactor = undefined;
      state.error = undefined;
    },
  },
});

export const {
  setAuthenticating,
  setAuthenticated,
  setTwoFactor,
  setSelectedTwoFactor,
  setAuthError,
  setDemoMode,
  logout,
} = authSlice.actions;

export default authSlice.reducer;
