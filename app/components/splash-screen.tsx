import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreenNative from 'expo-splash-screen';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withDelay,
  withSequence,
  runOnJS,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import { AdiverseLogo } from '@/components/adiverse-logo';
import { Brand } from '@/constants/theme';

const DURATION_EXIT = 480;
/** Full choreography must be readable before exit can start */
const MIN_VISIBLE_MS = 3000;

type Props = {
  onFinish: () => void;
  ready: boolean;
};

/**
 * Premium splash — mark only (no horizontal wordmark).
 *
 * Storyboard:
 *  0. Navy stage + soft ambient glow
 *  1. White plate + A mark rises in (spring)
 *  2. Soft presence pulse on the plate
 *  3. Tagline fades up under the mark
 *  4. Fade out → login / home
 */
export function SplashScreen({ onFinish, ready }: Props) {
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);

  const glow = useSharedValue(0);
  const ring = useSharedValue(0);
  const markOpacity = useSharedValue(0);
  const markScale = useSharedValue(0.72);
  const markY = useSharedValue(28);
  const pulse = useSharedValue(1);
  const taglineOpacity = useSharedValue(0);
  const taglineY = useSharedValue(16);
  const containerOpacity = useSharedValue(1);

  useEffect(() => {
    const hideNative = setTimeout(() => {
      SplashScreenNative.hideAsync?.();
    }, 60);

    // Ambient
    glow.value = withSequence(
      withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) }),
      withTiming(0.65, { duration: 1100, easing: Easing.inOut(Easing.sin) })
    );
    ring.value = withDelay(
      120,
      withTiming(1, { duration: 1600, easing: Easing.out(Easing.cubic) })
    );

    // Beat 1 — mark enters
    markOpacity.value = withTiming(1, { duration: 620, easing: Easing.out(Easing.cubic) });
    markScale.value = withSpring(1, { damping: 16, stiffness: 110, mass: 0.95 });
    markY.value = withSpring(0, { damping: 17, stiffness: 120 });

    // Beat 2 — presence pulse (after settle)
    pulse.value = withDelay(
      1000,
      withSequence(
        withTiming(1.045, { duration: 420, easing: Easing.out(Easing.quad) }),
        withTiming(1, { duration: 480, easing: Easing.inOut(Easing.quad) })
      )
    );

    // Beat 3 — tagline
    taglineOpacity.value = withDelay(
      1500,
      withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) })
    );
    taglineY.value = withDelay(1500, withSpring(0, { damping: 18, stiffness: 130 }));

    const t = setTimeout(() => setMinTimeElapsed(true), MIN_VISIBLE_MS);
    return () => {
      clearTimeout(hideNative);
      clearTimeout(t);
    };
  }, []);

  useEffect(() => {
    if (!ready || !minTimeElapsed) return;
    containerOpacity.value = withTiming(
      0,
      { duration: DURATION_EXIT, easing: Easing.in(Easing.cubic) },
      (finished) => {
        if (finished) runOnJS(onFinish)();
      }
    );
  }, [ready, minTimeElapsed]);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glow.value * 0.28,
    transform: [{ scale: interpolate(glow.value, [0, 1], [0.75, 1.12]) }],
  }));

  const ringStyle = useAnimatedStyle(() => ({
    opacity: interpolate(ring.value, [0, 0.4, 1], [0, 0.22, 0.08]),
    transform: [{ scale: interpolate(ring.value, [0, 1], [0.55, 1.35]) }],
  }));

  const markStyle = useAnimatedStyle(() => ({
    opacity: markOpacity.value,
    transform: [
      { translateY: markY.value },
      { scale: markScale.value * pulse.value },
    ],
  }));

  const taglineStyle = useAnimatedStyle(() => ({
    opacity: taglineOpacity.value * 0.88,
    transform: [{ translateY: taglineY.value }],
  }));

  const containerStyle = useAnimatedStyle(() => ({
    opacity: containerOpacity.value,
  }));

  const markSize = Platform.OS === 'web' ? 72 : 80;

  return (
    <Animated.View style={[styles.container, containerStyle]}>
      <StatusBar style="light" />
      <View style={styles.inner}>
        <View style={styles.stage}>
          <Animated.View style={[styles.glow, glowStyle]} />
          <Animated.View style={[styles.ring, ringStyle]} />

          <Animated.View style={[styles.plate, markStyle]}>
            <AdiverseLogo size={markSize} />
          </Animated.View>
        </View>

        <Animated.View style={[styles.textBlock, taglineStyle]}>
          <Text style={styles.tagline}>Human Resource Management System</Text>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Brand.navy,
  },
  inner: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  stage: {
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: Brand.primaryMid,
  },
  ring: {
    position: 'absolute',
    width: 168,
    height: 168,
    borderRadius: 84,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
  },
  plate: {
    width: 112,
    height: 112,
    borderRadius: 28,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.35,
    shadowRadius: 32,
    elevation: 14,
  },
  textBlock: {
    marginTop: 36,
    alignItems: 'center',
    maxWidth: 280,
  },
  tagline: {
    fontSize: 15,
    fontWeight: '500',
    letterSpacing: 0.3,
    lineHeight: 22,
    color: 'rgba(248,250,252,0.78)',
    textAlign: 'center',
  },
});
