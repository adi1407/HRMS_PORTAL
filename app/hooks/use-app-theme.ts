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

/** Theme-aware app colors. Use in screens to react to light/dark changes. */
export function useAppColors() {
  const mode = useAppTheme();
  return getAppColors(mode);
}
