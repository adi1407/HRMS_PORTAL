import React, { memo, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Spacing, BorderRadius } from '@/constants/theme';
import type { AppColorsType } from '@/constants/theme';

export type MoreMenuItemData = {
  route: string;
  label: string;
  icon: keyof typeof MaterialIcons.glyphMap;
};

type Props = {
  item: MoreMenuItemData;
  isLast: boolean;
  colors: AppColorsType;
  borderBottomColor: string;
};

/** Memoized row so scrolling the More menu doesn’t re-render every row each time. */
export const MoreMenuItem = memo(function MoreMenuItem({
  item,
  isLast,
  colors,
  borderBottomColor,
}: Props) {
  const router = useRouter();
  const onPress = useCallback(() => {
    router.push(item.route as never);
  }, [router, item.route]);

  const borderStyle: StyleProp<ViewStyle> = !isLast
    ? [styles.menuRowBorder, { borderBottomColor }]
    : undefined;

  return (
    <TouchableOpacity style={[styles.menuRow, borderStyle]} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.menuIconWrap, { backgroundColor: colors.tint + '20' }]}>
        <MaterialIcons name={item.icon} size={22} color={colors.tint} />
      </View>
      <Text style={[styles.menuLabel, { color: colors.text }]}>{item.label}</Text>
      <MaterialIcons name="chevron-right" size={22} color={colors.textSecondary} />
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  menuRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  menuIconWrap: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  menuLabel: { flex: 1, fontSize: 17, fontWeight: '500' },
});
