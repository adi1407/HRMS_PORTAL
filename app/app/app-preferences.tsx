import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Spacing, BorderRadius, CardShadow } from '@/constants/theme';
import { useThemeStore, type AppThemeMode } from '@/store/themeStore';
import { useAppColors } from '@/hooks/use-app-theme';
import { ScreenHeader } from '@/components/ui/screen-header';

const APPEARANCE_OPTIONS: { value: AppThemeMode; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'system', label: 'System' },
  { value: 'dark', label: 'Dark' },
];

export default function AppPreferencesScreen() {
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const colors = useAppColors();

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <SafeAreaView edges={["top"]} style={[styles.safeTop, { backgroundColor: colors.background }]}>
        <ScreenHeader title="App preferences" colors={colors} />
      </SafeAreaView>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Appearance</Text>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          {APPEARANCE_OPTIONS.map((opt, index) => (
            <TouchableOpacity
              key={opt.value}
              style={[
                styles.row,
                index < APPEARANCE_OPTIONS.length - 1 && [styles.rowBorder, { borderBottomColor: colors.textSecondary + '30' }],
              ]}
              onPress={async () => {
                await setTheme(opt.value);
                // Navigate back so previous screens remount with updated theme.
                router.back();
              }}
              activeOpacity={0.7}
            >
              <Text style={[styles.rowLabel, { color: colors.text }]}>{opt.label}</Text>
              {theme === opt.value ? (
                <MaterialIcons name="check" size={24} color={colors.tint} />
              ) : (
                <View style={styles.checkPlaceholder} />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  safeTop: {},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'flex-start' },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  scroll: { flex: 1 },
  content: { padding: Spacing.xl },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: Spacing.sm,
    marginLeft: Spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  card: {
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    ...CardShadow,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.lg,
  },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth },
  rowLabel: { fontSize: 17, fontWeight: '500' },
  checkPlaceholder: { width: 24, height: 24 },
});
