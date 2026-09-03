/**
 * Official Adiverse HRMS design system — navy + blue, slate neutrals.
 * Aligned with the web portal tokens (primary #2563eb, navy #0f172a).
 */

import { Appearance, Platform } from 'react-native';
import { useThemeStore } from '@/store/themeStore';

const tintLight = '#2563eb';
const tintDark = '#3b82f6';
const navy = '#0f172a';

export const Brand = {
  primary: tintLight,
  primaryMid: '#3b82f6',
  primaryDark: '#1d4ed8',
  navy,
  primaryLight: '#eff6ff',
} as const;

export const Colors = {
  light: {
    text: '#0f172a',
    textSecondary: '#475569',
    textTertiary: '#94a3b8',
    background: '#f8fafc',
    backgroundElevated: '#FFFFFF',
    surfaceMuted: '#f1f5f9',
    tint: tintLight,
    navy,
    icon: '#64748b',
    tabIconDefault: '#94a3b8',
    tabIconSelected: tintLight,
    separator: 'rgba(15,23,42,0.08)',
    border: '#e2e8f0',
    card: '#FFFFFF',
    label: '#475569',
    fill: 'rgba(100,116,139,0.14)',
    destructive: '#dc2626',
    success: '#059669',
    warning: '#d97706',
  },
  dark: {
    text: '#f8fafc',
    textSecondary: '#cbd5e1',
    textTertiary: '#64748b',
    background: '#020617',
    backgroundElevated: '#0f172a',
    surfaceMuted: '#1e293b',
    tint: tintDark,
    navy: '#020617',
    icon: '#94a3b8',
    tabIconDefault: '#64748b',
    tabIconSelected: tintDark,
    separator: 'rgba(148,163,184,0.18)',
    border: 'rgba(148,163,184,0.22)',
    card: '#0f172a',
    label: '#cbd5e1',
    fill: 'rgba(148,163,184,0.16)',
    destructive: '#f87171',
    success: '#34d399',
    warning: '#fbbf24',
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
  lg: 14,
  xl: 18,
  full: 9999,
} as const;

/** Theme-aware app colors. Use with useAppColors() or pass resolved 'light' | 'dark'. */
export function getAppColors(mode: 'light' | 'dark') {
  const c = Colors[mode];
  return {
    background: c.background,
    backgroundElevated: c.backgroundElevated,
    surfaceMuted: c.surfaceMuted,
    card: c.card,
    text: c.text,
    textSecondary: c.textSecondary,
    textTertiary: c.textTertiary,
    tint: c.tint,
    navy: c.navy,
    border: c.border,
    separator: c.separator,
    fill: c.fill,
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
    shadowColor: navy,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
  },
  android: { elevation: 1 },
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
