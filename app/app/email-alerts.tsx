import React, { useEffect, useState, useCallback } from 'react';
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Platform,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Spacing, BorderRadius, AppColors, CardShadow } from '@/constants/theme';
import api from '@/lib/api';

const TYPE_CONFIG: Record<string, { icon: string; label: string; bg: string; color: string }> = {
  BIRTHDAY: { icon: 'cake', label: 'Birthday', bg: '#fce7f3', color: '#be185d' },
  WORK_ANNIVERSARY: { icon: 'celebration', label: 'Anniversary', bg: '#fef3c7', color: '#b45309' },
  PROBATION_REMINDER: { icon: 'schedule', label: 'Probation', bg: '#dbeafe', color: '#2563eb' },
  LEAVE_BALANCE: { icon: 'today', label: 'Leave Balance', bg: '#dcfce7', color: '#15803d' },
  SLA_BREACH: { icon: 'warning', label: 'SLA Breach', bg: '#fee2e2', color: '#b91c1c' },
};

type Alert = {
  _id: string;
  type?: string;
  status?: string;
  createdAt: string;
  recipient?: { name?: string; employeeId?: string };
};

type Stats = {
  total?: number;
  sentToday?: number;
  byType?: Record<string, number>;
};

export default function EmailAlertsScreen() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats>({});
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [triggerMsg, setTriggerMsg] = useState('');

  const load = useCallback(async () => {
    try {
      const [statsRes, historyRes] = await Promise.all([
        api.get<{ data: Stats }>('/email-alerts/stats'),
        api.get<{ data: { alerts: Alert[] } }>('/email-alerts/history?limit=30'),
      ]);
      setStats(statsRes.data.data ?? {});
      setAlerts(historyRes.data.data?.alerts ?? []);
    } catch {
      setStats({});
      setAlerts([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const runAll = async () => {
    setTriggering(true);
    setTriggerMsg('');
    try {
      const { data } = await api.post<{ data: Record<string, number> }>('/email-alerts/trigger', {});
      const d = data.data as Record<string, number>;
      setTriggerMsg(`Sent — ${Object.entries(d).map(([k, v]) => `${k}: ${v}`).join(', ')}`);
      await load();
    } catch (e: unknown) {
      const res = e as { response?: { data?: { message?: string } } };
      setTriggerMsg(res?.response?.data?.message ?? 'Failed to run alerts.');
    } finally {
      setTriggering(false);
    }
  };

  const fmt = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  return (
    <View style={[styles.screen, { backgroundColor: AppColors.background }]}>
      <SafeAreaView style={styles.safeTop}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <MaterialIcons name={Platform.OS === 'ios' ? 'arrow-back-ios' : 'arrow-back'} size={Platform.OS === 'ios' ? 22 : 24} color={AppColors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Email Alerts</Text>
          <View style={styles.backBtn} />
        </View>
      </SafeAreaView>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={AppColors.tint} />}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.pageSubtitle}>Birthday, anniversary, probation, leave balance & SLA alerts</Text>

        <TouchableOpacity
          style={[styles.runAllBtn, triggering && styles.runAllBtnDisabled]}
          onPress={runAll}
          disabled={triggering}
        >
          {triggering ? <ActivityIndicator color="#fff" /> : <MaterialIcons name="send" size={22} color="#fff" />}
          <Text style={styles.runAllText}>{triggering ? 'Sending…' : 'Run All Alerts Now'}</Text>
        </TouchableOpacity>

        {triggerMsg ? (
          <View style={[styles.alertBanner, triggerMsg.startsWith('Sent') ? styles.alertSuccess : styles.alertError]}>
            <MaterialIcons name={triggerMsg.startsWith('Sent') ? 'check-circle' : 'error'} size={20} color={triggerMsg.startsWith('Sent') ? AppColors.success : AppColors.danger} />
            <Text style={[styles.alertBannerText, { color: triggerMsg.startsWith('Sent') ? AppColors.success : AppColors.danger }]}>{triggerMsg}</Text>
          </View>
        ) : null}

        {!loading && (
          <View style={styles.statsRow}>
            <View style={[styles.statCard, { backgroundColor: '#dbeafe' }]}>
              <Text style={[styles.statValue, { color: '#2563eb' }]}>{stats.total ?? '—'}</Text>
              <Text style={[styles.statLabel, { color: '#2563eb' }]}>Total</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: '#dcfce7' }]}>
              <Text style={[styles.statValue, { color: '#15803d' }]}>{stats.sentToday ?? '—'}</Text>
              <Text style={[styles.statLabel, { color: '#15803d' }]}>Today</Text>
            </View>
          </View>
        )}

        {!loading && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.typeScroll}>
            {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
              <View key={key} style={[styles.typeCard, { backgroundColor: cfg.bg }]}>
                <MaterialIcons name={cfg.icon as never} size={20} color={cfg.color} />
                <Text style={[styles.typeValue, { color: cfg.color }]}>{stats.byType?.[key] ?? 0}</Text>
                <Text style={[styles.typeLabel, { color: cfg.color }]}>{cfg.label}</Text>
              </View>
            ))}
          </ScrollView>
        )}

        <Text style={styles.sectionTitle}>Recent history</Text>
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={AppColors.tint} />
          </View>
        ) : alerts.length === 0 ? (
          <View style={styles.emptyCard}>
            <MaterialIcons name="email" size={40} color={AppColors.textSecondary} />
            <Text style={styles.emptyText}>No alert history yet</Text>
            <Text style={styles.muted}>Run alerts to see history here.</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {alerts.slice(0, 25).map((a) => {
              const cfg = TYPE_CONFIG[a.type ?? ''] ?? { label: a.type ?? '—', bg: '#f3f4f6', color: '#6b7280' };
              return (
                <View key={a._id} style={[styles.alertRow, { borderLeftColor: cfg.color }]}>
                  <View style={styles.alertRowBody}>
                    <Text style={styles.alertType}>{cfg.label}</Text>
                    <Text style={styles.alertRecipient}>{a.recipient?.name ?? a.recipient?.employeeId ?? '—'}</Text>
                    <Text style={styles.alertDate}>{fmt(a.createdAt)} · {a.status ?? '—'}</Text>
                  </View>
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
  safeTop: {},
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
  bottomPad: { height: Spacing.section },
  pageSubtitle: { fontSize: 15, color: AppColors.textSecondary, marginBottom: Spacing.lg },
  runAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    height: 52,
    borderRadius: BorderRadius.md,
    backgroundColor: AppColors.tint,
    marginBottom: Spacing.lg,
  },
  runAllBtnDisabled: { opacity: 0.7 },
  runAllText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
  },
  alertSuccess: { backgroundColor: `${AppColors.success}18` },
  alertError: { backgroundColor: `${AppColors.danger}12` },
  alertBannerText: { fontSize: 14, flex: 1 },
  statsRow: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.lg },
  statCard: { flex: 1, padding: Spacing.lg, borderRadius: BorderRadius.xl, alignItems: 'center' },
  statValue: { fontSize: 24, fontWeight: '700' },
  statLabel: { fontSize: 12, fontWeight: '600' },
  typeScroll: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.xl, paddingRight: Spacing.xl },
  typeCard: { paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg, borderRadius: BorderRadius.xl, minWidth: 90, alignItems: 'center' },
  typeValue: { fontSize: 18, fontWeight: '700', marginTop: 4 },
  typeLabel: { fontSize: 11, fontWeight: '600' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: AppColors.text, marginBottom: Spacing.md },
  muted: { fontSize: 14, color: AppColors.textSecondary, marginTop: 4 },
  loadingWrap: { alignItems: 'center', paddingVertical: Spacing.lg },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
    backgroundColor: AppColors.card,
    borderRadius: BorderRadius.xl,
    ...CardShadow,
  },
  emptyText: { fontSize: 17, fontWeight: '600', color: AppColors.text, marginTop: Spacing.md },
  list: { gap: Spacing.sm },
  alertRow: {
    flexDirection: 'row',
    backgroundColor: AppColors.card,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderLeftWidth: 4,
    ...CardShadow,
  },
  alertRowBody: { flex: 1 },
  alertType: { fontSize: 14, fontWeight: '700', color: AppColors.text },
  alertRecipient: { fontSize: 13, color: AppColors.textSecondary, marginTop: 2 },
  alertDate: { fontSize: 12, color: AppColors.textSecondary, marginTop: 2 },
});
