import React, { useEffect, useState, useCallback } from 'react';
import {
  ScrollView,
  View,
  Text,
  TextInput,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Linking,
  Platform,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Spacing, BorderRadius, AppColors, CardShadow } from '@/constants/theme';
import api from '@/lib/api';

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Administrator',
  DIRECTOR: 'Director',
  HR: 'HR',
  ACCOUNTS: 'Accounts',
  EMPLOYEE: 'Employee',
};

type DirUser = {
  _id: string;
  name: string;
  employeeId?: string;
  email?: string;
  phone?: string;
  role?: string;
  designation?: string;
  department?: { name: string };
  branch?: { name: string };
  photoUrl?: string;
};

type Department = { _id: string; name: string; isActive?: boolean };

function getInitials(name: string): string {
  if (!name || !name.trim()) return '?';
  return name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}

export default function DirectoryScreen() {
  const router = useRouter();
  const [users, setUsers] = useState<DirUser[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (search.trim()) params.search = search.trim();
      if (deptFilter) params.department = deptFilter;
      if (roleFilter) params.role = roleFilter;
      const { data } = await api.get<{ data: DirUser[] }>('/users/directory', { params });
      setUsers(data.data ?? []);
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search, deptFilter, roleFilter]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    api.get<{ data: Department[] }>('/departments').then(({ data }) => setDepartments(data.data ?? [])).catch(() => {});
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const openEmail = (email?: string) => {
    if (email) Linking.openURL(`mailto:${email}`);
  };
  const openPhone = (phone?: string) => {
    if (phone) Linking.openURL(`tel:${phone}`);
  };

  const activeDepts = departments.filter((d) => d.isActive !== false);

  return (
    <View style={[styles.screen, { backgroundColor: AppColors.background }]}>
      <SafeAreaView style={styles.safeTop}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <MaterialIcons name={Platform.OS === 'ios' ? 'arrow-back-ios' : 'arrow-back'} size={Platform.OS === 'ios' ? 22 : 24} color={AppColors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Directory</Text>
          <View style={styles.backBtn} />
        </View>
      </SafeAreaView>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={AppColors.tint} />}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.pageSubtitle}>Who’s who — search by name, ID, department or designation</Text>

        <View style={styles.searchWrap}>
          <MaterialIcons name="search" size={22} color={AppColors.textSecondary} style={styles.searchIcon} />
          <TextInput
            style={styles.search}
            placeholder="Name, ID, email or designation..."
            placeholderTextColor={AppColors.textSecondary}
            value={search}
            onChangeText={setSearch}
          />
        </View>

        <View style={styles.filters}>
          <Text style={styles.filterSectionLabel}>Department</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
            <TouchableOpacity style={[styles.chip, !deptFilter && styles.chipActive]} onPress={() => setDeptFilter('')} activeOpacity={0.7}>
              <Text style={[styles.chipText, !deptFilter && styles.chipTextActive]}>All</Text>
            </TouchableOpacity>
            {activeDepts.map((d) => (
              <TouchableOpacity
                key={d._id}
                style={[styles.chip, deptFilter === d._id && styles.chipActive]}
                onPress={() => setDeptFilter(deptFilter === d._id ? '' : d._id)}
                activeOpacity={0.7}
              >
                <Text style={[styles.chipText, deptFilter === d._id && styles.chipTextActive]} numberOfLines={1}>{d.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <Text style={styles.filterSectionLabel}>Role</Text>
          <View style={styles.roleRow}>
            <TouchableOpacity style={[styles.chip, !roleFilter && styles.chipActive]} onPress={() => setRoleFilter('')} activeOpacity={0.7}>
              <Text style={[styles.chipText, !roleFilter && styles.chipTextActive]}>All</Text>
            </TouchableOpacity>
            {['DIRECTOR', 'HR', 'ACCOUNTS', 'EMPLOYEE'].map((r) => (
              <TouchableOpacity
                key={r}
                style={[styles.chip, roleFilter === r && styles.chipActive]}
                onPress={() => setRoleFilter(roleFilter === r ? '' : r)}
                activeOpacity={0.7}
              >
                <Text style={[styles.chipText, roleFilter === r && styles.chipTextActive]}>{ROLE_LABELS[r] ?? r}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.viewToggle}>
            <TouchableOpacity style={[styles.toggleBtn, viewMode === 'grid' && styles.toggleBtnActive]} onPress={() => setViewMode('grid')} activeOpacity={0.8}>
              <MaterialIcons name="grid-view" size={20} color={viewMode === 'grid' ? '#fff' : AppColors.textSecondary} />
              <Text style={[styles.toggleText, viewMode === 'grid' && styles.toggleTextActive]}>Grid</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.toggleBtn, viewMode === 'list' && styles.toggleBtnActive]} onPress={() => setViewMode('list')} activeOpacity={0.8}>
              <MaterialIcons name="view-list" size={20} color={viewMode === 'list' ? '#fff' : AppColors.textSecondary} />
              <Text style={[styles.toggleText, viewMode === 'list' && styles.toggleTextActive]}>List</Text>
            </TouchableOpacity>
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={AppColors.tint} />
            <Text style={styles.muted}>Loading directory…</Text>
          </View>
        ) : users.length === 0 ? (
          <View style={styles.emptyCard}>
            <MaterialIcons name="contacts" size={48} color={AppColors.textSecondary} />
            <Text style={styles.emptyText}>No employees match your search</Text>
            <Text style={styles.muted}>Try a different search or filters.</Text>
          </View>
        ) : viewMode === 'grid' ? (
          <View style={styles.grid}>
            {users.map((u) => (
              <View key={u._id} style={styles.gridCard}>
                <View style={styles.gridAvatar}>
                  <Text style={styles.avatarText}>{getInitials(u.name ?? '')}</Text>
                </View>
                <Text style={styles.gridName}>{u.name}</Text>
                {u.employeeId ? <Text style={styles.gridId}>{u.employeeId}</Text> : null}
                <Text style={styles.gridMeta}>{u.designation ?? '—'}</Text>
                <Text style={styles.gridDept}>{u.department?.name ?? '—'}{u.branch?.name ? ` · ${u.branch.name}` : ''}</Text>
                <View style={styles.roleBadge}>
                  <Text style={styles.roleBadgeText}>{ROLE_LABELS[u.role ?? ''] ?? u.role ?? '—'}</Text>
                </View>
                <View style={styles.contactBlock}>
                  {u.email ? (
                    <TouchableOpacity style={styles.contactBtn} onPress={() => openEmail(u.email)} activeOpacity={0.7}>
                      <MaterialIcons name="email" size={18} color={AppColors.tint} />
                      <Text style={styles.contactLinkText} numberOfLines={1}>{u.email}</Text>
                    </TouchableOpacity>
                  ) : null}
                  {u.phone ? (
                    <TouchableOpacity style={styles.contactBtn} onPress={() => openPhone(u.phone)} activeOpacity={0.7}>
                      <MaterialIcons name="phone" size={18} color={AppColors.tint} />
                      <Text style={styles.contactLinkText}>{u.phone}</Text>
                    </TouchableOpacity>
                  ) : null}
                  {!u.email && !u.phone ? <Text style={styles.noContact}>No contact</Text> : null}
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.list}>
            {users.map((u, i) => (
              <View key={u._id} style={[styles.listCard, i < users.length - 1 && styles.listCardBorder]}>
                <View style={styles.listAvatar}>
                  <Text style={styles.avatarText}>{getInitials(u.name ?? '')}</Text>
                </View>
                <View style={styles.listBody}>
                  <Text style={styles.listName}>{u.name} {u.employeeId ? <Text style={styles.listId}>({u.employeeId})</Text> : null}</Text>
                  <View style={styles.listMeta}>
                    <Text style={styles.listMetaText}>{u.designation ?? '—'}</Text>
                    <Text style={styles.listMetaText}>{u.department?.name ?? '—'}</Text>
                    <View style={styles.roleBadge}>
                      <Text style={styles.roleBadgeText}>{ROLE_LABELS[u.role ?? ''] ?? u.role ?? '—'}</Text>
                    </View>
                  </View>
                  <View style={styles.listContactInline}>
                    {u.email ? (
                      <TouchableOpacity style={styles.listContactBtn} onPress={() => openEmail(u.email)} activeOpacity={0.7}>
                        <MaterialIcons name="email" size={16} color={AppColors.tint} />
                        <Text style={styles.contactLinkText} numberOfLines={1}>{u.email}</Text>
                      </TouchableOpacity>
                    ) : null}
                    {u.phone ? (
                      <TouchableOpacity style={styles.listContactBtn} onPress={() => openPhone(u.phone)} activeOpacity={0.7}>
                        <MaterialIcons name="phone" size={16} color={AppColors.tint} />
                        <Text style={styles.contactLinkText}>{u.phone}</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        {!loading && users.length > 0 && (
          <Text style={styles.footer}>
            {users.length} employee{users.length !== 1 ? 's' : ''} found
          </Text>
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
  content: { padding: Spacing.lg, paddingBottom: Spacing.section },
  bottomPad: { height: Spacing.section },
  pageSubtitle: { fontSize: 15, color: AppColors.textSecondary, marginBottom: Spacing.lg },
  searchWrap: { position: 'relative', marginBottom: Spacing.lg },
  searchIcon: { position: 'absolute', left: Spacing.lg, top: 18, zIndex: 1 },
  search: {
    minHeight: 52,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg,
    paddingLeft: 48,
    fontSize: 16,
    color: AppColors.text,
    backgroundColor: AppColors.card,
    borderWidth: 1,
    borderColor: 'rgba(118,118,128,0.2)',
  },
  filters: { marginBottom: Spacing.xl },
  filterSectionLabel: { fontSize: 13, fontWeight: '600', color: AppColors.textSecondary, marginBottom: Spacing.sm },
  chipScroll: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingRight: Spacing.xl, marginBottom: Spacing.lg },
  roleRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.lg },
  chip: {
    minHeight: 44,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 12,
    borderRadius: BorderRadius.lg,
    backgroundColor: 'rgba(118,118,128,0.12)',
    justifyContent: 'center',
  },
  chipActive: { backgroundColor: AppColors.tint },
  chipText: { fontSize: 14, fontWeight: '600', color: AppColors.text },
  chipTextActive: { color: '#fff' },
  viewToggle: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs },
  toggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 44,
    paddingVertical: 12,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(118,118,128,0.2)',
  },
  toggleBtnActive: { backgroundColor: AppColors.tint, borderColor: AppColors.tint },
  toggleText: { fontSize: 14, fontWeight: '600', color: AppColors.textSecondary },
  toggleTextActive: { color: '#fff' },
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
  grid: { gap: Spacing.lg },
  gridCard: {
    width: '100%',
    backgroundColor: AppColors.card,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    alignItems: 'center',
    ...CardShadow,
  },
  gridAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: AppColors.tint,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  avatarText: { color: '#fff', fontSize: 20, fontWeight: '700' },
  gridName: { fontSize: 16, fontWeight: '700', color: AppColors.text, marginBottom: 2 },
  gridId: { fontSize: 13, fontWeight: '600', color: AppColors.tint, marginBottom: 4 },
  gridMeta: { fontSize: 13, color: AppColors.textSecondary, marginBottom: 2 },
  gridDept: { fontSize: 12, color: AppColors.textSecondary, marginBottom: Spacing.sm },
  roleBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, backgroundColor: 'rgba(118,118,128,0.12)', marginBottom: Spacing.sm },
  roleBadgeText: { fontSize: 12, fontWeight: '600', color: AppColors.text },
  contactBlock: { width: '100%', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(60,60,67,0.12)', paddingTop: Spacing.md, alignItems: 'stretch' },
  contactBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 44,
    paddingVertical: 8,
    marginBottom: 4,
  },
  contactLinkText: { fontSize: 14, fontWeight: '600', color: AppColors.tint },
  noContact: { fontSize: 13, color: AppColors.textSecondary },
  list: { backgroundColor: AppColors.card, borderRadius: BorderRadius.xl, overflow: 'hidden', ...CardShadow },
  listCard: { flexDirection: 'row', alignItems: 'flex-start', padding: Spacing.lg, gap: Spacing.md },
  listCardBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(60,60,67,0.12)' },
  listAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: AppColors.tint,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listBody: { flex: 1, minWidth: 0 },
  listName: { fontSize: 16, fontWeight: '700', color: AppColors.text },
  listId: { fontSize: 14, fontWeight: '500', color: AppColors.textSecondary },
  listMeta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Spacing.sm, marginTop: 4 },
  listMetaText: { fontSize: 13, color: AppColors.textSecondary },
  listContactInline: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Spacing.md, marginTop: Spacing.sm },
  listContactBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    paddingVertical: 8,
    paddingRight: Spacing.sm,
    justifyContent: 'flex-start',
  },
  footer: { marginTop: Spacing.lg, fontSize: 13, color: AppColors.textSecondary, textAlign: 'center' },
});
