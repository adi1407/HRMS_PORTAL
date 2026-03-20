import React, { useEffect, useState, useCallback } from 'react';
import {
  ScrollView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Alert,
  RefreshControl,
  ActivityIndicator,
  Platform,
  SafeAreaView,
  KeyboardAvoidingView,
} from 'react-native';
import { useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Spacing, BorderRadius, AppColors, CardShadow } from '@/constants/theme';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

type Comment = { _id?: string; author?: { name?: string; role?: string }; message: string; createdAt: string };
type Ticket = {
  _id: string;
  ticketId?: string;
  category: string;
  subject: string;
  description: string;
  priority: string;
  status: string;
  createdAt: string;
  comments?: Comment[];
  assignedTo?: { name?: string };
  employee?: { name?: string; employeeId?: string; designation?: string };
  slaDueAt?: string;
  slaBreached?: boolean;
  resolvedAt?: string;
  closedAt?: string;
};

const CATEGORIES = [
  { value: 'IT', label: 'IT Support' },
  { value: 'HR', label: 'HR' },
  { value: 'ADMIN', label: 'Admin' },
  { value: 'FINANCE', label: 'Finance' },
  { value: 'OTHER', label: 'Other' },
];

const PRIORITIES = [
  { value: 'LOW', label: 'Low', bg: '#dbeafe', text: '#2563eb' },
  { value: 'MEDIUM', label: 'Medium', bg: '#dcfce7', text: '#15803d' },
  { value: 'HIGH', label: 'High', bg: '#fef3c7', text: '#b45309' },
  { value: 'CRITICAL', label: 'Critical', bg: '#fee2e2', text: '#b91c1c' },
];

const STATUSES = [
  { value: 'OPEN', label: 'Open', bg: '#dbeafe', text: '#2563eb' },
  { value: 'IN_PROGRESS', label: 'In Progress', bg: '#fef3c7', text: '#b45309' },
  { value: 'RESOLVED', label: 'Resolved', bg: '#dcfce7', text: '#15803d' },
  { value: 'CLOSED', label: 'Closed', bg: '#f3f4f6', text: '#6b7280' },
];

function fmt(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function fmtShort(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function SLATag({ ticket }: { ticket: Ticket }) {
  if (['RESOLVED', 'CLOSED'].includes(ticket.status)) {
    const resolved = ticket.resolvedAt || ticket.closedAt;
    const tookHrs = resolved ? Math.round((new Date(resolved).getTime() - new Date(ticket.createdAt).getTime()) / 3600000) : '—';
    return <Text style={styles.slaResolved}>Resolved in {tookHrs}h</Text>;
  }
  if (ticket.slaBreached) return <Text style={styles.slaBreached}>SLA BREACHED</Text>;
  if (ticket.slaDueAt) {
    const remaining = Math.max(0, Math.round((new Date(ticket.slaDueAt).getTime() - Date.now()) / 3600000));
    return <Text style={[styles.slaLeft, remaining < 8 && { color: '#b45309' }]}>{remaining}h left</Text>;
  }
  return null;
}

const st = (s: string) => STATUSES.find((x) => x.value === s) ?? STATUSES[0];
const pr = (p: string) => PRIORITIES.find((x) => x.value === p) ?? PRIORITIES[1];
const catLabel = (c: string) => CATEGORIES.find((x) => x.value === c)?.label ?? c;

// ─── Ticket detail modal (shared; isAdmin shows status update) ─────────────
function TicketDetailModal({
  visible,
  ticket,
  isAdmin,
  onClose,
  onUpdated,
}: {
  visible: boolean;
  ticket: Ticket | null;
  isAdmin: boolean;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [comment, setComment] = useState('');
  const [commenting, setCommenting] = useState(false);
  const [status, setStatus] = useState(ticket?.status ?? 'OPEN');
  const [updatingStatus, setUpdatingStatus] = useState(false);

  useEffect(() => {
    if (ticket) setStatus(ticket.status);
  }, [ticket?.status, ticket?._id]);

  const addComment = async () => {
    if (!ticket || !comment.trim()) return;
    setCommenting(true);
    try {
      const { data } = await api.post<{ data: Ticket }>(`/tickets/${ticket._id}/comment`, { message: comment.trim() });
      setComment('');
      onUpdated();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to add comment.';
      Alert.alert('Error', msg);
    } finally {
      setCommenting(false);
    }
  };

  const updateStatus = async () => {
    if (!ticket || status === ticket.status) return;
    setUpdatingStatus(true);
    try {
      await api.patch(`/tickets/${ticket._id}/status`, { status });
      onUpdated();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to update status.';
      Alert.alert('Error', msg);
    } finally {
      setUpdatingStatus(false);
    }
  };

  if (!visible) return null;
  return (
    <Modal visible animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <SafeAreaView style={styles.detailSafe}>
          <View style={styles.detailHeader}>
            <TouchableOpacity onPress={onClose} style={styles.detailBack}>
              <MaterialIcons name="arrow-back" size={24} color={AppColors.text} />
              <Text style={styles.detailBackText}>Back</Text>
            </TouchableOpacity>
            <Text style={styles.detailHeaderTitle}>Ticket</Text>
          </View>
          {ticket && (
            <ScrollView style={styles.detailScroll} contentContainerStyle={styles.detailContent} keyboardShouldPersistTaps="handled">
              <View style={styles.detailCard}>
                <View style={styles.detailBadges}>
                  <Text style={styles.detailTicketId}>{ticket.ticketId}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: st(ticket.status).bg }]}>
                    <Text style={[styles.statusText, { color: st(ticket.status).text }]}>{st(ticket.status).label}</Text>
                  </View>
                  <View style={[styles.priorityBadge, { backgroundColor: pr(ticket.priority).bg }]}>
                    <Text style={[styles.priorityText, { color: pr(ticket.priority).text }]}>{pr(ticket.priority).label}</Text>
                  </View>
                  <SLATag ticket={ticket} />
                </View>
                <Text style={styles.detailSubject}>{ticket.subject}</Text>
                <Text style={styles.detailDesc}>{ticket.description}</Text>
                <Text style={styles.detailMeta}>
                  {ticket.employee?.name && isAdmin ? `By ${ticket.employee.name} (${ticket.employee.employeeId ?? '—'}) · ` : ''}
                  {catLabel(ticket.category)} · Created {fmt(ticket.createdAt)}
                  {ticket.assignedTo?.name ? ` · Assigned to ${ticket.assignedTo.name}` : ''}
                </Text>
                {isAdmin && (
                  <View style={styles.statusUpdateRow}>
                    <Text style={styles.inputLabel}>Status</Text>
                    <View style={styles.statusChipsRow}>
                      {STATUSES.map((s) => (
                        <TouchableOpacity
                          key={s.value}
                          style={[styles.statusChip, status === s.value && { backgroundColor: s.bg }]}
                          onPress={() => setStatus(s.value)}
                        >
                          <Text style={[styles.statusChipText, status === s.value && { color: s.text }]}>{s.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <TouchableOpacity
                      style={[styles.updateStatusBtn, (status === ticket.status || updatingStatus) && styles.updateStatusBtnDisabled]}
                      onPress={updateStatus}
                      disabled={status === ticket.status || updatingStatus}
                    >
                      {updatingStatus ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.updateStatusBtnText}>Update Status</Text>}
                    </TouchableOpacity>
                  </View>
                )}
              </View>
              <View style={styles.commentsCard}>
                <Text style={styles.commentsTitle}>Comments ({ticket.comments?.length ?? 0})</Text>
                {(ticket.comments?.length ?? 0) > 0 ? (
                  (ticket.comments ?? []).map((c, idx) => (
                    <View key={idx} style={[styles.commentBlock, c.author?.role && ['HR', 'DIRECTOR', 'SUPER_ADMIN'].includes(c.author.role) && styles.commentBlockStaff]}>
                      <View style={styles.commentHead}>
                        <Text style={styles.commentAuthor}>
                          {c.author?.name ?? 'Unknown'}
                          {c.author?.role && ['HR', 'DIRECTOR', 'SUPER_ADMIN'].includes(c.author.role) && (
                            <Text style={styles.commentStaff}> Staff</Text>
                          )}
                        </Text>
                        <Text style={styles.commentDate}>{fmtShort(c.createdAt)}</Text>
                      </View>
                      <Text style={styles.commentMessage}>{c.message}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.noComments}>No comments yet.</Text>
                )}
                <View style={styles.commentInputRow}>
                  <TextInput
                    style={styles.commentInput}
                    placeholder="Type a reply..."
                    placeholderTextColor={AppColors.textSecondary}
                    value={comment}
                    onChangeText={setComment}
                    maxLength={2000}
                    editable={!commenting}
                  />
                  <TouchableOpacity
                    style={[styles.sendBtn, (!comment.trim() || commenting) && styles.sendBtnDisabled]}
                    onPress={addComment}
                    disabled={!comment.trim() || commenting}
                  >
                    {commenting ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.sendBtnText}>Send</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          )}
        </SafeAreaView>
      </View>
    </Modal>
  );
}

// ─── Employee view: my tickets, create, detail ───────────────────────────
function EmployeeTicketsView() {
  const router = useRouter();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [createVisible, setCreateVisible] = useState(false);
  const [detailTicket, setDetailTicket] = useState<Ticket | null>(null);
  const [category, setCategory] = useState('IT');
  const [priority, setPriority] = useState('MEDIUM');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [createMsg, setCreateMsg] = useState('');

  const load = useCallback(async () => {
    try {
      const { data } = await api.get<{ data: Ticket[] }>('/tickets/my');
      setTickets(data.data ?? []);
    } catch {
      setTickets([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  const filtered = statusFilter ? tickets.filter((t) => t.status === statusFilter) : tickets;
  useEffect(() => {
    if (detailTicket && tickets.length > 0) {
      const fresh = tickets.find((t) => t._id === detailTicket._id);
      if (fresh) setDetailTicket(fresh);
    }
  }, [tickets]);

  const submitTicket = async () => {
    if (!subject.trim() || !description.trim()) {
      setCreateMsg('Subject and description are required.');
      return;
    }
    setSubmitting(true);
    setCreateMsg('');
    try {
      await api.post('/tickets', { category, subject: subject.trim(), description: description.trim(), priority });
      setCreateVisible(false);
      setSubject('');
      setDescription('');
      setCategory('IT');
      setPriority('MEDIUM');
      load();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to create ticket.';
      setCreateMsg(msg);
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
          <Text style={styles.headerTitle}>Help Desk</Text>
          <TouchableOpacity style={styles.headerAction} onPress={() => setCreateVisible(true)}>
            <MaterialIcons name="add-circle-outline" size={26} color={AppColors.tint} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={AppColors.tint} />}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.pageSubtitle}>Raise tickets for IT, HR, or Admin support</Text>
        {tickets.length > 0 && (
          <>
            <Text style={styles.summary}>{tickets.length} ticket{tickets.length === 1 ? '' : 's'}</Text>
            <View style={styles.filterRow}>
              <TouchableOpacity style={[styles.filterChip, !statusFilter && styles.filterChipActive]} onPress={() => setStatusFilter(null)}>
                <Text style={[styles.filterText, !statusFilter && styles.filterTextActive]}>All</Text>
              </TouchableOpacity>
              {STATUSES.map((s) => {
                const count = tickets.filter((t) => t.status === s.value).length;
                return (
                  <TouchableOpacity
                    key={s.value}
                    style={[styles.filterChip, statusFilter === s.value && styles.filterChipActive]}
                    onPress={() => setStatusFilter(statusFilter === s.value ? null : s.value)}
                  >
                    <Text style={[styles.filterText, statusFilter === s.value && styles.filterTextActive]}>{s.label} ({count})</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}
        {loading ? (
          <Text style={styles.muted}>Loading…</Text>
        ) : filtered.length === 0 ? (
          <View style={styles.emptyCard}>
            <MaterialIcons name="support-agent" size={48} color={AppColors.textSecondary} />
            <Text style={styles.emptyText}>No tickets yet</Text>
            <Text style={styles.emptySub}>Tap + to raise a ticket for IT, HR, or Admin support.</Text>
          </View>
        ) : (
          <View style={styles.card}>
            {filtered.map((t, i) => {
              const statusSt = st(t.status);
              const prioritySt = pr(t.priority);
              return (
                <TouchableOpacity
                  key={t._id}
                  style={[
                    styles.row,
                    i < filtered.length - 1 && styles.rowBorder,
                    t.slaBreached && !['RESOLVED', 'CLOSED'].includes(t.status) && styles.rowSlaBreach,
                  ]}
                  onPress={() => setDetailTicket(t)}
                  activeOpacity={0.7}
                >
                  <View style={styles.rowTop}>
                    <Text style={styles.ticketId}>{t.ticketId ?? t._id.slice(-6)}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: statusSt.bg }]}>
                      <Text style={[styles.statusText, { color: statusSt.text }]}>{statusSt.label}</Text>
                    </View>
                  </View>
                  <Text style={styles.subject} numberOfLines={1}>{t.subject}</Text>
                  <View style={styles.badgeRow}>
                    <View style={[styles.priorityBadge, { backgroundColor: prioritySt.bg }]}>
                      <Text style={[styles.priorityText, { color: prioritySt.text }]}>{prioritySt.label}</Text>
                    </View>
                    <SLATag ticket={t} />
                    <Text style={styles.commentCount}>{t.comments?.length ?? 0} comments</Text>
                  </View>
                  <Text style={styles.meta}>{catLabel(t.category)} · {fmtShort(t.createdAt)}</Text>
                  <MaterialIcons name="chevron-right" size={20} color={AppColors.textSecondary} style={styles.rowChevron} />
                </TouchableOpacity>
              );
            })}
          </View>
        )}
        <View style={styles.bottomPad} />
      </ScrollView>
      <Modal visible={createVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalKeyboard}>
            <ScrollView contentContainerStyle={styles.modalScrollContent} keyboardShouldPersistTaps="handled">
              <View style={styles.modalCard}>
                <Text style={styles.modalTitle}>Raise a ticket</Text>
                {createMsg ? <Text style={styles.createError}>{createMsg}</Text> : null}
                <Text style={styles.inputLabel}>Category</Text>
                <View style={styles.categoryRow}>
                  {CATEGORIES.map((c) => (
                    <TouchableOpacity key={c.value} style={[styles.catChip, category === c.value && styles.catChipActive]} onPress={() => setCategory(c.value)} disabled={submitting}>
                      <Text style={[styles.catChipText, category === c.value && styles.catChipTextActive]}>{c.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={styles.inputLabel}>Priority</Text>
                <View style={styles.priorityRow}>
                  {PRIORITIES.map((p) => (
                    <TouchableOpacity key={p.value} style={[styles.prioChip, priority === p.value && { backgroundColor: p.bg }]} onPress={() => setPriority(p.value)} disabled={submitting}>
                      <Text style={[styles.prioChipText, priority === p.value && { color: p.text }]}>{p.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={styles.inputLabel}>Subject *</Text>
                <TextInput style={styles.input} placeholder="Brief summary of the issue" placeholderTextColor={AppColors.textSecondary} value={subject} onChangeText={setSubject} maxLength={200} editable={!submitting} />
                <Text style={styles.inputLabel}>Description *</Text>
                <TextInput style={[styles.input, styles.inputArea]} placeholder="Detailed description..." placeholderTextColor={AppColors.textSecondary} value={description} onChangeText={setDescription} multiline maxLength={3000} editable={!submitting} />
                <View style={styles.modalActions}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => { setCreateVisible(false); setCreateMsg(''); }} disabled={submitting}>
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.submitBtn, submitting && styles.submitBtnDisabled]} onPress={submitTicket} disabled={submitting || !subject.trim() || !description.trim()}>
                    {submitting ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.submitBtnText}>Submit ticket</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>
      <TicketDetailModal visible={!!detailTicket} ticket={detailTicket} isAdmin={false} onClose={() => setDetailTicket(null)} onUpdated={load} />
    </View>
  );
}

// ─── HR/Admin view: all tickets, stats, filters, detail with status update ──
function AdminTicketsView() {
  const router = useRouter();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [stats, setStats] = useState<{ open?: number; inProgress?: number; resolved?: number; closed?: number; breached?: number }>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [selected, setSelected] = useState<Ticket | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (catFilter) params.set('category', catFilter);
      const [tRes, sRes] = await Promise.all([
        api.get<{ data: Ticket[] }>(`/tickets?${params.toString()}`),
        api.get<{ data: typeof stats }>('/tickets/stats'),
      ]);
      setTickets(tRes.data.data ?? []);
      setStats(sRes.data.data ?? {});
    } catch {
      setTickets([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter, catFilter]);

  useEffect(() => {
    const t = setTimeout(fetchAll, 200);
    return () => clearTimeout(t);
  }, [fetchAll]);

  // Keep selected ticket in sync when list refetches (e.g. after status update)
  useEffect(() => {
    if (selected && tickets.length > 0) {
      const fresh = tickets.find((t) => t._id === selected._id);
      if (fresh) setSelected(fresh);
    }
  }, [tickets]);

  return (
    <View style={[styles.screen, { backgroundColor: AppColors.background }]}>
      <SafeAreaView style={styles.safeTop}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <MaterialIcons name={Platform.OS === 'ios' ? 'arrow-back-ios' : 'arrow-back'} size={Platform.OS === 'ios' ? 22 : 24} color={AppColors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Help Desk</Text>
          <View style={styles.backBtn} />
        </View>
      </SafeAreaView>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchAll(); }} tintColor={AppColors.tint} />}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.pageSubtitle}>Manage employee support tickets and SLA tracking</Text>
        <View style={styles.statsRow}>
          <View style={[styles.statBox, { backgroundColor: '#dbeafe' }]}>
            <Text style={[styles.statValue, { color: '#2563eb' }]}>{stats.open ?? '—'}</Text>
            <Text style={[styles.statLabel, { color: '#2563eb' }]}>Open</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: '#fef3c7' }]}>
            <Text style={[styles.statValue, { color: '#b45309' }]}>{stats.inProgress ?? '—'}</Text>
            <Text style={[styles.statLabel, { color: '#b45309' }]}>In Progress</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: '#dcfce7' }]}>
            <Text style={[styles.statValue, { color: '#15803d' }]}>{stats.resolved ?? '—'}</Text>
            <Text style={[styles.statLabel, { color: '#15803d' }]}>Resolved</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: '#f3f4f6' }]}>
            <Text style={[styles.statValue, { color: '#6b7280' }]}>{stats.closed ?? '—'}</Text>
            <Text style={[styles.statLabel, { color: '#6b7280' }]}>Closed</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: '#fee2e2' }]}>
            <Text style={[styles.statValue, { color: '#b91c1c' }]}>{stats.breached ?? '—'}</Text>
            <Text style={[styles.statLabel, { color: '#b91c1c' }]}>SLA Breached</Text>
          </View>
        </View>
        <View style={styles.filterRow}>
          <TouchableOpacity style={[styles.filterChip, !statusFilter && styles.filterChipActive]} onPress={() => setStatusFilter('')}>
            <Text style={[styles.filterText, !statusFilter && styles.filterTextActive]}>All status</Text>
          </TouchableOpacity>
          {STATUSES.map((s) => (
            <TouchableOpacity key={s.value} style={[styles.filterChip, statusFilter === s.value && styles.filterChipActive]} onPress={() => setStatusFilter(statusFilter === s.value ? '' : s.value)}>
              <Text style={[styles.filterText, statusFilter === s.value && styles.filterTextActive]}>{s.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={[styles.filterRow, { marginBottom: Spacing.lg }]}>
          <TouchableOpacity style={[styles.filterChip, !catFilter && styles.filterChipActive]} onPress={() => setCatFilter('')}>
            <Text style={[styles.filterText, !catFilter && styles.filterTextActive]}>All category</Text>
          </TouchableOpacity>
          {CATEGORIES.map((c) => (
            <TouchableOpacity key={c.value} style={[styles.filterChip, catFilter === c.value && styles.filterChipActive]} onPress={() => setCatFilter(catFilter === c.value ? '' : c.value)}>
              <Text style={[styles.filterText, catFilter === c.value && styles.filterTextActive]}>{c.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {loading ? (
          <Text style={styles.muted}>Loading…</Text>
        ) : tickets.length === 0 ? (
          <View style={styles.emptyCard}>
            <MaterialIcons name="support-agent" size={48} color={AppColors.textSecondary} />
            <Text style={styles.emptyText}>No tickets found</Text>
            <Text style={styles.emptySub}>Tickets raised by employees will appear here.</Text>
          </View>
        ) : (
          <View style={styles.card}>
            {tickets.map((t, i) => {
              const statusSt = st(t.status);
              const prioritySt = pr(t.priority);
              return (
                <TouchableOpacity
                  key={t._id}
                  style={[
                    styles.row,
                    i < tickets.length - 1 && styles.rowBorder,
                    t.slaBreached && !['RESOLVED', 'CLOSED'].includes(t.status) && styles.rowSlaBreach,
                  ]}
                  onPress={() => setSelected(t)}
                  activeOpacity={0.7}
                >
                  <View style={styles.rowTop}>
                    <Text style={styles.ticketId}>{t.ticketId ?? t._id.slice(-6)}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: statusSt.bg }]}>
                      <Text style={[styles.statusText, { color: statusSt.text }]}>{statusSt.label}</Text>
                    </View>
                  </View>
                  <Text style={styles.subject} numberOfLines={1}>{t.subject}</Text>
                  <View style={styles.badgeRow}>
                    <View style={[styles.priorityBadge, { backgroundColor: prioritySt.bg }]}>
                      <Text style={[styles.priorityText, { color: prioritySt.text }]}>{prioritySt.label}</Text>
                    </View>
                    <SLATag ticket={t} />
                    <Text style={styles.commentCount}>{t.comments?.length ?? 0} comments</Text>
                  </View>
                  <Text style={styles.meta}>
                    {t.employee?.name ? `${t.employee.name} (${t.employee.employeeId ?? '—'}) · ` : ''}{catLabel(t.category)} · {fmtShort(t.createdAt)}
                  </Text>
                  <MaterialIcons name="chevron-right" size={20} color={AppColors.textSecondary} style={styles.rowChevron} />
                </TouchableOpacity>
              );
            })}
          </View>
        )}
        <View style={styles.bottomPad} />
      </ScrollView>
      <TicketDetailModal visible={!!selected} ticket={selected ?? null} isAdmin={true} onClose={() => setSelected(null)} onUpdated={fetchAll} />
    </View>
  );
}

export default function TicketsScreen() {
  const getRole = useAuthStore((s) => s.getRole);
  const role = getRole();
  const isAdmin = ['HR', 'DIRECTOR', 'SUPER_ADMIN'].includes(role);
  return isAdmin ? <AdminTicketsView /> : <EmployeeTicketsView />;
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
  scroll: { flex: 1 },
  content: { padding: Spacing.xl, paddingBottom: Spacing.section },
  pageSubtitle: { fontSize: 15, color: AppColors.textSecondary, marginBottom: Spacing.sm },
  summary: { fontSize: 14, color: AppColors.textSecondary, marginBottom: Spacing.sm, fontWeight: '500' },
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
  card: { backgroundColor: AppColors.card, borderRadius: BorderRadius.xl, overflow: 'hidden', ...CardShadow },
  row: { padding: Spacing.lg, paddingRight: 40, position: 'relative' },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(60,60,67,0.12)' },
  rowSlaBreach: { borderLeftWidth: 4, borderLeftColor: '#dc2626' },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  ticketId: { fontSize: 15, fontWeight: '700', color: AppColors.tint },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 12, fontWeight: '600' },
  subject: { fontSize: 16, fontWeight: '600', color: AppColors.text, marginBottom: 4 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 2 },
  priorityBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  priorityText: { fontSize: 11, fontWeight: '600' },
  slaResolved: { fontSize: 11, color: AppColors.textSecondary },
  slaBreached: { fontSize: 11, fontWeight: '700', color: '#dc2626' },
  slaLeft: { fontSize: 11, fontWeight: '600', color: '#15803d' },
  commentCount: { fontSize: 12, color: AppColors.textSecondary },
  meta: { fontSize: 13, color: AppColors.textSecondary },
  rowChevron: { position: 'absolute', right: Spacing.lg, top: Spacing.lg + 4 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalKeyboard: { maxHeight: '90%' },
  modalScrollContent: { paddingBottom: Spacing.xxl + 24 },
  modalCard: {
    backgroundColor: AppColors.card,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.xl,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: AppColors.text, marginBottom: Spacing.lg },
  createError: { fontSize: 14, color: '#dc2626', marginBottom: Spacing.sm },
  inputLabel: { fontSize: 13, color: AppColors.textSecondary, marginBottom: 6, fontWeight: '600' },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.md },
  catChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: 'rgba(118,118,128,0.12)' },
  catChipActive: { backgroundColor: AppColors.tint },
  catChipText: { fontSize: 14, fontWeight: '500', color: AppColors.text },
  catChipTextActive: { color: '#fff' },
  priorityRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.md },
  prioChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, backgroundColor: 'rgba(118,118,128,0.12)' },
  prioChipText: { fontSize: 13, fontWeight: '600', color: AppColors.textSecondary },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: 'rgba(118,118,128,0.2)',
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    fontSize: 16,
    color: AppColors.text,
  },
  inputArea: { minHeight: 88, paddingTop: Spacing.md, textAlignVertical: 'top' },
  modalActions: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.sm },
  cancelBtn: { flex: 1, paddingVertical: Spacing.md, alignItems: 'center', borderRadius: BorderRadius.md, backgroundColor: 'rgba(118,118,128,0.2)' },
  cancelBtnText: { fontSize: 16, fontWeight: '600', color: AppColors.text },
  submitBtn: { flex: 1, paddingVertical: Spacing.md, alignItems: 'center', justifyContent: 'center', borderRadius: BorderRadius.md, backgroundColor: AppColors.tint, minHeight: 48 },
  submitBtnDisabled: { opacity: 0.7 },
  submitBtnText: { fontSize: 16, fontWeight: '600', color: '#fff' },

  detailSafe: { flex: 1, backgroundColor: AppColors.background },
  detailHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(60,60,67,0.12)' },
  detailBack: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  detailBackText: { fontSize: 17, color: AppColors.tint, fontWeight: '500' },
  detailHeaderTitle: { fontSize: 18, fontWeight: '700', color: AppColors.text, marginLeft: Spacing.lg },
  detailScroll: { flex: 1 },
  detailContent: { padding: Spacing.xl, paddingBottom: Spacing.section },
  detailCard: { backgroundColor: AppColors.card, borderRadius: BorderRadius.xl, padding: Spacing.lg, marginBottom: Spacing.lg, ...CardShadow },
  detailBadges: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: Spacing.md },
  detailTicketId: { fontSize: 16, fontWeight: '700', color: AppColors.tint },
  detailSubject: { fontSize: 17, fontWeight: '700', color: AppColors.text, marginBottom: Spacing.sm },
  detailDesc: { fontSize: 15, color: AppColors.text, lineHeight: 22, marginBottom: Spacing.sm },
  detailMeta: { fontSize: 13, color: AppColors.textSecondary },
  statusUpdateRow: { marginTop: Spacing.lg, paddingTop: Spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(60,60,67,0.12)' },
  statusChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: Spacing.sm },
  statusChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: 'rgba(118,118,128,0.12)' },
  statusChipText: { fontSize: 13, fontWeight: '600', color: AppColors.text },
  updateStatusBtn: { backgroundColor: AppColors.tint, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.lg, borderRadius: BorderRadius.md, alignItems: 'center', marginTop: 4 },
  updateStatusBtnDisabled: { opacity: 0.6 },
  updateStatusBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: Spacing.lg },
  statBox: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, minWidth: 64, alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: '700' },
  statLabel: { fontSize: 11, fontWeight: '600' },
  commentsCard: { backgroundColor: AppColors.card, borderRadius: BorderRadius.xl, padding: Spacing.lg, ...CardShadow },
  commentsTitle: { fontSize: 16, fontWeight: '600', color: AppColors.text, marginBottom: Spacing.md },
  commentBlock: { padding: Spacing.md, borderRadius: BorderRadius.md, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', marginBottom: Spacing.sm },
  commentBlockStaff: { backgroundColor: '#eff6ff' },
  commentHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  commentAuthor: { fontSize: 14, fontWeight: '600', color: AppColors.text },
  commentStaff: { fontSize: 12, color: '#2563eb', fontWeight: '600' },
  commentDate: { fontSize: 12, color: AppColors.textSecondary },
  commentMessage: { fontSize: 14, color: AppColors.text },
  noComments: { fontSize: 14, color: AppColors.textSecondary, marginBottom: Spacing.md },
  commentInputRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  commentInput: { flex: 1, borderWidth: 1, borderColor: 'rgba(118,118,128,0.2)', borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, fontSize: 16, color: AppColors.text, maxHeight: 100 },
  sendBtn: { paddingHorizontal: Spacing.lg, justifyContent: 'center', borderRadius: BorderRadius.md, backgroundColor: AppColors.tint },
  sendBtnDisabled: { opacity: 0.6 },
  sendBtnText: { fontSize: 15, fontWeight: '600', color: '#fff' },
});
