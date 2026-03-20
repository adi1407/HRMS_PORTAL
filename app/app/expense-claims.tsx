import React, { useEffect, useState } from 'react';
import { ScrollView, View, Text, StyleSheet, RefreshControl, TouchableOpacity, Linking, Alert, SafeAreaView, Platform, Modal, TextInput, KeyboardAvoidingView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Spacing, BorderRadius, AppColors, CardShadow } from '@/constants/theme';
import api from '@/lib/api';

type Claim = {
  _id: string;
  amount: number;
  category?: string;
  description?: string;
  status: string;
  receiptUrl?: string;
  createdAt: string;
};

const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  PENDING: { bg: '#fef3c7', text: '#d97706' },
  APPROVED: { bg: '#dcfce7', text: '#16a34a' },
  REJECTED: { bg: '#fee2e2', text: '#dc2626' },
};

const STATUS_OPTIONS = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
];

const CATEGORY_OPTIONS = [
  { value: 'TRAVEL', label: 'Travel' },
  { value: 'FOOD', label: 'Food' },
  { value: 'ACCOMMODATION', label: 'Accommodation' },
  { value: 'COMMUNICATION', label: 'Communication' },
  { value: 'MEDICAL', label: 'Medical' },
  { value: 'OTHER', label: 'Other' },
];

const RECEIPT_MIME = ['application/pdf', 'image/jpeg', 'image/png'];

function todayISO() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

export default function ExpenseClaimsScreen() {
  const router = useRouter();
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [addAmount, setAddAmount] = useState('');
  const [addCategory, setAddCategory] = useState('OTHER');
  const [addDescription, setAddDescription] = useState('');
  const [addExpenseDate, setAddExpenseDate] = useState(todayISO);
  const [addReceipt, setAddReceipt] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [addMsg, setAddMsg] = useState('');

  const load = async () => {
    try {
      const { data } = await api.get<{ data: Claim[] }>('/expense-claims/my');
      setClaims(data.data ?? []);
    } catch {
      setClaims([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = filterStatus
    ? claims.filter((c) => c.status === filterStatus)
    : claims;

  const openReceipt = (url?: string) => {
    if (!url) return;
    Linking.canOpenURL(url).then((ok) => {
      if (ok) {
        Linking.openURL(url).catch(() => Alert.alert('Error', 'Could not open receipt on this device.'));
      } else {
        Alert.alert('Error', 'Cannot open this receipt.');
      }
    }).catch(() => Alert.alert('Error', 'Could not open receipt.'));
  };

  const totalAmount = (list: Claim[]) => list.reduce((s, c) => s + Number(c.amount || 0), 0);

  const pickReceipt = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: RECEIPT_MIME,
        copyToCacheDirectory: true,
      });
      if (!result.canceled) setAddReceipt(result.assets[0]);
    } catch {
      Alert.alert('Error', 'Could not pick file.');
    }
  };

  const submitClaim = async () => {
    const amount = Number(addAmount?.replace(/,/g, ''));
    if (!amount || amount < 1) return setAddMsg('Enter a valid amount.');
    if (!addDescription.trim()) return setAddMsg('Enter description.');
    const date = addExpenseDate?.trim();
    if (!date) return setAddMsg('Enter expense date (YYYY-MM-DD).');
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return setAddMsg('Invalid date. Use YYYY-MM-DD.');
    setSubmitting(true);
    setAddMsg('');
    try {
      const formData = new FormData();
      formData.append('amount', String(amount));
      formData.append('category', addCategory);
      formData.append('description', addDescription.trim());
      formData.append('expenseDate', date);
      if (addReceipt) {
        const uri = addReceipt.uri;
        formData.append('receipt', {
          uri: Platform.OS === 'android' && !uri.startsWith('file://') ? `file://${uri}` : uri,
          name: addReceipt.name ?? 'receipt',
          type: addReceipt.mimeType ?? 'application/octet-stream',
        } as unknown as Blob);
      }
      await api.post('/expense-claims', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setShowAdd(false);
      setAddAmount('');
      setAddCategory('OTHER');
      setAddDescription('');
      setAddExpenseDate(todayISO());
      setAddReceipt(null);
      load();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Submit failed.';
      setAddMsg(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const closeAdd = () => {
    if (!submitting) {
      setShowAdd(false);
      setAddMsg('');
      setAddAmount('');
      setAddCategory('OTHER');
      setAddDescription('');
      setAddExpenseDate(todayISO());
      setAddReceipt(null);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: AppColors.background }]}>
      <SafeAreaView style={styles.safeTop}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <MaterialIcons name={Platform.OS === 'ios' ? 'arrow-back-ios' : 'arrow-back'} size={Platform.OS === 'ios' ? 22 : 24} color={AppColors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Expense Claims</Text>
          <TouchableOpacity style={styles.headerAction} onPress={() => setShowAdd(true)}>
            <MaterialIcons name="add-circle-outline" size={26} color={AppColors.tint} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <Modal visible={showAdd} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalContent}>
            <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalScrollContent} keyboardShouldPersistTaps="handled">
              <View style={styles.modalCard}>
                <Text style={styles.modalTitle}>New Expense Claim</Text>
                {addMsg ? <Text style={styles.addError}>{addMsg}</Text> : null}
                <Text style={styles.inputLabel}>Amount (₹) *</Text>
                <TextInput
                  style={styles.input}
                  value={addAmount}
                  onChangeText={setAddAmount}
                  placeholder="e.g. 500"
                  placeholderTextColor={AppColors.textSecondary}
                  keyboardType="numeric"
                  editable={!submitting}
                />
                <Text style={styles.inputLabel}>Category</Text>
                <View style={styles.categoryRow}>
                  {CATEGORY_OPTIONS.map((cat) => (
                    <TouchableOpacity
                      key={cat.value}
                      style={[styles.categoryChip, addCategory === cat.value && styles.categoryChipActive]}
                      onPress={() => setAddCategory(cat.value)}
                      disabled={submitting}
                    >
                      <Text style={[styles.categoryChipText, addCategory === cat.value && styles.categoryChipTextActive]}>{cat.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={styles.inputLabel}>Description *</Text>
                <TextInput
                  style={[styles.input, styles.inputMultiline]}
                  value={addDescription}
                  onChangeText={setAddDescription}
                  placeholder="What was this expense for?"
                  placeholderTextColor={AppColors.textSecondary}
                  multiline
                  numberOfLines={3}
                  editable={!submitting}
                />
                <Text style={styles.inputLabel}>Expense date * (YYYY-MM-DD)</Text>
                <TextInput
                  style={styles.input}
                  value={addExpenseDate}
                  onChangeText={setAddExpenseDate}
                  placeholder="2025-03-18"
                  placeholderTextColor={AppColors.textSecondary}
                  editable={!submitting}
                />
                <Text style={styles.inputLabel}>Receipt (optional, PDF/JPG/PNG)</Text>
                <TouchableOpacity style={styles.pickBtn} onPress={pickReceipt} disabled={submitting}>
                  <MaterialIcons name="receipt" size={20} color={AppColors.tint} />
                  <Text style={styles.pickBtnText}>{addReceipt ? addReceipt.name : 'Attach receipt'}</Text>
                </TouchableOpacity>
                <View style={styles.modalActions}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={closeAdd} disabled={submitting}>
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.submitClaimBtn, submitting && styles.submitClaimBtnDisabled]}
                    onPress={submitClaim}
                    disabled={submitting || !addAmount || !addDescription.trim() || !addExpenseDate.trim()}
                  >
                    {submitting ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.submitClaimBtnText}>Submit claim</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={AppColors.tint} />}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.pageSubtitle}>View your claims and receipts. Tap + to submit a new claim.</Text>

        {claims.length > 0 && !loading && (
          <Text style={styles.summary}>
            {filterStatus
              ? `${filtered.length} ${filterStatus.toLowerCase()} · ₹${totalAmount(filtered).toLocaleString('en-IN')}`
              : `${claims.length} claim${claims.length === 1 ? '' : 's'} · ₹${totalAmount(claims).toLocaleString('en-IN')} total`}
          </Text>
        )}

        {claims.length > 0 && (
          <View style={styles.filterRow}>
            <TouchableOpacity
              style={[styles.filterChip, !filterStatus && styles.filterChipActive]}
              onPress={() => setFilterStatus(null)}
            >
              <Text style={[styles.filterText, !filterStatus && styles.filterTextActive]}>All ({claims.length})</Text>
            </TouchableOpacity>
            {STATUS_OPTIONS.map((s) => {
              const count = claims.filter((c) => c.status === s.value).length;
              if (count === 0) return null;
              return (
                <TouchableOpacity
                  key={s.value}
                  style={[styles.filterChip, filterStatus === s.value && styles.filterChipActive]}
                  onPress={() => setFilterStatus(filterStatus === s.value ? null : s.value)}
                >
                  <Text style={[styles.filterText, filterStatus === s.value && styles.filterTextActive]}>
                    {s.label} ({count})
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {loading ? (
          <Text style={styles.muted}>Loading…</Text>
        ) : filtered.length === 0 ? (
          <View style={styles.emptyCard}>
            <MaterialIcons name="receipt-long" size={48} color={AppColors.textSecondary} />
            <Text style={styles.emptyText}>No expense claims yet</Text>
            <Text style={styles.emptySub}>
              {filterStatus ? `No ${filterStatus.toLowerCase()} claims.` : 'Tap + to submit your first expense claim.'}
            </Text>
          </View>
        ) : (
          <View style={styles.card}>
            {filtered.map((c, i) => {
              const st = STATUS_STYLE[c.status] ?? STATUS_STYLE.PENDING;
              return (
                <View key={c._id} style={[styles.row, i < filtered.length - 1 && styles.rowBorder]}>
                  <View style={styles.rowTop}>
                    <Text style={styles.amount}>₹ {Number(c.amount).toLocaleString('en-IN')}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
                      <Text style={[styles.statusText, { color: st.text }]}>{c.status}</Text>
                    </View>
                  </View>
                  {c.category ? <Text style={styles.meta}>{c.category}</Text> : null}
                  {c.description ? <Text style={styles.meta} numberOfLines={2}>{c.description}</Text> : null}
                  <Text style={styles.date}>{new Date(c.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
                  {c.receiptUrl ? (
                    <TouchableOpacity style={styles.receiptBtn} onPress={() => openReceipt(c.receiptUrl)}>
                      <MaterialIcons name="receipt" size={18} color={AppColors.tint} />
                      <Text style={styles.receiptBtnText}>View receipt</Text>
                    </TouchableOpacity>
                  ) : null}
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
  headerAction: { width: 44, height: 44, justifyContent: 'center', alignItems: 'flex-end' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: AppColors.text },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { maxHeight: '90%' },
  modalScroll: { maxHeight: '100%' },
  modalScrollContent: { paddingBottom: Spacing.xxl + 24 },
  modalCard: { backgroundColor: AppColors.card, borderTopLeftRadius: BorderRadius.xl, borderTopRightRadius: BorderRadius.xl, padding: Spacing.xl },
  modalTitle: { fontSize: 18, fontWeight: '700', color: AppColors.text, marginBottom: Spacing.lg },
  addError: { fontSize: 14, color: '#dc2626', marginBottom: Spacing.sm },
  inputLabel: { fontSize: 14, fontWeight: '600', color: AppColors.text, marginBottom: 6, marginTop: Spacing.sm },
  input: { borderWidth: 1, borderColor: 'rgba(60,60,67,0.2)', borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, fontSize: 16, color: AppColors.text },
  inputMultiline: { minHeight: 80, textAlignVertical: 'top' },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: 4 },
  categoryChip: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: BorderRadius.full, backgroundColor: 'rgba(118,118,128,0.12)' },
  categoryChipActive: { backgroundColor: AppColors.tint },
  categoryChipText: { fontSize: 13, fontWeight: '600', color: AppColors.text },
  categoryChipTextActive: { color: '#fff' },
  pickBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: 'rgba(60,60,67,0.2)', borderStyle: 'dashed' },
  pickBtnText: { fontSize: 15, color: AppColors.tint, fontWeight: '600' },
  modalActions: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.xl },
  cancelBtn: { flex: 1, paddingVertical: Spacing.md, alignItems: 'center', borderRadius: BorderRadius.md, backgroundColor: 'rgba(118,118,128,0.2)' },
  cancelBtnText: { fontSize: 16, fontWeight: '600', color: AppColors.text },
  submitClaimBtn: { flex: 1, paddingVertical: Spacing.md, alignItems: 'center', justifyContent: 'center', borderRadius: BorderRadius.md, backgroundColor: AppColors.tint, minHeight: 48 },
  submitClaimBtnDisabled: { opacity: 0.7 },
  submitClaimBtnText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  scroll: { flex: 1 },
  content: { padding: Spacing.xl, paddingBottom: Spacing.section },
  pageSubtitle: { fontSize: 15, color: AppColors.textSecondary, marginBottom: Spacing.sm },
  summary: { fontSize: 14, color: AppColors.textSecondary, marginBottom: Spacing.md, fontWeight: '500' },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.lg },
  filterChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(118,118,128,0.12)',
  },
  filterChipActive: { backgroundColor: AppColors.tint },
  filterText: { fontSize: 13, fontWeight: '600', color: AppColors.text },
  filterTextActive: { color: '#fff' },
  bottomPad: { height: Spacing.section },
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
  card: { backgroundColor: AppColors.card, borderRadius: BorderRadius.xl, overflow: 'hidden', ...CardShadow },
  row: { padding: Spacing.lg },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(60,60,67,0.12)' },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  amount: { fontSize: 18, fontWeight: '700', color: AppColors.text },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 12, fontWeight: '600' },
  meta: { fontSize: 14, color: AppColors.textSecondary, marginTop: 2 },
  date: { fontSize: 13, color: AppColors.textSecondary, marginTop: 4 },
  receiptBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: Spacing.sm },
  receiptBtnText: { fontSize: 14, fontWeight: '600', color: AppColors.tint },
});
