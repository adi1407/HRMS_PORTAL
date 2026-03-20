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
  Switch,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Spacing, BorderRadius, AppColors, CardShadow } from '@/constants/theme';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

type User = {
  _id: string;
  name?: string;
  email?: string;
  employeeId?: string;
  designation?: string;
  role?: string;
  department?: { name: string };
  branch?: { name: string };
};

type Department = { _id: string; name: string };

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Administrator',
  DIRECTOR: 'Director',
  HR: 'HR',
  ACCOUNTS: 'Accounts',
  EMPLOYEE: 'Employee',
};

const CREATE_ROLES = [
  { value: 'EMPLOYEE', label: 'Employee' },
  { value: 'ACCOUNTS', label: 'Accounts' },
  { value: 'HR', label: 'HR' },
  { value: 'DIRECTOR', label: 'Director' },
];

const DEFAULT_PASSWORD = 'Welcome@123';

// ─── Add Employee Modal ─────────────────────────────────────────────────
function AddEmployeeModal({
  visible,
  departments,
  isAccounts,
  onClose,
  onSaved,
  showMsg,
}: {
  visible: boolean;
  departments: Department[];
  isAccounts: boolean;
  onClose: () => void;
  onSaved: () => void;
  showMsg: (m: string) => void;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState(DEFAULT_PASSWORD);
  const [role, setRole] = useState('EMPLOYEE');
  const [designation, setDesignation] = useState('');
  const [department, setDepartment] = useState('');
  const [grossSalary, setGrossSalary] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [isManagingHead, setIsManagingHead] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) {
      setName('');
      setEmail('');
      setPassword(DEFAULT_PASSWORD);
      setRole('EMPLOYEE');
      setDesignation('');
      setDepartment('');
      setGrossSalary('');
      setBankAccountNumber('');
      setIfscCode('');
      setIsManagingHead(false);
    }
  }, [visible]);

  const submit = async () => {
    if (!name.trim()) return showMsg('Full name is required.');
    if (!email.trim()) return showMsg('Email is required.');
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name: name.trim(),
        email: email.trim(),
        password: password.trim() || DEFAULT_PASSWORD,
        role,
        designation: designation.trim(),
        department: department || undefined,
      };
      if (isAccounts) {
        payload.grossSalary = grossSalary !== '' ? Number(grossSalary) : 0;
        payload.bankAccountNumber = bankAccountNumber.trim();
        payload.ifscCode = ifscCode.trim().toUpperCase();
        payload.isManagingHead = isManagingHead;
      }
      const { data } = await api.post<{ data: User; message?: string }>('/users', payload);
      showMsg(data.message ?? 'Employee created successfully.');
      onSaved();
      onClose();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to create employee.';
      showMsg(msg);
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
            <Text style={modalStyles.title}>New Employee</Text>
            <TouchableOpacity onPress={onClose} style={modalStyles.closeBtn}>
              <MaterialIcons name="close" size={24} color={AppColors.text} />
            </TouchableOpacity>
          </View>
          <ScrollView style={modalStyles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={modalStyles.label}>Full Name *</Text>
            <TextInput
              style={modalStyles.input}
              placeholder="John Doe"
              placeholderTextColor={AppColors.textSecondary}
              value={name}
              onChangeText={setName}
            />
            <Text style={modalStyles.label}>Email *</Text>
            <TextInput
              style={modalStyles.input}
              placeholder="john@company.com"
              placeholderTextColor={AppColors.textSecondary}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <Text style={modalStyles.label}>Password</Text>
            <TextInput
              style={modalStyles.input}
              placeholder={DEFAULT_PASSWORD}
              placeholderTextColor={AppColors.textSecondary}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
            <Text style={modalStyles.label}>Role</Text>
            <View style={modalStyles.chipRow}>
              {CREATE_ROLES.map((r) => (
                <TouchableOpacity
                  key={r.value}
                  style={[modalStyles.chip, role === r.value && modalStyles.chipActive]}
                  onPress={() => setRole(r.value)}
                >
                  <Text style={[modalStyles.chipText, role === r.value && modalStyles.chipTextActive]}>{r.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={modalStyles.label}>Designation</Text>
            <TextInput
              style={modalStyles.input}
              placeholder="e.g. Software Engineer"
              placeholderTextColor={AppColors.textSecondary}
              value={designation}
              onChangeText={setDesignation}
            />
            <Text style={modalStyles.label}>Department</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={modalStyles.deptScroll}>
              <TouchableOpacity
                style={[modalStyles.chip, !department && modalStyles.chipActive]}
                onPress={() => setDepartment('')}
              >
                <Text style={[modalStyles.chipText, !department && modalStyles.chipTextActive]}>— None —</Text>
              </TouchableOpacity>
              {departments.map((d) => (
                <TouchableOpacity
                  key={d._id}
                  style={[modalStyles.chip, department === d._id && modalStyles.chipActive]}
                  onPress={() => setDepartment(d._id)}
                >
                  <Text style={[modalStyles.chipText, department === d._id && modalStyles.chipTextActive]} numberOfLines={1}>{d.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {isAccounts ? (
              <>
                <View style={modalStyles.infoBox}>
                  <Text style={modalStyles.infoText}>As Accounts, you can set salary and bank details now or add them later.</Text>
                </View>
                <Text style={modalStyles.label}>Gross Salary (₹)</Text>
                <TextInput
                  style={modalStyles.input}
                  placeholder="e.g. 30000"
                  placeholderTextColor={AppColors.textSecondary}
                  value={grossSalary}
                  onChangeText={setGrossSalary}
                  keyboardType="number-pad"
                />
                <Text style={modalStyles.label}>Bank Account Number</Text>
                <TextInput
                  style={modalStyles.input}
                  placeholder="e.g. 1234567890"
                  placeholderTextColor={AppColors.textSecondary}
                  value={bankAccountNumber}
                  onChangeText={setBankAccountNumber}
                  keyboardType="number-pad"
                />
                <Text style={modalStyles.label}>IFSC Code</Text>
                <TextInput
                  style={modalStyles.input}
                  placeholder="e.g. SBIN0001234"
                  placeholderTextColor={AppColors.textSecondary}
                  value={ifscCode}
                  onChangeText={(t) => setIfscCode(t.toUpperCase())}
                  autoCapitalize="characters"
                  maxLength={11}
                />
                <View style={modalStyles.switchRow}>
                  <Text style={modalStyles.switchLabel}>Managing Head (full salary, no attendance deduction)</Text>
                  <Switch value={isManagingHead} onValueChange={setIsManagingHead} trackColor={{ false: '#ccc', true: AppColors.tint }} thumbColor="#fff" />
                </View>
              </>
            ) : (
              <View style={[modalStyles.infoBox, modalStyles.infoBoxBlue]}>
                <Text style={[modalStyles.infoText, modalStyles.infoTextBlue]}>
                  Gross salary, bank account & IFSC code are managed by the Accounts department after the employee is created.
                </Text>
              </View>
            )}

            <TouchableOpacity style={[modalStyles.submitBtn, saving && modalStyles.submitBtnDisabled]} onPress={submit} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={modalStyles.submitBtnText}>Create Employee</Text>}
            </TouchableOpacity>
            <View style={{ height: Spacing.section }} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function EmployeesScreen() {
  const router = useRouter();
  const getRole = useAuthStore((s) => s.getRole);
  const role = getRole();
  const canCreate = ['HR', 'DIRECTOR', 'SUPER_ADMIN', 'ACCOUNTS'].includes(role);
  const isAccounts = ['ACCOUNTS', 'SUPER_ADMIN'].includes(role);

  const [list, setList] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    try {
      const [usersRes, deptRes] = await Promise.all([
        api.get<{ data: User[] }>('/users'),
        api.get<{ data: Department[] }>('/departments'),
      ]);
      const users = (usersRes.data.data ?? []).filter((u) => u.role !== 'SUPER_ADMIN');
      setList(users);
      setDepartments(deptRes.data.data ?? []);
    } catch {
      setList([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const showMsg = (m: string) => {
    setMsg(m);
    const t = setTimeout(() => setMsg(''), 4000);
    return () => clearTimeout(t);
  };

  const filtered = search.trim()
    ? list.filter(
        (u) =>
          u.name?.toLowerCase().includes(search.toLowerCase()) ||
          u.email?.toLowerCase().includes(search.toLowerCase()) ||
          u.employeeId?.toLowerCase().includes(search.toLowerCase())
      )
    : list;

  return (
    <View style={[styles.screen, { backgroundColor: AppColors.background }]}>
      <SafeAreaView style={styles.safeTop}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <MaterialIcons name={Platform.OS === 'ios' ? 'arrow-back-ios' : 'arrow-back'} size={Platform.OS === 'ios' ? 22 : 24} color={AppColors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Employees</Text>
          {canCreate ? (
            <TouchableOpacity style={styles.addBtn} onPress={() => setShowAddModal(true)}>
              <MaterialIcons name="add" size={24} color="#fff" />
            </TouchableOpacity>
          ) : (
            <View style={styles.backBtn} />
          )}
        </View>
      </SafeAreaView>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={AppColors.tint} />}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.pageSubtitle}>{filtered.length} of {list.length} staff members</Text>

        {msg ? (
          <View style={[styles.msgBox, msg.includes('created') || msg.includes('success') ? styles.msgBoxSuccess : styles.msgBoxError]}>
            <Text style={styles.msgText}>{msg}</Text>
          </View>
        ) : null}

        <View style={styles.searchWrap}>
          <MaterialIcons name="search" size={22} color={AppColors.textSecondary} style={styles.searchIcon} />
          <TextInput
            style={styles.search}
            placeholder="Search by name, ID or email..."
            placeholderTextColor={AppColors.textSecondary}
            value={search}
            onChangeText={setSearch}
          />
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={AppColors.tint} />
            <Text style={styles.muted}>Loading…</Text>
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.emptyCard}>
            <MaterialIcons name="people" size={48} color={AppColors.textSecondary} />
            <Text style={styles.emptyText}>{search.trim() ? 'No matches' : 'No employees'}</Text>
            <Text style={styles.muted}>{search.trim() ? 'Try a different search.' : canCreate ? 'Tap + to add an employee.' : 'Add employees from the web portal.'}</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {filtered.map((u) => (
              <TouchableOpacity
                key={u._id}
                style={styles.card}
                onPress={() => router.push(`/profile?empId=${u._id}`)}
                activeOpacity={0.82}
              >
                <View style={styles.avatarWrap}>
                  <Text style={styles.avatarText}>{(u.name ?? '?').charAt(0).toUpperCase()}</Text>
                </View>
                <View style={styles.body}>
                  <Text style={styles.name}>{u.name ?? '—'}</Text>
                  {u.employeeId ? <Text style={styles.employeeId}>{u.employeeId}</Text> : null}
                  <Text style={styles.meta}>{u.designation ?? '—'}{u.department?.name ? ` · ${u.department.name}` : ''}</Text>
                  <View style={styles.roleBadge}>
                    <Text style={styles.roleText}>{ROLE_LABELS[u.role ?? ''] ?? u.role ?? '—'}</Text>
                  </View>
                </View>
                <MaterialIcons name="chevron-right" size={24} color={AppColors.textSecondary} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        <Text style={styles.footer}>{filtered.length} employee{filtered.length !== 1 ? 's' : ''}</Text>
        <View style={styles.bottomPad} />
      </ScrollView>

      <AddEmployeeModal
        visible={showAddModal}
        departments={departments}
        isAccounts={isAccounts}
        onClose={() => setShowAddModal(false)}
        onSaved={load}
        showMsg={showMsg}
      />
    </View>
  );
}

const modalStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  box: { backgroundColor: AppColors.card, borderTopLeftRadius: BorderRadius.xl, borderTopRightRadius: BorderRadius.xl, maxHeight: '92%' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(60,60,67,0.12)' },
  title: { fontSize: 18, fontWeight: '700', color: AppColors.text },
  closeBtn: { padding: Spacing.sm },
  body: { padding: Spacing.lg },
  label: { fontSize: 13, fontWeight: '600', color: AppColors.textSecondary, marginBottom: 6, marginTop: Spacing.sm },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(60,60,67,0.2)',
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    fontSize: 16,
    color: AppColors.text,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.sm },
  chip: { paddingHorizontal: Spacing.md, paddingVertical: 8, borderRadius: BorderRadius.md, backgroundColor: 'rgba(118,118,128,0.12)' },
  chipActive: { backgroundColor: AppColors.tint },
  chipText: { fontSize: 13, fontWeight: '600', color: AppColors.text },
  chipTextActive: { color: '#fff' },
  deptScroll: { marginBottom: Spacing.sm, maxHeight: 44 },
  infoBox: { padding: Spacing.md, marginBottom: Spacing.md, backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0', borderRadius: BorderRadius.md },
  infoBoxBlue: { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' },
  infoText: { fontSize: 14, color: '#166534' },
  infoTextBlue: { color: '#1e40af' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md },
  switchLabel: { fontSize: 14, color: AppColors.text, flex: 1, marginRight: Spacing.md },
  submitBtn: { backgroundColor: AppColors.tint, paddingVertical: Spacing.md, borderRadius: BorderRadius.md, alignItems: 'center', marginTop: Spacing.lg },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});

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
  addBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: AppColors.tint, justifyContent: 'center', alignItems: 'center' },
  scroll: { flex: 1 },
  content: { padding: Spacing.xl, paddingBottom: Spacing.section },
  bottomPad: { height: Spacing.section },
  pageSubtitle: { fontSize: 15, color: AppColors.textSecondary, marginBottom: Spacing.md },
  msgBox: { padding: Spacing.md, borderRadius: BorderRadius.md, marginBottom: Spacing.md },
  msgBoxSuccess: { backgroundColor: '#dcfce7' },
  msgBoxError: { backgroundColor: '#fef2f2' },
  msgText: { fontSize: 14, fontWeight: '600' },
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
  list: { gap: Spacing.md },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppColors.card,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    ...CardShadow,
  },
  avatarWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: AppColors.tint,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  body: { flex: 1, minWidth: 0 },
  name: { fontSize: 16, fontWeight: '700', color: AppColors.text },
  employeeId: { fontSize: 13, fontWeight: '600', color: AppColors.tint, marginTop: 2 },
  meta: { fontSize: 13, color: AppColors.textSecondary, marginTop: 2 },
  roleBadge: { alignSelf: 'flex-start', marginTop: 6, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: 'rgba(118,118,128,0.12)' },
  roleText: { fontSize: 12, fontWeight: '600', color: AppColors.text },
  footer: { marginTop: Spacing.lg, fontSize: 13, color: AppColors.textSecondary, textAlign: 'center' },
});
