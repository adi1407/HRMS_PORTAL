import React, { useEffect, useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  SafeAreaView,
  Platform,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Spacing, BorderRadius, AppColors, CardShadow } from '@/constants/theme';
import api from '@/lib/api';

type TaskItem = { _id?: string; title: string; description?: string; status?: string };
type DailyEntry = { _id: string; date: string; tasks: TaskItem[] };

const STATUS_OPTIONS = [
  { value: 'COMPLETED', label: 'Completed', bg: '#dcfce7', text: '#15803d' },
  { value: 'IN_PROGRESS', label: 'In Progress', bg: '#fef3c7', text: '#b45309' },
  { value: 'BLOCKED', label: 'Blocked', bg: '#fee2e2', text: '#b91c1c' },
];

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const emptyTask = (): TaskItem => ({ title: '', description: '', status: 'COMPLETED' });

function fmtDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

export default function DailyTasksScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<'submit' | 'history'>('submit');
  const [todaySubmitted, setTodaySubmitted] = useState(false);
  const [entries, setEntries] = useState<DailyEntry[]>([]);
  const [historyMonth, setHistoryMonth] = useState(new Date().getMonth() + 1);
  const [historyYear, setHistoryYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showSubmit, setShowSubmit] = useState(false);
  const [tasks, setTasks] = useState<TaskItem[]>([emptyTask()]);
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState('');

  const loadTodayAndRecent = async () => {
    try {
      const todayRes = await api.get<{ data: DailyEntry | null; submitted: boolean }>('/daily-tasks/today');
      setTodaySubmitted(!!todayRes.data.submitted);
    } catch {}
  };

  const loadHistory = async () => {
    setLoading(true);
    try {
      const { data } = await api.get<{ data: DailyEntry[] }>(`/daily-tasks/my?month=${historyMonth}&year=${historyYear}`);
      setEntries(data.data ?? []);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadTodayAndRecent();
  }, []);
  useEffect(() => {
    if (tab === 'history') loadHistory();
  }, [tab, historyMonth, historyYear]);

  const load = async () => {
    await loadTodayAndRecent();
    if (tab === 'history') await loadHistory();
  };

  const updateTask = (idx: number, field: keyof TaskItem, value: string) => {
    setTasks((prev) => prev.map((t, i) => (i === idx ? { ...t, [field]: value } : t)));
  };

  const addTask = () => {
    if (tasks.length >= 20) return;
    setTasks((prev) => [...prev, emptyTask()]);
  };

  const removeTask = (idx: number) => {
    if (tasks.length <= 1) return;
    setTasks((prev) => prev.filter((_, i) => i !== idx));
  };

  const submitToday = async () => {
    const sanitized = tasks.map((t) => ({
      title: (t.title ?? '').trim(),
      description: (t.description ?? '').trim(),
      status: STATUS_OPTIONS.some((s) => s.value === t.status) ? t.status : 'COMPLETED',
    }));
    const withoutEmpty = sanitized.filter((t) => t.title.length > 0);
    if (withoutEmpty.length === 0) return setSubmitMsg('Add at least one task with a title.');
    setSubmitting(true);
    setSubmitMsg('');
    try {
      await api.post('/daily-tasks', { tasks: withoutEmpty });
      setShowSubmit(false);
      setTasks([emptyTask()]);
      setTodaySubmitted(true);
      setTab('history');
      loadHistory();
      loadTodayAndRecent();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Submission failed.';
      setSubmitMsg(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const closeSubmit = () => {
    if (!submitting) {
      setShowSubmit(false);
      setSubmitMsg('');
      setTasks([emptyTask()]);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: AppColors.background }]}>
      <SafeAreaView style={styles.safeTop}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <MaterialIcons name={Platform.OS === 'ios' ? 'arrow-back-ios' : 'arrow-back'} size={Platform.OS === 'ios' ? 22 : 24} color={AppColors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Daily Tasks</Text>
          {!todaySubmitted ? (
            <TouchableOpacity style={styles.headerAction} onPress={() => setShowSubmit(true)}>
              <MaterialIcons name="add-circle-outline" size={26} color={AppColors.tint} />
            </TouchableOpacity>
          ) : (
            <View style={styles.headerAction} />
          )}
        </View>
      </SafeAreaView>

      <Modal visible={showSubmit} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalContent}>
            <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalScrollContent} keyboardShouldPersistTaps="handled">
              <View style={styles.modalCard}>
                <Text style={styles.modalTitle}>Submit today&apos;s tasks</Text>
                <Text style={styles.modalSubtitle}>Add what you worked on. You can submit only once per day.</Text>
                {submitMsg ? <Text style={styles.submitError}>{submitMsg}</Text> : null}

                {tasks.map((t, idx) => (
                  <View key={idx} style={styles.taskBlock}>
                    <View style={styles.taskBlockHeader}>
                      <Text style={styles.taskBlockLabel}>Task {idx + 1}</Text>
                      {tasks.length > 1 && (
                        <TouchableOpacity onPress={() => removeTask(idx)} disabled={submitting}>
                          <Text style={styles.removeTaskText}>Remove</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                    <Text style={styles.inputLabel}>Title *</Text>
                    <TextInput
                      style={styles.input}
                      value={t.title}
                      onChangeText={(v) => updateTask(idx, 'title', v)}
                      placeholder="What did you work on?"
                      placeholderTextColor={AppColors.textSecondary}
                      maxLength={200}
                      editable={!submitting}
                    />
                    <Text style={styles.inputLabel}>Status</Text>
                    <View style={styles.statusRow}>
                      {STATUS_OPTIONS.map((s) => (
                        <TouchableOpacity
                          key={s.value}
                          style={[styles.statusChip, t.status === s.value && { backgroundColor: s.bg }]}
                          onPress={() => updateTask(idx, 'status', s.value)}
                          disabled={submitting}
                        >
                          <Text style={[styles.statusChipText, t.status === s.value && { color: s.text }]}>{s.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <Text style={styles.inputLabel}>Description (optional)</Text>
                    <TextInput
                      style={[styles.input, styles.inputMultiline]}
                      value={t.description ?? ''}
                      onChangeText={(v) => updateTask(idx, 'description', v)}
                      placeholder="Details, notes, blockers..."
                      placeholderTextColor={AppColors.textSecondary}
                      multiline
                      numberOfLines={2}
                      maxLength={1000}
                      editable={!submitting}
                    />
                  </View>
                ))}

                {tasks.length < 20 && (
                  <TouchableOpacity style={styles.addTaskBtn} onPress={addTask} disabled={submitting}>
                    <MaterialIcons name="add" size={20} color={AppColors.tint} />
                    <Text style={styles.addTaskBtnText}>Add task</Text>
                  </TouchableOpacity>
                )}

                <View style={styles.modalActions}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={closeSubmit} disabled={submitting}>
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
                    onPress={submitToday}
                    disabled={submitting || tasks.every((t) => !(t.title ?? '').trim())}
                  >
                    {submitting ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.submitBtnText}>Submit tasks</Text>}
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); if (tab === 'history') loadHistory(); else loadTodayAndRecent(); }} tintColor={AppColors.tint} />}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.pageSubtitle}>Submit your daily task updates and view your history</Text>

        <View style={styles.tabRow}>
          <TouchableOpacity style={[styles.tabBtn, tab === 'submit' && styles.tabBtnActive]} onPress={() => setTab('submit')}>
            <Text style={[styles.tabBtnText, tab === 'submit' && styles.tabBtnTextActive]}>Today&apos;s Update</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tabBtn, tab === 'history' && styles.tabBtnActive]} onPress={() => setTab('history')}>
            <Text style={[styles.tabBtnText, tab === 'history' && styles.tabBtnTextActive]}>My History</Text>
          </TouchableOpacity>
        </View>

        {tab === 'submit' && (
          <>
            {todaySubmitted ? (
              <View style={styles.submittedBanner}>
                <MaterialIcons name="check-circle" size={24} color={AppColors.success} />
                <View style={styles.submittedBannerText}>
                  <Text style={styles.submittedText}>Today&apos;s tasks submitted</Text>
                  <Text style={styles.submittedSub}>You have already submitted for today. Come back tomorrow!</Text>
                </View>
              </View>
            ) : (
              <View style={styles.emptyCard}>
                <MaterialIcons name="assignment" size={48} color={AppColors.textSecondary} />
                <Text style={styles.emptyText}>Submit today&apos;s tasks</Text>
                <Text style={styles.emptySub}>Tap + in the header to add what you worked on. One submission per day.</Text>
                <TouchableOpacity style={styles.primaryBtn} onPress={() => setShowSubmit(true)}>
                  <Text style={styles.primaryBtnText}>Submit today&apos;s tasks</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}

        {tab === 'history' && (
          <>
            <View style={styles.historyFilters}>
              <View style={styles.pickerRow}>
                <Text style={styles.controlLabel}>Month</Text>
                <View style={styles.chipRow}>
                  {MONTHS.map((_, i) => {
                    const m = i + 1;
                    const selected = historyMonth === m;
                    return (
                      <TouchableOpacity key={m} style={[styles.filterChip, selected && styles.filterChipActive]} onPress={() => setHistoryMonth(m)}>
                        <Text style={[styles.filterChipText, selected && styles.filterChipTextActive]} numberOfLines={1}>{MONTHS[i].slice(0, 3)}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
              <View style={styles.pickerRow}>
                <Text style={styles.controlLabel}>Year</Text>
                <View style={styles.chipRow}>
                  {[historyYear, historyYear - 1, historyYear - 2].map((y) => {
                    const selected = historyYear === y;
                    return (
                      <TouchableOpacity key={y} style={[styles.filterChip, selected && styles.filterChipActive]} onPress={() => setHistoryYear(y)}>
                        <Text style={[styles.filterChipText, selected && styles.filterChipTextActive]}>{y}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </View>

            {loading ? (
              <Text style={styles.muted}>Loading…</Text>
            ) : entries.length === 0 ? (
              <View style={styles.emptyCard}>
                <MaterialIcons name="assignment" size={48} color={AppColors.textSecondary} />
                <Text style={styles.emptyText}>No task entries</Text>
                <Text style={styles.emptySub}>No tasks submitted for {MONTHS[historyMonth - 1]} {historyYear}.</Text>
              </View>
            ) : (
              <View style={styles.entryList}>
                {entries.map((e) => (
                  <View key={e._id} style={styles.historyCard}>
                    <View style={styles.historyCardHeader}>
                      <Text style={styles.historyCardDate}>{fmtDate(e.date)}</Text>
                      <Text style={styles.historyCardCount}>{e.tasks?.length ?? 0} task{(e.tasks?.length ?? 0) !== 1 ? 's' : ''}</Text>
                    </View>
                    {(e.tasks ?? []).map((t, i) => {
                      const st = STATUS_OPTIONS.find((s) => s.value === t.status) ?? STATUS_OPTIONS[0];
                      return (
                        <View key={t._id ?? i} style={[styles.historyTaskItem, i > 0 && styles.historyTaskItemBorder]}>
                          <View style={styles.taskRow}>
                            <Text style={styles.taskTitle}>{t.title}</Text>
                            <View style={[styles.taskStatusBadge, { backgroundColor: st.bg }]}>
                              <Text style={[styles.taskStatusText, { color: st.text }]}>{st.label}</Text>
                            </View>
                          </View>
                          {t.description ? <Text style={styles.taskDesc}>{t.description}</Text> : null}
                        </View>
                      );
                    })}
                  </View>
                ))}
              </View>
            )}
          </>
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
  modalTitle: { fontSize: 18, fontWeight: '700', color: AppColors.text, marginBottom: 4 },
  modalSubtitle: { fontSize: 14, color: AppColors.textSecondary, marginBottom: Spacing.lg },
  submitError: { fontSize: 14, color: '#dc2626', marginBottom: Spacing.sm },
  taskBlock: {
    backgroundColor: 'rgba(248,250,252,1)',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,1)',
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  taskBlockHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  taskBlockLabel: { fontSize: 14, fontWeight: '600', color: AppColors.text },
  removeTaskText: { fontSize: 13, fontWeight: '600', color: '#dc2626' },
  inputLabel: { fontSize: 13, fontWeight: '600', color: AppColors.text, marginBottom: 4, marginTop: 6 },
  input: { borderWidth: 1, borderColor: 'rgba(60,60,67,0.2)', borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, fontSize: 16, color: AppColors.text },
  inputMultiline: { minHeight: 60, textAlignVertical: 'top' },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: 4 },
  statusChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: BorderRadius.full, backgroundColor: 'rgba(118,118,128,0.12)' },
  statusChipText: { fontSize: 12, fontWeight: '600', color: AppColors.textSecondary },
  addTaskBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: Spacing.md, marginBottom: Spacing.md, borderWidth: 1, borderColor: AppColors.tint, borderRadius: BorderRadius.md, borderStyle: 'dashed' },
  addTaskBtnText: { fontSize: 15, fontWeight: '600', color: AppColors.tint },
  modalActions: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.sm },
  cancelBtn: { flex: 1, paddingVertical: Spacing.md, alignItems: 'center', borderRadius: BorderRadius.md, backgroundColor: 'rgba(118,118,128,0.2)' },
  cancelBtnText: { fontSize: 16, fontWeight: '600', color: AppColors.text },
  submitBtn: { flex: 1, paddingVertical: Spacing.md, alignItems: 'center', justifyContent: 'center', borderRadius: BorderRadius.md, backgroundColor: AppColors.tint, minHeight: 48 },
  submitBtnDisabled: { opacity: 0.7 },
  submitBtnText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  scroll: { flex: 1 },
  content: { padding: Spacing.xl, paddingBottom: Spacing.section },
  pageSubtitle: { fontSize: 15, color: AppColors.textSecondary, marginBottom: Spacing.lg },
  muted: { fontSize: 15, color: AppColors.textSecondary },
  tabRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg },
  tabBtn: { flex: 1, paddingVertical: Spacing.md, borderRadius: BorderRadius.md, backgroundColor: 'rgba(118,118,128,0.12)', alignItems: 'center', justifyContent: 'center' },
  tabBtnActive: { backgroundColor: AppColors.tint },
  tabBtnText: { fontSize: 15, fontWeight: '600', color: AppColors.text },
  tabBtnTextActive: { color: '#fff' },
  submittedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.lg,
    backgroundColor: `${AppColors.success}18`,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
  },
  submittedBannerText: { flex: 1 },
  submittedText: { fontSize: 16, fontWeight: '700', color: AppColors.success },
  submittedSub: { fontSize: 14, color: AppColors.textSecondary, marginTop: 4 },
  primaryBtn: { marginTop: Spacing.lg, paddingVertical: Spacing.md, borderRadius: BorderRadius.md, backgroundColor: AppColors.tint, alignItems: 'center' },
  primaryBtnText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  historyFilters: { marginBottom: Spacing.lg },
  pickerRow: { marginBottom: Spacing.md },
  controlLabel: { fontSize: 13, fontWeight: '600', color: AppColors.textSecondary, marginBottom: 6 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  filterChip: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: BorderRadius.md, backgroundColor: 'rgba(118,118,128,0.12)' },
  filterChipActive: { backgroundColor: AppColors.tint },
  filterChipText: { fontSize: 13, fontWeight: '600', color: AppColors.text },
  filterChipTextActive: { color: '#fff' },
  entryList: { gap: Spacing.md },
  historyCard: { backgroundColor: AppColors.card, borderRadius: BorderRadius.xl, padding: Spacing.lg, ...CardShadow },
  historyCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  historyCardDate: { fontSize: 15, fontWeight: '700', color: AppColors.text },
  historyCardCount: { fontSize: 13, color: AppColors.textSecondary },
  historyTaskItem: { paddingVertical: Spacing.sm },
  historyTaskItemBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(60,60,67,0.12)' },
  taskDesc: { fontSize: 14, color: AppColors.textSecondary, marginTop: 4, marginLeft: 0 },
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
  entry: { padding: Spacing.lg },
  entryBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(60,60,67,0.12)' },
  entryDate: { fontSize: 14, fontWeight: '600', color: AppColors.textSecondary, marginBottom: 6 },
  taskRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: 4, flexWrap: 'wrap' },
  taskTitle: { fontSize: 15, color: AppColors.text, flex: 1 },
  taskStatusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  taskStatusText: { fontSize: 11, fontWeight: '600' },
});
