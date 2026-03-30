import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { BorderRadius, Spacing } from '@/constants/theme';
import { useAppColors } from '@/hooks/use-app-theme';
import { useAuthStore } from '@/store/authStore';
import api from '@/lib/api';

export default function AuditLogScreen() {
  const colors = useAppColors();
  const getRole = useAuthStore((s) => s.getRole);
  const role = getRole();
  const canClear = role === 'SUPER_ADMIN';

  type Severity = 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
  type Method = 'POST' | 'PATCH' | 'PUT' | 'DELETE' | 'OTHER';

  type AuditLog = {
    _id: string;
    actorName?: string;
    actorRole?: string;
    action?: string;
    method?: Method | string;
    entity?: string;
    description?: string;
    ip?: string;
    path?: string;
    statusCode?: number;
    severity?: Severity | string;
    createdAt?: string;
  };

  type Stats = {
    total?: number;
    today?: number;
    thisWeek?: number;
    bySeverity?: Record<string, number>;
  };

  const SEVERITY_STYLE: Record<string, { bg: string; color: string }> = {
    INFO: { bg: '#dbeafe', color: '#2563eb' },
    WARNING: { bg: '#fef3c7', color: '#b45309' },
    ERROR: { bg: '#fee2e2', color: '#b91c1c' },
    CRITICAL: { bg: '#7f1d1d', color: '#ffffff' },
  };

  const METHOD_STYLE: Record<string, { bg: string; color: string }> = {
    POST: { bg: '#dcfce7', color: '#15803d' },
    PATCH: { bg: '#dbeafe', color: '#2563eb' },
    PUT: { bg: '#e0e7ff', color: '#4338ca' },
    DELETE: { bg: '#fee2e2', color: '#b91c1c' },
    OTHER: { bg: '#f3f4f6', color: '#6b7280' },
  };

  const SEVERITIES: string[] = ['INFO', 'WARNING', 'ERROR', 'CRITICAL'];
  const METHODS: string[] = ['POST', 'PATCH', 'PUT', 'DELETE', 'OTHER'];

  const ENTITIES = useMemo(
    () => [
      'Auth',
      'User',
      'Attendance',
      'Salary',
      'Leave',
      'Branch',
      'Department',
      'Holiday',
      'Resignation',
      'Document',
      'ExpenseClaim',
      'DailyTask',
      'Announcement',
      'Ticket',
      'Asset',
      'Onboarding',
      'Notification',
      'Warning',
      'SalaryRequest',
      'Analytics',
      'Export',
      'Face',
      'System',
    ],
    []
  );

  const ACTIONS = useMemo(() => ['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT'], []);

  const fmtDateTime = (d?: string) => {
    if (!d) return '—';
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return '—';
    return dt.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const timeAgo = (d?: string) => {
    if (!d) return '—';
    const dt = new Date(d);
    const diffSec = Math.floor((Date.now() - dt.getTime()) / 1000);
    if (diffSec < 30) return 'just now';
    if (diffSec < 60) return `${diffSec}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH}h ago`;
    const diffD = Math.floor(diffH / 24);
    return diffD === 1 ? 'yesterday' : `${diffD}d ago`;
  };

  const Badge = ({ text, bg, color }: { text: string; bg: string; color: string }) => (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.badgeText, { color }]} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [stats, setStats] = useState<Stats>({});
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [clearing, setClearing] = useState(false);

  const [filters, setFilters] = useState({
    search: '',
    actor: '',
    severity: '',
    action: '',
    entity: '',
    method: '',
    startDate: '',
    endDate: '',
  });

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const buildParams = useCallback(() => {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', '50');
    if (filters.search.trim()) params.set('search', filters.search.trim());
    if (filters.severity) params.set('severity', filters.severity);
    if (filters.action) params.set('action', filters.action);
    if (filters.entity) params.set('entity', filters.entity);
    if (filters.method) params.set('method', filters.method);
    if (filters.actor.trim()) params.set('actor', filters.actor.trim());
    if (filters.startDate) params.set('startDate', filters.startDate);
    if (filters.endDate) params.set('endDate', filters.endDate);
    return params;
  }, [filters, page]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const params = buildParams();
      const [logRes, statsRes] = await Promise.all([
        api.get<{ data: { logs: AuditLog[]; total: number; pages: number } }>(
          `/audit-logs?${params.toString()}`
        ),
        api.get<{ data: Stats }>('/audit-logs/stats'),
      ]);
      setLogs(logRes.data.data.logs ?? []);
      setTotal(logRes.data.data.total ?? 0);
      setPages(logRes.data.data.pages ?? 1);
      setStats(statsRes.data.data ?? {});
    } catch {
      setLogs([]);
      setTotal(0);
      setPages(1);
      setStats({});
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [buildParams]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchAll();
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [fetchAll]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAll();
  };

  const clearOld = async () => {
    if (!canClear) return;
    Alert.alert('Clear Audit Logs', 'Delete audit logs older than 90 days?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          try {
            setClearing(true);
            await api.delete('/audit-logs/clear?olderThanDays=90');
            setPage(1);
            setFilters({
              search: '',
              actor: '',
              severity: '',
              action: '',
              entity: '',
              method: '',
              startDate: '',
              endDate: '',
            });
            fetchAll();
          } catch {
            Alert.alert('Error', 'Failed to clear audit logs.');
          } finally {
            setClearing(false);
          }
        },
      },
    ]);
  };

  const totalText = `${total.toLocaleString()} log entries`;

  const renderChipRow = (
    values: string[],
    selected: string,
    onSelect: (v: string) => void,
    labelForAll: string
  ) => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
      <TouchableOpacity style={[styles.chip, !selected && styles.chipActive]} onPress={() => onSelect('')}>
        <Text style={[styles.chipText, !selected && styles.chipTextActive]}>{labelForAll}</Text>
      </TouchableOpacity>
      {values.map((v) => (
        <TouchableOpacity key={v} style={[styles.chip, selected === v && styles.chipActive]} onPress={() => onSelect(v)}>
          <Text style={[styles.chipText, selected === v && styles.chipTextActive]}>{v}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  const renderItem = ({ item }: { item: AuditLog }) => {
    const sev = String(item.severity ?? 'INFO');
    const sevStyle = SEVERITY_STYLE[sev] ?? SEVERITY_STYLE.INFO;
    const method = String(item.method ?? 'OTHER');
    const methodStyle = METHOD_STYLE[method] ?? METHOD_STYLE.OTHER;
    const actorName = item.actorName || 'System';

    return (
      <View style={[styles.logCard, { backgroundColor: colors.card, borderColor: 'rgba(60,60,67,0.12)' }]}>
        <View style={styles.logTopRow}>
          <View style={{ flex: 1, gap: Spacing.xs }}>
            <Text style={[styles.logActor, { color: colors.text }]} numberOfLines={1}>
              {actorName}
            </Text>
            {item.actorRole ? (
              <Badge text={item.actorRole} bg={colors.tint + '20'} color={colors.tint} />
            ) : null}
          </View>
          <Text style={[styles.timeText, { color: colors.textSecondary }]}>{timeAgo(item.createdAt)}</Text>
        </View>

        <View style={styles.badgesRow}>
          <Badge text={method} bg={methodStyle.bg} color={methodStyle.color} />
          <Badge text={sev} bg={sevStyle.bg} color={sevStyle.color} />
          {item.action ? <Badge text={item.action} bg={colors.tint + '20'} color={colors.tint} /> : null}
          {item.entity ? <Badge text={item.entity} bg={'#ede9fe'} color={'#6d28d9'} /> : null}
        </View>

        <Text style={[styles.logDesc, { color: colors.textSecondary }]} numberOfLines={3}>
          {item.description || item.action || '—'}
        </Text>

        <View style={styles.metaRow}>
          {item.path ? <Text style={[styles.metaText, { color: colors.textSecondary }]}>Path: {item.path}</Text> : null}
          {item.ip ? <Text style={[styles.metaText, { color: colors.textSecondary }]}>IP: {item.ip}</Text> : null}
          {item.statusCode ? <Text style={[styles.metaText, { color: colors.textSecondary }]}>Status: {item.statusCode}</Text> : null}
          <Text style={[styles.metaText, { color: colors.textSecondary }]}>At: {fmtDateTime(item.createdAt)}</Text>
        </View>
      </View>
    );
  };

  const canShowPagination = pages > 1;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Audit Log</Text>
        {canClear ? (
          <TouchableOpacity
            style={[
              styles.clearBtn,
              { borderColor: colors.destructive, backgroundColor: clearing ? colors.destructive + '20' : colors.background },
            ]}
            onPress={clearOld}
            disabled={clearing}
          >
            <MaterialIcons name="delete-outline" size={18} color={colors.destructive} />
            <Text style={[styles.clearBtnText, { color: colors.destructive }]}>{clearing ? 'Clearing…' : 'Clear Logs (90d+)'}</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Track all system actions — who did what, when</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statsRow}>
        {[
          { label: 'Total', value: stats.total ?? 0, bg: '#dbeafe', color: '#2563eb' },
          { label: 'Today', value: stats.today ?? 0, bg: '#dcfce7', color: '#15803d' },
          { label: 'This Week', value: stats.thisWeek ?? 0, bg: '#fef3c7', color: '#b45309' },
          { label: 'Info', value: stats.bySeverity?.INFO ?? 0, bg: '#dbeafe', color: '#2563eb' },
          { label: 'Warnings', value: stats.bySeverity?.WARNING ?? 0, bg: '#fef3c7', color: '#b45309' },
          {
            label: 'Errors',
            value: (stats.bySeverity?.ERROR ?? 0) + (stats.bySeverity?.CRITICAL ?? 0),
            bg: '#fee2e2',
            color: '#b91c1c',
          },
        ].map((s) => (
          <View key={s.label} style={[styles.statCard, { backgroundColor: s.bg, borderColor: s.bg }]}>
            <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
            <Text style={[styles.statLabel, { color: s.color }]}>{s.label}</Text>
          </View>
        ))}
      </ScrollView>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.tint} />}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.filterCard, { backgroundColor: colors.card, borderColor: 'rgba(60,60,67,0.12)' }]}>
            <Text style={[styles.filterTitle, { color: colors.textSecondary }]}>Filters</Text>

            <TextInput
              style={[styles.input, { backgroundColor: colors.background, color: colors.text }]}
              placeholder="Search description, name, path..."
              placeholderTextColor={colors.textSecondary}
              value={filters.search}
              onChangeText={(t) => {
                setFilters((f) => ({ ...f, search: t }));
                setPage(1);
              }}
            />

            <TextInput
              style={[styles.input, { backgroundColor: colors.background, color: colors.text }]}
              placeholder="Actor name or ID..."
              placeholderTextColor={colors.textSecondary}
              value={filters.actor}
              onChangeText={(t) => {
                setFilters((f) => ({ ...f, actor: t }));
                setPage(1);
              }}
            />

            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Severity</Text>
            {renderChipRow(SEVERITIES, filters.severity, (v) => { setFilters((f) => ({ ...f, severity: v })); setPage(1); }, 'All')}

            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Action</Text>
            {renderChipRow(ACTIONS, filters.action, (v) => { setFilters((f) => ({ ...f, action: v })); setPage(1); }, 'All')}

            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Entity</Text>
            {renderChipRow(ENTITIES, filters.entity, (v) => { setFilters((f) => ({ ...f, entity: v })); setPage(1); }, 'All')}

            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Method</Text>
            {renderChipRow(METHODS, filters.method, (v) => { setFilters((f) => ({ ...f, method: v })); setPage(1); }, 'All')}

            <View style={styles.dateRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>From</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.background, color: colors.text }]}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.textSecondary}
                  value={filters.startDate}
                  onChangeText={(t) => {
                    setFilters((f) => ({ ...f, startDate: t }));
                    setPage(1);
                  }}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>To</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.background, color: colors.text }]}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.textSecondary}
                  value={filters.endDate}
                  onChangeText={(t) => {
                    setFilters((f) => ({ ...f, endDate: t }));
                    setPage(1);
                  }}
                />
              </View>
            </View>
          </View>

          <View style={styles.resultsRow}>
            <Text style={[styles.resultsText, { color: colors.textSecondary }]}>
              {totalText} · Page {page} of {pages}
            </Text>
          </View>

          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color={colors.tint} />
              <Text style={[styles.muted, { color: colors.textSecondary }]}>Loading audit logs…</Text>
            </View>
          ) : logs.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: colors.card }]}>
              <MaterialIcons name="search-off" size={48} color={colors.textSecondary} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No audit logs found</Text>
              <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                Adjust filters or wait for system activity.
              </Text>
            </View>
          ) : (
            <FlatList
              data={logs}
              keyExtractor={(i) => i._id}
              renderItem={renderItem}
              scrollEnabled={false}
              contentContainerStyle={{ gap: Spacing.md }}
            />
          )}

          {canShowPagination ? (
            <View style={styles.paginationRow}>
              <TouchableOpacity
                style={[styles.pageBtn, page <= 1 && styles.pageBtnDisabled]}
                onPress={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                <MaterialIcons name="chevron-left" size={18} color={colors.textSecondary} />
                <Text style={[styles.pageBtnText, { color: colors.textSecondary }]}>Prev</Text>
              </TouchableOpacity>
              <Text style={[styles.pageInfo, { color: colors.textSecondary }]}>Page {page} of {pages}</Text>
              <TouchableOpacity
                style={[styles.pageBtn, page >= pages && styles.pageBtnDisabled]}
                onPress={() => setPage((p) => Math.min(pages, p + 1))}
                disabled={page >= pages}
              >
                <Text style={[styles.pageBtnText, { color: colors.textSecondary }]}>Next</Text>
                <MaterialIcons name="chevron-right" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          ) : null}

          <View style={styles.bottomPad} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    paddingHorizontal: Spacing.xxl,
    paddingTop: Spacing.xxl,
    paddingBottom: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  headerTitle: { fontSize: 22, fontWeight: '700' },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1.5,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  clearBtnText: { fontSize: 13, fontWeight: '800' },
  subtitle: {
    paddingHorizontal: Spacing.xxl,
    marginBottom: Spacing.md,
    fontSize: 15,
    fontWeight: '600',
  },
  statsRow: { paddingHorizontal: Spacing.xxl, gap: Spacing.sm, paddingBottom: Spacing.md },
  statCard: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    minWidth: 110,
    alignItems: 'center',
  },
  statValue: { fontSize: 20, fontWeight: '900' },
  statLabel: { fontSize: 12, fontWeight: '800', marginTop: Spacing.xs },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: Spacing.xxl, paddingBottom: Spacing.section, gap: Spacing.lg },

  filterCard: {
    borderWidth: 1,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
  },
  filterTitle: { fontSize: 13, fontWeight: '800', marginBottom: Spacing.sm, textTransform: 'uppercase' },
  input: {
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: 15,
    marginBottom: Spacing.sm,
  },

  sectionLabel: { fontSize: 13, fontWeight: '800', marginTop: Spacing.sm, marginBottom: Spacing.sm },
  chipScroll: { gap: Spacing.sm, paddingBottom: 4 },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: BorderRadius.md,
    backgroundColor: 'rgba(118,118,128,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(118,118,128,0.0)',
  },
  chipActive: { backgroundColor: '#6366f1' },
  chipText: { fontSize: 13, fontWeight: '800', color: '#3C3C43' },
  chipTextActive: { color: '#fff' },

  dateRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm, marginBottom: Spacing.sm },

  resultsRow: {},
  resultsText: { fontSize: 13, fontWeight: '900' },

  loadingWrap: { alignItems: 'center', paddingVertical: Spacing.xxl, gap: Spacing.sm },
  muted: { fontSize: 14, fontWeight: '700' },

  emptyCard: { borderRadius: BorderRadius.xl, padding: Spacing.xxl, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(60,60,67,0.12)' },
  emptyTitle: { fontSize: 18, fontWeight: '900', marginTop: Spacing.md },
  emptySubtitle: { fontSize: 13, fontWeight: '700', marginTop: Spacing.xs, textAlign: 'center', lineHeight: 20 },

  logCard: { borderRadius: BorderRadius.xl, borderWidth: 1, padding: Spacing.lg },
  logTopRow: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.sm, alignItems: 'flex-start', marginBottom: Spacing.sm },
  logActor: { fontSize: 16, fontWeight: '900' },
  timeText: { fontSize: 12, fontWeight: '800' },
  badgesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.sm },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeText: { fontSize: 12, fontWeight: '900' },
  logDesc: { fontSize: 14, lineHeight: 20, fontWeight: '700', marginBottom: Spacing.sm },
  metaRow: { gap: 2 },
  metaText: { fontSize: 12, fontWeight: '800' },

  paginationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  pageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    backgroundColor: 'rgba(118,118,128,0.12)',
  },
  pageBtnDisabled: { opacity: 0.5 },
  pageBtnText: { fontSize: 14, fontWeight: '900' },
  pageInfo: { fontSize: 13, fontWeight: '900' },

  bottomPad: { height: Spacing.section },
});
