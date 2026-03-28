import { useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { useThemeStore } from '@/store/themeStore';
import { getAppColors } from '@/constants/theme';

export type ResolvedTheme = 'light' | 'dark';

/** Resolved theme: user choice or system. */
export function useAppTheme(): ResolvedTheme {
  const theme = useThemeStore((s) => s.theme);
  const system = useColorScheme();
  if (theme === 'system') return system ?? 'light';
  return theme;
}

/**
 * Theme-aware app colors. Palette reference is stable per theme so child memo/components
 * don’t re-render on every parent render when only unrelated state changes.
 */
export function useAppColors() {
  const mode = useAppTheme();
  return useMemo(() => getAppColors(mode), [mode]);
}
