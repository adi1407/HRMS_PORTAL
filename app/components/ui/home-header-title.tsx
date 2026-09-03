import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { AdiverseLogo } from '@/components/adiverse-logo';
import { Spacing, BorderRadius, Colors } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';

/** Tab Home header title: mark + HRMS. */
export function HomeHeaderTitle() {
  const theme = useAppTheme();
  const c = Colors[theme];

  return (
    <View style={styles.row}>
      <View style={[styles.plate, { backgroundColor: c.card, borderColor: c.border }]}>
        <AdiverseLogo size={22} />
      </View>
      <Text style={[styles.title, { color: c.text }]}>HRMS</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  plate: {
    width: 30,
    height: 30,
    borderRadius: BorderRadius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    marginRight: Spacing.sm,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
});
