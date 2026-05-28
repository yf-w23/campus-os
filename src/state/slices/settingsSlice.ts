import {createSlice, PayloadAction} from '@reduxjs/toolkit';

interface SettingsSliceState {
  locale: 'zh' | 'en';
  trustDevice: boolean;
  aiApiKeyConfigured: boolean;
}

const initialState: SettingsSliceState = {
  locale: 'zh',
  trustDevice: true,
  aiApiKeyConfigured: false,
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
  },
});

export const {setLocale, setTrustDevice, setAIApiKeyConfigured} =
  settingsSlice.actions;

export default settingsSlice.reducer;
