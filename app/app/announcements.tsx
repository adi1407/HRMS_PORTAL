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

type Announcement = {
  _id: string;
  title: string;
  content: string;
  priority?: string;
  createdAt: string;
  expiresAt?: string;
  audience?: string;
  department?: { name: string };
  branch?: { name: string };
  createdBy?: { name: string };
};

const PRIORITY_STYLE: Record<string, { bg: string; text: string }> = {
  URGENT: { bg: '#fee2e2', text: '#dc2626' },
  IMPORTANT: { bg: '#fef3c7', text: '#d97706' },
  NORMAL: { bg: '#dbeafe', text: '#2563eb' },
};

function fmt(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function fmtDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function AnnouncementsScreen() {
  const router = useRouter();
  const [list, setList] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const { data } = await api.get<{ data: Announcement[] }>('/announcements/active');
      setList(data.data ?? []);
    } catch {
      setList([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);

  const pr = (p?: string) => PRIORITY_STYLE[p ?? 'NORMAL'] ?? PRIORITY_STYLE.NORMAL;

  return (
    <View style={[styles.screen, { backgroundColor: AppColors.background }]}>
      <SafeAreaView style={styles.safeTop}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <MaterialIcons name={Platform.OS === 'ios' ? 'arrow-back-ios' : 'arrow-back'} size={Platform.OS === 'ios' ? 22 : 24} color={AppColors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Announcements</Text>
          <View style={styles.backBtn} />
        </View>
      </SafeAreaView>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={AppColors.tint} />}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.pageSubtitle}>Company announcements and updates</Text>

        {list.length > 0 && !loading && (
          <Text style={styles.summary}>Active ({list.length})</Text>
        )}

        {loading ? (
          <Text style={styles.muted}>Loading…</Text>
        ) : list.length === 0 ? (
          <View style={styles.emptyCard}>
            <MaterialIcons name="campaign" size={48} color={AppColors.textSecondary} />
            <Text style={styles.emptyText}>No announcements</Text>
            <Text style={styles.emptySub}>New announcements will appear here when published by HR.</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {list.map((a) => {
              const style = pr(a.priority);
              const audienceLabel = a.audience === 'DEPARTMENT' && a.department?.name
                ? a.department.name
                : a.audience === 'BRANCH' && a.branch?.name
                  ? a.branch.name
                  : null;
              return (
                <View key={a._id} style={[styles.card, { borderLeftWidth: 4, borderLeftColor: style.text }]}>
                  <View style={styles.cardTop}>
                    <View style={[styles.priorityBadge, { backgroundColor: style.bg }]}>
                      <MaterialIcons name="campaign" size={14} color={style.text} />
                      <Text style={[styles.priorityText, { color: style.text }]}>{a.priority ?? 'Normal'}</Text>
                    </View>
                    {audienceLabel ? (
                      <View style={styles.audienceBadge}>
                        <Text style={styles.audienceText}>{audienceLabel}</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.title}>{a.title}</Text>
                  <Text style={styles.content}>{a.content}</Text>
                  <Text style={styles.meta}>
                    By {a.createdBy?.name ?? 'HR'} · {fmt(a.createdAt)}
                    {a.expiresAt ? ` · Expires: ${fmtDate(a.expiresAt)}` : ''}
                  </Text>
                </View>
              );
            })}
          </View>
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
  pageSubtitle: { fontSize: 15, color: AppColors.textSecondary, marginBottom: Spacing.sm },
  summary: { fontSize: 14, fontWeight: '600', color: AppColors.success, marginBottom: Spacing.md },
  muted: { fontSize: 15, color: AppColors.textSecondary },
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
  list: { gap: Spacing.lg },
  card: {
    backgroundColor: AppColors.card,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    ...CardShadow,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.sm },
  priorityBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  priorityText: { fontSize: 12, fontWeight: '600' },
  audienceBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, backgroundColor: '#f3e8ff' },
  audienceText: { fontSize: 12, fontWeight: '600', color: '#7c3aed' },
  title: { fontSize: 17, fontWeight: '700', color: AppColors.text, marginBottom: Spacing.sm },
  content: { fontSize: 15, color: AppColors.text, lineHeight: 22 },
  meta: { fontSize: 13, color: AppColors.textSecondary, marginTop: Spacing.sm },
});
