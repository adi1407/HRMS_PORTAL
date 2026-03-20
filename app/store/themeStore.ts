import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { Appearance } from 'react-native';

const THEME_KEY = 'hrms_app_theme';

export type AppThemeMode = 'light' | 'dark' | 'system';

type ThemeState = {
  theme: AppThemeMode;
  hydrated: boolean;
  setTheme: (theme: AppThemeMode) => Promise<void>;
  hydrate: () => Promise<void>;
};

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: 'system',
  hydrated: false,

  setTheme: async (theme: AppThemeMode) => {
    set({ theme });
    // Best-effort global app scheme for components reading native color scheme.
    Appearance.setColorScheme?.(theme === 'system' ? null : theme);
    try {
      await SecureStore.setItemAsync(THEME_KEY, theme);
    } catch {}
  },

  hydrate: async () => {
    try {
      const stored = await SecureStore.getItemAsync(THEME_KEY);
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        set({ theme: stored });
        Appearance.setColorScheme?.(stored === 'system' ? null : stored);
      }
    } catch {}
    set({ hydrated: true });
  },
}));
