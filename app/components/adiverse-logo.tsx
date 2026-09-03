import React from 'react';
import { Image, ImageStyle, StyleProp } from 'react-native';

const LOGO_MARK = require('@/assets/images/logo.png');
const LOGO_HORIZONTAL = require('@/assets/images/logo-horizontal.png');

type Props = {
  size?: number;
  style?: StyleProp<ImageStyle>;
};

/** Mark logo — compact chrome sizes: 22 / 28 / 36; larger for splash/login. */
export function AdiverseLogo({ size = 28, style }: Props) {
  return (
    <Image
      source={LOGO_MARK}
      accessibilityLabel="Adiverse"
      style={[{ width: size, height: size, resizeMode: 'contain' }, style]}
    />
  );
}

/** Horizontal wordmark (Untitled-1) — use wherever the “Adiverse” name was shown. */
export function AdiverseLogoHorizontal({
  height = 36,
  style,
}: {
  height?: number;
  style?: StyleProp<ImageStyle>;
}) {
  return (
    <Image
      source={LOGO_HORIZONTAL}
      accessibilityLabel="Adiverse"
      style={[{ height, width: height * 4.2, maxWidth: 240, resizeMode: 'contain' }, style]}
    />
  );
}
