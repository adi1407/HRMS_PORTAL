import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

/**
 * Adiverse logo — same brand as website (rounded square + "A").
 * Pure RN (no react-native-svg) to avoid native module issues.
 */
export function AdiverseLogo({ size = 120 }: { size?: number }) {
  return (
    <View style={[styles.box, { width: size, height: size, borderRadius: size * (14 / 64) }]}>
      <Text style={[styles.letter, { fontSize: size * 0.5 }]}>A</Text>
      <View style={[styles.dots, { bottom: size * (6/64) }]}>
        <View style={styles.dot} />
        <View style={styles.dot} />
        <View style={styles.dot} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  letter: {
    color: '#ffffff',
    fontWeight: '700',
    marginBottom: -4,
  },
  dots: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
});
