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

const TYPE_CFG: Record<string, { icon: string; color: string }> = {
  LEAVE_APPROVED:      { icon: 'check-circle',      color: '#16a34a' },
  LEAVE_REJECTED:     { icon: 'cancel',            color: '#dc2626' },
  LEAVE_REQUEST:      { icon: 'list',              color: '#2563eb' },
  TICKET_UPDATE:      { icon: 'confirmation-number', color: '#7c3aed' },
  TICKET_ASSIGNED:    { icon: 'confirmation-number', color: '#ea580c' },
  TICKET_NEW:         { icon: 'add-circle',        color: '#0891b2' },
  ANNOUNCEMENT:       { icon: 'campaign',          color: '#2563eb' },
  ONBOARDING_ASSIGNED: { icon: 'school',           color: '#7c3aed' },
  ONBOARDING_COMPLETE: { icon: 'celebration',       color: '#16a34a' },
  ASSET_ASSIGNED:     { icon: 'laptop',            color: '#0891b2' },
  ASSET_RETURNED:     { icon: 'inventory',         color: '#6b7280' },
  WARNING_ISSUED:     { icon: 'warning',           color: '#d97706' },
  EXPENSE_APPROVED:   { icon: 'account-balance-wallet', color: '#16a34a' },
  EXPENSE_REJECTED:   { icon: 'block',             color: '#dc2626' },
  RESIGNATION_UPDATE: { icon: 'edit',              color: '#9333ea' },
  SALARY_UPDATE:      { icon: 'payments',          color: '#059669' },
  GENERAL:            { icon: 'notifications',     color: '#6b7280' },
};

type Notif = {
  _id: string;
  type?: string;
  title?: string;
  message?: string;
  link?: string;
  isRead: boolean;
  readAt?: string;
  createdAt: string;
};

function timeAgo(dateStr: string): string {
  const s = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const day = Math.floor(h / 24);
  if (day === 1) return 'yesterday';
  if (day < 7) return `${day}d ago`;
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export default function NotificationsScreen() {
  const router = useRouter();
  const [list, setList] = useState<Notif[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [clearing, setClearing] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get<{ data: { notifications: Notif[]; unreadCount?: number } }>('/notifications/my?limit=50');
      const notifs = data.data?.notifications ?? [];
      setList(notifs);
      setUnreadCount(data.data?.unreadCount ?? notifs.filter((n) => !n.isRead).length);
    } catch {
      setList([]);
      setUnreadCount(0);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const markRead = async (id: string) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setList((prev) => prev.map((n) => (n._id === id ? { ...n, isRead: true } : n)));
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {}
  };

  const markAllRead = async () => {
    try {
      await api.patch('/notifications/read-all');
      setList((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch {}
  };

  const clearAll = async () => {
    setClearing(true);
    try {
      await api.delete('/notifications/clear-all');
      setList([]);
      setUnreadCount(0);
    } catch {}
    finally { setClearing(false); }
  };

  const handlePress = (n: Notif) => {
    if (!n.isRead) markRead(n._id);
    if (n.link?.trim()) {
      const path = n.link.startsWith('/') ? n.link : `/${n.link}`;
      router.push(path as never);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: AppColors.background }]}>
      <SafeAreaView style={styles.safeTop}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <MaterialIcons name={Platform.OS === 'ios' ? 'arrow-back-ios' : 'arrow-back'} size={Platform.OS === 'ios' ? 22 : 24} color={AppColors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            Notifications
            {unreadCount > 0 ? (
              <Text style={styles.headerBadge}> ({unreadCount})</Text>
            ) : null}
          </Text>
          <View style={styles.backBtn} />
        </View>
      </SafeAreaView>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={AppColors.tint} />}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.pageSubtitle}>Your activity and company updates</Text>

        <View style={styles.actions}>
          {unreadCount > 0 && (
            <TouchableOpacity style={styles.actionBtn} onPress={markAllRead}>
              <MaterialIcons name="done-all" size={20} color={AppColors.tint} />
              <Text style={styles.actionBtnText}>Mark all read</Text>
            </TouchableOpacity>
          )}
          {list.length > 0 && (
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnMuted]}
              onPress={clearAll}
              disabled={clearing}
            >
              {clearing ? <ActivityIndicator size="small" color={AppColors.textSecondary} /> : <MaterialIcons name="delete-sweep" size={20} color={AppColors.textSecondary} />}
              <Text style={[styles.actionBtnText, styles.actionBtnTextMuted]}>Clear all</Text>
            </TouchableOpacity>
          )}
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={AppColors.tint} />
            <Text style={styles.muted}>Loading…</Text>
          </View>
        ) : list.length === 0 ? (
          <View style={styles.emptyCard}>
            <MaterialIcons name="notifications-none" size={48} color={AppColors.textSecondary} />
            <Text style={styles.emptyText}>No notifications yet</Text>
            <Text style={styles.muted}>You're all caught up.</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {list.map((n, i) => {
              const cfg = TYPE_CFG[n.type ?? ''] ?? TYPE_CFG.GENERAL;
              return (
                <TouchableOpacity
                  key={n._id}
                  style={[
                    styles.row,
                    i < list.length - 1 && styles.rowBorder,
                    !n.isRead && styles.rowUnread,
                  ]}
                  onPress={() => handlePress(n)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.iconWrap, { backgroundColor: `${cfg.color}18` }]}>
                    <MaterialIcons name={cfg.icon} size={20} color={cfg.color} />
                  </View>
                  <View style={styles.body}>
                    <Text style={[styles.title, !n.isRead && styles.titleUnread]} numberOfLines={2}>
                      {n.title ?? 'Notification'}
                    </Text>
                    {n.message ? (
                      <Text style={styles.message} numberOfLines={2}>{n.message}</Text>
                    ) : null}
                    <Text style={styles.time}>{timeAgo(n.createdAt)}</Text>
                  </View>
                  {!n.isRead && <View style={styles.unreadDot} />}
                </TouchableOpacity>
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
  headerBadge: { color: AppColors.danger, fontWeight: '700' },
  scroll: { flex: 1 },
  content: { padding: Spacing.xl, paddingBottom: Spacing.section },
  bottomPad: { height: Spacing.section },
  pageSubtitle: { fontSize: 15, color: AppColors.textSecondary, marginBottom: Spacing.lg },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.lg },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: 10,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    borderColor: AppColors.tint,
  },
  actionBtnMuted: { borderColor: 'rgba(118,118,128,0.3)' },
  actionBtnText: { fontSize: 14, fontWeight: '600', color: AppColors.tint },
  actionBtnTextMuted: { color: AppColors.textSecondary },
  muted: { fontSize: 14, color: AppColors.textSecondary, marginTop: Spacing.sm },
  loadingWrap: { alignItems: 'center', paddingVertical: Spacing.xxl },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
    backgroundColor: AppColors.card,
    borderRadius: BorderRadius.xl,
    ...CardShadow,
  },
  emptyText: { fontSize: 17, fontWeight: '600', color: AppColors.text, marginTop: Spacing.md },
  list: { backgroundColor: AppColors.card, borderRadius: BorderRadius.xl, overflow: 'hidden', ...CardShadow },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: Spacing.lg,
    minHeight: 56,
  },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(60,60,67,0.08)' },
  rowUnread: { backgroundColor: '#f0f7ff' },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  body: { flex: 1, minWidth: 0 },
  title: { fontSize: 15, fontWeight: '600', color: AppColors.text },
  titleUnread: { fontWeight: '700' },
  message: { fontSize: 13, color: AppColors.textSecondary, marginTop: 2, lineHeight: 18 },
  time: { fontSize: 12, color: AppColors.textSecondary, marginTop: 4 },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2563eb',
    marginTop: 6,
    marginLeft: Spacing.sm,
  },
});
