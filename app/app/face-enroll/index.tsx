import React from 'react';
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Spacing } from '@/constants/theme';
import { useAppColors } from '@/hooks/use-app-theme';

export default function FaceEnrollScreen() {
  const router = useRouter();
  const colors = useAppColors();

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <SafeAreaView />
      <View style={styles.centered}>
        <MaterialIcons name="face-retouching-off" size={48} color={colors.textSecondary} />
        <Text style={[styles.title, { color: colors.text }]}>Face enrollment disabled</Text>
        <Text style={[styles.text, { color: colors.textSecondary }]}>
          Attendance now uses GPS + office WiFi. Mobile check-in also requires device biometric confirmation.
        </Text>
        <TouchableOpacity style={[styles.backBtn, { backgroundColor: colors.tint }]} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Go back</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xl },
  title: { fontSize: 20, fontWeight: '700', marginTop: Spacing.md },
  text: { textAlign: 'center', marginTop: Spacing.sm, fontSize: 14, lineHeight: 21 },
  backBtn: {
    marginTop: Spacing.lg,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  backBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
