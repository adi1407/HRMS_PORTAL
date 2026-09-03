import { Tabs, useRouter } from 'expo-router';
import React from 'react';
import { Pressable, Platform, View, StyleSheet } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { HomeHeaderTitle } from '@/components/ui/home-header-title';
import { Colors } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';

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
      style={{ marginRight: 2, padding: 8 }}
    >
      <MaterialIcons name="smart-toy" size={24} color={iconColor} />
    </Pressable>
  );
}

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
      <MaterialIcons name="notifications-none" size={24} color={iconColor} />
    </Pressable>
  );
}

export default function TabLayout() {
  const theme = useAppTheme();
  const tint = Colors[theme].tint;
  const sceneBg = Colors[theme].background;
  const tabBarBg = Colors[theme].backgroundElevated;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: tint,
        tabBarInactiveTintColor: Colors[theme].tabIconDefault,
        headerShown: true,
        tabBarButton: HapticTab,
        lazy: true,
        sceneStyle: { backgroundColor: sceneBg },
        tabBarStyle: {
          backgroundColor: tabBarBg,
          borderTopColor: Colors[theme].separator,
          borderTopWidth: StyleSheet.hairlineWidth,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          letterSpacing: 0.1,
        },
        headerStyle: {
          backgroundColor: sceneBg,
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: Colors[theme].separator,
        },
        headerTitleStyle: { fontSize: 17, fontWeight: '600', color: Colors[theme].text, letterSpacing: -0.2 },
        headerTintColor: Colors[theme].text,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          headerTitle: () => <HomeHeaderTitle />,
          headerRight: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <HomeAssistantButton />
              <HomeNotificationsButton />
            </View>
          ),
          tabBarIcon: ({ color }: { color: string }) => <IconSymbol size={24} name="house.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="checkin"
        options={{
          title: 'Check-in',
          tabBarIcon: ({ color }: { color: string }) => <IconSymbol size={24} name="location.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="leave"
        options={{
          title: 'Leave',
          tabBarIcon: ({ color }: { color: string }) => <IconSymbol size={24} name="calendar" color={color} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          headerTitle: () => <HomeHeaderTitle />,
          tabBarIcon: ({ color }: { color: string }) => <IconSymbol size={24} name="ellipsis.circle.fill" color={color} />,
        }}
      />
      <Tabs.Screen name="explore" options={{ href: null }} />
    </Tabs>
  );
}
