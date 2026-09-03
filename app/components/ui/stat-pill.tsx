import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BorderRadius, Spacing } from '@/constants/theme';
import type { AppColorsType } from '@/constants/theme';

type Tone = 'default' | 'tint' | 'success' | 'warning' | 'danger';

type Props = {
  label: string;
  value?: string | number;
  colors: AppColorsType;
  tone?: Tone;
};

function toneColors(colors: AppColorsType, tone: Tone) {
  switch (tone) {
    case 'tint':
      return { fg: colors.tint, bg: `${colors.tint}14` };
    case 'success':
      return { fg: colors.success, bg: `${colors.success}14` };
    case 'warning':
      return { fg: colors.warning, bg: `${colors.warning}14` };
    case 'danger':
      return { fg: colors.destructive, bg: `${colors.destructive}14` };
    default:
      return { fg: colors.textSecondary, bg: colors.surfaceMuted };
  }
}

export function StatPill({ label, value, colors, tone = 'default' }: Props) {
  const t = toneColors(colors, tone);
  return (
    <View style={[styles.pill, { backgroundColor: t.bg }]}>
      {value != null ? (
        <Text style={[styles.value, { color: t.fg }]}>{value}</Text>
      ) : null}
      <Text style={[styles.label, { color: t.fg }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    minWidth: 72,
    alignItems: 'center',
  },
  value: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
    opacity: 0.9,
  },
});
