import React, { useEffect, useState, useCallback } from 'react';
import {
  ScrollView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  SafeAreaView,
  Platform,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Alert,
  Switch,
} from 'react-native';
import { useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Spacing, BorderRadius, AppColors, CardShadow } from '@/constants/theme';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

// ─── Types ───────────────────────────────────────────────────────────────
type ChecklistItem = {
  _id: string;
  title: string;
  description?: string;
  category?: string;
  order?: number;
  isCompleted?: boolean;
  completedAt?: string;
  completedBy?: { name?: string };
};
type OnboardingRecord = {
  _id: string;
  checklist: ChecklistItem[];
  dueDate?: string;
  status?: string;
  completionPercent?: number;
  employee?: {
    _id: string;
    name?: string;
    employeeId?: string;
    designation?: string;
    joiningDate?: string;
    department?: { name?: string };
  };
};

const CATEGORIES: Record<string, { label: string; color: string; icon: keyof typeof MaterialIcons.glyphMap }> = {
  DOCUMENTS: { label: 'Documents', color: '#2563eb', icon: 'description' },
  IT_SETUP: { label: 'IT Setup', color: '#7c3aed', icon: 'computer' },
  HR_FORMALITIES: { label: 'HR Formalities', color: '#b45309', icon: 'assignment' },
  TRAINING: { label: 'Training', color: '#15803d', icon: 'school' },
  OTHER: { label: 'Other', color: '#6b7280', icon: 'label' },
};
const CATEGORY_OPTIONS = [
  { value: 'DOCUMENTS', label: 'Documents' },
  { value: 'IT_SETUP', label: 'IT Setup' },
  { value: 'HR_FORMALITIES', label: 'HR Formalities' },
  { value: 'TRAINING', label: 'Training' },
  { value: 'OTHER', label: 'Other' },
];

function fmt(d?: string | null) {
  return d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
}

// ─── Create Onboarding Modal (HR) ────────────────────────────────────────
function CreateOnboardingModal({
  visible,
  onClose,
  onCreated,
  showMsg,
}: {
  visible: boolean;
  onClose: () => void;
  onCreated: () => void;
  showMsg: (m: string) => void;
}) {
  const [employeeId, setEmployeeId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [useDefault, setUseDefault] = useState(true);
  const [customItems, setCustomItems] = useState<{ title: string; category: string }[]>([{ title: '', category: 'OTHER' }]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) {
      setEmployeeId('');
      setDueDate('');
      setNotes('');
      setUseDefault(true);
      setCustomItems([{ title: '', category: 'OTHER' }]);
    }
  }, [visible]);

  const addCustomItem = () => setCustomItems((p) => [...p, { title: '', category: 'OTHER' }]);
  const removeCustomItem = (i: number) => setCustomItems((p) => p.filter((_, idx) => idx !== i));
  const updateCustomItem = (i: number, field: 'title' | 'category', val: string) =>
    setCustomItems((p) => p.map((item, idx) => (idx === i ? { ...item, [field]: val } : item)));

  const submit = async () => {
    if (!employeeId.trim()) return showMsg('Employee ID is required.');
    if (!useDefault) {
      const valid = customItems.filter((i) => i.title.trim());
      if (valid.length === 0) return showMsg('Add at least one checklist item.');
    }
    setBusy(true);
    try {
      const payload: { employeeId: string; dueDate?: string; notes?: string; checklist?: { title: string; category: string }[] } = {
        employeeId: employeeId.trim(),
        dueDate: dueDate || undefined,
        notes: notes.trim() || undefined,
      };
      if (!useDefault) {
        payload.checklist = customItems.filter((i) => i.title.trim()).map((i) => ({ title: i.title.trim(), category: i.category }));
      }
      await api.post('/onboarding', payload);
      showMsg('Onboarding created.');
      onCreated();
      onClose();
    } catch (e: unknown) {
      showMsg((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed.');
    } finally {
      setBusy(false);
    }
  };

  if (!visible) return null;
  return (
    <Modal visible animationType="slide" transparent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={modalStyles.overlay}>
        <View style={modalStyles.box}>
          <View style={modalStyles.header}>
            <Text style={modalStyles.title}>Create Onboarding</Text>
            <TouchableOpacity onPress={onClose} style={modalStyles.closeBtn}>
              <MaterialIcons name="close" size={24} color={AppColors.text} />
            </TouchableOpacity>
          </View>
          <ScrollView style={modalStyles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={modalStyles.label}>Employee ID *</Text>
            <TextInput
              style={modalStyles.input}
              placeholder="e.g. EMP-0005"
              placeholderTextColor={AppColors.textSecondary}
              value={employeeId}
              onChangeText={setEmployeeId}
              autoCapitalize="characters"
            />
            <Text style={modalStyles.label}>Due Date</Text>
            <TextInput
              style={modalStyles.input}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={AppColors.textSecondary}
              value={dueDate}
              onChangeText={setDueDate}
            />
            <Text style={modalStyles.label}>Notes (optional)</Text>
            <TextInput
              style={[modalStyles.input, modalStyles.textArea]}
              placeholder="Special instructions..."
              placeholderTextColor={AppColors.textSecondary}
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={2}
              maxLength={1000}
            />
            <View style={modalStyles.switchRow}>
              <Text style={modalStyles.switchLabel}>Use default checklist (12 items)</Text>
              <Switch value={useDefault} onValueChange={setUseDefault} trackColor={{ false: '#ccc', true: AppColors.tint }} thumbColor="#fff" />
            </View>
            {!useDefault && (
              <View style={modalStyles.customSection}>
                <Text style={modalStyles.label}>Custom checklist items</Text>
                {customItems.map((item, i) => (
                  <View key={i} style={modalStyles.customItemRow}>
                    <TextInput
                      style={[modalStyles.input, { flex: 1 }]}
                      placeholder="Task title"
                      placeholderTextColor={AppColors.textSecondary}
                      value={item.title}
                      onChangeText={(v) => updateCustomItem(i, 'title', v)}
                    />
                    <View style={modalStyles.pickerWrap}>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        {CATEGORY_OPTIONS.map((c) => (
                          <TouchableOpacity
                            key={c.value}
                            style={[modalStyles.miniChip, item.category === c.value && modalStyles.miniChipActive]}
                            onPress={() => updateCustomItem(i, 'category', c.value)}
                          >
                            <Text style={[modalStyles.miniChipText, item.category === c.value && modalStyles.miniChipTextActive]} numberOfLines={1}>{c.label}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                    {customItems.length > 1 && (
                      <TouchableOpacity onPress={() => removeCustomItem(i)} style={modalStyles.removeItemBtn}>
                        <MaterialIcons name="remove-circle-outline" size={24} color={AppColors.tint} />
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
                <TouchableOpacity style={modalStyles.addItemBtn} onPress={addCustomItem}>
                  <MaterialIcons name="add-circle-outline" size={22} color={AppColors.tint} />
                  <Text style={modalStyles.addItemText}>Add item</Text>
                </TouchableOpacity>
              </View>
            )}
            <TouchableOpacity style={[modalStyles.submitBtn, busy && modalStyles.submitDisabled]} onPress={submit} disabled={busy}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={modalStyles.submitBtnText}>Create Onboarding</Text>}
            </TouchableOpacity>
            <View style={{ height: Spacing.section }} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Onboarding Detail (HR: single record, toggle/add/delete items, delete record) ─
function OnboardingDetailView({
  record,
  onBack,
  onUpdated,
}: {
  record: OnboardingRecord;
  onBack: () => void;
  onUpdated: () => void;
}) {
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [addTitle, setAddTitle] = useState('');
  const [addCat, setAddCat] = useState('OTHER');
  const [adding, setAdding] = useState(false);

  const toggle = async (itemId: string, current: boolean) => {
    setTogglingId(itemId);
    try {
      await api.patch(`/onboarding/${record._id}/item/${itemId}`, { isCompleted: !current });
      onUpdated();
    } catch {
      // ignore
    } finally {
      setTogglingId(null);
    }
  };

  const addItem = async () => {
    if (!addTitle.trim()) return;
    setAdding(true);
    try {
      await api.post(`/onboarding/${record._id}/item`, { title: addTitle.trim(), category: addCat });
      setAddTitle('');
      onUpdated();
    } catch {
      // ignore
    } finally {
      setAdding(false);
    }
  };

  const deleteItem = (itemId: string) => {
    Alert.alert('Remove item', 'Remove this checklist item?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/onboarding/${record._id}/item/${itemId}`);
            onUpdated();
          } catch {
            // ignore
          }
        },
      },
    ]);
  };

  const sorted = [...(record.checklist ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const isOverdue = record.dueDate && new Date(record.dueDate) < new Date() && record.status !== 'COMPLETED';
  const pct = record.completionPercent ?? 0;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <TouchableOpacity style={styles.backButton} onPress={onBack}>
        <MaterialIcons name={Platform.OS === 'ios' ? 'arrow-back-ios' : 'arrow-back'} size={22} color={AppColors.tint} />
        <Text style={styles.backButtonText}>Back</Text>
      </TouchableOpacity>

      <View style={styles.detailCard}>
        <Text style={styles.detailName}>{record.employee?.name ?? '—'}</Text>
        <Text style={styles.detailMeta}>
          {record.employee?.employeeId ?? '—'} · {record.employee?.designation ?? '—'} · Joined {fmt(record.employee?.joiningDate)}
        </Text>
        <View style={styles.detailStatusRow}>
          <View style={[styles.statusBadge, record.status === 'COMPLETED' ? styles.statusBadgeDone : styles.statusBadgeProgress]}>
            <MaterialIcons name={record.status === 'COMPLETED' ? 'check-circle' : 'schedule'} size={14} color={record.status === 'COMPLETED' ? '#15803d' : '#b45309'} />
            <Text style={[styles.statusBadgeText, record.status === 'COMPLETED' ? styles.statusBadgeTextDone : styles.statusBadgeTextProgress]}>
              {record.status === 'COMPLETED' ? 'Completed' : 'In Progress'}
            </Text>
          </View>
          {isOverdue && (
            <View style={styles.overdueBadge}>
              <Text style={styles.overdueText}>OVERDUE</Text>
            </View>
          )}
        </View>
        <Text style={styles.dueLine}>Due: {fmt(record.dueDate)}</Text>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: pct === 100 ? AppColors.success : AppColors.tint }]} />
        </View>
        <Text style={styles.progressPct}>{pct}%</Text>
      </View>

      {sorted.map((item) => {
        const info = CATEGORIES[item.category ?? 'OTHER'] ?? CATEGORIES.OTHER;
        return (
          <View key={item._id} style={[styles.itemCard, item.isCompleted && styles.itemCardDone]}>
            <TouchableOpacity
              style={[styles.checkbox, item.isCompleted && styles.checkboxDone]}
              onPress={() => toggle(item._id, !!item.isCompleted)}
              disabled={togglingId === item._id}
            >
              {togglingId === item._id ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : item.isCompleted ? (
                <MaterialIcons name="check" size={18} color="#fff" />
              ) : null}
            </TouchableOpacity>
            <View style={styles.itemBody}>
              <View style={styles.itemTitleRow}>
                <Text style={[styles.itemTitle, item.isCompleted && styles.itemTitleDone]}>{item.title}</Text>
                <View style={[styles.catBadge, { backgroundColor: info.color + '20' }]}>
                  <MaterialIcons name={info.icon} size={12} color={info.color} />
                  <Text style={[styles.catBadgeText, { color: info.color }]}>{info.label}</Text>
                </View>
              </View>
              {item.isCompleted && item.completedAt && (
                <Text style={styles.itemDoneMeta}>
                  Done {fmt(item.completedAt)}{item.completedBy?.name ? ` by ${item.completedBy.name}` : ''}
                </Text>
              )}
            </View>
            <TouchableOpacity onPress={() => deleteItem(item._id)} style={styles.deleteItemBtn}>
              <MaterialIcons name="delete-outline" size={22} color="#dc2626" />
            </TouchableOpacity>
          </View>
        );
      })}

      <View style={styles.addItemCard}>
        <Text style={modalStyles.label}>Add checklist item</Text>
        <View style={styles.addItemRow}>
          <TextInput
            style={[modalStyles.input, { flex: 1 }]}
            placeholder="New item title..."
            placeholderTextColor={AppColors.textSecondary}
            value={addTitle}
            onChangeText={setAddTitle}
            maxLength={200}
          />
          <View style={styles.addCatChips}>
            {CATEGORY_OPTIONS.map((c) => (
              <TouchableOpacity
                key={c.value}
                style={[modalStyles.miniChip, addCat === c.value && modalStyles.miniChipActive]}
                onPress={() => setAddCat(c.value)}
              >
                <Text style={[modalStyles.miniChipText, addCat === c.value && modalStyles.miniChipTextActive]} numberOfLines={1}>{c.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={[styles.addItemSubmitBtn, (!addTitle.trim() || adding) && styles.addItemSubmitDisabled]} onPress={addItem} disabled={!addTitle.trim() || adding}>
            {adding ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.addItemSubmitText}>Add</Text>}
          </TouchableOpacity>
        </View>
      </View>
      <View style={{ height: Spacing.section }} />
    </ScrollView>
  );
}

// ─── HR Admin View ────────────────────────────────────────────────────────
function AdminOnboardingView() {
  const router = useRouter();
  const [records, setRecords] = useState<OnboardingRecord[]>([]);
  const [stats, setStats] = useState<{ total?: number; inProgress?: number; completed?: number; overdue?: number }>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<OnboardingRecord | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [msg, setMsg] = useState('');

  const fetchAll = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (search.trim()) params.set('search', search.trim());
      const [rRes, sRes] = await Promise.all([
        api.get<{ data: OnboardingRecord[] }>(`/onboarding?${params.toString()}`),
        api.get<{ data: typeof stats }>('/onboarding/stats'),
      ]);
      setRecords(rRes.data.data ?? []);
      setStats(sRes.data.data ?? {});
    } catch {
      setRecords([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter, search]);

  useEffect(() => {
    const t = setTimeout(fetchAll, 300);
    return () => clearTimeout(t);
  }, [fetchAll]);

  const handleDeleteRecord = (id: string) => {
    Alert.alert('Delete onboarding', 'Delete this onboarding record?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setDeletingId(id);
          try {
            await api.delete(`/onboarding/${id}`);
            setSelected(null);
            fetchAll();
          } catch {
            setMsg('Failed to delete.');
          } finally {
            setDeletingId(null);
          }
        },
      },
    ]);
  };

  if (selected) {
    const fresh = records.find((r) => r._id === selected._id) ?? selected;
    return (
      <View style={[styles.screen, { backgroundColor: AppColors.background }]}>
        <SafeAreaView style={styles.safeTop}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backBtn} onPress={() => { setSelected(null); fetchAll(); }} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <MaterialIcons name={Platform.OS === 'ios' ? 'arrow-back-ios' : 'arrow-back'} size={Platform.OS === 'ios' ? 22 : 24} color={AppColors.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Onboarding Detail</Text>
            <View style={styles.backBtn} />
          </View>
        </SafeAreaView>
        <OnboardingDetailView record={fresh} onBack={() => { setSelected(null); fetchAll(); }} onUpdated={fetchAll} />
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: AppColors.background }]}>
      <SafeAreaView style={styles.safeTop}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <MaterialIcons name={Platform.OS === 'ios' ? 'arrow-back-ios' : 'arrow-back'} size={Platform.OS === 'ios' ? 22 : 24} color={AppColors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Employee Onboarding</Text>
          <View style={styles.backBtn} />
        </View>
      </SafeAreaView>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchAll(); }} tintColor={AppColors.tint} />}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.pageSubtitle}>Track new joinee onboarding progress</Text>
        {msg ? <View style={styles.msgBanner}><Text style={styles.msgText}>{msg}</Text></View> : null}

        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => setShowCreate(true)}>
            <MaterialIcons name="add" size={20} color="#fff" />
            <Text style={styles.primaryBtnText}>New Onboarding</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.statsRow}>
          <View style={[styles.statBox, { backgroundColor: '#dbeafe' }]}>
            <Text style={[styles.statValue, { color: '#2563eb' }]}>{stats.total ?? '—'}</Text>
            <Text style={[styles.statLabel, { color: '#2563eb' }]}>Total</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: '#fef3c7' }]}>
            <Text style={[styles.statValue, { color: '#b45309' }]}>{stats.inProgress ?? '—'}</Text>
            <Text style={[styles.statLabel, { color: '#b45309' }]}>In Progress</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: '#dcfce7' }]}>
            <Text style={[styles.statValue, { color: '#15803d' }]}>{stats.completed ?? '—'}</Text>
            <Text style={[styles.statLabel, { color: '#15803d' }]}>Completed</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: '#fee2e2' }]}>
            <Text style={[styles.statValue, { color: '#b91c1c' }]}>{stats.overdue ?? '—'}</Text>
            <Text style={[styles.statLabel, { color: '#b91c1c' }]}>Overdue</Text>
          </View>
        </View>

        <TextInput
          style={styles.searchInput}
          placeholder="Search name or ID..."
          placeholderTextColor={AppColors.textSecondary}
          value={search}
          onChangeText={setSearch}
        />
        <View style={styles.filterRow}>
          <TouchableOpacity
            style={[styles.filterChip, !statusFilter && styles.filterChipActive]}
            onPress={() => setStatusFilter('')}
          >
            <Text style={[styles.filterChipText, !statusFilter && styles.filterChipTextActive]}>All</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterChip, statusFilter === 'IN_PROGRESS' && styles.filterChipActive]}
            onPress={() => setStatusFilter('IN_PROGRESS')}
          >
            <Text style={[styles.filterChipText, statusFilter === 'IN_PROGRESS' && styles.filterChipTextActive]}>In Progress</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterChip, statusFilter === 'COMPLETED' && styles.filterChipActive]}
            onPress={() => setStatusFilter('COMPLETED')}
          >
            <Text style={[styles.filterChipText, statusFilter === 'COMPLETED' && styles.filterChipTextActive]}>Completed</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <Text style={styles.muted}>Loading…</Text>
        ) : records.length === 0 ? (
          <View style={styles.emptyCard}>
            <MaterialIcons name="launch" size={48} color={AppColors.textSecondary} />
            <Text style={styles.emptyText}>No onboarding records</Text>
            <Text style={styles.emptySub}>Create an onboarding checklist for new joinees</Text>
          </View>
        ) : (
          <View style={styles.recordList}>
            {records.map((r) => {
              const isOverdue = r.dueDate && new Date(r.dueDate) < new Date() && r.status !== 'COMPLETED';
              const borderColor = r.status === 'COMPLETED' ? '#15803d' : isOverdue ? '#dc2626' : '#2563eb';
              return (
                <View key={r._id} style={[styles.recordCard, { borderLeftColor: borderColor }]}>
                  <View style={styles.recordMain}>
                    <View style={styles.recordTitleRow}>
                      <Text style={styles.recordName}>{r.employee?.name ?? '—'}</Text>
                      <Text style={styles.recordId}>{r.employee?.employeeId}</Text>
                      <View style={[styles.recordStatusBadge, r.status === 'COMPLETED' ? styles.recordStatusDone : styles.recordStatusProgress]}>
                        <Text style={[styles.recordStatusText, r.status === 'COMPLETED' ? styles.recordStatusTextDone : styles.recordStatusTextProgress]}>
                          {r.status === 'COMPLETED' ? 'Completed' : 'In Progress'}
                        </Text>
                      </View>
                      {isOverdue && (
                        <View style={styles.overdueBadge}>
                          <Text style={styles.overdueText}>Overdue</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.progressBar}>
                      <View style={[styles.progressFill, { width: `${r.completionPercent ?? 0}%`, backgroundColor: r.status === 'COMPLETED' ? AppColors.success : AppColors.tint }]} />
                    </View>
                    <Text style={styles.recordMeta}>
                      {r.employee?.designation ?? '—'} · Joined {fmt(r.employee?.joiningDate)} · Due {fmt(r.dueDate)} · {r.checklist?.filter((i) => i.isCompleted).length ?? 0}/{r.checklist?.length ?? 0} tasks
                    </Text>
                  </View>
                  <View style={styles.recordActions}>
                    <TouchableOpacity style={styles.viewBtn} onPress={() => setSelected(r)}>
                      <Text style={styles.viewBtnText}>View</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.deleteBtn, deletingId === r._id && styles.deleteBtnDisabled]}
                      onPress={() => handleDeleteRecord(r._id)}
                      disabled={deletingId === r._id}
                    >
                      {deletingId === r._id ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.deleteBtnText}>Delete</Text>}
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}
        <View style={styles.bottomPad} />
      </ScrollView>

      <CreateOnboardingModal
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => { setShowCreate(false); fetchAll(); }}
        showMsg={setMsg}
      />
    </View>
  );
}

// ─── Employee: My Onboarding ──────────────────────────────────────────────
function MyOnboardingView() {
  const router = useRouter();
  const [record, setRecord] = useState<OnboardingRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const load = async () => {
    try {
      const { data } = await api.get<{ data: OnboardingRecord | null }>('/onboarding/my');
      setRecord(data.data ?? null);
    } catch {
      setRecord(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);

  const toggleItem = async (recordId: string, itemId: string, current: boolean) => {
    setTogglingId(itemId);
    try {
      const { data } = await api.patch<{ data: OnboardingRecord }>(`/onboarding/${recordId}/item/${itemId}`, { isCompleted: !current });
      setRecord(data.data);
    } catch {
      // keep existing state
    } finally {
      setTogglingId(null);
    }
  };

  const items = record?.checklist ?? [];
  const sorted = [...items].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const grouped: Record<string, ChecklistItem[]> = {};
  for (const item of sorted) {
    const cat = item.category ?? 'OTHER';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(item);
  }
  const completed = items.filter((i) => i.isCompleted).length;
  const pct = record?.completionPercent ?? (items.length > 0 ? Math.round((completed / items.length) * 100) : 0);
  const isComplete = record?.status === 'COMPLETED';
  const isOverdue = record?.dueDate && new Date(record.dueDate) < new Date() && !isComplete;
  const progressColor = pct === 100 ? AppColors.success : pct >= 50 ? AppColors.tint : '#b45309';

  return (
    <View style={[styles.screen, { backgroundColor: AppColors.background }]}>
      <SafeAreaView style={styles.safeTop}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <MaterialIcons name={Platform.OS === 'ios' ? 'arrow-back-ios' : 'arrow-back'} size={Platform.OS === 'ios' ? 22 : 24} color={AppColors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Onboarding</Text>
          <View style={styles.backBtn} />
        </View>
      </SafeAreaView>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={AppColors.tint} />}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.pageSubtitle}>Complete your onboarding checklist to get started</Text>

        {loading ? (
          <Text style={styles.muted}>Loading…</Text>
        ) : !record ? (
          <View style={styles.emptyCard}>
            <MaterialIcons name="launch" size={48} color={AppColors.textSecondary} />
            <Text style={styles.emptyText}>No onboarding checklist</Text>
            <Text style={styles.emptySub}>You don&apos;t have an active onboarding checklist. Contact HR if you&apos;re a new joinee.</Text>
          </View>
        ) : (
          <>
            <View style={styles.statusCard}>
              <View style={styles.statusRow}>
                <View style={styles.statusLeft}>
                  <MaterialIcons name={isComplete ? 'check-circle' : 'schedule'} size={18} color={isComplete ? AppColors.success : AppColors.text} />
                  <Text style={[styles.statusTitle, isComplete && styles.statusTitleDone]}>
                    {isComplete ? 'Onboarding Complete!' : 'Onboarding In Progress'}
                  </Text>
                </View>
                {isOverdue && (
                  <View style={styles.overdueBadge}>
                    <Text style={styles.overdueText}>OVERDUE</Text>
                  </View>
                )}
              </View>
              <Text style={styles.dueLine}>
                Due: {fmt(record.dueDate)} · {completed}/{items.length} done
              </Text>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: progressColor }]} />
              </View>
              <Text style={[styles.progressPct, { color: progressColor }]}>{pct}%</Text>
            </View>

            {Object.entries(grouped).map(([cat, catItems]) => {
              const info = CATEGORIES[cat] ?? CATEGORIES.OTHER;
              return (
                <View key={cat} style={styles.categorySection}>
                  <View style={styles.categoryHeader}>
                    <MaterialIcons name={info.icon} size={16} color={info.color} />
                    <Text style={[styles.categoryTitle, { color: info.color }]}>{info.label}</Text>
                  </View>
                  <View style={styles.itemList}>
                    {catItems.map((item) => (
                      <TouchableOpacity
                        key={item._id}
                        style={[styles.itemCard, item.isCompleted && styles.itemCardDone]}
                        onPress={() => toggleItem(record._id, item._id, !!item.isCompleted)}
                        disabled={togglingId === item._id}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.checkbox, item.isCompleted && styles.checkboxDone]}>
                          {togglingId === item._id ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : item.isCompleted ? (
                            <MaterialIcons name="check" size={18} color="#fff" />
                          ) : null}
                        </View>
                        <View style={styles.itemBody}>
                          <Text style={[styles.itemTitle, item.isCompleted && styles.itemTitleDone]}>{item.title}</Text>
                          {item.description ? <Text style={styles.itemDesc} numberOfLines={2}>{item.description}</Text> : null}
                          {item.isCompleted && item.completedAt && (
                            <Text style={styles.itemDoneMeta}>
                              Done {fmt(item.completedAt)}{item.completedBy?.name ? ` by ${item.completedBy.name}` : ''}
                            </Text>
                          )}
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              );
            })}
          </>
        )}
        <View style={styles.bottomPad} />
      </ScrollView>
    </View>
  );
}

// ─── Main screen: role-based ─────────────────────────────────────────────
export default function OnboardingScreen() {
  const getRole = useAuthStore((s) => s.getRole);
  const role = getRole();
  const isAdmin = ['HR', 'DIRECTOR', 'SUPER_ADMIN'].includes(role);
  return isAdmin ? <AdminOnboardingView /> : <MyOnboardingView />;
}

// ─── Modal styles ───────────────────────────────────────────────────────
const modalStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  box: { backgroundColor: AppColors.background, borderTopLeftRadius: BorderRadius.xl, borderTopRightRadius: BorderRadius.xl, maxHeight: '90%' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(60,60,67,0.12)' },
  title: { fontSize: 18, fontWeight: '700', color: AppColors.text },
  closeBtn: { padding: 8 },
  body: { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  label: { fontSize: 14, fontWeight: '600', color: AppColors.text, marginBottom: 6, marginTop: 12 },
  input: { borderWidth: 1, borderColor: 'rgba(60,60,67,0.2)', borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, fontSize: 16, color: AppColors.text, backgroundColor: AppColors.card },
  textArea: { minHeight: 72, textAlignVertical: 'top' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, marginBottom: 8 },
  switchLabel: { fontSize: 15, fontWeight: '600', color: AppColors.text, flex: 1 },
  customSection: { marginTop: 8, marginBottom: 12 },
  customItemRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' },
  pickerWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  miniChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: 'rgba(60,60,67,0.12)' },
  miniChipActive: { backgroundColor: AppColors.tint },
  miniChipText: { fontSize: 12, fontWeight: '600', color: AppColors.textSecondary },
  miniChipTextActive: { color: '#fff' },
  removeItemBtn: { padding: 4 },
  addItemBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  addItemText: { fontSize: 14, fontWeight: '600', color: AppColors.tint },
  submitBtn: { backgroundColor: AppColors.tint, borderRadius: BorderRadius.lg, paddingVertical: Spacing.md, alignItems: 'center', justifyContent: 'center', marginTop: 20, minHeight: 48 },
  submitDisabled: { opacity: 0.7 },
  submitBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});

// ─── Screen styles ───────────────────────────────────────────────────────
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
  muted: { fontSize: 15, color: AppColors.textSecondary },
  msgBanner: { backgroundColor: '#dbeafe', padding: Spacing.sm, borderRadius: BorderRadius.md, marginBottom: Spacing.md },
  msgText: { fontSize: 14, color: '#2563eb' },
  headerRow: { marginBottom: Spacing.lg },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: AppColors.tint, paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg, borderRadius: BorderRadius.lg },
  primaryBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: Spacing.lg },
  statBox: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, minWidth: 72, alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: '700' },
  statLabel: { fontSize: 11, fontWeight: '600' },
  searchInput: { borderWidth: 1, borderColor: 'rgba(60,60,67,0.2)', borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, fontSize: 15, color: AppColors.text, backgroundColor: AppColors.card, marginBottom: Spacing.sm },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: Spacing.lg },
  filterChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: 'rgba(60,60,67,0.12)' },
  filterChipActive: { backgroundColor: AppColors.tint },
  filterChipText: { fontSize: 14, fontWeight: '600', color: AppColors.textSecondary },
  filterChipTextActive: { color: '#fff' },
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

  recordList: { gap: Spacing.md },
  recordCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: Spacing.lg,
    backgroundColor: AppColors.card,
    borderRadius: BorderRadius.xl,
    borderLeftWidth: 4,
    ...CardShadow,
  },
  recordMain: { flex: 1, minWidth: 0 },
  recordTitleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 6 },
  recordName: { fontSize: 16, fontWeight: '700', color: AppColors.text },
  recordId: { fontSize: 13, color: AppColors.textSecondary },
  recordStatusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  recordStatusDone: { backgroundColor: '#dcfce7' },
  recordStatusProgress: { backgroundColor: '#fef3c7' },
  recordStatusText: { fontSize: 12, fontWeight: '600' },
  recordStatusTextDone: { color: '#15803d' },
  recordStatusTextProgress: { color: '#b45309' },
  recordMeta: { fontSize: 13, color: AppColors.textSecondary, marginTop: 4 },
  recordActions: { flexDirection: 'row', gap: 8, flexShrink: 0 },
  viewBtn: { backgroundColor: AppColors.tint, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  viewBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  deleteBtn: { backgroundColor: '#dc2626', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, minWidth: 60, alignItems: 'center' },
  deleteBtnDisabled: { opacity: 0.7 },
  deleteBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },

  backButton: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: Spacing.lg },
  backButtonText: { fontSize: 15, fontWeight: '600', color: AppColors.tint },
  detailCard: {
    backgroundColor: AppColors.card,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
    ...CardShadow,
  },
  detailName: { fontSize: 18, fontWeight: '700', color: AppColors.text, marginBottom: 4 },
  detailMeta: { fontSize: 14, color: AppColors.textSecondary, marginBottom: 8 },
  detailStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statusBadgeDone: { backgroundColor: '#dcfce7' },
  statusBadgeProgress: { backgroundColor: '#fef3c7' },
  statusBadgeText: { fontSize: 12, fontWeight: '700' },
  statusBadgeTextDone: { color: '#15803d' },
  statusBadgeTextProgress: { color: '#b45309' },
  dueLine: { fontSize: 13, color: AppColors.textSecondary, marginBottom: 6 },
  progressBar: { height: 8, borderRadius: 4, backgroundColor: 'rgba(118,118,128,0.2)', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  progressPct: { fontSize: 14, fontWeight: '700', marginTop: 6, textAlign: 'right' },

  addItemCard: { backgroundColor: AppColors.card, borderRadius: BorderRadius.xl, padding: Spacing.lg, marginTop: Spacing.md, ...CardShadow },
  addItemRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 6 },
  addCatChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  addItemSubmitBtn: { backgroundColor: AppColors.tint, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  addItemSubmitDisabled: { opacity: 0.6 },
  addItemSubmitText: { fontSize: 14, fontWeight: '700', color: '#fff' },

  statusCard: {
    backgroundColor: AppColors.card,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
    ...CardShadow,
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', marginBottom: 6 },
  statusLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusTitle: { fontSize: 16, fontWeight: '700', color: AppColors.text },
  statusTitleDone: { color: AppColors.success },
  overdueBadge: { backgroundColor: '#fee2e2', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  overdueText: { fontSize: 12, fontWeight: '700', color: '#dc2626' },
  dueLine: { fontSize: 14, color: AppColors.textSecondary, marginBottom: Spacing.sm },
  categorySection: { marginBottom: Spacing.xl },
  categoryHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: Spacing.sm },
  categoryTitle: { fontSize: 15, fontWeight: '700' },
  itemList: { gap: Spacing.sm },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    backgroundColor: AppColors.card,
    borderRadius: BorderRadius.lg,
    borderLeftWidth: 4,
    borderLeftColor: '#e2e8f0',
    ...CardShadow,
  },
  itemCardDone: { borderLeftColor: AppColors.success, opacity: 0.9 },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    marginRight: Spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxDone: { backgroundColor: AppColors.success, borderColor: AppColors.success },
  itemBody: { flex: 1 },
  itemTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  itemTitle: { fontSize: 16, fontWeight: '600', color: AppColors.text },
  itemTitleDone: { textDecorationLine: 'line-through', color: AppColors.textSecondary },
  catBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  catBadgeText: { fontSize: 11, fontWeight: '600' },
  itemDesc: { fontSize: 14, color: AppColors.textSecondary, marginTop: 2 },
  itemDoneMeta: { fontSize: 12, color: AppColors.success, marginTop: 4 },
  deleteItemBtn: { padding: 4 },
});
