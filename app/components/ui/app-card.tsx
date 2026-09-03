import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { BorderRadius, CardShadow, Spacing } from '@/constants/theme';
import type { AppColorsType } from '@/constants/theme';

type Props = {
  colors: AppColorsType;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
  elevated?: boolean;
};

/** Single premium card surface used across dashboards and lists. */
export function AppCard({ colors, children, style, padded = true, elevated = true }: Props) {
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
        },
        elevated ? CardShadow : null,
        padded ? styles.padded : null,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: BorderRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  padded: {
    padding: Spacing.lg,
  },
});
