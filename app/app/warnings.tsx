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

// ─── Constants ───────────────────────────────────────────────────────────
const TYPES = ['VERBAL', 'WRITTEN', 'FINAL_WRITTEN', 'SUSPENSION', 'TERMINATION'];
const CATEGORIES = ['ATTENDANCE', 'PERFORMANCE', 'CONDUCT', 'POLICY_VIOLATION', 'INSUBORDINATION', 'OTHER'];
const STATUSES = ['ACTIVE', 'ACKNOWLEDGED', 'APPEALED', 'RESOLVED', 'ESCALATED'];

const TYPE_COLORS: Record<string, { bg: string; color: string }> = {
  VERBAL: { bg: '#dbeafe', color: '#2563eb' },
  WRITTEN: { bg: '#fef3c7', color: '#b45309' },
  FINAL_WRITTEN: { bg: '#fed7aa', color: '#c2410c' },
  SUSPENSION: { bg: '#fecaca', color: '#b91c1c' },
  TERMINATION: { bg: '#7f1d1d', color: '#fff' },
};
const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  ACTIVE: { bg: '#fee2e2', color: '#b91c1c' },
  ACKNOWLEDGED: { bg: '#dbeafe', color: '#2563eb' },
  APPEALED: { bg: '#fef3c7', color: '#b45309' },
  RESOLVED: { bg: '#dcfce7', color: '#15803d' },
  ESCALATED: { bg: '#7f1d1d', color: '#fff' },
};

type Warning = {
  _id: string;
  warningId?: string;
  subject: string;
  description?: string;
  type?: string;
  category?: string;
  status?: string;
  actionRequired?: string;
  responseDeadline?: string;
  employeeResponse?: string;
  respondedAt?: string;
  escalatedTo?: string;
  issuedBy?: { name?: string };
  employee?: { _id: string; name?: string; employeeId?: string };
  createdAt: string;
};

function fmt(d: string | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ─── Issue Warning Modal ───────────────────────────────────────────────
function IssueWarningModal({
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
  const [employeeId, setEmployeeId] = useState('');
  const [type, setType] = useState('VERBAL');
  const [category, setCategory] = useState('CONDUCT');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [actionRequired, setActionRequired] = useState('');
  const [responseDeadline, setResponseDeadline] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) {
      setEmployeeId('');
      setType('VERBAL');
      setCategory('CONDUCT');
      setSubject('');
      setDescription('');
      setActionRequired('');
      setResponseDeadline('');
    }
  }, [visible]);

  const submit = async () => {
    if (!employeeId.trim()) return showMsg('Employee ID is required.');
    if (!subject.trim()) return showMsg('Subject is required.');
    if (!description.trim()) return showMsg('Description is required.');
    setSaving(true);
    try {
      await api.post('/warnings', {
        employeeId: employeeId.trim(),
        type,
        category,
        subject: subject.trim(),
        description: description.trim(),
        actionRequired: actionRequired.trim() || undefined,
        responseDeadline: responseDeadline || undefined,
      });
      showMsg('Warning issued.');
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
            <Text style={modalStyles.title}>Issue Warning</Text>
            <TouchableOpacity onPress={onClose} style={modalStyles.closeBtn}>
              <MaterialIcons name="close" size={24} color={AppColors.text} />
            </TouchableOpacity>
          </View>
          <ScrollView style={modalStyles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={modalStyles.label}>Employee ID *</Text>
            <TextInput style={modalStyles.input} placeholder="e.g. EMP-0005" placeholderTextColor={AppColors.textSecondary} value={employeeId} onChangeText={setEmployeeId} autoCapitalize="characters" />
            <Text style={modalStyles.label}>Warning Type *</Text>
            <View style={modalStyles.chipRow}>
              {TYPES.map((t) => (
                <TouchableOpacity key={t} style={[modalStyles.chip, type === t && modalStyles.chipActive]} onPress={() => setType(t)}>
                  <Text style={[modalStyles.chipText, type === t && modalStyles.chipTextActive]} numberOfLines={1}>{t.replace(/_/g, ' ')}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={modalStyles.label}>Category *</Text>
            <View style={modalStyles.chipRow}>
              {CATEGORIES.map((c) => (
                <TouchableOpacity key={c} style={[modalStyles.chip, category === c && modalStyles.chipActive]} onPress={() => setCategory(c)}>
                  <Text style={[modalStyles.chipText, category === c && modalStyles.chipTextActive]} numberOfLines={1}>{c.replace(/_/g, ' ')}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={modalStyles.label}>Response Deadline (YYYY-MM-DD)</Text>
            <TextInput style={modalStyles.input} placeholder="Optional" placeholderTextColor={AppColors.textSecondary} value={responseDeadline} onChangeText={setResponseDeadline} />
            <Text style={modalStyles.label}>Subject *</Text>
            <TextInput style={modalStyles.input} placeholder="Brief subject of the warning" placeholderTextColor={AppColors.textSecondary} value={subject} onChangeText={setSubject} maxLength={200} />
            <Text style={modalStyles.label}>Description *</Text>
            <TextInput style={[modalStyles.input, modalStyles.textArea]} placeholder="Detailed description of the incident or behavior..." placeholderTextColor={AppColors.textSecondary} value={description} onChangeText={setDescription} multiline numberOfLines={4} maxLength={3000} />
            <Text style={modalStyles.label}>Action Required</Text>
            <TextInput style={modalStyles.input} placeholder="What the employee must do..." placeholderTextColor={AppColors.textSecondary} value={actionRequired} onChangeText={setActionRequired} maxLength={1000} />
            <TouchableOpacity style={[modalStyles.submitBtn, saving && modalStyles.submitDisabled]} onPress={submit} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={modalStyles.submitBtnText}>Issue Warning</Text>}
            </TouchableOpacity>
            <View style={{ height: Spacing.section }} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Employee View (My Warnings) ─────────────────────────────────────────
function EmployeeWarningsView() {
  const router = useRouter();
  const [list, setList] = useState<Warning[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [msg, setMsg] = useState('');
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [responseText, setResponseText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get<{ data: Warning[] }>('/warnings/my');
      setList(data.data ?? []);
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

  const respond = async (id: string, appeal: boolean) => {
    setSubmitting(true);
    setMsg('');
    try {
      await api.patch(`/warnings/${id}/respond`, { response: responseText.trim(), appeal });
      setMsg(appeal ? 'Appeal submitted.' : 'Warning acknowledged.');
      setRespondingId(null);
      setResponseText('');
      load();
    } catch (e: unknown) {
      setMsg((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to submit.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: AppColors.background }]}>
      <SafeAreaView style={styles.safeTop}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <MaterialIcons name={Platform.OS === 'ios' ? 'arrow-back-ios' : 'arrow-back'} size={Platform.OS === 'ios' ? 22 : 24} color={AppColors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>My Warnings</Text>
          <View style={styles.backBtn} />
        </View>
      </SafeAreaView>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={80}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={AppColors.tint} />}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.pageSubtitle}>View and respond to warnings issued to you</Text>
          {msg ? (
            <View style={[styles.alert, { backgroundColor: `${AppColors.success}18` }]}>
              <MaterialIcons name="info" size={20} color={AppColors.success} />
              <Text style={[styles.alertText, { color: AppColors.success }]}>{msg}</Text>
            </View>
          ) : null}
          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color={AppColors.tint} />
              <Text style={styles.muted}>Loading…</Text>
            </View>
          ) : list.length === 0 ? (
            <View style={styles.emptyCard}>
              <MaterialIcons name="check-circle" size={48} color={AppColors.success} />
              <Text style={styles.emptyText}>No warnings</Text>
              <Text style={styles.muted}>You have a clean record. Keep it up!</Text>
            </View>
          ) : (
            <View style={styles.list}>
              {list.map((w) => {
                const tc = TYPE_COLORS[w.type ?? ''] ?? TYPE_COLORS.VERBAL;
                const sc = STATUS_COLORS[w.status ?? ''] ?? STATUS_COLORS.ACTIVE;
                const isActive = w.status === 'ACTIVE';
                const isResponding = respondingId === w._id;
                const deadlineOverdue = w.responseDeadline ? new Date(w.responseDeadline) < new Date() : false;
                return (
                  <View key={w._id} style={[styles.card, { borderLeftWidth: 4, borderLeftColor: tc.color }]}>
                    <View style={styles.cardTop}>
                      <View style={styles.badgeRow}>
                        <Text style={styles.warningId}>{w.warningId ?? '—'}</Text>
                        <View style={[styles.badge, { backgroundColor: tc.bg }]}>
                          <Text style={[styles.badgeText, { color: tc.color }]}>{((w.type ?? '').replace(/_/g, ' '))}</Text>
                        </View>
                        <View style={[styles.badge, { backgroundColor: '#f3f4f6' }]}>
                          <Text style={[styles.badgeText, { color: '#374151' }]}>{((w.category ?? '').replace(/_/g, ' '))}</Text>
                        </View>
                        <View style={[styles.badge, { backgroundColor: sc.bg }]}>
                          <Text style={[styles.badgeText, { color: sc.color }]}>{((w.status ?? '').replace(/_/g, ' '))}</Text>
                        </View>
                      </View>
                      <Text style={styles.dateText}>{fmt(w.createdAt)}</Text>
                    </View>
                    <Text style={styles.subject}>{w.subject}</Text>
                    {w.description ? <Text style={styles.desc}>{w.description}</Text> : null}
                    {w.actionRequired ? (
                      <View style={styles.actionBox}>
                        <Text style={styles.actionLabel}>Action Required: </Text>
                        <Text style={styles.actionValue}>{w.actionRequired}</Text>
                      </View>
                    ) : null}
                    {w.responseDeadline ? (
                      <Text style={[styles.deadline, deadlineOverdue && styles.deadlineOverdue]}>
                        Response deadline: {fmt(w.responseDeadline)}
                        {deadlineOverdue ? ' (OVERDUE)' : ''}
                      </Text>
                    ) : null}
                    <Text style={styles.issuedBy}>Issued by: {w.issuedBy?.name ?? '—'}</Text>
                    {w.employeeResponse ? (
                      <View style={styles.responseBox}>
                        <Text style={styles.responseLabel}>Your Response: </Text>
                        <Text style={styles.responseValue}>{w.employeeResponse}</Text>
                        {w.respondedAt ? <Text style={styles.responseDate}>Responded: {fmt(w.respondedAt)}</Text> : null}
                      </View>
                    ) : null}
                    {isActive &&
                      (isResponding ? (
                        <View style={styles.respondBlock}>
                          <TextInput
                            style={styles.textArea}
                            placeholder="Write your response..."
                            placeholderTextColor={AppColors.textSecondary}
                            value={responseText}
                            onChangeText={setResponseText}
                            multiline
                            numberOfLines={3}
                            maxLength={2000}
                          />
                          <View style={styles.respondActions}>
                            <TouchableOpacity style={[styles.respondBtn, styles.ackBtn]} onPress={() => respond(w._id, false)} disabled={submitting}>
                              {submitting ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.respondBtnTextWhite}>Acknowledge</Text>}
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.respondBtn, styles.appealBtn]} onPress={() => respond(w._id, true)} disabled={submitting}>
                              <Text style={[styles.respondBtnText, { color: '#b45309' }]}>Appeal</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.respondBtn} onPress={() => { setRespondingId(null); setResponseText(''); }} disabled={submitting}>
                              <Text style={[styles.respondBtnText, { color: AppColors.textSecondary }]}>Cancel</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      ) : (
                        <TouchableOpacity style={styles.respondPrimaryBtn} onPress={() => setRespondingId(w._id)}>
                          <Text style={styles.respondPrimaryBtnText}>Respond</Text>
                        </TouchableOpacity>
                      ))}
                  </View>
                );
              })}
            </View>
          )}
          <View style={styles.bottomPad} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// ─── Admin View (Warnings & Disciplinary) ─────────────────────────────────
function AdminWarningsView() {
  const router = useRouter();
  const [warnings, setWarnings] = useState<Warning[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [filters, setFilters] = useState({ status: '', type: '', category: '', search: '', flagged: false });
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filters.status) params.set('status', filters.status);
      if (filters.type) params.set('type', filters.type);
      if (filters.category) params.set('category', filters.category);
      if (filters.search.trim()) params.set('search', filters.search.trim());
      if (filters.flagged) params.set('flagged', 'true');
      const [wRes, sRes] = await Promise.all([
        api.get<{ data: Warning[] }>(`/warnings?${params.toString()}`),
        api.get<{ data: Record<string, number> }>('/warnings/stats'),
      ]);
      setWarnings(wRes.data.data ?? []);
      setStats(sRes.data.data ?? {});
    } catch {
      setWarnings([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filters.status, filters.type, filters.category, filters.search, filters.flagged]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  const showMsg = (m: string) => {
    setMsg(m);
    setTimeout(() => setMsg(''), 3500);
  };

  const updateStatus = async (id: string, status: string) => {
    setUpdatingId(id);
    try {
      await api.patch(`/warnings/${id}/status`, { status });
      showMsg('Status updated.');
      load();
    } catch (e: unknown) {
      showMsg((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed.');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete Warning', 'Delete this warning?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setDeletingId(id);
          try {
            await api.delete(`/warnings/${id}`);
            showMsg('Warning deleted.');
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

  return (
    <View style={[styles.screen, { backgroundColor: AppColors.background }]}>
      <SafeAreaView style={styles.safeTop}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <MaterialIcons name={Platform.OS === 'ios' ? 'arrow-back-ios' : 'arrow-back'} size={Platform.OS === 'ios' ? 22 : 24} color={AppColors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Warnings & Disciplinary</Text>
          <TouchableOpacity style={styles.addBtn} onPress={() => setShowIssueModal(true)}>
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
        <Text style={styles.pageSubtitle}>Issue and track employee warnings, auto-flag repeat offenders</Text>
        {msg ? (
          <View style={[styles.msgBox, msg.includes('issued') || msg.includes('updated') || msg.includes('deleted') ? styles.msgBoxSuccess : styles.msgBoxError]}>
            <Text style={styles.msgText}>{msg}</Text>
          </View>
        ) : null}

        <IssueWarningModal visible={showIssueModal} onClose={() => setShowIssueModal(false)} onSaved={load} showMsg={showMsg} />

        <View style={styles.statsRow}>
          {[
            { key: 'total', label: 'Total', color: '#2563eb' },
            { key: 'active', label: 'Active', color: '#b91c1c' },
            { key: 'acknowledged', label: 'Acknowledged', color: '#2563eb' },
            { key: 'escalated', label: 'Escalated', color: '#7f1d1d' },
            { key: 'flaggedEmployees', label: 'Flagged (3+)', color: '#991b1b' },
          ].map((s) => (
            <TouchableOpacity
              key={s.key}
              style={[styles.statCard, { backgroundColor: `${s.color}18` }]}
              onPress={s.key === 'flaggedEmployees' ? () => setFilters((f) => ({ ...f, flagged: !f.flagged })) : undefined}
              activeOpacity={s.key === 'flaggedEmployees' ? 0.7 : 1}
            >
              <Text style={[styles.statValue, { color: s.color }]}>{stats[s.key] ?? '—'}</Text>
              <Text style={[styles.statLabel, { color: s.color }]}>{s.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TextInput
          style={styles.searchInput}
          placeholder="Search name or ID..."
          placeholderTextColor={AppColors.textSecondary}
          value={filters.search}
          onChangeText={(t) => setFilters((f) => ({ ...f, search: t }))}
        />
        <View style={styles.filterRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
            <TouchableOpacity style={[styles.filterChip, !filters.status && styles.filterChipActive]} onPress={() => setFilters((f) => ({ ...f, status: '' }))}>
              <Text style={[styles.filterChipText, !filters.status && styles.filterChipTextActive]}>All Status</Text>
            </TouchableOpacity>
            {STATUSES.map((s) => (
              <TouchableOpacity key={s} style={[styles.filterChip, filters.status === s && styles.filterChipActive]} onPress={() => setFilters((f) => ({ ...f, status: filters.status === s ? '' : s }))}>
                <Text style={[styles.filterChipText, filters.status === s && styles.filterChipTextActive]}>{s.replace(/_/g, ' ')}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
        <View style={styles.filterRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
            <TouchableOpacity style={[styles.filterChip, !filters.type && styles.filterChipActive]} onPress={() => setFilters((f) => ({ ...f, type: '' }))}>
              <Text style={[styles.filterChipText, !filters.type && styles.filterChipTextActive]}>All Types</Text>
            </TouchableOpacity>
            {TYPES.map((t) => (
              <TouchableOpacity key={t} style={[styles.filterChip, filters.type === t && styles.filterChipActive]} onPress={() => setFilters((f) => ({ ...f, type: filters.type === t ? '' : t }))}>
                <Text style={[styles.filterChipText, filters.type === t && styles.filterChipTextActive]}>{t.replace(/_/g, ' ')}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
        <View style={styles.filterRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
            <TouchableOpacity style={[styles.filterChip, !filters.category && styles.filterChipActive]} onPress={() => setFilters((f) => ({ ...f, category: '' }))}>
              <Text style={[styles.filterChipText, !filters.category && styles.filterChipTextActive]}>All Categories</Text>
            </TouchableOpacity>
            {CATEGORIES.map((c) => (
              <TouchableOpacity key={c} style={[styles.filterChip, filters.category === c && styles.filterChipActive]} onPress={() => setFilters((f) => ({ ...f, category: filters.category === c ? '' : c }))}>
                <Text style={[styles.filterChipText, filters.category === c && styles.filterChipTextActive]}>{c.replace(/_/g, ' ')}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
        {filters.flagged && (
          <TouchableOpacity style={styles.clearFlaggedBtn} onPress={() => setFilters((f) => ({ ...f, flagged: false }))}>
            <Text style={styles.clearFlaggedText}>Clear Flagged Filter</Text>
          </TouchableOpacity>
        )}

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={AppColors.tint} />
          </View>
        ) : warnings.length === 0 ? (
          <View style={styles.emptyCard}>
            <MaterialIcons name="warning" size={48} color={AppColors.textSecondary} />
            <Text style={styles.emptyText}>No warnings found</Text>
            <Text style={styles.muted}>Issue a warning when disciplinary action is needed</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {warnings.map((w) => {
              const tc = TYPE_COLORS[w.type ?? ''] ?? TYPE_COLORS.VERBAL;
              const sc = STATUS_COLORS[w.status ?? ''] ?? STATUS_COLORS.ACTIVE;
              const canResolve = w.status !== 'RESOLVED' && w.status !== 'ESCALATED';
              const canEscalate = w.status !== 'ESCALATED' && w.status !== 'RESOLVED';
              return (
                <View key={w._id} style={[styles.adminCard, { borderLeftWidth: 4, borderLeftColor: tc.color }]}>
                  <View style={styles.adminCardTop}>
                    <View style={styles.badgeRow}>
                      <Text style={styles.empName}>{w.employee?.name ?? '—'}</Text>
                      <Text style={styles.empId}>{w.employee?.employeeId ?? '—'}</Text>
                      <View style={[styles.badge, { backgroundColor: '#f3f4f6' }]}>
                        <Text style={[styles.badgeText, { color: '#374151' }]}>{w.warningId ?? '—'}</Text>
                      </View>
                      <View style={[styles.badge, { backgroundColor: tc.bg }]}>
                        <Text style={[styles.badgeText, { color: tc.color }]}>{((w.type ?? '').replace(/_/g, ' '))}</Text>
                      </View>
                      <View style={[styles.badge, { backgroundColor: '#f3f4f6' }]}>
                        <Text style={[styles.badgeText, { color: '#374151' }]}>{((w.category ?? '').replace(/_/g, ' '))}</Text>
                      </View>
                      <View style={[styles.badge, { backgroundColor: sc.bg }]}>
                        <Text style={[styles.badgeText, { color: sc.color }]}>{((w.status ?? '').replace(/_/g, ' '))}</Text>
                      </View>
                    </View>
                    <Text style={styles.dateText}>{fmt(w.createdAt)}</Text>
                  </View>
                  <Text style={styles.subject}>{w.subject}</Text>
                  {w.description ? <Text style={styles.desc}>{w.description}</Text> : null}
                  {w.actionRequired ? (
                    <Text style={styles.actionRequiredText}><Text style={styles.bold}>Action Required:</Text> {w.actionRequired}</Text>
                  ) : null}
                  {w.employeeResponse ? (
                    <View style={styles.responseBox}>
                      <Text style={styles.responseLabel}>Employee Response: </Text>
                      <Text style={styles.responseValue}>{w.employeeResponse}</Text>
                    </View>
                  ) : null}
                  {w.escalatedTo ? (
                    <Text style={styles.escalatedTo}>Escalated to: {w.escalatedTo.replace(/_/g, ' ')}</Text>
                  ) : null}
                  <View style={styles.adminCardFooter}>
                    <Text style={styles.issuedBy}>Issued by: {w.issuedBy?.name ?? '—'}</Text>
                    <View style={styles.adminActions}>
                      {canResolve && (
                        <TouchableOpacity style={styles.resolveBtn} onPress={() => updateStatus(w._id, 'RESOLVED')} disabled={updatingId === w._id}>
                          {updatingId === w._id ? <ActivityIndicator size="small" color={AppColors.text} /> : <Text style={styles.resolveBtnText}>Resolve</Text>}
                        </TouchableOpacity>
                      )}
                      {canEscalate && (
                        <TouchableOpacity style={styles.escalateBtn} onPress={() => updateStatus(w._id, 'ESCALATED')} disabled={updatingId === w._id}>
                          <Text style={styles.escalateBtnText}>Escalate</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(w._id)} disabled={deletingId === w._id}>
                        {deletingId === w._id ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.deleteBtnText}>Delete</Text>}
                      </TouchableOpacity>
                    </View>
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
export default function WarningsScreen() {
  const getRole = useAuthStore((s) => s.getRole);
  const role = getRole();
  const isAdmin = ['HR', 'DIRECTOR', 'SUPER_ADMIN'].includes(role);

  if (isAdmin) return <AdminWarningsView />;
  return <EmployeeWarningsView />;
}

const modalStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  box: { backgroundColor: AppColors.card, borderTopLeftRadius: BorderRadius.xl, borderTopRightRadius: BorderRadius.xl, maxHeight: '92%' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(60,60,67,0.12)' },
  title: { fontSize: 18, fontWeight: '700', color: AppColors.text },
  closeBtn: { padding: Spacing.sm },
  body: { padding: Spacing.lg },
  label: { fontSize: 13, fontWeight: '600', color: AppColors.textSecondary, marginBottom: 6, marginTop: Spacing.sm },
  input: { borderWidth: 1, borderColor: 'rgba(60,60,67,0.2)', borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, paddingVertical: 12, fontSize: 16, color: AppColors.text },
  textArea: { minHeight: 88 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: { paddingHorizontal: Spacing.md, paddingVertical: 8, borderRadius: BorderRadius.md, backgroundColor: 'rgba(118,118,128,0.12)' },
  chipActive: { backgroundColor: AppColors.tint },
  chipText: { fontSize: 12, fontWeight: '600', color: AppColors.text },
  chipTextActive: { color: '#fff' },
  submitBtn: { backgroundColor: AppColors.tint, paddingVertical: Spacing.md, borderRadius: BorderRadius.md, alignItems: 'center', marginTop: Spacing.lg },
  submitDisabled: { opacity: 0.6 },
  submitBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
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
  clearFlaggedBtn: { alignSelf: 'flex-start', marginBottom: Spacing.md, paddingVertical: 8, paddingHorizontal: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: AppColors.danger },
  clearFlaggedText: { fontSize: 14, fontWeight: '600', color: AppColors.danger },
  loadingWrap: { alignItems: 'center', paddingVertical: Spacing.xxl },
  muted: { fontSize: 14, color: AppColors.textSecondary, marginTop: Spacing.sm },
  alert: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md, borderRadius: BorderRadius.md, marginBottom: Spacing.lg },
  alertText: { fontSize: 14, fontWeight: '500', flex: 1 },
  emptyCard: { alignItems: 'center', paddingVertical: Spacing.xxl, backgroundColor: AppColors.card, borderRadius: BorderRadius.xl, ...CardShadow },
  emptyText: { fontSize: 17, fontWeight: '600', color: AppColors.text, marginTop: Spacing.md },
  list: { gap: Spacing.lg },
  card: { backgroundColor: AppColors.card, borderRadius: BorderRadius.xl, padding: Spacing.lg, ...CardShadow },
  adminCard: { backgroundColor: AppColors.card, borderRadius: BorderRadius.xl, padding: Spacing.lg, marginBottom: Spacing.md, ...CardShadow },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: Spacing.sm },
  adminCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: Spacing.sm },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  warningId: { fontSize: 13, fontWeight: '700', color: AppColors.textSecondary, marginRight: 4 },
  empName: { fontSize: 15, fontWeight: '700', color: AppColors.text, marginRight: 4 },
  empId: { fontSize: 13, color: AppColors.textSecondary, marginRight: 4 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  dateText: { fontSize: 12, color: AppColors.textSecondary },
  subject: { fontSize: 16, fontWeight: '700', color: AppColors.text, marginBottom: 6 },
  desc: { fontSize: 14, color: AppColors.textSecondary, lineHeight: 20, marginBottom: Spacing.sm },
  actionBox: { paddingVertical: 8, paddingHorizontal: Spacing.md, borderRadius: BorderRadius.md, backgroundColor: '#fef3c7', marginBottom: Spacing.sm },
  actionLabel: { fontSize: 12, fontWeight: '600', color: '#92400e' },
  actionValue: { fontSize: 12, color: '#78350f', marginTop: 2 },
  actionRequiredText: { fontSize: 13, color: '#92400e', marginBottom: Spacing.sm },
  bold: { fontWeight: '700' },
  deadline: { fontSize: 12, color: AppColors.textSecondary, marginBottom: Spacing.sm },
  deadlineOverdue: { color: AppColors.danger },
  issuedBy: { fontSize: 12, color: AppColors.textSecondary },
  responseBox: { paddingVertical: 8, paddingHorizontal: Spacing.md, borderRadius: BorderRadius.md, backgroundColor: '#f0f7ff', marginBottom: Spacing.sm },
  responseLabel: { fontSize: 12, fontWeight: '600', color: '#1e40af' },
  responseValue: { fontSize: 12, color: '#1e3a8a', marginTop: 2 },
  responseDate: { fontSize: 11, color: AppColors.textSecondary, marginTop: 4 },
  escalatedTo: { fontSize: 13, color: AppColors.danger, fontWeight: '700', marginBottom: Spacing.sm },
  adminCardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', marginTop: Spacing.sm, gap: Spacing.sm },
  adminActions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  resolveBtn: { paddingHorizontal: Spacing.md, paddingVertical: 8, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: 'rgba(118,118,128,0.3)' },
  resolveBtnText: { fontSize: 13, fontWeight: '600', color: AppColors.text },
  escalateBtn: { paddingHorizontal: Spacing.md, paddingVertical: 8, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: AppColors.danger },
  escalateBtnText: { fontSize: 13, fontWeight: '600', color: AppColors.danger },
  deleteBtn: { paddingHorizontal: Spacing.md, paddingVertical: 8, borderRadius: BorderRadius.md, backgroundColor: AppColors.danger },
  deleteBtnText: { fontSize: 13, fontWeight: '600', color: '#fff' },
  respondBlock: { marginTop: Spacing.md },
  textArea: { borderWidth: 1, borderColor: 'rgba(118,118,128,0.2)', borderRadius: BorderRadius.md, padding: Spacing.md, fontSize: 14, color: AppColors.text, minHeight: 80, textAlignVertical: 'top', marginBottom: Spacing.sm },
  respondActions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  respondBtn: { paddingVertical: 10, paddingHorizontal: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: 'rgba(118,118,128,0.2)', minHeight: 44, justifyContent: 'center' },
  ackBtn: { backgroundColor: AppColors.tint, borderColor: AppColors.tint },
  appealBtn: { borderColor: '#b45309' },
  respondBtnText: { fontSize: 14, fontWeight: '600', color: AppColors.text },
  respondBtnTextWhite: { fontSize: 14, fontWeight: '600', color: '#fff' },
  respondPrimaryBtn: { marginTop: Spacing.sm, paddingVertical: 12, paddingHorizontal: Spacing.lg, borderRadius: BorderRadius.md, backgroundColor: AppColors.tint, alignSelf: 'flex-start' },
  respondPrimaryBtnText: { fontSize: 14, fontWeight: '600', color: '#fff' },
});
