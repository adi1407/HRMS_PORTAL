import React from 'react';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Spacing } from '@/constants/theme';
import { useAppColors } from '@/hooks/use-app-theme';

export default function FaceEnrollEmployeeScreen() {
  const router = useRouter();
  const colors = useAppColors();

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <SafeAreaView />
      <View style={styles.centered}>
        <MaterialIcons name="face-retouching-off" size={48} color={colors.textSecondary} />
        <Text style={[styles.title, { color: colors.text }]}>Face enrollment disabled</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          This feature has been removed. Attendance now works using office WiFi + GPS, with biometric confirmation in app.
        </Text>
        <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.tint }]} onPress={() => router.back()}>
          <Text style={styles.primaryBtnText}>Go back</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { marginTop: Spacing.md, fontSize: 20, fontWeight: '700' },
  subtitle: { marginTop: Spacing.sm, textAlign: 'center', lineHeight: 20, paddingHorizontal: Spacing.xl },
  primaryBtn: {
    marginTop: Spacing.lg,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
