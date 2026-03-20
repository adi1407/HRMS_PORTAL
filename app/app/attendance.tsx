import React, { useEffect, useState, useCallback } from 'react';
import {
  ScrollView,
  View,
  Text,
  TextInput,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  SafeAreaView,
  Platform,
  Modal,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Spacing, BorderRadius, AppColors, CardShadow } from '@/constants/theme';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { downloadAndShareFromApi } from '@/lib/download';

type AttRecord = {
  _id: string;
  date: string;
  status?: string;
  displayStatus?: string;
  checkIn?: string;
  checkOut?: string;
  checkInTime?: string;
  checkOutTime?: string;
  workingHours?: number;
  overriddenByName?: string;
  notes?: string;
};

type AttRecordWithEmployee = AttRecord & {
  employee?: { _id: string; name: string; employeeId?: string; designation?: string; department?: { name: string } };
};

type AttRequest = {
  _id: string;
  date: string;
  message: string;
  status: string;
  employee?: { _id: string; name: string; employeeId?: string; designation?: string };
};

type UserOption = { _id: string; name: string; employeeId?: string };

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const HR_ATTENDANCE_ROLES = ['HR', 'DIRECTOR', 'SUPER_ADMIN'];
const OVERRIDE_STATUS_OPTIONS = ['FULL_DAY', 'HALF_DAY', 'ABSENT', 'ON_LEAVE'] as const;

const STATUS_COLOR: Record<string, string> = {
  FULL_DAY: AppColors.success,
  HALF_DAY: AppColors.warning,
  ABSENT: AppColors.danger,
  ON_LEAVE: '#2563eb',
  HOLIDAY: '#059669',
  WEEKLY_OFF: AppColors.textSecondary,
};

export default function AttendanceScreen() {
  const router = useRouter();
  const getRole = useAuthStore((s) => s.getRole);
  const role = getRole();
  const canDoHR = HR_ATTENDANCE_ROLES.includes(role);

  const now = new Date();
  const [tab, setTab] = useState<'my' | 'team' | 'requests'>('my');
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [records, setRecords] = useState<AttRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [teamRecords, setTeamRecords] = useState<AttRecordWithEmployee[]>([]);
  const [loadingTeam, setLoadingTeam] = useState(false);
  const [requests, setRequests] = useState<AttRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [users, setUsers] = useState<UserOption[]>([]);

  const [overrideModal, setOverrideModal] = useState<AttRecordWithEmployee | null>(null);
  const [overrideStatus, setOverrideStatus] = useState('FULL_DAY');
  const [overrideNotes, setOverrideNotes] = useState('');
  const [overrideSubmitting, setOverrideSubmitting] = useState(false);

  const [manualModal, setManualModal] = useState(false);
  const [manualEmpId, setManualEmpId] = useState('');
  const [manualDate, setManualDate] = useState(now.toISOString().slice(0, 10));
  const [manualStatus, setManualStatus] = useState('FULL_DAY');
  const [manualNotes, setManualNotes] = useState('');
  const [manualSubmitting, setManualSubmitting] = useState(false);

  const [resolveModal, setResolveModal] = useState<AttRequest | null>(null);
  const [resolveStatus, setResolveStatus] = useState('FULL_DAY');
  const [resolveNote, setResolveNote] = useState('');
  const [resolveSubmitting, setResolveSubmitting] = useState(false);
  const [dismissingId, setDismissingId] = useState<string | null>(null);
  const [exportingExcel, setExportingExcel] = useState(false);

  const load = async () => {
    try {
      const { data } = await api.get<{ data: AttRecord[] }>(`/attendance/my?month=${month}&year=${year}`);
      setRecords(data.data ?? []);
    } catch {
      setRecords([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadTeam = useCallback(async () => {
    if (!canDoHR) return;
    setLoadingTeam(true);
    try {
      const { data } = await api.get<{ data: AttRecordWithEmployee[] }>(`/attendance?month=${month}&year=${year}`);
      setTeamRecords(data.data ?? []);
    } catch {
      setTeamRecords([]);
    } finally {
      setLoadingTeam(false);
    }
  }, [canDoHR, month, year]);

  const loadRequests = useCallback(async () => {
    if (!canDoHR) return;
    setLoadingRequests(true);
    try {
      const { data } = await api.get<{ data: AttRequest[] }>('/attendance/requests');
      setRequests(data.data ?? []);
    } catch {
      setRequests([]);
    } finally {
      setLoadingRequests(false);
    }
  }, [canDoHR]);

  const loadUsers = useCallback(async () => {
    if (!canDoHR) return;
    try {
      const { data } = await api.get<{ data: UserOption[] }>('/users');
      setUsers(data.data ?? []);
    } catch {
      setUsers([]);
    }
  }, [canDoHR]);

  useEffect(() => {
    if (tab === 'my') load();
    if (tab === 'team') { loadTeam(); loadUsers(); }
    if (tab === 'requests') loadRequests();
  }, [tab, month, year, loadTeam, loadRequests]);

  const onRefresh = () => {
    setRefreshing(true);
    if (tab === 'my') load();
    else if (tab === 'team') loadTeam();
    else if (tab === 'requests') loadRequests();
  };

  const handleOverride = async () => {
    if (!overrideModal || !overrideNotes.trim()) return;
    setOverrideSubmitting(true);
    try {
      await api.patch(`/attendance/${overrideModal._id}/override`, { status: overrideStatus, notes: overrideNotes.trim() });
      setOverrideModal(null);
      setOverrideNotes('');
      loadTeam();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to override.';
      Alert.alert('Error', msg);
    } finally {
      setOverrideSubmitting(false);
    }
  };

  const handleManualMark = async () => {
    if (!manualEmpId || !manualNotes.trim()) return;
    setManualSubmitting(true);
    try {
      await api.post('/attendance/manual', {
        employeeId: manualEmpId,
        date: manualDate,
        status: manualStatus,
        notes: manualNotes.trim(),
      });
      setManualModal(false);
      setManualEmpId('');
      setManualNotes('');
      loadTeam();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to mark attendance.';
      Alert.alert('Error', msg);
    } finally {
      setManualSubmitting(false);
    }
  };

  const handleMarkAndResolve = async () => {
    if (!resolveModal || !resolveNote.trim()) return;
    setResolveSubmitting(true);
    try {
      const empId = resolveModal.employee?._id;
      if (empId) {
        await api.post('/attendance/manual', {
          employeeId: empId,
          date: new Date(resolveModal.date).toISOString().slice(0, 10),
          status: resolveStatus,
          notes: resolveNote.trim(),
        });
      }
      await api.patch(`/attendance/requests/${resolveModal._id}/resolve`, { note: resolveNote.trim() });
      setResolveModal(null);
      setResolveNote('');
      loadRequests();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to resolve.';
      Alert.alert('Error', msg);
    } finally {
      setResolveSubmitting(false);
    }
  };

  const handleDismiss = (req: AttRequest) => {
    Alert.alert('Dismiss request', 'Mark this request as resolved without changing attendance?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Dismiss',
        style: 'destructive',
        onPress: async () => {
          setDismissingId(req._id);
          try {
            await api.patch(`/attendance/requests/${req._id}/resolve`, { note: 'Dismissed by HR' });
            loadRequests();
          } catch {
            Alert.alert('Error', 'Failed to dismiss.');
          } finally {
            setDismissingId(null);
          }
        },
      },
    ]);
  };

  const statusKey = (r: AttRecord) =>
    r.status === 'WEEKLY_OFF' || r.status === 'HOLIDAY' ? r.status : (r.displayStatus ?? r.status ?? '');
  const statusLabel = (r: AttRecord) => (statusKey(r) ?? '').replace(/_/g, ' ');
  const statusColor = (r: AttRecord) => STATUS_COLOR[statusKey(r)] ?? AppColors.text;

  const years = [now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2];

  const exportExcel = async () => {
    if (!canDoHR) return;
    setExportingExcel(true);
    try {
      await downloadAndShareFromApi({
        path: `/attendance/export?month=${month}&year=${year}`,
        fileName: `Attendance_Report_${MONTHS[month - 1]}_${year}.xlsx`,
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        dialogTitle: `Attendance Report ${MONTHS[month - 1]} ${year}`,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to export attendance report.';
      Alert.alert('Export failed', msg);
    } finally {
      setExportingExcel(false);
    }
  };

  const summary = () => {
    const full = records.filter((r) => statusKey(r) === 'FULL_DAY').length;
    const half = records.filter((r) => statusKey(r) === 'HALF_DAY').length;
    const absent = records.filter((r) => statusKey(r) === 'ABSENT').length;
    const leave = records.filter((r) => statusKey(r) === 'ON_LEAVE').length;
    const holiday = records.filter((r) => r.status === 'HOLIDAY').length;
    const wo = records.filter((r) => r.status === 'WEEKLY_OFF').length;
    const parts: string[] = [];
    if (full) parts.push(`${full} Full`);
    if (half) parts.push(`${half} Half`);
    if (leave) parts.push(`${leave} Leave`);
    if (holiday) parts.push(`${holiday} Holiday`);
    if (wo) parts.push(`${wo} WO`);
    if (absent) parts.push(`${absent} Absent`);
    return parts.length ? parts.join(', ') : 'No records';
  };

  return (
    <View style={[styles.screen, { backgroundColor: AppColors.background }]}>
      <SafeAreaView style={styles.safeTop}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <MaterialIcons name={Platform.OS === 'ios' ? 'arrow-back-ios' : 'arrow-back'} size={Platform.OS === 'ios' ? 22 : 24} color={AppColors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Attendance</Text>
          <View style={styles.backBtn} />
        </View>
      </SafeAreaView>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={AppColors.tint} />
        }
        showsVerticalScrollIndicator={false}
      >
        {canDoHR && (
          <View style={styles.tabRow}>
            <TouchableOpacity style={[styles.tab, tab === 'my' && styles.tabActive]} onPress={() => setTab('my')}>
              <Text style={[styles.tabText, tab === 'my' && styles.tabTextActive]}>My</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.tab, tab === 'team' && styles.tabActive]} onPress={() => setTab('team')}>
              <Text style={[styles.tabText, tab === 'team' && styles.tabTextActive]}>Team</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.tab, tab === 'requests' && styles.tabActive]} onPress={() => setTab('requests')}>
              <Text style={[styles.tabText, tab === 'requests' && styles.tabTextActive]}>Requests</Text>
            </TouchableOpacity>
          </View>
        )}

        {tab === 'my' && (
          <>
            <Text style={styles.pageSubtitle}>Your attendance history</Text>
            <View style={styles.controls}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.monthRow}>
            {MONTHS.map((m, i) => (
              <TouchableOpacity
                key={i}
                style={[styles.controlChip, month === i + 1 && styles.controlChipActive]}
                onPress={() => setMonth(i + 1)}
              >
                <Text style={[styles.controlChipText, month === i + 1 && styles.controlChipTextActive]}>{m}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <View style={styles.yearRow}>
            {years.map((y) => (
              <TouchableOpacity
                key={y}
                style={[styles.controlChip, year === y && styles.controlChipActive]}
                onPress={() => setYear(y)}
              >
                <Text style={[styles.controlChipText, year === y && styles.controlChipTextActive]}>{y}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {records.length > 0 && !loading && (
          <Text style={styles.summary}>{records.length} days · {summary()}</Text>
        )}

        {loading ? (
          <Text style={styles.muted}>Loading…</Text>
        ) : records.length === 0 ? (
          <View style={styles.emptyCard}>
            <MaterialIcons name="today" size={48} color={AppColors.textSecondary} />
            <Text style={styles.emptyText}>No records for this month</Text>
            <Text style={styles.emptySub}>No attendance data for {MONTHS[month - 1]} {year}. Check in from the app to record attendance.</Text>
          </View>
        ) : (
          <View style={styles.card}>
            {records.map((r, index) => (
              <View
                key={r._id}
                style={[styles.row, index < records.length - 1 && styles.rowBorder]}
              >
                <View style={styles.rowTop}>
                  <Text style={styles.date}>
                    {new Date(r.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                  </Text>
                  <View style={[styles.statusBadge, { backgroundColor: `${statusColor(r)}20` }]}>
                    <Text style={[styles.statusText, { color: statusColor(r) }]}>{statusLabel(r)}</Text>
                  </View>
                </View>
                {(r.checkInTime ?? r.checkIn) && (
                  <View style={styles.metaRow}>
                    <MaterialIcons name="login" size={14} color={AppColors.success} />
                    <Text style={styles.meta}>
                      In: {r.checkInTime ?? (r.checkIn ? new Date(r.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '')}
                    </Text>
                  </View>
                )}
                {(r.checkOutTime ?? r.checkOut) && (
                  <View style={styles.metaRow}>
                    <MaterialIcons name="logout" size={14} color={AppColors.danger} />
                    <Text style={styles.meta}>
                      Out: {r.checkOutTime ?? (r.checkOut ? new Date(r.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '')}
                    </Text>
                  </View>
                )}
                {r.workingHours != null && r.workingHours > 0 && (
                  <Text style={styles.worked}>{r.workingHours}h worked</Text>
                )}
                {r.overriddenByName && (
                  <View style={styles.overrideRow}>
                    <MaterialIcons name="edit" size={12} color={AppColors.warning} />
                    <Text style={styles.overrideText}>{r.overriddenByName}{r.notes ? ` · ${r.notes}` : ''}</Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}
          </>
        )}

        {tab === 'team' && canDoHR && (
          <>
            <Text style={styles.pageSubtitle}>Team attendance — override or mark manually</Text>
            <View style={styles.controls}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.monthRow}>
                {MONTHS.map((m, i) => (
                  <TouchableOpacity key={i} style={[styles.controlChip, month === i + 1 && styles.controlChipActive]} onPress={() => setMonth(i + 1)}>
                    <Text style={[styles.controlChipText, month === i + 1 && styles.controlChipTextActive]}>{m}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <View style={styles.yearRow}>
                {years.map((y) => (
                  <TouchableOpacity key={y} style={[styles.controlChip, year === y && styles.controlChipActive]} onPress={() => setYear(y)}>
                    <Text style={[styles.controlChipText, year === y && styles.controlChipTextActive]}>{y}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => { setManualModal(true); loadUsers(); }}>
              <MaterialIcons name="add-circle-outline" size={20} color="#fff" />
              <Text style={styles.primaryBtnText}>Mark attendance manually</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.secondaryActionBtn, exportingExcel && styles.btnDisabled]} onPress={exportExcel} disabled={exportingExcel}>
              {exportingExcel ? (
                <ActivityIndicator size="small" color={AppColors.tint} />
              ) : (
                <MaterialIcons name="download" size={18} color={AppColors.tint} />
              )}
              <Text style={styles.secondaryActionBtnText}>{exportingExcel ? 'Exporting…' : 'Export Excel'}</Text>
            </TouchableOpacity>
            {loadingTeam ? (
              <View style={styles.loadingRow}><ActivityIndicator size="small" color={AppColors.tint} /><Text style={styles.muted}>Loading…</Text></View>
            ) : teamRecords.length === 0 ? (
              <View style={styles.emptyCard}>
                <MaterialIcons name="people-outline" size={48} color={AppColors.textSecondary} />
                <Text style={styles.emptyText}>No team records</Text>
                <Text style={styles.emptySub}>No attendance for {MONTHS[month - 1]} {year}.</Text>
              </View>
            ) : (
              <View style={styles.card}>
                {teamRecords.map((r, index) => {
                  const empName = (r as AttRecordWithEmployee).employee?.name ?? (r as AttRecordWithEmployee).employee?.employeeId ?? '—';
                  const sk = r.status === 'WEEKLY_OFF' || r.status === 'HOLIDAY' ? r.status : (r.displayStatus ?? r.status ?? '');
                  return (
                    <View key={r._id} style={[styles.row, index < teamRecords.length - 1 && styles.rowBorder]}>
                      <View style={styles.rowTop}>
                        <Text style={styles.date}>{new Date(r.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</Text>
                        <View style={[styles.statusBadge, { backgroundColor: `${STATUS_COLOR[sk] ?? AppColors.text}20` }]}>
                          <Text style={[styles.statusText, { color: STATUS_COLOR[sk] ?? AppColors.text }]}>{sk.replace(/_/g, ' ')}</Text>
                        </View>
                      </View>
                      <Text style={styles.teamEmpName}>{empName}</Text>
                      {(r.checkInTime ?? r.checkIn) && <Text style={styles.meta}>In: {r.checkInTime ?? (r.checkIn ? new Date(r.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '')}</Text>}
                      {(r.checkOutTime ?? r.checkOut) && <Text style={styles.meta}>Out: {r.checkOutTime ?? (r.checkOut ? new Date(r.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '')}</Text>}
                      <TouchableOpacity style={styles.overrideBtn} onPress={() => { setOverrideModal(r as AttRecordWithEmployee); setOverrideStatus(sk && OVERRIDE_STATUS_OPTIONS.includes(sk as typeof OVERRIDE_STATUS_OPTIONS[number]) ? sk : 'FULL_DAY'); setOverrideNotes(''); }}>
                        <MaterialIcons name="edit" size={16} color={AppColors.tint} />
                        <Text style={styles.overrideBtnText}>Override</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            )}
          </>
        )}

        {tab === 'requests' && canDoHR && (
          <>
            <Text style={styles.pageSubtitle}>Employee requests (e.g. couldn’t mark, forgot to check in)</Text>
            {loadingRequests ? (
              <View style={styles.loadingRow}><ActivityIndicator size="small" color={AppColors.tint} /><Text style={styles.muted}>Loading…</Text></View>
            ) : requests.length === 0 ? (
              <View style={styles.emptyCard}>
                <MaterialIcons name="inbox" size={48} color={AppColors.textSecondary} />
                <Text style={styles.emptyText}>No pending requests</Text>
                <Text style={styles.emptySub}>When employees send a message from Check-in, they appear here.</Text>
              </View>
            ) : (
              <View style={styles.card}>
                {requests.map((req) => {
                  const empName = req.employee?.name ?? req.employee?.employeeId ?? '—';
                  const isDismissing = dismissingId === req._id;
                  return (
                    <View key={req._id} style={styles.requestRow}>
                      <Text style={styles.requestEmpName}>{empName}</Text>
                      <Text style={styles.requestDate}>{new Date(req.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</Text>
                      <Text style={styles.requestMessage}>{req.message}</Text>
                      <View style={styles.requestActions}>
                        <TouchableOpacity style={styles.resolveBtn} onPress={() => { setResolveModal(req); setResolveStatus('FULL_DAY'); setResolveNote(''); }} disabled={isDismissing}>
                          <MaterialIcons name="check-circle" size={18} color="#fff" />
                          <Text style={styles.resolveBtnText}>Mark & resolve</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.dismissBtn} onPress={() => handleDismiss(req)} disabled={isDismissing}>
                          {isDismissing ? <ActivityIndicator size="small" color="#fff" /> : <MaterialIcons name="cancel" size={18} color="#fff" />}
                          <Text style={styles.dismissBtnText}>Dismiss</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </>
        )}

        <View style={styles.bottomPad} />
      </ScrollView>

      {/* Override modal */}
      <Modal visible={!!overrideModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Override attendance</Text>
            {overrideModal && (
              <>
                <Text style={styles.muted}>{overrideModal.employee?.name} · {new Date(overrideModal.date).toLocaleDateString('en-IN')}</Text>
                <Text style={styles.inputLabel}>New status</Text>
                <View style={styles.pickerRow}>
                  {OVERRIDE_STATUS_OPTIONS.map((s) => (
                    <TouchableOpacity key={s} style={[styles.pickerChip, overrideStatus === s && styles.pickerChipActive]} onPress={() => setOverrideStatus(s)}>
                      <Text style={[styles.pickerChipText, overrideStatus === s && styles.pickerChipTextActive]}>{s.replace(/_/g, ' ')}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={styles.inputLabel}>Reason (required)</Text>
                <TextInput style={styles.input} placeholder="Why is this being changed?" placeholderTextColor={AppColors.textSecondary} value={overrideNotes} onChangeText={setOverrideNotes} />
                <View style={styles.modalActions}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => { setOverrideModal(null); setOverrideNotes(''); }}>
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.primaryBtn, styles.modalPrimaryBtn, (!overrideNotes.trim() || overrideSubmitting) && styles.btnDisabled]} onPress={handleOverride} disabled={!overrideNotes.trim() || overrideSubmitting}>
                    {overrideSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Save</Text>}
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Manual mark modal */}
      <Modal visible={manualModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalScrollContent}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Mark attendance manually</Text>
              <Text style={styles.inputLabel}>Employee</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.empScroll}>
                {users.map((u) => (
                  <TouchableOpacity key={u._id} style={[styles.empChip, manualEmpId === u._id && styles.empChipActive]} onPress={() => setManualEmpId(u._id)}>
                    <Text style={[styles.empChipText, manualEmpId === u._id && styles.empChipTextActive]} numberOfLines={1}>{u.name} {u.employeeId ? `(${u.employeeId})` : ''}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <Text style={styles.inputLabel}>Date</Text>
              <TextInput style={styles.input} value={manualDate} onChangeText={setManualDate} placeholder="YYYY-MM-DD" placeholderTextColor={AppColors.textSecondary} />
              <Text style={styles.inputLabel}>Status</Text>
              <View style={styles.pickerRow}>
                {OVERRIDE_STATUS_OPTIONS.map((s) => (
                  <TouchableOpacity key={s} style={[styles.pickerChip, manualStatus === s && styles.pickerChipActive]} onPress={() => setManualStatus(s)}>
                    <Text style={[styles.pickerChipText, manualStatus === s && styles.pickerChipTextActive]}>{s.replace(/_/g, ' ')}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.inputLabel}>Reason (required)</Text>
              <TextInput style={[styles.input, styles.inputArea]} placeholder="e.g. WFH approved, forgot to check in" placeholderTextColor={AppColors.textSecondary} value={manualNotes} onChangeText={setManualNotes} multiline />
              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => { setManualModal(false); setManualEmpId(''); setManualNotes(''); }}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.primaryBtn, styles.modalPrimaryBtn, (!manualEmpId || !manualNotes.trim() || manualSubmitting) && styles.btnDisabled]} onPress={handleManualMark} disabled={!manualEmpId || !manualNotes.trim() || manualSubmitting}>
                  {manualSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Mark</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Mark & resolve request modal */}
      <Modal visible={!!resolveModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Mark attendance & resolve</Text>
            {resolveModal && (
              <>
                <Text style={styles.muted}>{resolveModal.employee?.name} — {resolveModal.message}</Text>
                <Text style={styles.inputLabel}>Status to mark</Text>
                <View style={styles.pickerRow}>
                  {OVERRIDE_STATUS_OPTIONS.map((s) => (
                    <TouchableOpacity key={s} style={[styles.pickerChip, resolveStatus === s && styles.pickerChipActive]} onPress={() => setResolveStatus(s)}>
                      <Text style={[styles.pickerChipText, resolveStatus === s && styles.pickerChipTextActive]}>{s.replace(/_/g, ' ')}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={styles.inputLabel}>Note (required)</Text>
                <TextInput style={[styles.input, styles.inputArea]} placeholder="e.g. Marked full day as requested" placeholderTextColor={AppColors.textSecondary} value={resolveNote} onChangeText={setResolveNote} multiline />
                <View style={styles.modalActions}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => { setResolveModal(null); setResolveNote(''); }}>
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.primaryBtn, styles.modalPrimaryBtn, (!resolveNote.trim() || resolveSubmitting) && styles.btnDisabled]} onPress={handleMarkAndResolve} disabled={!resolveNote.trim() || resolveSubmitting}>
                    {resolveSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Mark & resolve</Text>}
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
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
  headerTitle: { fontSize: 18, fontWeight: '700', color: AppColors.text },
  scroll: { flex: 1 },
  content: { padding: Spacing.xl, paddingBottom: Spacing.section },
  pageSubtitle: { fontSize: 15, color: AppColors.textSecondary, marginBottom: Spacing.lg },
  controls: { marginBottom: Spacing.lg },
  monthRow: { flexDirection: 'row', gap: Spacing.sm, paddingVertical: 4 },
  yearRow: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap', marginTop: Spacing.sm },
  controlChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(118,118,128,0.12)',
  },
  controlChipActive: { backgroundColor: AppColors.tint },
  controlChipText: { fontSize: 13, fontWeight: '600', color: AppColors.text },
  controlChipTextActive: { color: '#fff' },
  summary: { fontSize: 14, color: AppColors.textSecondary, marginBottom: Spacing.md, fontWeight: '500' },
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
  bottomPad: { height: Spacing.section },
  card: {
    backgroundColor: AppColors.card,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    ...CardShadow,
  },
  row: { paddingVertical: Spacing.md },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(60,60,67,0.12)',
  },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  date: { fontSize: 16, fontWeight: '600', color: AppColors.text },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 12, fontWeight: '600' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  meta: { fontSize: 14, color: AppColors.textSecondary },
  worked: { fontSize: 13, color: AppColors.textSecondary, marginTop: 2 },
  overrideRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  overrideText: { fontSize: 11, color: AppColors.textSecondary },
  tabRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg },
  tab: { flex: 1, paddingVertical: Spacing.md, borderRadius: BorderRadius.md, alignItems: 'center', backgroundColor: 'rgba(118,118,128,0.12)' },
  tabActive: { backgroundColor: AppColors.tint },
  tabText: { fontSize: 14, fontWeight: '600', color: AppColors.textSecondary },
  tabTextActive: { color: '#fff' },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, height: 48, borderRadius: BorderRadius.md, backgroundColor: AppColors.tint, marginBottom: Spacing.lg },
  primaryBtnText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  secondaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 44,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: AppColors.tint,
    marginTop: -Spacing.sm,
    marginBottom: Spacing.lg,
    backgroundColor: AppColors.card,
  },
  secondaryActionBtnText: { fontSize: 14, fontWeight: '600', color: AppColors.tint },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.lg },
  teamEmpName: { fontSize: 15, fontWeight: '600', color: AppColors.text, marginTop: 2 },
  overrideBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: Spacing.sm },
  overrideBtnText: { fontSize: 14, fontWeight: '600', color: AppColors.tint },
  requestRow: { paddingVertical: Spacing.lg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(60,60,67,0.12)' },
  requestEmpName: { fontSize: 16, fontWeight: '600', color: AppColors.text },
  requestDate: { fontSize: 13, color: AppColors.textSecondary, marginTop: 2 },
  requestMessage: { fontSize: 14, color: AppColors.text, marginTop: 4 },
  requestActions: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.md },
  resolveBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 42, borderRadius: BorderRadius.md, backgroundColor: AppColors.success },
  resolveBtnText: { fontSize: 14, fontWeight: '600', color: '#fff' },
  dismissBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 42, borderRadius: BorderRadius.md, backgroundColor: AppColors.danger },
  dismissBtnText: { fontSize: 14, fontWeight: '600', color: '#fff' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: AppColors.card, borderTopLeftRadius: BorderRadius.xl, borderTopRightRadius: BorderRadius.xl, padding: Spacing.xl },
  modalTitle: { fontSize: 18, fontWeight: '700', color: AppColors.text, marginBottom: Spacing.md },
  inputLabel: { fontSize: 13, color: AppColors.textSecondary, marginBottom: 6, fontWeight: '500' },
  input: { borderWidth: 1, borderColor: 'rgba(118,118,128,0.2)', borderRadius: BorderRadius.md, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, fontSize: 16, color: AppColors.text, marginBottom: Spacing.lg },
  inputArea: { minHeight: 72, textAlignVertical: 'top' },
  pickerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.lg },
  pickerChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: 'rgba(118,118,128,0.12)' },
  pickerChipActive: { backgroundColor: AppColors.tint },
  pickerChipText: { fontSize: 13, fontWeight: '500', color: AppColors.text },
  pickerChipTextActive: { color: '#fff' },
  modalActions: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.sm },
  cancelBtn: { flex: 1, height: 48, borderRadius: BorderRadius.md, backgroundColor: 'rgba(118,118,128,0.12)', justifyContent: 'center', alignItems: 'center' },
  cancelBtnText: { fontSize: 16, fontWeight: '600', color: AppColors.tint },
  modalPrimaryBtn: { flex: 1 },
  btnDisabled: { opacity: 0.6 },
  modalScroll: { maxHeight: '80%' },
  modalScrollContent: { paddingBottom: Spacing.section },
  empScroll: { marginBottom: Spacing.lg, maxHeight: 120 },
  empChip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, backgroundColor: 'rgba(118,118,128,0.12)', marginRight: Spacing.sm },
  empChipActive: { backgroundColor: AppColors.tint },
  empChipText: { fontSize: 13, fontWeight: '500', color: AppColors.text, maxWidth: 140 },
  empChipTextActive: { color: '#fff' },
});
