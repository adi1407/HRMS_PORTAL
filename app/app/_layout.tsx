import { useEffect } from 'react';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreenNative from 'expo-splash-screen';
import 'react-native-reanimated';
import { ActivityIndicator, View } from 'react-native';

import { useAppTheme } from '@/hooks/use-app-theme';
import { useThemeStore } from '@/store/themeStore';
import { AppColors } from '@/constants/theme';

// Keep native splash visible until our custom splash is ready to show
SplashScreenNative.preventAutoHideAsync?.();

export default function RootLayout() {
  const theme = useAppTheme();
  const hydrated = useThemeStore((s) => s.hydrated);

  useEffect(() => {
    useThemeStore.getState().hydrate();
  }, []);

  if (!hydrated) {
    return (
      <View style={{ flex: 1, backgroundColor: AppColors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={AppColors.tint} />
      </View>
    );
  }

  return (
    <ThemeProvider value={theme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="login" options={{ animation: 'fade' }} />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="salary" options={{ headerShown: false }} />
        <Stack.Screen name="profile" options={{ headerShown: true, title: 'Profile' }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
    </ThemeProvider>
  );
}
