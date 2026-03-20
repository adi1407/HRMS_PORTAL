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
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { AdiverseLogo } from '@/components/adiverse-logo';

const DURATION_EXIT = 480;
/** Min time custom splash is visible after boot is ready (UX polish; keep modest to avoid feeling slow) */
const MIN_VISIBLE_MS = 1000;
const SPRING_CONFIG = { damping: 18, stiffness: 120 };

type Props = {
  onFinish: () => void;
  ready: boolean;
};

export function SplashScreen({ onFinish, ready }: Props) {
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);
  const logoScale = useSharedValue(0.72);
  const logoOpacity = useSharedValue(0);
  const titleOpacity = useSharedValue(0);
  const titleY = useSharedValue(12);
  const taglineOpacity = useSharedValue(0);
  const taglineY = useSharedValue(8);
  const containerOpacity = useSharedValue(1);

  useEffect(() => {
    // Hide native splash so our custom splash is visible (native was covering it)
    const hideNative = setTimeout(() => {
      SplashScreenNative.hideAsync?.();
    }, 100);

    // Enter: logo scales up and fades in
    logoScale.value = withSpring(1, SPRING_CONFIG);
    logoOpacity.value = withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) });

    // Title and tagline stagger
    titleOpacity.value = withDelay(280, withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) }));
    titleY.value = withDelay(280, withSpring(0, SPRING_CONFIG));
    taglineOpacity.value = withDelay(420, withTiming(0.88, { duration: 380, easing: Easing.out(Easing.cubic) }));
    taglineY.value = withDelay(420, withSpring(0, SPRING_CONFIG));

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

  const logoAnimated = useAnimatedStyle(() => ({
    transform: [{ scale: logoScale.value }],
    opacity: logoOpacity.value,
  }));

  const titleAnimated = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateY: titleY.value }],
  }));

  const taglineAnimated = useAnimatedStyle(() => ({
    opacity: taglineOpacity.value,
    transform: [{ translateY: taglineY.value }],
  }));

  const containerAnimated = useAnimatedStyle(() => ({
    opacity: containerOpacity.value,
  }));

  return (
    <Animated.View style={[styles.container, containerAnimated]}>
      <StatusBar style="light" />
      <View style={styles.inner}>
        <Animated.View style={logoAnimated}>
          <AdiverseLogo size={Platform.OS === 'web' ? 112 : 120} />
        </Animated.View>
        <Animated.View style={[styles.textBlock, titleAnimated]}>
          <Text style={styles.title}>Adiverse</Text>
        </Animated.View>
        <Animated.View style={taglineAnimated}>
          <Text style={styles.tagline}>Human Resource Management System</Text>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#6366f1',
  },
  inner: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  textBlock: {
    marginTop: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.5,
    color: '#ffffff',
  },
  tagline: {
    marginTop: 6,
    fontSize: 15,
    fontWeight: '500',
    letterSpacing: 0.2,
    color: 'rgba(255,255,255,0.82)',
  },
});
