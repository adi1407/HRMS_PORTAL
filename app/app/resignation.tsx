import React, { useEffect, useState, useCallback } from 'react';
import {
  ScrollView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Platform,
  SafeAreaView,
  Modal,
  KeyboardAvoidingView,
} from 'react-native';
import { useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Spacing, BorderRadius, AppColors, CardShadow } from '@/constants/theme';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { downloadAndShareFromApi } from '@/lib/download';

// ─── Types ─────────────────────────────────────────────────────────────
type Resignation = {
  _id: string;
  reason: string;
  lastWorkingDate?: string;
  status: string;
  createdAt: string;
  hrNote?: string;
  headNote?: string;
  rejectionNote?: string;
  employee?: { _id: string; name?: string; employeeId?: string; designation?: string };
};

const STATUS_MAP: Record<string, { label: string; bg: string; text: string }> = {
  PENDING_HR: { label: 'Pending HR Review', bg: '#fef3c7', text: '#d97706' },
  PENDING_HEAD: { label: 'Pending Head Approval', bg: '#dbeafe', text: '#2563eb' },
  APPROVED: { label: 'Approved', bg: '#dcfce7', text: '#16a34a' },
  REJECTED: { label: 'Rejected', bg: '#fee2e2', text: '#dc2626' },
};

function getStatusStyle(s: string) {
  return STATUS_MAP[s] ?? { label: s, bg: '#f3f4f6', text: '#374151' };
}

async function downloadResignationDocuments(
  resignationId: string,
  fileName: string,
  setDownloading: (v: boolean) => void,
  onError: (msg: string) => void
) {
  setDownloading(true);
  try {
    const safeName = (fileName || 'Resignation_Documents').replace(/\s+/g, '_');
    await downloadAndShareFromApi({
      path: `/resignations/${resignationId}/documents`,
      fileName: `${safeName}.pdf`,
      mimeType: 'application/pdf',
      dialogTitle: safeName,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to download documents.';
    onError(msg);
  } finally {
    setDownloading(false);
  }
}

// ─── Shared: My Resignation (submit + history + download) ────────────────
function MyResignationSection({ onMsg }: { onMsg?: (m: string) => void }) {
  const [history, setHistory] = useState<Resignation[]>([]);
  const [loading, setLoading] = useState(true);
  const [reason, setReason] = useState('');
  const [lastDate, setLastDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const fetchMy = useCallback(async () => {
    try {
      const { data } = await api.get<{ data: Resignation[] }>('/resignations/my');
      setHistory(data.data ?? []);
    } catch {
      setHistory([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMy();
  }, [fetchMy]);

  const latest = history[0] ?? null;
  const isApproved = latest?.status === 'APPROVED';
  const canApplyAgain = !latest || latest.status === 'REJECTED';

  const submit = async () => {
    if (!reason.trim()) {
      if (onMsg) onMsg('Please enter a reason.');
      else Alert.alert('Required', 'Please enter a reason.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/resignations', { reason: reason.trim(), lastWorkingDate: lastDate || undefined });
      if (onMsg) onMsg('Resignation submitted. HR will review it shortly.');
      setReason('');
      setLastDate('');
      setShowForm(false);
      fetchMy();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to submit.';
      if (onMsg) onMsg(msg);
      else Alert.alert('Error', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const downloadDocs = (r: Resignation) => {
    downloadResignationDocuments(r._id, 'Resignation_Documents', setDownloading, (err) => {
      if (onMsg) onMsg(err);
      else Alert.alert('Error', err);
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="small" color={AppColors.tint} />
        <Text style={styles.muted}>Loading your resignation history…</Text>
      </View>
    );
  }

  return (
    <View>
      {latest && (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle} numberOfLines={2}>Latest Resignation</Text>
            <View style={[styles.statusBadge, { backgroundColor: getStatusStyle(latest.status).bg }]}>
              <Text style={[styles.statusText, { color: getStatusStyle(latest.status).text }]} numberOfLines={1}>{getStatusStyle(latest.status).label}</Text>
            </View>
          </View>
          <Text style={styles.reason} selectable>{latest.reason}</Text>
          {latest.lastWorkingDate && (
            <Text style={styles.meta}>Requested last day: {new Date(latest.lastWorkingDate).toLocaleDateString('en-IN')}</Text>
          )}
          <Text style={styles.meta}>Submitted: {new Date(latest.createdAt).toLocaleDateString('en-IN')}</Text>
          {latest.hrNote ? <Text style={styles.meta}>HR Note: {latest.hrNote}</Text> : null}
          {latest.headNote ? <Text style={styles.meta}>Head Note: {latest.headNote}</Text> : null}
          {latest.rejectionNote ? (
            <View style={styles.rejectionBox}>
              <MaterialIcons name="info" size={18} color={AppColors.danger} />
              <Text style={styles.rejectionText}>Rejected: {latest.rejectionNote}</Text>
            </View>
          ) : null}
          {isApproved && (
            <TouchableOpacity
              style={[styles.primaryBtn, downloading && styles.primaryBtnDisabled]}
              onPress={() => downloadDocs(latest)}
              disabled={downloading}
              activeOpacity={0.7}
            >
              {downloading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText} numberOfLines={2}>Download Documents</Text>}
            </TouchableOpacity>
          )}
          {canApplyAgain && !showForm && (
            <TouchableOpacity style={styles.outlineBtn} onPress={() => setShowForm(true)}>
              <Text style={styles.outlineBtnText}>Apply for Resignation Again</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {(canApplyAgain && (showForm || !latest)) && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{latest ? 'New Resignation Request' : 'Submit Resignation'}</Text>
          {latest?.status === 'REJECTED' && (
            <Text style={styles.rejectionHint}>Your previous resignation was rejected. You can submit a new request below.</Text>
          )}
          <Text style={styles.inputLabel}>Reason for Resignation *</Text>
          <TextInput
            style={styles.input}
            placeholder="Please state your reason for resignation..."
            placeholderTextColor={AppColors.textSecondary}
            value={reason}
            onChangeText={setReason}
            multiline
            numberOfLines={4}
          />
          <Text style={styles.inputLabel}>Requested Last Working Date (optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={AppColors.textSecondary}
            value={lastDate}
            onChangeText={setLastDate}
          />
          <TouchableOpacity style={[styles.primaryBtn, submitting && styles.primaryBtnDisabled]} onPress={submit} disabled={submitting}>
            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Submit Resignation</Text>}
          </TouchableOpacity>
          {latest && (
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowForm(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {history.length > 1 && (
        <View style={styles.previousSection}>
          <Text style={styles.previousTitle}>Previous Resignations</Text>
          {history.slice(1).map((r) => (
            <View key={r._id} style={styles.previousCard}>
              <View style={styles.previousCardHeader}>
                <Text style={styles.previousDate}>{new Date(r.createdAt).toLocaleDateString('en-IN')}</Text>
                <View style={[styles.statusBadge, { backgroundColor: getStatusStyle(r.status).bg }]}>
                  <Text style={[styles.statusText, { color: getStatusStyle(r.status).text }]}>{getStatusStyle(r.status).label}</Text>
                </View>
              </View>
              <Text style={styles.previousReason}>{r.reason}</Text>
              {r.rejectionNote ? <Text style={styles.rejectionSmall}>Rejection: {r.rejectionNote}</Text> : null}
              {r.status === 'APPROVED' && (
                <TouchableOpacity
                  style={styles.downloadSmallBtn}
                  onPress={() => downloadResignationDocuments(r._id, 'Resignation_Documents', setDownloading, (err) => Alert.alert('Error', err))}
                  disabled={downloading}
                >
                  <Text style={styles.downloadSmallText}>Download Documents</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ─── HR Panel: pending list + approve/reject modal ───────────────────────
function HRPanel({ onRefresh }: { onRefresh: () => void }) {
  const [list, setList] = useState<Resignation[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState<{ id: string; action: 'approve' | 'reject' } | null>(null);
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchList = useCallback(async () => {
    try {
      const { data } = await api.get<{ data: Resignation[] }>('/resignations');
      setList(data.data ?? []);
    } catch {
      setList([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const review = async (id: string, action: 'approve' | 'reject') => {
    if (action === 'reject' && !note.trim()) {
      setMsg('Rejection reason is required.');
      return;
    }
    setSubmitting(true);
    setMsg('');
    try {
      await api.patch(`/resignations/${id}/hr-review`, { action, note });
      setReviewing(null);
      setNote('');
      fetchList();
      onRefresh();
    } catch (e: unknown) {
      setMsg((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="small" color={AppColors.tint} />
        <Text style={styles.muted}>Loading resignations…</Text>
      </View>
    );
  }

  return (
    <View style={styles.hrSection}>
      <Text style={styles.sectionTitle}>Pending HR Review</Text>
      <Text style={styles.sectionSubtitle}>Approve to forward to Managing Head, or reject</Text>
      {msg ? (
        <View style={[styles.msgBox, msg.startsWith('Forwarded') || msg.includes('rejected') ? styles.msgBoxSuccess : styles.msgBoxError]}>
          <Text style={styles.msgText}>{msg}</Text>
        </View>
      ) : null}
      {list.length === 0 ? (
        <View style={styles.emptyState}>
          <MaterialIcons name="assignment" size={48} color={AppColors.textSecondary} />
          <Text style={styles.emptyTitle}>No pending resignations</Text>
        </View>
      ) : (
        <View style={styles.listWrap}>
          {list.map((r) => (
            <View key={r._id} style={styles.reviewCard}>
              <View style={styles.reviewCardBody}>
                <Text style={styles.empName} numberOfLines={2}>{r.employee?.name ?? '—'}</Text>
                <Text style={styles.empMeta} numberOfLines={1}>{r.employee?.employeeId ?? '—'} · {r.employee?.designation ?? '—'}</Text>
                <Text style={styles.reviewReason} selectable><Text style={styles.bold}>Reason:</Text> {r.reason}</Text>
                {r.lastWorkingDate ? (
                  <Text style={styles.meta}>Last day: {new Date(r.lastWorkingDate).toLocaleDateString('en-IN')}</Text>
                ) : null}
                <View style={[styles.statusBadge, { backgroundColor: getStatusStyle(r.status).bg, alignSelf: 'flex-start' }]}>
                  <Text style={[styles.statusText, { color: getStatusStyle(r.status).text }]} numberOfLines={1}>{getStatusStyle(r.status).label}</Text>
                </View>
              </View>
              {r.status === 'PENDING_HR' && (
                <View style={styles.reviewActions}>
                  <TouchableOpacity style={styles.approveBtn} onPress={() => { setReviewing({ id: r._id, action: 'approve' }); setNote(''); }} activeOpacity={0.7}>
                    <Text style={styles.approveBtnText}>Approve & Forward</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.rejectBtn} onPress={() => { setReviewing({ id: r._id, action: 'reject' }); setNote(''); }} activeOpacity={0.7}>
                    <Text style={styles.rejectBtnText}>Reject</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))}
        </View>
      )}

      <Modal visible={!!reviewing} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={modalStyles.overlay}>
          <TouchableOpacity style={modalStyles.overlayTouchable} activeOpacity={1} onPress={() => { setReviewing(null); setNote(''); }}>
            <View style={modalStyles.boxWrap}>
              <TouchableOpacity style={modalStyles.box} activeOpacity={1}>
                <Text style={modalStyles.title} numberOfLines={2}>
                  {reviewing?.action === 'approve' ? 'Approve & Forward to Head' : 'Reject Resignation'}
                </Text>
                <Text style={modalStyles.label}>{reviewing?.action === 'reject' ? 'Rejection Reason *' : 'Note (optional)'}</Text>
                <TextInput
                  style={modalStyles.input}
                  placeholder={reviewing?.action === 'reject' ? 'Reason for rejection...' : 'Any notes for the employee...'}
                  placeholderTextColor={AppColors.textSecondary}
                  value={note}
                  onChangeText={setNote}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
                <View style={modalStyles.actions}>
                  <TouchableOpacity
                    style={[reviewing?.action === 'approve' ? modalStyles.confirmPrimary : modalStyles.confirmDanger, submitting && modalStyles.disabled]}
                    onPress={() => reviewing && review(reviewing.id, reviewing.action)}
                    disabled={submitting || (reviewing?.action === 'reject' && !note.trim())}
                    activeOpacity={0.7}
                  >
                    <Text style={modalStyles.confirmText}>{submitting ? '…' : 'Confirm'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={modalStyles.cancelBtn} onPress={() => { setReviewing(null); setNote(''); }} activeOpacity={0.7}>
                    <Text style={modalStyles.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ─── Head View: Pending / All tabs, approve/reject, download ──────────────
function HeadView() {
  const router = useRouter();
  const [pendingList, setPendingList] = useState<Resignation[]>([]);
  const [allList, setAllList] = useState<Resignation[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'pending' | 'all'>('pending');
  const [reviewing, setReviewing] = useState<{ id: string; action: 'approve' | 'reject' } | null>(null);
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const [pending, all] = await Promise.all([
        api.get<{ data: Resignation[] }>('/resignations/pending-head'),
        api.get<{ data: Resignation[] }>('/resignations'),
      ]);
      setPendingList(pending.data.data ?? []);
      setAllList(all.data.data ?? []);
    } catch {
      setPendingList([]);
      setAllList([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const review = async (id: string, action: 'approve' | 'reject') => {
    if (action === 'reject' && !note.trim()) {
      setMsg('Rejection reason is required.');
      return;
    }
    setSubmitting(true);
    setMsg('');
    try {
      await api.patch(`/resignations/${id}/head-review`, { action, note });
      setReviewing(null);
      setNote('');
      fetchAll();
    } catch (e: unknown) {
      setMsg((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const downloadDocs = (r: Resignation) => {
    const name = r.employee?.name?.replace(/\s+/g, '_') ?? 'Resignation';
    downloadResignationDocuments(r._id, `Resignation_${name}`, setDownloading, (err) => Alert.alert('Error', err));
  };

  const displayList = tab === 'pending' ? pendingList : allList;

  return (
    <View style={[styles.screen, { backgroundColor: AppColors.background }]}>
      <SafeAreaView style={styles.safeTop}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <MaterialIcons name={Platform.OS === 'ios' ? 'arrow-back-ios' : 'arrow-back'} size={Platform.OS === 'ios' ? 22 : 24} color={AppColors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Resignation Management</Text>
          <View style={styles.backBtn} />
        </View>
      </SafeAreaView>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.pageSubtitle}>Final approval authority</Text>
        {msg ? (
          <View style={[styles.msgBox, msg.includes('approved') || msg.includes('rejected') ? styles.msgBoxSuccess : styles.msgBoxError]}>
            <Text style={styles.msgText}>{msg}</Text>
          </View>
        ) : null}
        <View style={styles.tabRow}>
          <TouchableOpacity style={[styles.tabBtn, tab === 'pending' && styles.tabBtnActive]} onPress={() => setTab('pending')} activeOpacity={0.7}>
            <Text style={[styles.tabBtnText, tab === 'pending' && styles.tabBtnTextActive]} numberOfLines={1}>Pending ({pendingList.length})</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tabBtn, tab === 'all' && styles.tabBtnActive]} onPress={() => setTab('all')} activeOpacity={0.7}>
            <Text style={[styles.tabBtnText, tab === 'all' && styles.tabBtnTextActive]} numberOfLines={1}>All</Text>
          </TouchableOpacity>
        </View>
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="small" color={AppColors.tint} />
          </View>
        ) : displayList.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialIcons name="assignment" size={48} color={AppColors.textSecondary} />
            <Text style={styles.emptyTitle}>No resignations {tab === 'pending' ? 'pending your approval' : 'found'}</Text>
          </View>
        ) : (
          <View style={styles.listWrap}>
            {displayList.map((r) => (
              <View key={r._id} style={styles.reviewCard}>
                <View style={styles.reviewCardBody}>
                  <Text style={styles.empName} numberOfLines={2}>{r.employee?.name ?? '—'}</Text>
                  <Text style={styles.empMeta} numberOfLines={1}>{r.employee?.employeeId ?? '—'} · {r.employee?.designation ?? '—'}</Text>
                  <Text style={styles.reviewReason} selectable><Text style={styles.bold}>Reason:</Text> {r.reason}</Text>
                  {r.hrNote ? <Text style={styles.meta} numberOfLines={3}>HR Note: {r.hrNote}</Text> : null}
                  <View style={[styles.statusBadge, { backgroundColor: getStatusStyle(r.status).bg, alignSelf: 'flex-start' }]}>
                    <Text style={[styles.statusText, { color: getStatusStyle(r.status).text }]} numberOfLines={1}>{getStatusStyle(r.status).label}</Text>
                  </View>
                </View>
                <View style={styles.reviewActions}>
                  {r.status === 'PENDING_HEAD' && (
                    <>
                      <TouchableOpacity style={styles.approveBtn} onPress={() => { setReviewing({ id: r._id, action: 'approve' }); setNote(''); }} activeOpacity={0.7}>
                        <Text style={styles.approveBtnText}>Approve</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.rejectBtn} onPress={() => { setReviewing({ id: r._id, action: 'reject' }); setNote(''); }} activeOpacity={0.7}>
                        <Text style={styles.rejectBtnText}>Reject</Text>
                      </TouchableOpacity>
                    </>
                  )}
                  {r.status === 'APPROVED' && (
                    <TouchableOpacity style={styles.downloadSmallBtn} onPress={() => downloadDocs(r)} disabled={downloading} activeOpacity={0.7}>
                      <Text style={styles.downloadSmallText}>Download Documents</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}

        <Modal visible={!!reviewing} animationType="slide" transparent>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={modalStyles.overlay}>
            <TouchableOpacity style={modalStyles.overlayTouchable} activeOpacity={1} onPress={() => { setReviewing(null); setNote(''); }}>
              <View style={modalStyles.boxWrap}>
                <TouchableOpacity style={modalStyles.box} activeOpacity={1}>
                  <Text style={modalStyles.title} numberOfLines={2}>{reviewing?.action === 'approve' ? 'Approve Resignation' : 'Reject Resignation'}</Text>
                  {reviewing?.action === 'approve' && (
                    <Text style={modalStyles.hint}>Approving will finalize the resignation. Documents will be available for download.</Text>
                  )}
                  <Text style={modalStyles.label}>{reviewing?.action === 'reject' ? 'Rejection Reason *' : 'Note (optional)'}</Text>
                  <TextInput
                    style={modalStyles.input}
                    placeholder={reviewing?.action === 'reject' ? 'Reason for rejection...' : 'Any message for the employee...'}
                    placeholderTextColor={AppColors.textSecondary}
                    value={note}
                    onChangeText={setNote}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                  />
                  <View style={modalStyles.actions}>
                    <TouchableOpacity
                      style={[reviewing?.action === 'approve' ? modalStyles.confirmPrimary : modalStyles.confirmDanger, submitting && modalStyles.disabled]}
                      onPress={() => reviewing && review(reviewing.id, reviewing.action)}
                      disabled={submitting || (reviewing?.action === 'reject' && !note.trim())}
                      activeOpacity={0.7}
                    >
                      <Text style={modalStyles.confirmText}>{submitting ? '…' : 'Confirm'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={modalStyles.cancelBtn} onPress={() => { setReviewing(null); setNote(''); }} activeOpacity={0.7}>
                      <Text style={modalStyles.cancelBtnText}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </Modal>

        <View style={styles.bottomPad} />
      </ScrollView>
    </View>
  );
}

// ─── HR Combined: HR panel + My Resignation (collapsible) ───────────────
function HRCombinedView() {
  const router = useRouter();
  const [myOpen, setMyOpen] = useState(false);
  const [msg, setMsg] = useState('');

  return (
    <View style={[styles.screen, { backgroundColor: AppColors.background }]}>
      <SafeAreaView style={styles.safeTop}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <MaterialIcons name={Platform.OS === 'ios' ? 'arrow-back-ios' : 'arrow-back'} size={Platform.OS === 'ios' ? 22 : 24} color={AppColors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Resignation</Text>
          <View style={styles.backBtn} />
        </View>
      </SafeAreaView>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.pageSubtitle}>Review employee resignations and manage your own</Text>
        {msg ? (
          <View style={[styles.msgBox, msg.includes('submitted') || msg.includes('Forwarded') ? styles.msgBoxSuccess : styles.msgBoxError]}>
            <Text style={styles.msgText}>{msg}</Text>
          </View>
        ) : null}
        <HRPanel onRefresh={() => {}} />
        <View style={styles.mySection}>
          <TouchableOpacity style={styles.mySectionHeader} onPress={() => setMyOpen((o) => !o)} activeOpacity={0.7}>
            <View>
              <Text style={styles.mySectionTitle}>My Resignation</Text>
              <Text style={styles.mySectionSubtitle}>Submit or track your own resignation request</Text>
            </View>
            <Text style={styles.mySectionToggle}>{myOpen ? 'Hide' : 'Show My Resignation'}</Text>
          </TouchableOpacity>
          {myOpen && <MyResignationSection onMsg={(m) => { setMsg(m); setTimeout(() => setMsg(''), 3500); }} />}
        </View>
        <View style={styles.bottomPad} />
      </ScrollView>
    </View>
  );
}

// ─── Employee View ──────────────────────────────────────────────────────
function EmployeeView() {
  const router = useRouter();
  return (
    <View style={[styles.screen, { backgroundColor: AppColors.background }]}>
      <SafeAreaView style={styles.safeTop}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <MaterialIcons name={Platform.OS === 'ios' ? 'arrow-back-ios' : 'arrow-back'} size={Platform.OS === 'ios' ? 22 : 24} color={AppColors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Resignation</Text>
          <View style={styles.backBtn} />
        </View>
      </SafeAreaView>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.pageSubtitle}>Submit and track your resignation request</Text>
        <MyResignationSection />
        <View style={styles.bottomPad} />
      </ScrollView>
    </View>
  );
}

// ─── Main ───────────────────────────────────────────────────────────────
export default function ResignationScreen() {
  const { user, getRole } = useAuthStore();
  const role = getRole();
  const isHead = (user as Record<string, unknown>)?.isManagingHead === true || ['DIRECTOR', 'SUPER_ADMIN'].includes(role);
  const isHR = role === 'HR';

  if (isHead) return <HeadView />;
  if (isHR) return <HRCombinedView />;
  return <EmployeeView />;
}

const modalStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.xl },
  overlayTouchable: { flex: 1, justifyContent: 'center' },
  boxWrap: { width: '100%', maxWidth: 400, alignSelf: 'center' },
  box: { backgroundColor: AppColors.card, borderRadius: BorderRadius.xl, padding: Spacing.lg },
  title: { fontSize: 18, fontWeight: '700', color: AppColors.text, marginBottom: Spacing.md },
  hint: { fontSize: 14, color: AppColors.textSecondary, marginBottom: Spacing.md },
  label: { fontSize: 13, fontWeight: '600', color: AppColors.textSecondary, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(60,60,67,0.2)',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: 16,
    color: AppColors.text,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  actions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.lg },
  confirmPrimary: { flex: 1, paddingVertical: Spacing.md, borderRadius: BorderRadius.md, backgroundColor: AppColors.tint, alignItems: 'center', minHeight: 48 },
  confirmDanger: { flex: 1, paddingVertical: Spacing.md, borderRadius: BorderRadius.md, backgroundColor: AppColors.danger, alignItems: 'center', minHeight: 48 },
  disabled: { opacity: 0.6 },
  confirmText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  cancelBtn: { paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg, justifyContent: 'center', minHeight: 48 },
  cancelBtnText: { fontSize: 16, fontWeight: '600', color: AppColors.tint },
});

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
  content: { padding: Spacing.md, paddingBottom: Spacing.section },
  bottomPad: { height: Spacing.section },
  pageSubtitle: { fontSize: 15, color: AppColors.textSecondary, marginBottom: Spacing.lg },
  msgBox: { padding: Spacing.md, borderRadius: BorderRadius.md, marginBottom: Spacing.md },
  msgBoxSuccess: { backgroundColor: '#dcfce7' },
  msgBoxError: { backgroundColor: '#fef2f2' },
  msgText: { fontSize: 14, fontWeight: '600' },
  loadingWrap: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.lg },
  muted: { fontSize: 15, color: AppColors.textSecondary },
  card: { backgroundColor: AppColors.card, borderRadius: BorderRadius.xl, padding: Spacing.lg, marginBottom: Spacing.lg, ...CardShadow },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.md },
  cardTitle: { fontSize: 17, fontWeight: '600', color: AppColors.text },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 12, fontWeight: '600' },
  reason: { fontSize: 15, color: AppColors.text, lineHeight: 22 },
  meta: { fontSize: 14, color: AppColors.textSecondary, marginTop: Spacing.sm },
  rejectionBox: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, marginTop: Spacing.md, padding: Spacing.md, backgroundColor: `${AppColors.danger}12`, borderRadius: BorderRadius.md },
  rejectionText: { flex: 1, fontSize: 14, color: AppColors.danger },
  rejectionHint: { fontSize: 14, color: AppColors.danger, marginBottom: Spacing.md },
  inputLabel: { fontSize: 13, color: AppColors.textSecondary, marginBottom: 6, fontWeight: '500' },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(118,118,128,0.2)',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    fontSize: 16,
    color: AppColors.text,
    minHeight: 72,
    textAlignVertical: 'top',
  },
  primaryBtn: { minHeight: 48, borderRadius: BorderRadius.md, backgroundColor: AppColors.tint, justifyContent: 'center', alignItems: 'center', paddingVertical: Spacing.md },
  primaryBtnDisabled: { opacity: 0.6 },
  primaryBtnText: { fontSize: 17, fontWeight: '600', color: '#fff' },
  cancelBtn: { marginTop: Spacing.md, alignItems: 'center' },
  cancelText: { fontSize: 17, color: AppColors.tint, fontWeight: '500' },
  outlineBtn: { minHeight: 48, borderRadius: BorderRadius.md, borderWidth: 2, borderColor: AppColors.tint, justifyContent: 'center', alignItems: 'center', marginTop: Spacing.sm, paddingVertical: Spacing.md },
  outlineBtnText: { fontSize: 16, fontWeight: '600', color: AppColors.tint },
  previousSection: { marginTop: Spacing.lg },
  previousTitle: { fontSize: 16, fontWeight: '600', color: AppColors.text, marginBottom: Spacing.md },
  previousCard: { backgroundColor: AppColors.card, borderRadius: BorderRadius.md, padding: Spacing.md, marginBottom: Spacing.sm, ...CardShadow },
  previousCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  previousDate: { fontSize: 14, color: AppColors.textSecondary },
  previousReason: { fontSize: 15, color: AppColors.text },
  rejectionSmall: { fontSize: 13, color: AppColors.danger, marginTop: 4 },
  downloadSmallBtn: { marginTop: 8, alignSelf: 'flex-start' },
  downloadSmallText: { fontSize: 14, fontWeight: '600', color: AppColors.tint },
  hrSection: { marginBottom: Spacing.xl },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: AppColors.text, marginBottom: 4 },
  sectionSubtitle: { fontSize: 14, color: AppColors.textSecondary, marginBottom: Spacing.md },
  emptyState: { alignItems: 'center', paddingVertical: Spacing.xxl },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: AppColors.textSecondary, marginTop: Spacing.md },
  listWrap: { gap: Spacing.md },
  reviewCard: { backgroundColor: AppColors.card, borderRadius: BorderRadius.xl, padding: Spacing.lg, marginBottom: Spacing.md, ...CardShadow },
  reviewCardBody: { marginBottom: Spacing.sm },
  empName: { fontSize: 16, fontWeight: '700', color: AppColors.text },
  empMeta: { fontSize: 14, color: AppColors.textSecondary },
  bold: { fontWeight: '700' },
  reviewReason: { fontSize: 15, color: AppColors.text, marginTop: 4 },
  reviewActions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.sm },
  approveBtn: { flex: 1, minWidth: 120, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.md, backgroundColor: AppColors.tint, minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  approveBtnText: { fontSize: 14, fontWeight: '600', color: '#fff' },
  rejectBtn: { flex: 1, minWidth: 120, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.md, backgroundColor: AppColors.danger, minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  rejectBtnText: { fontSize: 14, fontWeight: '600', color: '#fff' },
  mySection: { marginTop: Spacing.xl, paddingTop: Spacing.xl, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(60,60,67,0.12)' },
  mySectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.md },
  mySectionTitle: { fontSize: 17, fontWeight: '600', color: AppColors.text, flex: 1, minWidth: 0 },
  mySectionSubtitle: { fontSize: 14, color: AppColors.textSecondary },
  mySectionToggle: { fontSize: 14, fontWeight: '600', color: AppColors.tint },
  tabRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg },
  tabBtn: { flex: 1, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, borderRadius: BorderRadius.md, backgroundColor: 'rgba(118,118,128,0.12)', minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  tabBtnActive: { backgroundColor: AppColors.tint },
  tabBtnText: { fontSize: 14, fontWeight: '600', color: AppColors.text },
  tabBtnTextActive: { color: '#fff' },
});
