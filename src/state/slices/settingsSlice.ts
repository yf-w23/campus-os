import {createSlice, PayloadAction} from '@reduxjs/toolkit';
import type {ColorScheme} from '../../app/theme';

interface SettingsSliceState {
  locale: 'zh' | 'en';
  trustDevice: boolean;
  aiApiKeyConfigured: boolean;
  colorScheme: ColorScheme;
}

const initialState: SettingsSliceState = {
  locale: 'zh',
  trustDevice: true,
  aiApiKeyConfigured: false,
  colorScheme: 'light',
};

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    setLocale(state, action: PayloadAction<'zh' | 'en'>) {
      state.locale = action.payload;
    },
    setTrustDevice(state, action: PayloadAction<boolean>) {
      state.trustDevice = action.payload;
    },
    setAIApiKeyConfigured(state, action: PayloadAction<boolean>) {
      state.aiApiKeyConfigured = action.payload;
    },
    setColorScheme(state, action: PayloadAction<ColorScheme>) {
      state.colorScheme = action.payload;
    },
  },
});

export const {
  setLocale,
  setTrustDevice,
  setAIApiKeyConfigured,
  setColorScheme,
} = settingsSlice.actions;

export default settingsSlice.reducer;
