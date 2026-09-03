import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { AdiverseLogo } from '@/components/adiverse-logo';
import { Spacing, BorderRadius, getAppColorsSync } from '@/constants/theme';
import type { AppColorsType } from '@/constants/theme';

type Props = {
  title: string;
  colors?: Partial<AppColorsType> | AppColorsType;
  onBack?: () => void;
  showLogo?: boolean;
  right?: React.ReactNode;
  subtitle?: string;
};

/** Consistent stack header: optional back, mark logo, title. */
export function ScreenHeader({
  title,
  colors: colorsProp,
  onBack,
  showLogo = true,
  right,
  subtitle,
}: Props) {
  const router = useRouter();
  const fallback = getAppColorsSync();
  const colors = {
    ...fallback,
    ...(colorsProp || {}),
  };
  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }
    try {
      // Expo Router / React Navigation
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const nav = router as any;
      if (typeof nav.canGoBack === 'function' ? nav.canGoBack() : true) {
        router.back();
      } else {
        router.replace('/(tabs)');
      }
    } catch {
      try {
        router.replace('/(tabs)');
      } catch {
        /* ignore */
      }
    }
  };

  return (
    <View
      style={[
        styles.wrap,
        {
          borderBottomColor: colors.separator || 'rgba(15,23,42,0.08)',
          backgroundColor: colors.background || '#f8fafc',
        },
      ]}
    >
      <Pressable
        onPress={handleBack}
        hitSlop={12}
        style={styles.backBtn}
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <MaterialIcons name="arrow-back" size={22} color={colors.text || '#0f172a'} />
      </Pressable>

      <View style={styles.center}>
        {showLogo ? (
          <View
            style={[
              styles.logoPlate,
              {
                backgroundColor: colors.card || '#fff',
                borderColor: colors.border || '#e2e8f0',
              },
            ]}
          >
            <AdiverseLogo size={22} />
          </View>
        ) : null}
        <View style={styles.titleBlock}>
          <Text style={[styles.title, { color: colors.text || '#0f172a' }]} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text
              style={[styles.subtitle, { color: colors.textTertiary || colors.textSecondary || '#94a3b8' }]}
              numberOfLines={1}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={styles.right}>{right ?? <View style={styles.rightSpacer} />}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 52,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  center: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: Spacing.xs,
    minWidth: 0,
  },
  logoPlate: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    marginRight: Spacing.sm,
  },
  titleBlock: { flex: 1, minWidth: 0 },
  title: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 1,
  },
  right: {
    minWidth: 40,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  rightSpacer: { width: 40 },
});
