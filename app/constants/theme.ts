/**
 * Apple-inspired design system: SF-style typography, system colors, generous spacing.
 * Light/Dark aligned with iOS semantics.
 */

import { Appearance, Platform } from 'react-native';
import { useThemeStore } from '@/store/themeStore';

// Brand purple (matches app logo)
const tintLight = '#6366f1';
const tintDark = '#6366f1';

export const Colors = {
  light: {
    text: '#1C1C1E',
    textSecondary: '#3C3C43',
    textTertiary: '#8E8E93',
    background: '#F2F2F7',
    backgroundElevated: '#FFFFFF',
    tint: tintLight,
    icon: '#8E8E93',
    tabIconDefault: '#8E8E93',
    tabIconSelected: tintLight,
    separator: 'rgba(60,60,67,0.12)',
    card: '#FFFFFF',
    label: '#3C3C43',
    fill: 'rgba(120,120,128,0.2)',
    destructive: '#FF3B30',
    success: '#34C759',
    warning: '#FF9500',
  },
  dark: {
    text: '#FFFFFF',
    textSecondary: '#EBEBF5',
    textTertiary: '#8E8E93',
    background: '#000000',
    backgroundElevated: '#1C1C1E',
    tint: tintDark,
    icon: '#8E8E93',
    tabIconDefault: '#8E8E93',
    tabIconSelected: tintDark,
    separator: 'rgba(84,84,88,0.65)',
    card: '#1C1C1E',
    label: '#EBEBF5',
    fill: 'rgba(120,120,128,0.36)',
    destructive: '#FF453A',
    success: '#32D74B',
    warning: '#FF9F0A',
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  section: 32,
} as const;

export const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999,
} as const;

/** Theme-aware app colors. Use with useAppColors() or pass resolved 'light' | 'dark'. */
export function getAppColors(mode: 'light' | 'dark') {
  const c = Colors[mode];
  return {
    background: c.background,
    card: c.card,
    text: c.text,
    textSecondary: c.textSecondary,
    tint: c.tint,
    success: c.success,
    danger: c.destructive,
    warning: c.warning,
    destructive: c.destructive,
  };
}

export type AppColorsType = ReturnType<typeof getAppColors>;

/** Resolves current light/dark from user preference + system (same as useAppTheme). */
export function resolveThemeMode(): 'light' | 'dark' {
  const pref = useThemeStore.getState().theme;
  if (pref === 'system') {
    return Appearance.getColorScheme() === 'dark' ? 'dark' : 'light';
  }
  return pref;
}

/** Always matches the current theme (unlike the old frozen AppColors snapshot). */
export function getAppColorsSync(): AppColorsType {
  return getAppColors(resolveThemeMode());
}

/**
 * Legacy: reads resolve at access time via getAppColorsSync().
 * For StyleSheet.create() at module scope, styles are still captured once when the file loads —
 * use useMemo(() => StyleSheet.create(...), [theme]) in screens so toggling theme updates UI.
 */
export const AppColors = new Proxy({} as AppColorsType, {
  get(_, prop: keyof AppColorsType) {
    return getAppColorsSync()[prop];
  },
});

export const CardShadow = Platform.select({
  ios: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  android: { elevation: 2 },
  default: {},
});

export const Fonts = Platform.select({
  ios: {
    sans: 'System',
    serif: 'Georgia',
    rounded: 'System',
    mono: 'Menlo',
  },
  default: {
    sans: 'System',
    serif: 'serif',
    rounded: 'System',
    mono: 'monospace',
  },
  web: {
    sans: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "-apple-system, BlinkMacSystemFont, 'SF Pro Rounded', sans-serif",
    mono: "'SF Mono', Menlo, Monaco, monospace",
  },
});
