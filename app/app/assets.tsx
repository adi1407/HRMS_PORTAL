import React, { useEffect, useState, useCallback } from 'react';
import {
  ScrollView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Platform,
  SafeAreaView,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Spacing, BorderRadius, AppColors, CardShadow } from '@/constants/theme';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

// ─── Types & constants ─────────────────────────────────────────────────
type Asset = {
  _id: string;
  assetId?: string;
  name: string;
  type?: string;
  brand?: string;
  modelName?: string;
  serialNumber?: string;
  condition?: string;
  status?: string;
  purchaseDate?: string;
  purchaseCost?: number;
  assignedAt?: string;
  currentAssignment?: {
    assignedDate?: string;
    assignedBy?: { name?: string };
    employee?: { _id: string; name?: string; employeeId?: string };
  };
};

const ASSET_TYPES = [
  { value: 'LAPTOP', label: 'Laptop' },
  { value: 'DESKTOP', label: 'Desktop' },
  { value: 'PHONE', label: 'Phone' },
  { value: 'TABLET', label: 'Tablet' },
  { value: 'MONITOR', label: 'Monitor' },
  { value: 'ACCESS_CARD', label: 'Access Card' },
  { value: 'HEADSET', label: 'Headset' },
  { value: 'CHAIR', label: 'Chair' },
  { value: 'OTHER', label: 'Other' },
];

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  AVAILABLE: { bg: '#dcfce7', text: '#15803d', label: 'Available' },
  ASSIGNED: { bg: '#dbeafe', text: '#2563eb', label: 'Assigned' },
  UNDER_REPAIR: { bg: '#fef3c7', text: '#b45309', label: 'Under Repair' },
  RETIRED: { bg: '#f3f4f6', text: '#6b7280', label: 'Retired' },
  LOST: { bg: '#fee2e2', text: '#b91c1c', label: 'Lost' },
};

const CONDITION_STYLES: Record<string, { bg: string; text: string }> = {
  NEW: { bg: '#dcfce7', text: '#15803d' },
  GOOD: { bg: '#dbeafe', text: '#2563eb' },
  FAIR: { bg: '#fef3c7', text: '#b45309' },
  POOR: { bg: '#fee2e2', text: '#b91c1c' },
};

const RETURN_CONDITIONS = [
  { value: 'GOOD', label: 'Good' },
  { value: 'DAMAGED', label: 'Damaged' },
  { value: 'LOST', label: 'Lost' },
];

function fmt(d?: string | null) {
  return d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
}

// ─── Add Asset Modal ───────────────────────────────────────────────────
function AddAssetModal({
  visible,
  onClose,
  onSaved,
  showMsg,
}: {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
  showMsg: (m: string) => void;
}) {
  const [name, setName] = useState('');
  const [type, setType] = useState('LAPTOP');
  const [brand, setBrand] = useState('');
  const [modelName, setModelName] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [purchaseCost, setPurchaseCost] = useState('');
  const [condition, setCondition] = useState('NEW');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) {
      setName('');
      setType('LAPTOP');
      setBrand('');
      setModelName('');
      setSerialNumber('');
      setPurchaseDate('');
      setPurchaseCost('');
      setCondition('NEW');
      setNotes('');
    }
  }, [visible]);

  const submit = async () => {
    if (!name.trim()) return showMsg('Asset name is required.');
    setSaving(true);
    try {
      await api.post('/assets', {
        name: name.trim(),
        type,
        brand: brand.trim() || undefined,
        modelName: modelName.trim() || undefined,
        serialNumber: serialNumber.trim() || undefined,
        purchaseDate: purchaseDate || undefined,
        purchaseCost: purchaseCost !== '' ? Number(purchaseCost) : undefined,
        condition,
        notes: notes.trim() || undefined,
      });
      showMsg('Asset created.');
      onSaved();
      onClose();
    } catch (e: unknown) {
      showMsg((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed.');
    } finally {
      setSaving(false);
    }
  };

  if (!visible) return null;
  return (
    <Modal visible animationType="slide" transparent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={modalStyles.overlay}>
        <View style={modalStyles.box}>
          <View style={modalStyles.header}>
            <Text style={modalStyles.title}>Add New Asset</Text>
            <TouchableOpacity onPress={onClose} style={modalStyles.closeBtn}>
              <MaterialIcons name="close" size={24} color={AppColors.text} />
            </TouchableOpacity>
          </View>
          <ScrollView style={modalStyles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={modalStyles.label}>Name *</Text>
            <TextInput style={modalStyles.input} placeholder="e.g. MacBook Pro 14" placeholderTextColor={AppColors.textSecondary} value={name} onChangeText={setName} maxLength={200} />
            <Text style={modalStyles.label}>Type *</Text>
            <View style={modalStyles.chipRow}>
              {ASSET_TYPES.map((t) => (
                <TouchableOpacity key={t.value} style={[modalStyles.chip, type === t.value && modalStyles.chipActive]} onPress={() => setType(t.value)}>
                  <Text style={[modalStyles.chipText, type === t.value && modalStyles.chipTextActive]} numberOfLines={1}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={modalStyles.label}>Brand</Text>
            <TextInput style={modalStyles.input} placeholder="e.g. Apple" placeholderTextColor={AppColors.textSecondary} value={brand} onChangeText={setBrand} />
            <Text style={modalStyles.label}>Model</Text>
            <TextInput style={modalStyles.input} placeholder="e.g. M3 Pro" placeholderTextColor={AppColors.textSecondary} value={modelName} onChangeText={setModelName} />
            <Text style={modalStyles.label}>Serial No.</Text>
            <TextInput style={modalStyles.input} placeholder="Optional" placeholderTextColor={AppColors.textSecondary} value={serialNumber} onChangeText={setSerialNumber} />
            <Text style={modalStyles.label}>Condition</Text>
            <View style={modalStyles.row}>
              {(['NEW', 'GOOD', 'FAIR', 'POOR'] as const).map((c) => (
                <TouchableOpacity key={c} style={[modalStyles.chip, condition === c && modalStyles.chipActive]} onPress={() => setCondition(c)}>
                  <Text style={[modalStyles.chipText, condition === c && modalStyles.chipTextActive]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={modalStyles.label}>Purchase Date (YYYY-MM-DD)</Text>
            <TextInput style={modalStyles.input} placeholder="Optional" placeholderTextColor={AppColors.textSecondary} value={purchaseDate} onChangeText={setPurchaseDate} />
            <Text style={modalStyles.label}>Cost (₹)</Text>
            <TextInput style={modalStyles.input} placeholder="Optional" keyboardType="number-pad" placeholderTextColor={AppColors.textSecondary} value={purchaseCost} onChangeText={setPurchaseCost} />
            <Text style={modalStyles.label}>Notes</Text>
            <TextInput style={[modalStyles.input, modalStyles.textArea]} placeholder="Optional" placeholderTextColor={AppColors.textSecondary} value={notes} onChangeText={setNotes} multiline numberOfLines={2} />
            <TouchableOpacity style={[modalStyles.submitBtn, saving && modalStyles.submitDisabled]} onPress={submit} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={modalStyles.submitBtnText}>Add Asset</Text>}
            </TouchableOpacity>
            <View style={{ height: Spacing.section }} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Assign Modal ───────────────────────────────────────────────────────
function AssignModal({ asset, onClose, onDone, showMsg }: { asset: Asset | null; onClose: () => void; onDone: () => void; showMsg: (m: string) => void }) {
  const [employeeId, setEmployeeId] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!asset) setEmployeeId('');
  }, [asset]);

  const submit = async () => {
    if (!asset) return;
    if (!employeeId.trim()) return showMsg('Employee ID is required.');
    setSaving(true);
    try {
      await api.post(`/assets/${asset._id}/assign`, { employeeId: employeeId.trim() });
      showMsg('Asset assigned.');
      onDone();
      onClose();
    } catch (e: unknown) {
      showMsg((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed.');
    } finally {
      setSaving(false);
    }
  };

  if (!asset) return null;
  return (
    <Modal visible animationType="slide" transparent>
      <View style={modalStyles.overlay}>
        <View style={modalStyles.smallBox}>
          <Text style={modalStyles.title}>Assign {asset.assetId ?? asset._id.slice(-6)}</Text>
          <Text style={modalStyles.label}>Employee ID *</Text>
          <TextInput
            style={modalStyles.input}
            placeholder="e.g. EMP-0002"
            placeholderTextColor={AppColors.textSecondary}
            value={employeeId}
            onChangeText={setEmployeeId}
            autoCapitalize="characters"
          />
          <View style={modalStyles.actions}>
            <TouchableOpacity style={modalStyles.cancelBtn} onPress={onClose} disabled={saving}>
              <Text style={modalStyles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[modalStyles.submitBtn, saving && modalStyles.submitDisabled]} onPress={submit} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={modalStyles.submitBtnText}>Assign</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Return Modal ───────────────────────────────────────────────────────
function ReturnModal({ asset, onClose, onDone, showMsg }: { asset: Asset | null; onClose: () => void; onDone: () => void; showMsg: (m: string) => void }) {
  const [returnCondition, setReturnCondition] = useState('GOOD');
  const [returnNote, setReturnNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!asset) {
      setReturnCondition('GOOD');
      setReturnNote('');
    }
  }, [asset]);

  const submit = async () => {
    if (!asset) return;
    setSaving(true);
    try {
      await api.post(`/assets/${asset._id}/return`, { returnCondition, returnNote: returnNote.trim() || undefined });
      showMsg('Asset returned.');
      onDone();
      onClose();
    } catch (e: unknown) {
      showMsg((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed.');
    } finally {
      setSaving(false);
    }
  };

  if (!asset) return null;
  return (
    <Modal visible animationType="slide" transparent>
      <View style={modalStyles.overlay}>
        <View style={modalStyles.smallBox}>
          <Text style={modalStyles.title}>Return {asset.assetId ?? asset._id.slice(-6)}</Text>
          <Text style={modalStyles.hint}>Currently assigned to {asset.currentAssignment?.employee?.name ?? '—'}</Text>
          <Text style={modalStyles.label}>Return Condition *</Text>
          <View style={modalStyles.row}>
            {RETURN_CONDITIONS.map((r) => (
              <TouchableOpacity key={r.value} style={[modalStyles.chip, returnCondition === r.value && modalStyles.chipActive]} onPress={() => setReturnCondition(r.value)}>
                <Text style={[modalStyles.chipText, returnCondition === r.value && modalStyles.chipTextActive]}>{r.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={modalStyles.label}>Note (optional)</Text>
          <TextInput style={[modalStyles.input, modalStyles.textArea]} placeholder="Optional" placeholderTextColor={AppColors.textSecondary} value={returnNote} onChangeText={setReturnNote} multiline numberOfLines={2} />
          <View style={modalStyles.actions}>
            <TouchableOpacity style={modalStyles.cancelBtn} onPress={onClose} disabled={saving}>
              <Text style={modalStyles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[modalStyles.submitBtn, returnCondition === 'LOST' && modalStyles.submitDanger, saving && modalStyles.submitDisabled]}
              onPress={submit}
              disabled={saving}
            >
              {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={modalStyles.submitBtnText}>Process Return</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Employee View (My Assets) ───────────────────────────────────────────
function EmployeeAssetsView() {
  const router = useRouter();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get<{ data: Asset[] }>('/assets/my');
      setAssets(data.data ?? []);
    } catch {
      setAssets([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const typeLabel = (t?: string) => ASSET_TYPES.find((x) => x.value === t)?.label ?? t ?? 'Asset';
  const statusStyle = (s?: string) => STATUS_STYLES[s ?? ''] ?? STATUS_STYLES.ASSIGNED;
  const conditionStyle = (c?: string) => CONDITION_STYLES[c ?? ''] ?? CONDITION_STYLES.GOOD;

  return (
    <View style={[styles.screen, { backgroundColor: AppColors.background }]}>
      <SafeAreaView style={styles.safeTop}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <MaterialIcons name={Platform.OS === 'ios' ? 'arrow-back-ios' : 'arrow-back'} size={Platform.OS === 'ios' ? 22 : 24} color={AppColors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>My Assets</Text>
          <View style={styles.backBtn} />
        </View>
      </SafeAreaView>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={AppColors.tint} />}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.pageSubtitle}>Company assets currently assigned to you</Text>
        {assets.length > 0 && !loading && <Text style={styles.summary}>{assets.length} asset{assets.length === 1 ? '' : 's'}</Text>}
        {loading ? (
          <Text style={styles.muted}>Loading…</Text>
        ) : assets.length === 0 ? (
          <View style={styles.emptyCard}>
            <MaterialIcons name="inventory-2" size={48} color={AppColors.textSecondary} />
            <Text style={styles.emptyText}>No assets assigned</Text>
            <Text style={styles.emptySub}>You don&apos;t have any company assets currently assigned to you.</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {assets.map((a) => {
              const st = statusStyle(a.status);
              const cond = conditionStyle(a.condition);
              const assignedDate = a.currentAssignment?.assignedDate ?? a.assignedAt;
              const assignedBy = a.currentAssignment?.assignedBy?.name;
              const metaParts = [typeLabel(a.type), a.brand, a.modelName, a.serialNumber ? `S/N: ${a.serialNumber}` : null].filter(Boolean);
              return (
                <View key={a._id} style={styles.card}>
                  <View style={styles.badgeRow}>
                    <Text style={styles.assetId}>{a.assetId ?? a._id.slice(-6)}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
                      <Text style={[styles.statusText, { color: st.text }]}>{st.label}</Text>
                    </View>
                    <View style={[styles.conditionBadge, { backgroundColor: cond.bg }]}>
                      <Text style={[styles.conditionText, { color: cond.text }]}>{a.condition ?? 'Good'}</Text>
                    </View>
                  </View>
                  <Text style={styles.name}>{a.name}</Text>
                  {metaParts.length > 0 && <Text style={styles.meta}>{metaParts.join(' · ')}</Text>}
                  {assignedDate && (
                    <Text style={styles.assigned}>
                      Assigned: {fmt(assignedDate)}
                      {assignedBy ? ` by ${assignedBy}` : ''}
                    </Text>
                  )}
                  <View style={styles.iconWrap}>
                    <MaterialIcons name="devices" size={20} color={AppColors.tint} />
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

// ─── Admin View (Asset Management) ───────────────────────────────────────
function AdminAssetsView() {
  const router = useRouter();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [assigningAsset, setAssigningAsset] = useState<Asset | null>(null);
  const [returningAsset, setReturningAsset] = useState<Asset | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (typeFilter) params.set('type', typeFilter);
      if (search.trim()) params.set('search', search.trim());
      const [aRes, sRes] = await Promise.all([
        api.get<{ data: Asset[] }>(`/assets?${params.toString()}`),
        api.get<{ data: Record<string, number> }>('/assets/stats'),
      ]);
      setAssets(aRes.data.data ?? []);
      setStats(sRes.data.data ?? {});
    } catch {
      setAssets([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter, typeFilter, search]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  const showMsg = (m: string) => {
    setMsg(m);
    setTimeout(() => setMsg(''), 3500);
  };

  const handleDelete = (asset: Asset) => {
    if (asset.status === 'ASSIGNED') {
      showMsg('Return the asset first.');
      return;
    }
    Alert.alert('Delete Asset', `Delete ${asset.assetId ?? asset.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setDeletingId(asset._id);
          try {
            await api.delete(`/assets/${asset._id}`);
            showMsg('Asset deleted.');
            load();
          } catch (e: unknown) {
            showMsg((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed.');
          } finally {
            setDeletingId(null);
          }
        },
      },
    ]);
  };

  const typeLabel = (t?: string) => ASSET_TYPES.find((x) => x.value === t)?.label ?? t ?? 'Asset';
  const statusStyle = (s?: string) => STATUS_STYLES[s ?? ''] ?? STATUS_STYLES.AVAILABLE;
  const conditionStyle = (c?: string) => CONDITION_STYLES[c ?? ''] ?? CONDITION_STYLES.GOOD;

  return (
    <View style={[styles.screen, { backgroundColor: AppColors.background }]}>
      <SafeAreaView style={styles.safeTop}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <MaterialIcons name={Platform.OS === 'ios' ? 'arrow-back-ios' : 'arrow-back'} size={Platform.OS === 'ios' ? 22 : 24} color={AppColors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Asset Management</Text>
          <TouchableOpacity style={styles.addBtn} onPress={() => setShowAddModal(true)}>
            <MaterialIcons name="add" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={AppColors.tint} />}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.pageSubtitle}>Track and manage company assets, assignments, and returns</Text>
        {msg ? (
          <View style={[styles.msgBox, msg.includes('created') || msg.includes('assigned') || msg.includes('returned') || msg.includes('deleted') ? styles.msgBoxSuccess : styles.msgBoxError]}>
            <Text style={styles.msgText}>{msg}</Text>
          </View>
        ) : null}

        <AddAssetModal visible={showAddModal} onClose={() => setShowAddModal(false)} onSaved={load} showMsg={showMsg} />
        <AssignModal asset={assigningAsset} onClose={() => setAssigningAsset(null)} onDone={load} showMsg={showMsg} />
        <ReturnModal asset={returningAsset} onClose={() => setReturningAsset(null)} onDone={load} showMsg={showMsg} />

        <View style={styles.statsRow}>
          {[
            { key: 'total', label: 'Total', color: '#2563eb' },
            { key: 'available', label: 'Available', color: '#15803d' },
            { key: 'assigned', label: 'Assigned', color: '#2563eb' },
            { key: 'underRepair', label: 'Repair', color: '#b45309' },
            { key: 'retired', label: 'Retired', color: '#6b7280' },
            { key: 'lost', label: 'Lost', color: '#b91c1c' },
          ].map((s) => (
            <View key={s.key} style={[styles.statCard, { backgroundColor: `${s.color}18` }]}>
              <Text style={[styles.statValue, { color: s.color }]}>{stats[s.key] ?? '—'}</Text>
              <Text style={[styles.statLabel, { color: s.color }]}>{s.label}</Text>
            </View>
          ))}
        </View>

        <TextInput
          style={styles.searchInput}
          placeholder="Search name, ID, serial..."
          placeholderTextColor={AppColors.textSecondary}
          value={search}
          onChangeText={setSearch}
        />
        <View style={styles.filterRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
            <TouchableOpacity style={[styles.filterChip, !statusFilter && styles.filterChipActive]} onPress={() => setStatusFilter('')}>
              <Text style={[styles.filterChipText, !statusFilter && styles.filterChipTextActive]}>All Status</Text>
            </TouchableOpacity>
            {Object.entries(STATUS_STYLES).map(([k, v]) => (
              <TouchableOpacity key={k} style={[styles.filterChip, statusFilter === k && styles.filterChipActive]} onPress={() => setStatusFilter(statusFilter === k ? '' : k)}>
                <Text style={[styles.filterChipText, statusFilter === k && styles.filterChipTextActive]}>{v.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
        <View style={styles.filterRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
            <TouchableOpacity style={[styles.filterChip, !typeFilter && styles.filterChipActive]} onPress={() => setTypeFilter('')}>
              <Text style={[styles.filterChipText, !typeFilter && styles.filterChipTextActive]}>All Types</Text>
            </TouchableOpacity>
            {ASSET_TYPES.map((t) => (
              <TouchableOpacity key={t.value} style={[styles.filterChip, typeFilter === t.value && styles.filterChipActive]} onPress={() => setTypeFilter(typeFilter === t.value ? '' : t.value)}>
                <Text style={[styles.filterChipText, typeFilter === t.value && styles.filterChipTextActive]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={AppColors.tint} />
          </View>
        ) : assets.length === 0 ? (
          <View style={styles.emptyCard}>
            <MaterialIcons name="inventory-2" size={48} color={AppColors.textSecondary} />
            <Text style={styles.emptyText}>No assets found</Text>
            <Text style={styles.emptySub}>Add assets or adjust filters</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {assets.map((a) => {
              const st = statusStyle(a.status);
              const cond = conditionStyle(a.condition);
              const metaParts = [typeLabel(a.type), a.brand, a.modelName, a.serialNumber ? `S/N: ${a.serialNumber}` : null].filter(Boolean);
              return (
                <View key={a._id} style={styles.adminCard}>
                  <View style={styles.adminCardBody}>
                    <View style={styles.badgeRow}>
                      <Text style={styles.assetId}>{a.assetId ?? a._id.slice(-6)}</Text>
                      <Text style={styles.name}>{a.name}</Text>
                      <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
                        <Text style={[styles.statusText, { color: st.text }]}>{st.label}</Text>
                      </View>
                      <View style={[styles.conditionBadge, { backgroundColor: cond.bg }]}>
                        <Text style={[styles.conditionText, { color: cond.text }]}>{a.condition ?? 'Good'}</Text>
                      </View>
                    </View>
                    {metaParts.length > 0 && <Text style={styles.meta}>{metaParts.join(' · ')}</Text>}
                    {a.status === 'ASSIGNED' && a.currentAssignment?.employee && (
                      <Text style={styles.assignedTo}>
                        Assigned to: {a.currentAssignment.employee.name} ({a.currentAssignment.employee.employeeId})
                        <Text style={styles.assignedSince}> · Since {fmt(a.currentAssignment.assignedDate)}</Text>
                      </Text>
                    )}
                    {a.purchaseCost != null && (
                      <Text style={styles.cost}>Cost: ₹{a.purchaseCost.toLocaleString('en-IN')}{a.purchaseDate ? ` · Purchased: ${fmt(a.purchaseDate)}` : ''}</Text>
                    )}
                  </View>
                  <View style={styles.adminActions}>
                    {a.status === 'AVAILABLE' && (
                      <TouchableOpacity style={styles.assignBtn} onPress={() => setAssigningAsset(a)}>
                        <Text style={styles.assignBtnText}>Assign</Text>
                      </TouchableOpacity>
                    )}
                    {a.status === 'ASSIGNED' && (
                      <TouchableOpacity style={styles.returnBtn} onPress={() => setReturningAsset(a)}>
                        <Text style={styles.returnBtnText}>Return</Text>
                      </TouchableOpacity>
                    )}
                    {a.status !== 'ASSIGNED' && (
                      <TouchableOpacity
                        style={[styles.deleteBtn, deletingId === a._id && styles.deleteBtnDisabled]}
                        onPress={() => handleDelete(a)}
                        disabled={deletingId === a._id}
                      >
                        {deletingId === a._id ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.deleteBtnText}>Delete</Text>}
                      </TouchableOpacity>
                    )}
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

// ─── Main ───────────────────────────────────────────────────────────────
export default function AssetsScreen() {
  const getRole = useAuthStore((s) => s.getRole);
  const role = getRole();
  const isAdmin = ['HR', 'DIRECTOR', 'SUPER_ADMIN'].includes(role);

  if (isAdmin) return <AdminAssetsView />;
  return <EmployeeAssetsView />;
}

const modalStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  box: { backgroundColor: AppColors.card, borderTopLeftRadius: BorderRadius.xl, borderTopRightRadius: BorderRadius.xl, maxHeight: '92%' },
  smallBox: { backgroundColor: AppColors.card, borderRadius: BorderRadius.xl, padding: Spacing.xl, margin: Spacing.xl },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(60,60,67,0.12)' },
  title: { fontSize: 18, fontWeight: '700', color: AppColors.text, marginBottom: Spacing.md },
  closeBtn: { padding: Spacing.sm },
  body: { padding: Spacing.lg },
  label: { fontSize: 13, fontWeight: '600', color: AppColors.textSecondary, marginBottom: 6, marginTop: Spacing.sm },
  hint: { fontSize: 14, color: AppColors.textSecondary, marginBottom: Spacing.md },
  input: { borderWidth: 1, borderColor: 'rgba(60,60,67,0.2)', borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, paddingVertical: 12, fontSize: 16, color: AppColors.text },
  textArea: { minHeight: 64 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.sm },
  chip: { paddingHorizontal: Spacing.md, paddingVertical: 8, borderRadius: BorderRadius.md, backgroundColor: 'rgba(118,118,128,0.12)' },
  chipActive: { backgroundColor: AppColors.tint },
  chipText: { fontSize: 13, fontWeight: '600', color: AppColors.text },
  chipTextActive: { color: '#fff' },
  submitBtn: { backgroundColor: AppColors.tint, paddingVertical: Spacing.md, borderRadius: BorderRadius.md, alignItems: 'center', marginTop: Spacing.lg },
  submitDanger: { backgroundColor: AppColors.danger },
  submitDisabled: { opacity: 0.6 },
  submitBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  actions: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.lg, justifyContent: 'flex-end' },
  cancelBtn: { paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg, justifyContent: 'center' },
  cancelBtnText: { fontSize: 16, fontWeight: '600', color: AppColors.tint },
});

const styles = StyleSheet.create({
  screen: { flex: 1 },
  safeTop: {},
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(60,60,67,0.12)' },
  backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'flex-start' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: AppColors.text },
  addBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: AppColors.tint, justifyContent: 'center', alignItems: 'center' },
  scroll: { flex: 1 },
  content: { padding: Spacing.xl, paddingBottom: Spacing.section },
  bottomPad: { height: Spacing.section },
  pageSubtitle: { fontSize: 15, color: AppColors.textSecondary, marginBottom: Spacing.lg },
  msgBox: { padding: Spacing.md, borderRadius: BorderRadius.md, marginBottom: Spacing.md },
  msgBoxSuccess: { backgroundColor: '#dcfce7' },
  msgBoxError: { backgroundColor: '#fef2f2' },
  msgText: { fontSize: 14, fontWeight: '600' },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.lg },
  statCard: { flex: 1, minWidth: 70, padding: Spacing.md, borderRadius: BorderRadius.md, alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: '700' },
  statLabel: { fontSize: 11, fontWeight: '600' },
  searchInput: { borderWidth: 1, borderColor: 'rgba(118,118,128,0.2)', borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, paddingVertical: 12, fontSize: 16, color: AppColors.text, marginBottom: Spacing.md },
  filterRow: { marginBottom: Spacing.sm },
  filterScroll: { maxHeight: 44 },
  filterChip: { paddingHorizontal: Spacing.md, paddingVertical: 8, borderRadius: BorderRadius.md, backgroundColor: 'rgba(118,118,128,0.12)', marginRight: Spacing.sm },
  filterChipActive: { backgroundColor: AppColors.tint },
  filterChipText: { fontSize: 13, fontWeight: '600', color: AppColors.text },
  filterChipTextActive: { color: '#fff' },
  loadingWrap: { alignItems: 'center', paddingVertical: Spacing.xxl },
  muted: { fontSize: 15, color: AppColors.textSecondary },
  summary: { fontSize: 14, color: AppColors.textSecondary, marginBottom: Spacing.lg, fontWeight: '500' },
  emptyCard: { alignItems: 'center', paddingVertical: Spacing.xxl, backgroundColor: AppColors.card, borderRadius: BorderRadius.xl, ...CardShadow },
  emptyText: { fontSize: 17, fontWeight: '600', color: AppColors.text, marginTop: Spacing.md },
  emptySub: { fontSize: 14, color: AppColors.textSecondary, marginTop: Spacing.sm, textAlign: 'center', paddingHorizontal: Spacing.xl },
  list: { gap: Spacing.md },
  card: { backgroundColor: AppColors.card, borderRadius: BorderRadius.xl, padding: Spacing.lg, ...CardShadow, position: 'relative', paddingRight: 48 },
  adminCard: { backgroundColor: AppColors.card, borderRadius: BorderRadius.xl, padding: Spacing.lg, marginBottom: Spacing.md, ...CardShadow },
  adminCardBody: { marginBottom: Spacing.sm },
  adminActions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  badgeRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: 6 },
  assetId: { fontSize: 15, fontWeight: '700', color: AppColors.tint },
  name: { fontSize: 16, fontWeight: '700', color: AppColors.text },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  statusText: { fontSize: 11, fontWeight: '600' },
  conditionBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  conditionText: { fontSize: 11, fontWeight: '600' },
  meta: { fontSize: 14, color: AppColors.textSecondary, marginBottom: 2 },
  assigned: { fontSize: 13, color: AppColors.textSecondary },
  assignedTo: { fontSize: 14, color: AppColors.tint, fontWeight: '600', marginTop: 4 },
  assignedSince: { fontSize: 13, color: AppColors.textSecondary, fontWeight: '400' },
  cost: { fontSize: 13, color: AppColors.textSecondary, marginTop: 2 },
  iconWrap: { position: 'absolute', right: Spacing.lg, top: Spacing.lg },
  assignBtn: { paddingHorizontal: Spacing.md, paddingVertical: 8, borderRadius: BorderRadius.md, backgroundColor: AppColors.tint },
  assignBtnText: { fontSize: 14, fontWeight: '600', color: '#fff' },
  returnBtn: { paddingHorizontal: Spacing.md, paddingVertical: 8, borderRadius: BorderRadius.md, backgroundColor: 'rgba(118,118,128,0.2)' },
  returnBtnText: { fontSize: 14, fontWeight: '600', color: AppColors.text },
  deleteBtn: { paddingHorizontal: Spacing.md, paddingVertical: 8, borderRadius: BorderRadius.md, backgroundColor: AppColors.danger },
  deleteBtnDisabled: { opacity: 0.6 },
  deleteBtnText: { fontSize: 14, fontWeight: '600', color: '#fff' },
});
