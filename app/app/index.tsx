import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import * as SplashScreenNative from 'expo-splash-screen';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { SplashScreen } from '@/components/splash-screen';

export default function BootstrapScreen() {
  const router = useRouter();
  const { setAuth, clearAuth, setHydrated } = useAuthStore();
  const [bootstrapReady, setBootstrapReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.post<{ accessToken?: string }>('/auth/refresh', {
          refreshToken: await useAuthStore.getState().getStoredRefreshToken() || undefined,
        });
        if (cancelled || !data.accessToken) {
          if (!cancelled) clearAuth();
          setBootstrapReady(true);
          return;
        }
        const { data: meData } = await api.get<{ data: Parameters<typeof setAuth>[0] }>('/auth/me');
        if (cancelled) return;
        await setAuth(meData.data, data.accessToken, null);
        setBootstrapReady(true);
      } catch {
        if (!cancelled) await clearAuth();
        setBootstrapReady(true);
      } finally {
        if (!cancelled) setHydrated();
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleSplashFinish = () => {
    SplashScreenNative.hideAsync?.();
    const hasAuth = !!useAuthStore.getState().accessToken;
    if (hasAuth) router.replace('/(tabs)');
    else router.replace('/login');
  };

  return (
    <View style={{ flex: 1 }}>
      <SplashScreen onFinish={handleSplashFinish} ready={bootstrapReady} />
    </View>
  );
}
