import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Linking,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { BorderRadius, CardShadow, Spacing } from '@/constants/theme';
import { useAppColors } from '@/hooks/use-app-theme';
import { useAuthStore } from '@/store/authStore';
import api from '@/lib/api';

type Employee = {
  _id: string;
  name?: string;
  email?: string;
  employeeId?: string;
  designation?: string;
  role?: string;
};

export default function FaceEnrollScreen() {
  const router = useRouter();
  const colors = useAppColors();
  const getRole = useAuthStore((s) => s.getRole);
  const role = getRole();
  const canManage = ['HR', 'DIRECTOR', 'SUPER_ADMIN'].includes(role);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');

  const clientUrl =
    typeof process !== 'undefined'
      ? (process as unknown as { env?: { EXPO_PUBLIC_CLIENT_URL?: string } }).env?.EXPO_PUBLIC_CLIENT_URL
      : '';

  const load = useCallback(async () => {
    try {
      const { data } = await api.get<{ data: Employee[] }>('/users');
      setEmployees(data.data ?? []);
    } catch {
      setEmployees([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter((e) =>
      [e.name, e.email, e.employeeId, e.designation].some((v) => (v ?? '').toLowerCase().includes(q))
    );
  }, [employees, query]);

  const openWebEnroll = async (emp: Employee) => {
    if (!clientUrl) {
      Alert.alert('Web URL missing', 'Set EXPO_PUBLIC_CLIENT_URL in app .env to open web face enrollment.');
      return;
    }
    const url = `${clientUrl.replace(/\/$/, '')}/employees/${emp._id}/enroll-face`;
    try {
      const ok = await Linking.canOpenURL(url);
      if (ok) await Linking.openURL(url);
      else Alert.alert('Open failed', 'Could not open web face enrollment page.');
    } catch {
      Alert.alert('Open failed', 'Could not open web face enrollment page.');
    }
  };

  if (!canManage) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <MaterialIcons name="lock-outline" size={44} color={colors.textSecondary} />
        <Text style={[styles.deniedTitle, { color: colors.text }]}>Access denied</Text>
        <Text style={[styles.deniedText, { color: colors.textSecondary }]}>
          Face enrollment is available for HR, Director, and Super Admin.
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <SafeAreaView>
        <View style={[styles.header, { borderBottomColor: colors.textSecondary + '30' }]}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <MaterialIcons
              name={Platform.OS === 'ios' ? 'arrow-back-ios' : 'arrow-back'}
              size={Platform.OS === 'ios' ? 22 : 24}
              color={colors.text}
            />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Face Enroll</Text>
          <View style={styles.backBtn} />
        </View>
      </SafeAreaView>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={colors.tint}
          />
        }
      >
        <View style={[styles.infoCard, { backgroundColor: colors.card }, CardShadow]}>
          <Text style={[styles.infoTitle, { color: colors.text }]}>Same descriptors as the website</Text>
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            Enroll in the app with the front camera (samples are encoded on the server with the same models as the web), or
            open the web enrollment page if you prefer a desktop browser.
          </Text>
        </View>

        <TextInput
          style={[styles.search, { backgroundColor: colors.card, color: colors.text }]}
          placeholder="Search name, email, employee ID..."
          placeholderTextColor={colors.textSecondary}
          value={query}
          onChangeText={setQuery}
        />

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={colors.tint} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading employees…</Text>
          </View>
        ) : filtered.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.card }, CardShadow]}>
            <MaterialIcons name="person-search" size={46} color={colors.textSecondary} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No employees found</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {filtered.map((emp) => (
              <View key={emp._id} style={[styles.item, { backgroundColor: colors.card }, CardShadow]}>
                <View style={styles.itemTop}>
                  <Text style={[styles.name, { color: colors.text }]}>{emp.name ?? '—'}</Text>
                  {emp.role ? (
                    <View style={[styles.roleBadge, { backgroundColor: colors.tint + '1A' }]}>
                      <Text style={[styles.roleText, { color: colors.tint }]}>{emp.role.replace(/_/g, ' ')}</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={[styles.meta, { color: colors.textSecondary }]}>
                  {emp.employeeId ?? '—'} · {emp.email ?? '—'}
                </Text>
                {emp.designation ? (
                  <Text style={[styles.meta, { color: colors.textSecondary }]}>{emp.designation}</Text>
                ) : null}
                <TouchableOpacity
                  style={[styles.enrollBtn, { backgroundColor: colors.tint }]}
                  onPress={() => router.push(`/face-enroll/${emp._id}` as never)}
                >
                  <MaterialIcons name="photo-camera" size={18} color="#fff" />
                  <Text style={styles.enrollBtnText}>Enroll in app</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.secondaryBtn, { borderColor: colors.tint }]}
                  onPress={() => openWebEnroll(emp)}
                >
                  <MaterialIcons name="open-in-browser" size={18} color={colors.tint} />
                  <Text style={[styles.secondaryBtnText, { color: colors.tint }]}>Open web enrollment</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xl },
  deniedTitle: { fontSize: 20, fontWeight: '700', marginTop: Spacing.md },
  deniedText: { textAlign: 'center', marginTop: Spacing.sm, fontSize: 14, lineHeight: 21 },
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
  content: { padding: Spacing.xl, paddingBottom: Spacing.section },
  infoCard: { borderRadius: BorderRadius.xl, padding: Spacing.lg, marginBottom: Spacing.lg },
  infoTitle: { fontSize: 16, fontWeight: '700', marginBottom: 6 },
  infoText: { fontSize: 14, lineHeight: 20 },
  search: {
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: 15,
    marginBottom: Spacing.lg,
  },
  loadingText: { marginTop: Spacing.sm, fontSize: 14 },
  emptyCard: { borderRadius: BorderRadius.xl, padding: Spacing.xl, alignItems: 'center' },
  emptyTitle: { marginTop: Spacing.sm, fontSize: 17, fontWeight: '600' },
  list: { gap: Spacing.md },
  item: { borderRadius: BorderRadius.xl, padding: Spacing.lg },
  itemTop: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.sm, alignItems: 'center' },
  name: { fontSize: 16, fontWeight: '700', flex: 1 },
  roleBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  roleText: { fontSize: 12, fontWeight: '700' },
  meta: { fontSize: 13, marginTop: 3 },
  enrollBtn: {
    marginTop: Spacing.md,
    height: 42,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  enrollBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  secondaryBtn: {
    marginTop: Spacing.sm,
    height: 42,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    borderWidth: 1,
  },
  secondaryBtnText: { fontSize: 14, fontWeight: '700' },
});
