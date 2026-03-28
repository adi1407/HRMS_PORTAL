import { Tabs, useRouter } from 'expo-router';
import React from 'react';
import { Pressable, Platform } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';

/** Home header — HRMS Assistant (same route as More → HRMS Assistant). */
function HomeAssistantButton() {
  const router = useRouter();
  const theme = useAppTheme();
  const iconColor = Colors[theme].tint;

  return (
    <Pressable
      onPress={() => router.push('/assistant')}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel="HRMS Assistant"
      style={{ marginRight: 4, padding: 8 }}
    >
      <MaterialIcons name="smart-toy" size={26} color={iconColor} />
    </Pressable>
  );
}

/** Home header — opens Notifications (same as More → Notifications). */
function HomeNotificationsButton() {
  const router = useRouter();
  const theme = useAppTheme();
  const iconColor = Colors[theme].text;

  return (
    <Pressable
      onPress={() => router.push('/notifications')}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel="Notifications"
      style={{ marginRight: Platform.OS === 'ios' ? 4 : 8, padding: 8 }}
    >
      <MaterialIcons name="notifications-none" size={26} color={iconColor} />
    </Pressable>
  );
}

export default function TabLayout() {
  const theme = useAppTheme();
  const tint = Colors[theme].tint;
  /** Match tab screens that use `colors.background` from useAppColors — avoids light/dark mismatch vs header. */
  const sceneBg = Colors[theme].background;
  const tabBarBg = Colors[theme].backgroundElevated;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: tint,
        tabBarInactiveTintColor: Colors[theme].tabIconDefault,
        headerShown: true,
        tabBarButton: HapticTab,
        /** Don’t mount every tab’s tree until first visit (faster cold start). */
        lazy: true,
        /** Fills area behind tab content so switching tabs doesn’t flash wrong theme. */
        sceneStyle: { backgroundColor: sceneBg },
        tabBarStyle: {
          backgroundColor: tabBarBg,
          borderTopColor: Colors[theme].separator,
        },
        headerStyle: { backgroundColor: sceneBg },
        headerTitleStyle: { fontSize: 17, fontWeight: '600', color: Colors[theme].text },
        headerTintColor: Colors[theme].text,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          headerRight: () => (
            <>
              <HomeAssistantButton />
              <HomeNotificationsButton />
            </>
          ),
          tabBarIcon: ({ color }: { color: string }) => <IconSymbol size={26} name="house.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="checkin"
        options={{
          title: 'Check-in',
          tabBarIcon: ({ color }: { color: string }) => <IconSymbol size={26} name="location.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="leave"
        options={{
          title: 'Leave',
          tabBarIcon: ({ color }: { color: string }) => <IconSymbol size={26} name="calendar" color={color} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          tabBarIcon: ({ color }: { color: string }) => <IconSymbol size={26} name="ellipsis.circle.fill" color={color} />,
        }}
      />
      <Tabs.Screen name="explore" options={{ href: null }} />
    </Tabs>
  );
}
