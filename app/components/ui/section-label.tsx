import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { Spacing } from '@/constants/theme';
import type { AppColorsType } from '@/constants/theme';

type Props = {
  children: string;
  colors: AppColorsType;
  style?: object;
};

export function SectionLabel({ children, colors, style }: Props) {
  return (
    <Text style={[styles.label, { color: colors.textTertiary }, style]}>{children}</Text>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: Spacing.sm,
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.xxl,
  },
});
