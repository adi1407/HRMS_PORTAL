import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  ScrollView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Alert,
  RefreshControl,
  Platform,
  ActivityIndicator,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Spacing, BorderRadius, getAppColors } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

const LEAVE_TYPES = ['CASUAL', 'SICK', 'EARNED', 'MATERNITY', 'PATERNITY', 'UNPAID', 'COMP_OFF', 'OTHER'];

const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  PENDING:   { bg: '#fef3c7', text: '#d97706' },
  APPROVED:  { bg: '#dcfce7', text: '#16a34a' },
  REJECTED:  { bg: '#fee2e2', text: '#dc2626' },
  CANCELLED: { bg: '#f3f4f6', text: '#6b7280' },
};

type LeaveRecord = {
  _id: string;
  type: string;
  fromDate: string;
  toDate: string;
  status: string;
  totalDays: number;
  reason?: string;
  reviewNotes?: string;
  createdAt?: string;
};

type LeaveForApproval = LeaveRecord & {
  employee?: { _id: string; name: string; employeeId?: string; department?: { name: string } };
};

const HR_LEAVE_ROLES = ['HR', 'DIRECTOR', 'SUPER_ADMIN'];

function leaveTypeLabel(t: string) {
  if (t === 'COMP_OFF') return 'Comp Off';
  return t.charAt(0) + t.slice(1).toLowerCase();
}

export default function LeaveScreen() {
  const theme = useAppTheme();
  const colors = useMemo(() => getAppColors(theme), [theme]);
  const styles = useMemo(() => createLeaveStyles(colors, theme), [theme]);

  const getRole = useAuthStore((s) => s.getRole);
  const role = getRole();
  const canApproveLeave = HR_LEAVE_ROLES.includes(role);

  const [tab, setTab] = useState<'apply' | 'history' | 'approvals'>('apply');
  const [leaves, setLeaves] = useState<LeaveRecord[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [message, setMessage] = useState<{ success: boolean; text: string } | null>(null);

  const [approvalLeaves, setApprovalLeaves] = useState<LeaveForApproval[]>([]);
  const [loadingApprovals, setLoadingApprovals] = useState(false);
  const [approvalStatusFilter, setApprovalStatusFilter] = useState<string>('PENDING');
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');

  const [modalVisible, setModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [type, setType] = useState('CASUAL');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [reason, setReason] = useState('');
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);

  const toYMD = (d: Date) => d.toISOString().split('T')[0]!;
  const fromDateObj = fromDate ? new Date(fromDate) : new Date();
  const toDateObj = toDate ? new Date(toDate) : (fromDate ? new Date(fromDate) : new Date());
  const minToDate = fromDate ? new Date(fromDate) : new Date();

  const loadLeaves = async () => {
    if (tab === 'history') setLoadingHistory(true);
    try {
      const { data } = await api.get<{ data: LeaveRecord[] }>('/leaves/my');
      setLeaves(data.data ?? []);
    } catch {
      setLeaves([]);
    } finally {
      setRefreshing(false);
      setLoadingHistory(false);
    }
  };

  const loadApprovalLeaves = useCallback(async () => {
    if (!canApproveLeave) return;
    setLoadingApprovals(true);
    try {
      const params = new URLSearchParams();
      if (approvalStatusFilter) params.set('status', approvalStatusFilter);
      const { data } = await api.get<{ data: LeaveForApproval[] }>(`/leaves?${params.toString()}`);
      setApprovalLeaves(data.data ?? []);
    } catch {
      setApprovalLeaves([]);
    } finally {
      setLoadingApprovals(false);
      setRefreshing(false);
    }
  }, [canApproveLeave, approvalStatusFilter]);

  useEffect(() => {
    if (tab === 'history') loadLeaves();
    if (tab === 'approvals') loadApprovalLeaves();
  }, [tab, loadApprovalLeaves]);

  const handleReviewLeave = async (leaveId: string, status: 'APPROVED' | 'REJECTED') => {
    setActioningId(leaveId);
    try {
      await api.patch(`/leaves/${leaveId}/review`, {
        status,
        reviewNotes: reviewNotes.trim() || undefined,
        isPaid: status === 'APPROVED',
      });
      setMessage({ success: true, text: `Leave ${status.toLowerCase()} successfully.` });
      setReviewNotes('');
      loadApprovalLeaves();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? `Failed to ${status.toLowerCase()} leave.`;
      setMessage({ success: false, text: msg });
    } finally {
      setActioningId(null);
    }
  };

  const confirmReview = (leave: LeaveForApproval, status: 'APPROVED' | 'REJECTED') => {
    const name = leave.employee?.name ?? leave.employee?.employeeId ?? 'Employee';
    Alert.alert(
      status === 'APPROVED' ? 'Approve leave' : 'Reject leave',
      `${status === 'APPROVED' ? 'Approve' : 'Reject'} leave request of ${name}?${reviewNotes.trim() ? `\nNote: ${reviewNotes.trim()}` : ''}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: status === 'APPROVED' ? 'Approve' : 'Reject',
          style: status === 'REJECTED' ? 'destructive' : 'default',
          onPress: () => handleReviewLeave(leave._id, status),
        },
      ]
    );
  };

  const onRefresh = () => {
    setRefreshing(true);
    if (tab === 'approvals') loadApprovalLeaves();
    else loadLeaves();
  };

  const totalDays = fromDate && toDate
    ? Math.max(0, Math.ceil((new Date(toDate).getTime() - new Date(fromDate).getTime()) / (1000 * 60 * 60 * 24)) + 1)
    : 0;

  const submitLeave = async () => {
    if (!fromDate.trim() || !toDate.trim()) {
      Alert.alert('Required', 'Please enter From date and To date.');
      return;
    }
    const from = new Date(fromDate);
    const to = new Date(toDate);
    if (isNaN(from.getTime()) || isNaN(to.getTime())) {
      Alert.alert('Invalid dates', 'Use format YYYY-MM-DD (e.g. 2025-03-20).');
      return;
    }
    if (to < from) {
      Alert.alert('Invalid', 'To date must be on or after From date.');
      return;
    }
    if (!reason.trim()) {
      Alert.alert('Required', 'Please enter a reason for leave.');
      return;
    }
    setSubmitting(true);
    setMessage(null);
    try {
      await api.post('/leaves', {
        type,
        fromDate: from.toISOString(),
        toDate: to.toISOString(),
        reason: reason.trim(),
      });
      setMessage({ success: true, text: 'Leave application submitted successfully.' });
      closeModal();
      setFromDate('');
      setToDate('');
      setReason('');
      loadLeaves();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to apply for leave.';
      setMessage({ success: false, text: msg });
    } finally {
      setSubmitting(false);
    }
  };

  const openApply = () => {
    setMessage(null);
    setShowFromPicker(false);
    setShowToPicker(false);
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setShowFromPicker(false);
    setShowToPicker(false);
  };

  return (
    <>
      <ScrollView
        style={[styles.scroll, { backgroundColor: colors.background }]}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.tint} />
        }
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.pageTitle}>Leave</Text>
        <Text style={styles.pageSubtitle}>Apply for leave or view your application history</Text>

        {message && (
          <View style={[styles.alert, message.success ? styles.alertSuccess : styles.alertError]}>
            <MaterialIcons
              name={message.success ? 'check-circle' : 'warning'}
              size={20}
              color={message.success ? colors.success : colors.danger}
            />
            <Text style={[styles.alertText, { color: message.success ? colors.success : colors.danger }]}>
              {message.text}
            </Text>
          </View>
        )}

        {/* Tabs */}
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tab, tab === 'apply' && styles.tabActive]}
            onPress={() => setTab('apply')}
          >
            <Text style={[styles.tabText, tab === 'apply' && styles.tabTextActive]}>Apply Leave</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, tab === 'history' && styles.tabActive]}
            onPress={() => setTab('history')}
          >
            <Text style={[styles.tabText, tab === 'history' && styles.tabTextActive]}>My History</Text>
          </TouchableOpacity>
          {canApproveLeave && (
            <TouchableOpacity
              style={[styles.tab, tab === 'approvals' && styles.tabActive]}
              onPress={() => setTab('approvals')}
            >
              <Text style={[styles.tabText, tab === 'approvals' && styles.tabTextActive]}>Approvals</Text>
            </TouchableOpacity>
          )}
        </View>

        {tab === 'apply' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>New leave application</Text>
            <Text style={styles.muted}>Fill the form below and submit. You can also open the form from the button.</Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={openApply} activeOpacity={0.82}>
              <MaterialIcons name="add-circle-outline" size={22} color="#fff" />
              <Text style={styles.primaryBtnText}>Apply for leave</Text>
            </TouchableOpacity>
          </View>
        )}

        {tab === 'history' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>My leave applications</Text>
            {loadingHistory ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color={colors.tint} />
                <Text style={styles.muted}>Loading…</Text>
              </View>
            ) : leaves.length === 0 ? (
              <View style={styles.emptyState}>
                <MaterialIcons name="event-busy" size={40} color={colors.textSecondary} />
                <Text style={styles.emptyText}>No leave applications yet</Text>
                <Text style={styles.muted}>Apply for leave from the Apply tab.</Text>
              </View>
            ) : (
              leaves.map((l, index) => {
                const statusStyle = STATUS_STYLE[l.status] ?? STATUS_STYLE.CANCELLED;
                return (
                  <View key={l._id} style={[styles.leaveRow, { borderTopColor: 'rgba(60,60,67,0.12)' }, index === 0 && styles.leaveRowFirst]}>
                    <View style={styles.leaveRowTop}>
                      <Text style={styles.leaveType}>
                        {l.type === 'COMP_OFF' ? 'Comp Off' : l.type}
                      </Text>
                      <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
                        <Text style={[styles.statusBadgeText, { color: statusStyle.text }]}>{l.status}</Text>
                      </View>
                    </View>
                    <Text style={styles.leaveDates}>
                      {new Date(l.fromDate).toLocaleDateString('en-IN')} – {new Date(l.toDate).toLocaleDateString('en-IN')} · {l.totalDays} day{l.totalDays !== 1 ? 's' : ''}
                    </Text>
                    {l.reason ? (
                      <Text style={styles.leaveReason} numberOfLines={2}>{l.reason}</Text>
                    ) : null}
                    {l.reviewNotes ? (
                      <Text style={styles.reviewNotes}>Note: {l.reviewNotes}</Text>
                    ) : null}
                  </View>
                );
              })
            )}
          </View>
        )}

        {tab === 'approvals' && canApproveLeave && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Leave approvals</Text>
            <Text style={styles.muted}>Review and approve or reject leave requests.</Text>
            <View style={styles.filterRow}>
              {['PENDING', 'APPROVED', 'REJECTED'].map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[styles.filterChip, approvalStatusFilter === s && styles.filterChipActive]}
                  onPress={() => setApprovalStatusFilter(s)}
                >
                  <Text style={[styles.filterChipText, approvalStatusFilter === s && styles.filterChipTextActive]}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {loadingApprovals ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color={colors.tint} />
                <Text style={styles.muted}>Loading…</Text>
              </View>
            ) : approvalLeaves.length === 0 ? (
              <View style={styles.emptyState}>
                <MaterialIcons name="inbox" size={40} color={colors.textSecondary} />
                <Text style={styles.emptyText}>No leave requests</Text>
                <Text style={styles.muted}>When employees apply for leave, they will appear here.</Text>
              </View>
            ) : (
              <>
                {approvalLeaves.some((l) => l.status === 'PENDING') && (
                  <View style={styles.reviewNotesRow}>
                    <Text style={styles.inputLabel}>Optional note for approve/reject</Text>
                    <TextInput
                      style={styles.reviewNotesInput}
                      placeholder="e.g. Approved as requested"
                      placeholderTextColor={colors.textSecondary}
                      value={reviewNotes}
                      onChangeText={setReviewNotes}
                    />
                  </View>
                )}
                {approvalLeaves.map((l, index) => {
                  const statusStyle = STATUS_STYLE[l.status] ?? STATUS_STYLE.CANCELLED;
                  const isPending = l.status === 'PENDING';
                  const isActioning = actioningId === l._id;
                  const empName = l.employee?.name ?? l.employee?.employeeId ?? '—';
                  const empDept = l.employee?.department?.name;
                  return (
                    <View key={l._id} style={[styles.approvalRow, { borderTopColor: 'rgba(60,60,67,0.12)' }, index === 0 && styles.approvalRowFirst]}>
                      <View style={styles.approvalRowTop}>
                        <Text style={styles.approvalEmpName}>{empName}</Text>
                        {empDept ? <Text style={styles.muted}>{empDept}</Text> : null}
                        <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
                          <Text style={[styles.statusBadgeText, { color: statusStyle.text }]}>{l.status}</Text>
                        </View>
                      </View>
                      <Text style={styles.leaveType}>{leaveTypeLabel(l.type)}</Text>
                      <Text style={styles.leaveDates}>
                        {new Date(l.fromDate).toLocaleDateString('en-IN')} – {new Date(l.toDate).toLocaleDateString('en-IN')} · {l.totalDays} day{l.totalDays !== 1 ? 's' : ''}
                      </Text>
                      {l.reason ? <Text style={styles.leaveReason} numberOfLines={2}>{l.reason}</Text> : null}
                      {isPending && (
                        <View style={styles.approvalButtons}>
                          <TouchableOpacity
                            style={[styles.approveBtn, isActioning && styles.btnDisabled]}
                            onPress={() => confirmReview(l, 'APPROVED')}
                            disabled={isActioning}
                          >
                            {isActioning ? <ActivityIndicator size="small" color="#fff" /> : <MaterialIcons name="check-circle" size={18} color="#fff" />}
                            <Text style={styles.approveBtnText}>Approve</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.rejectBtn, isActioning && styles.btnDisabled]}
                            onPress={() => confirmReview(l, 'REJECTED')}
                            disabled={isActioning}
                          >
                            <MaterialIcons name="cancel" size={18} color="#fff" />
                            <Text style={styles.rejectBtnText}>Reject</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  );
                })}
              </>
            )}
          </View>
        )}

        <View style={styles.bottomPad} />
      </ScrollView>

      {/* Apply modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Apply for leave</Text>
              <TouchableOpacity onPress={closeModal} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Leave type</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typeScroll} contentContainerStyle={styles.typeScrollContent}>
              {LEAVE_TYPES.map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.typeChip, type === t && styles.typeChipActive]}
                  onPress={() => setType(t)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.typeChipText, type === t && styles.typeChipTextActive]}>
                    {leaveTypeLabel(t)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.inputLabel}>From date *</Text>
            <TouchableOpacity
              style={styles.dateTouchable}
              onPress={() => setShowFromPicker(true)}
              activeOpacity={0.8}
            >
              <MaterialIcons name="calendar-today" size={20} color={colors.tint} />
              <Text style={[styles.dateTouchableText, !fromDate && styles.datePlaceholder]}>
                {fromDate ? new Date(fromDate).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : 'Select from date'}
              </Text>
              <MaterialIcons name="chevron-right" size={22} color={colors.textSecondary} />
            </TouchableOpacity>

            {showFromPicker && (
              <DateTimePicker
                value={fromDateObj}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                minimumDate={new Date()}
                onChange={(event, selected) => {
                  if (Platform.OS === 'android') {
                    setShowFromPicker(false);
                    if (event.type === 'dismissed') return;
                  }
                  if (selected) {
                    const ymd = toYMD(selected);
                    setFromDate(ymd);
                    if (toDate && new Date(ymd) > new Date(toDate)) setToDate(ymd);
                  }
                }}
              />
            )}
            {showFromPicker && Platform.OS === 'ios' && (
              <View style={styles.pickerActions}>
                <TouchableOpacity onPress={() => setShowFromPicker(false)}>
                  <Text style={styles.pickerDoneText}>Done</Text>
                </TouchableOpacity>
              </View>
            )}

            <Text style={styles.inputLabel}>To date *</Text>
            <TouchableOpacity
              style={styles.dateTouchable}
              onPress={() => setShowToPicker(true)}
              activeOpacity={0.8}
            >
              <MaterialIcons name="event" size={20} color={colors.tint} />
              <Text style={[styles.dateTouchableText, !toDate && styles.datePlaceholder]}>
                {toDate ? new Date(toDate).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : 'Select to date'}
              </Text>
              <MaterialIcons name="chevron-right" size={22} color={colors.textSecondary} />
            </TouchableOpacity>

            {showToPicker && (
              <DateTimePicker
                value={toDateObj}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                minimumDate={minToDate}
                onChange={(event, selected) => {
                  if (Platform.OS === 'android') {
                    setShowToPicker(false);
                    if (event.type === 'dismissed') return;
                  }
                  if (selected) setToDate(toYMD(selected));
                }}
              />
            )}
            {showToPicker && Platform.OS === 'ios' && (
              <View style={styles.pickerActions}>
                <TouchableOpacity onPress={() => setShowToPicker(false)}>
                  <Text style={styles.pickerDoneText}>Done</Text>
                </TouchableOpacity>
              </View>
            )}
            {totalDays > 0 && (
              <Text style={styles.durationText}>Duration: <Text style={styles.durationBold}>{totalDays} day{totalDays !== 1 ? 's' : ''}</Text></Text>
            )}

            <Text style={styles.inputLabel}>Reason *</Text>
            <TextInput
              style={[styles.input, styles.inputArea]}
              placeholder="Briefly describe the reason for leave…"
              placeholderTextColor={colors.textSecondary}
              value={reason}
              onChangeText={setReason}
              multiline
              numberOfLines={3}
            />

            <TouchableOpacity
              style={[styles.primaryBtn, styles.submitBtn, submitting && styles.primaryBtnDisabled]}
              onPress={submitLeave}
              disabled={submitting}
              activeOpacity={0.82}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryBtnText}>Submit application</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

function createLeaveStyles(colors: ReturnType<typeof getAppColors>, theme: 'light' | 'dark') {
  const cardShadow = Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: theme === 'dark' ? 0.35 : 0.06,
      shadowRadius: 8,
    },
    android: { elevation: theme === 'dark' ? 4 : 2 },
    default: {},
  });
  const fillMuted = theme === 'dark' ? 'rgba(120,120,128,0.28)' : 'rgba(118,118,128,0.12)';
  const borderMuted = theme === 'dark' ? 'rgba(255,255,255,0.18)' : 'rgba(118,118,128,0.2)';

  return StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: Spacing.xxl, paddingBottom: Spacing.section },
  bottomPad: { height: Spacing.section },
  pageTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  pageSubtitle: { fontSize: 15, color: colors.textSecondary, marginBottom: Spacing.xl },
  alert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
  },
  alertSuccess: { backgroundColor: `${colors.success}18` },
  alertError: { backgroundColor: `${colors.danger}12` },
  alertText: { fontSize: 15, fontWeight: '500', flex: 1 },
  tabRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.xl },
  tab: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    backgroundColor: fillMuted,
  },
  tabActive: { backgroundColor: colors.tint },
  tabText: { fontSize: 15, fontWeight: '600', color: colors.textSecondary },
  tabTextActive: { color: '#fff' },
  card: {
    backgroundColor: colors.card,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    ...cardShadow,
  },
  cardTitle: { fontSize: 17, fontWeight: '600', color: colors.text, marginBottom: 4 },
  muted: { fontSize: 14, color: colors.textSecondary, lineHeight: 20, marginBottom: Spacing.md },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    height: 52,
    borderRadius: BorderRadius.md,
    backgroundColor: colors.tint,
  },
  primaryBtnDisabled: { opacity: 0.6 },
  primaryBtnText: { fontSize: 17, fontWeight: '600', color: '#fff' },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.lg },
  emptyState: { alignItems: 'center', paddingVertical: Spacing.xxl },
  emptyText: { fontSize: 16, fontWeight: '600', color: colors.text, marginTop: Spacing.sm },
  leaveRow: {
    paddingVertical: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  leaveRowFirst: { borderTopWidth: 0 },
  leaveRowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  leaveType: { fontSize: 16, fontWeight: '600', color: colors.text },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeText: { fontSize: 12, fontWeight: '600' },
  leaveDates: { fontSize: 14, color: colors.textSecondary, marginBottom: 2 },
  leaveReason: { fontSize: 14, color: colors.text, marginTop: 2 },
  reviewNotes: { fontSize: 13, color: colors.textSecondary, marginTop: 4, fontStyle: 'italic' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.card,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.xl,
    paddingBottom: Spacing.section + (Platform.OS === 'ios' ? 24 : 16),
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: colors.text },
  cancelText: { fontSize: 17, fontWeight: '500', color: colors.tint },
  inputLabel: { fontSize: 13, color: colors.textSecondary, marginBottom: 6, fontWeight: '500' },
  typeScroll: { marginBottom: Spacing.lg },
  typeScrollContent: { flexDirection: 'row', gap: Spacing.sm, paddingVertical: 2 },
  typeChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: fillMuted,
  },
  typeChipActive: { backgroundColor: colors.tint },
  typeChipText: { fontSize: 14, fontWeight: '500', color: colors.text },
  typeChipTextActive: { color: '#fff' },
  dateTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderWidth: 1,
    borderColor: borderMuted,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  dateTouchableText: { flex: 1, fontSize: 16, color: colors.text },
  datePlaceholder: { color: colors.textSecondary },
  pickerActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: Spacing.lg,
  },
  pickerDoneText: { fontSize: 17, fontWeight: '600', color: colors.tint },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: borderMuted,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    fontSize: 16,
    color: colors.text,
  },
  inputArea: {
    minHeight: 88,
    paddingTop: Spacing.md,
    textAlignVertical: 'top',
  },
  durationText: { fontSize: 14, color: colors.textSecondary, marginBottom: Spacing.md },
  durationBold: { fontWeight: '600', color: colors.text },
  submitBtn: { marginTop: Spacing.sm },
  filterRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: fillMuted,
  },
  filterChipActive: { backgroundColor: colors.tint },
  filterChipText: { fontSize: 14, fontWeight: '500', color: colors.textSecondary },
  filterChipTextActive: { color: '#fff' },
  approvalRow: {
    paddingVertical: Spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  approvalRowFirst: { borderTopWidth: 0 },
  approvalRowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  approvalEmpName: { fontSize: 16, fontWeight: '600', color: colors.text, flex: 1 },
  approvalButtons: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.md },
  approveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 44,
    borderRadius: BorderRadius.md,
    backgroundColor: colors.success,
  },
  rejectBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 44,
    borderRadius: BorderRadius.md,
    backgroundColor: colors.danger,
  },
  approveBtnText: { fontSize: 15, fontWeight: '600', color: '#fff' },
  rejectBtnText: { fontSize: 15, fontWeight: '600', color: '#fff' },
  btnDisabled: { opacity: 0.6 },
  reviewNotesRow: { marginBottom: Spacing.lg },
  reviewNotesInput: {
    borderWidth: 1,
    borderColor: borderMuted,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    fontSize: 15,
    color: colors.text,
    minHeight: 44,
  },
  });
}
