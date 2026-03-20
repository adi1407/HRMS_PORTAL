import React, { useEffect, useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  SafeAreaView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Spacing, BorderRadius, AppColors, CardShadow } from '@/constants/theme';
import api from '@/lib/api';

type Holiday = { _id: string; name: string; date: string; type?: string };

const TYPE_COLORS: Record<string, string> = {
  NATIONAL: '#2563eb',
  REGIONAL: '#7c3aed',
  COMPANY: '#059669',
  OPTIONAL: '#d97706',
};

const currentYear = new Date().getFullYear();
const YEARS = [currentYear, currentYear + 1, currentYear + 2];

function fmt(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function isUpcoming(dateStr: string) {
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d >= today;
}

export default function HolidaysScreen() {
  const router = useRouter();
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [year, setYear] = useState(currentYear);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const { data } = await api.get<{ data: Holiday[] }>(`/holidays?year=${year}`);
      setHolidays(data.data ?? []);
    } catch {
      setHolidays([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, [year]);

  const upcoming = holidays.filter((h) => isUpcoming(h.date)).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const past = holidays.filter((h) => !isUpcoming(h.date)).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const typeColor = (t?: string) => TYPE_COLORS[t ?? ''] ?? '#6b7280';

  return (
    <View style={[styles.screen, { backgroundColor: AppColors.background }]}>
      <SafeAreaView style={styles.safeTop}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <MaterialIcons name={Platform.OS === 'ios' ? 'arrow-back-ios' : 'arrow-back'} size={Platform.OS === 'ios' ? 22 : 24} color={AppColors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Holidays</Text>
          <View style={styles.backBtn} />
        </View>
      </SafeAreaView>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={AppColors.tint} />}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.pageSubtitle}>View declared holidays for the year.</Text>

        <View style={styles.yearRow}>
          {YEARS.map((y) => (
            <TouchableOpacity
              key={y}
              style={[styles.yearChip, year === y && styles.yearChipActive]}
              onPress={() => setYear(y)}
            >
              <Text style={[styles.yearChipText, year === y && styles.yearChipTextActive]}>{y}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <Text style={styles.muted}>Loading…</Text>
        ) : (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                Upcoming Holidays {year === currentYear ? '(This Year)' : `— ${year}`}
              </Text>
              {upcoming.length === 0 ? (
                <View style={styles.emptySection}>
                  <Text style={styles.emptySectionText}>No upcoming holidays for {year}.</Text>
                </View>
              ) : (
                <View style={styles.card}>
                  {upcoming.map((h, i) => (
                    <View key={h._id} style={[styles.row, i < upcoming.length - 1 && styles.rowBorder]}>
                      <View style={[styles.dot, { backgroundColor: typeColor(h.type) }]} />
                      <View style={styles.rowBody}>
                        <Text style={styles.name}>{h.name}</Text>
                        <Text style={styles.dateText}>{fmt(h.date)}</Text>
                      </View>
                      <View style={[styles.typeBadge, { backgroundColor: `${typeColor(h.type)}1a`, borderColor: `${typeColor(h.type)}40` }]}>
                        <Text style={[styles.typeBadgeText, { color: typeColor(h.type) }]}>{h.type ?? 'NATIONAL'}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {past.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, styles.sectionTitlePast]}>Past Holidays — {year}</Text>
                <View style={styles.cardPast}>
                  {past.map((h, i) => (
                    <View key={h._id} style={[styles.rowPast, i < past.length - 1 && styles.rowBorder]}>
                      <View style={styles.dotPast} />
                      <View style={styles.rowBody}>
                        <Text style={styles.namePast}>{h.name}</Text>
                        <Text style={styles.dateTextPast}>{fmt(h.date)}</Text>
                      </View>
                      <Text style={styles.typeTextPast}>{h.type ?? 'NATIONAL'}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {holidays.length === 0 && (
              <View style={styles.emptyCard}>
                <MaterialIcons name="celebration" size={48} color={AppColors.textSecondary} />
                <Text style={styles.emptyText}>No holidays for {year}</Text>
                <Text style={styles.emptySub}>No holidays have been declared for this year yet.</Text>
              </View>
            )}
          </>
        )}
        <View style={styles.bottomPad} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  safeTop: { backgroundColor: AppColors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(60,60,67,0.12)',
  },
  backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'flex-start' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: AppColors.text },
  scroll: { flex: 1 },
  content: { padding: Spacing.xl, paddingBottom: Spacing.section },
  pageSubtitle: { fontSize: 15, color: AppColors.textSecondary, marginBottom: Spacing.lg },
  yearRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.xl },
  yearChip: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: BorderRadius.md, backgroundColor: 'rgba(118,118,128,0.12)' },
  yearChipActive: { backgroundColor: AppColors.tint },
  yearChipText: { fontSize: 15, fontWeight: '600', color: AppColors.text },
  yearChipTextActive: { color: '#fff' },
  muted: { fontSize: 15, color: AppColors.textSecondary },
  section: { marginBottom: Spacing.xl },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: AppColors.text, marginBottom: Spacing.md },
  sectionTitlePast: { color: AppColors.textSecondary },
  emptySection: { padding: Spacing.lg, backgroundColor: AppColors.card, borderRadius: BorderRadius.xl, ...CardShadow },
  emptySectionText: { fontSize: 15, color: AppColors.textSecondary },
  card: { backgroundColor: '#f8fafc', borderRadius: BorderRadius.xl, borderWidth: 1, borderColor: '#e2e8f0', overflow: 'hidden' },
  cardPast: { backgroundColor: '#f9fafb', borderRadius: BorderRadius.xl, borderWidth: 1, borderColor: '#f3f4f6', overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, gap: Spacing.sm },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(60,60,67,0.12)' },
  rowPast: { flexDirection: 'row', alignItems: 'center', padding: Spacing.sm + 4, paddingVertical: Spacing.md, gap: Spacing.sm, opacity: 0.85 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  dotPast: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#9ca3af' },
  rowBody: { flex: 1, minWidth: 0 },
  name: { fontSize: 16, fontWeight: '600', color: AppColors.text },
  namePast: { fontSize: 15, fontWeight: '500', color: AppColors.text },
  dateText: { fontSize: 14, color: AppColors.textSecondary, marginTop: 2 },
  dateTextPast: { fontSize: 13, color: '#9ca3af', marginTop: 2 },
  typeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99, borderWidth: 1 },
  typeBadgeText: { fontSize: 12, fontWeight: '600' },
  typeTextPast: { fontSize: 12, color: '#9ca3af' },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
    backgroundColor: AppColors.card,
    borderRadius: BorderRadius.xl,
    ...CardShadow,
  },
  emptyText: { fontSize: 17, fontWeight: '600', color: AppColors.text, marginTop: Spacing.md },
  emptySub: { fontSize: 14, color: AppColors.textSecondary, marginTop: Spacing.sm, textAlign: 'center', paddingHorizontal: Spacing.xl },
  bottomPad: { height: Spacing.section },
});
