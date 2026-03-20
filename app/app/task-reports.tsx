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
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Spacing, BorderRadius, AppColors, CardShadow } from '@/constants/theme';
import api from '@/lib/api';
import { downloadAndShareFromApi } from '@/lib/download';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  COMPLETED: { bg: '#dcfce7', color: '#15803d' },
  IN_PROGRESS: { bg: '#fef3c7', color: '#b45309' },
  BLOCKED: { bg: '#fee2e2', color: '#b91c1c' },
};

type TaskItem = { _id?: string; title?: string; description?: string; status?: string };
type Entry = {
  _id: string;
  date: string;
  tasks: TaskItem[];
  employee?: { _id?: string; name?: string; employeeId?: string; designation?: string; department?: { name: string } };
};

type EmployeeAgg = {
  employee: NonNullable<Entry['employee']>;
  entries: Entry[];
  totalTasks: number;
  completed: number;
  inProgress: number;
  blocked: number;
};

async function downloadTaskReportPDF(
  empId: string,
  month: number,
  year: number,
  setDownloading: (v: string | null) => void,
  onError: (msg: string) => void
) {
  setDownloading(empId);
  try {
    await downloadAndShareFromApi({
      path: `/daily-tasks/report/${empId}/${month}/${year}/pdf`,
      fileName: `Task_Report_${empId}_${MONTHS[month - 1]}_${year}.pdf`,
      mimeType: 'application/pdf',
      dialogTitle: `Task Report ${empId}`,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to download PDF.';
    onError(msg);
  } finally {
    setDownloading(null);
  }
}

function fmt(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

export default function TaskReportsScreen() {
  const router = useRouter();
  const now = new Date();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [departments, setDepartments] = useState<{ _id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [nameSearch, setNameSearch] = useState('');
  const [empIdSearch, setEmpIdSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [filterMode, setFilterMode] = useState<'month' | 'date'>('month');
  const [monthFilter, setMonthFilter] = useState(now.getMonth() + 1);
  const [yearFilter, setYearFilter] = useState(now.getFullYear());
  const [dateFilter, setDateFilter] = useState('');
  const [viewEmployee, setViewEmployee] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  const years = [now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2];

  const loadDepts = useCallback(async () => {
    try {
      const { data } = await api.get<{ data: { _id: string; name: string }[] }>('/departments');
      setDepartments(data.data ?? []);
    } catch {}
  }, []);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (nameSearch.trim()) params.set('name', nameSearch.trim());
      if (empIdSearch.trim()) params.set('employeeId', empIdSearch.trim());
      if (deptFilter) params.set('department', deptFilter);
      if (filterMode === 'date' && dateFilter) {
        params.set('date', dateFilter);
      } else {
        params.set('month', String(monthFilter));
        params.set('year', String(yearFilter));
      }
      const { data } = await api.get<{ data: Entry[] }>(`/daily-tasks?${params.toString()}`);
      setEntries(data.data ?? []);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [nameSearch, empIdSearch, deptFilter, filterMode, monthFilter, yearFilter, dateFilter]);

  useEffect(() => {
    loadDepts();
  }, [loadDepts]);
  useEffect(() => {
    const t = setTimeout(fetchEntries, 300);
    return () => clearTimeout(t);
  }, [fetchEntries]);

  // Group by employee
  const employeeMap: Record<string, EmployeeAgg> = {};
  entries.forEach((e) => {
    const emp = e.employee;
    if (!emp) return;
    const key = emp.employeeId ?? emp._id ?? '';
    if (!key) return;
    if (!employeeMap[key]) {
      employeeMap[key] = { employee: emp, entries: [], totalTasks: 0, completed: 0, inProgress: 0, blocked: 0 };
    }
    employeeMap[key].entries.push(e);
    (e.tasks ?? []).forEach((t) => {
      employeeMap[key].totalTasks++;
      if (t.status === 'COMPLETED') employeeMap[key].completed++;
      else if (t.status === 'IN_PROGRESS') employeeMap[key].inProgress++;
      else if (t.status === 'BLOCKED') employeeMap[key].blocked++;
    });
  });
  const employeeList = Object.values(employeeMap).sort((a, b) => (a.employee.name ?? '').localeCompare(b.employee.name ?? ''));
  const viewData = viewEmployee ? employeeMap[viewEmployee] ?? null : null;

  return (
    <View style={[styles.screen, { backgroundColor: AppColors.background }]}>
      <SafeAreaView style={styles.safeTop}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => (viewData ? setViewEmployee(null) : router.back())}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <MaterialIcons name={Platform.OS === 'ios' ? 'arrow-back-ios' : 'arrow-back'} size={Platform.OS === 'ios' ? 22 : 24} color={AppColors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{viewData ? 'Employee Tasks' : 'Task Reports'}</Text>
          <View style={styles.backBtn} />
        </View>
      </SafeAreaView>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchEntries(); }} tintColor={AppColors.tint} />}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.pageSubtitle}>View employee daily tasks by department, name, or ID — download monthly PDF reports</Text>

        {viewData ? (
          <>
            <View style={styles.detailCard}>
              <Text style={styles.detailName}>{viewData.employee.name ?? '—'}</Text>
              <Text style={styles.detailMeta}>
                {viewData.employee.employeeId ?? '—'} · {viewData.employee.designation ?? '—'}
                {viewData.employee.department?.name ? ` · ${viewData.employee.department.name}` : ''}
              </Text>
              <View style={styles.statsRow}>
                <View style={styles.statChip}>
                  <Text style={styles.statChipText}>{viewData.entries.length} day{viewData.entries.length !== 1 ? 's' : ''} reported</Text>
                </View>
                <View style={[styles.statChip, styles.statChipGreen]}>
                  <Text style={styles.statChipTextGreen}>{viewData.completed} completed</Text>
                </View>
                {viewData.inProgress > 0 && (
                  <View style={[styles.statChip, styles.statChipAmber]}>
                    <Text style={styles.statChipTextAmber}>{viewData.inProgress} in progress</Text>
                  </View>
                )}
                {viewData.blocked > 0 && (
                  <View style={[styles.statChip, styles.statChipRed]}>
                    <Text style={styles.statChipTextRed}>{viewData.blocked} blocked</Text>
                  </View>
                )}
              </View>
            </View>
            <View style={styles.entryList}>
              {viewData.entries.map((entry) => (
                <View key={entry._id} style={styles.entryCard}>
                  <View style={styles.entryCardHeader}>
                    <Text style={styles.entryCardDate}>{fmt(entry.date)}</Text>
                    <Text style={styles.entryCardCount}>{entry.tasks?.length ?? 0} task{(entry.tasks?.length ?? 0) !== 1 ? 's' : ''}</Text>
                  </View>
                  {(entry.tasks ?? []).map((task, i) => {
                    const st = STATUS_STYLE[task.status ?? ''] ?? STATUS_STYLE.COMPLETED;
                    return (
                      <View key={task._id ?? i} style={[styles.taskItem, i > 0 && styles.taskItemBorder]}>
                        <View style={styles.taskItemRow}>
                          <Text style={styles.taskItemTitle}>{task.title ?? '—'}</Text>
                          <View style={[styles.badge, { backgroundColor: st.bg }]}>
                            <Text style={[styles.badgeText, { color: st.color }]}>{task.status === 'COMPLETED' ? 'Completed' : task.status === 'IN_PROGRESS' ? 'In Progress' : 'Blocked'}</Text>
                          </View>
                        </View>
                        {task.description ? <Text style={styles.taskItemDesc}>{task.description}</Text> : null}
                      </View>
                    );
                  })}
                </View>
              ))}
            </View>
          </>
        ) : (
          <>
            <View style={styles.filtersCard}>
              <Text style={styles.inputLabel}>Employee name</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. John"
                placeholderTextColor={AppColors.textSecondary}
                value={nameSearch}
                onChangeText={setNameSearch}
              />
              <Text style={styles.inputLabel}>Employee ID</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. EMP-0002"
                placeholderTextColor={AppColors.textSecondary}
                value={empIdSearch}
                onChangeText={setEmpIdSearch}
              />
              <Text style={styles.inputLabel}>Department</Text>
              <View style={styles.chipRow}>
                <TouchableOpacity style={[styles.chip, !deptFilter && styles.chipActive]} onPress={() => setDeptFilter('')}>
                  <Text style={[styles.chipText, !deptFilter && styles.chipTextActive]}>All</Text>
                </TouchableOpacity>
                {departments.map((d) => (
                  <TouchableOpacity key={d._id} style={[styles.chip, deptFilter === d._id && styles.chipActive]} onPress={() => setDeptFilter(d._id)}>
                    <Text style={[styles.chipText, deptFilter === d._id && styles.chipTextActive]} numberOfLines={1}>{d.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.inputLabel}>Filter by</Text>
              <View style={styles.chipRow}>
                <TouchableOpacity style={[styles.chip, filterMode === 'month' && styles.chipActive]} onPress={() => setFilterMode('month')}>
                  <Text style={[styles.chipText, filterMode === 'month' && styles.chipTextActive]}>Month</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.chip, filterMode === 'date' && styles.chipActive]} onPress={() => setFilterMode('date')}>
                  <Text style={[styles.chipText, filterMode === 'date' && styles.chipTextActive]}>Date</Text>
                </TouchableOpacity>
              </View>
              {filterMode === 'date' ? (
                <>
                  <Text style={styles.inputLabel}>Date</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={AppColors.textSecondary}
                    value={dateFilter}
                    onChangeText={setDateFilter}
                  />
                </>
              ) : (
                <>
                  <Text style={styles.inputLabel}>Month / Year</Text>
                  <View style={styles.chipRow}>
                    {MONTHS_SHORT.map((_, i) => {
                      const m = i + 1;
                      return (
                        <TouchableOpacity key={m} style={[styles.chip, monthFilter === m && styles.chipActive]} onPress={() => setMonthFilter(m)}>
                          <Text style={[styles.chipText, monthFilter === m && styles.chipTextActive]}>{MONTHS_SHORT[i]}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <View style={styles.chipRow}>
                    {years.map((y) => (
                      <TouchableOpacity key={y} style={[styles.chip, yearFilter === y && styles.chipActive]} onPress={() => setYearFilter(y)}>
                        <Text style={[styles.chipText, yearFilter === y && styles.chipTextActive]}>{y}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}
            </View>

            {loading ? (
              <View style={styles.loadingWrap}>
                <ActivityIndicator size="large" color={AppColors.tint} />
                <Text style={styles.muted}>Loading…</Text>
              </View>
            ) : employeeList.length === 0 ? (
              <View style={styles.emptyCard}>
                <MaterialIcons name="assessment" size={48} color={AppColors.textSecondary} />
                <Text style={styles.emptyText}>No task entries found</Text>
                <Text style={styles.emptySub}>Try adjusting the filters above</Text>
              </View>
            ) : (
              <View style={styles.list}>
                {employeeList.map(({ employee: emp, entries: empEntries, totalTasks, completed, inProgress, blocked }) => {
                  const key = emp.employeeId ?? emp._id ?? '';
                  return (
                    <View key={key} style={styles.empCard}>
                      <View style={styles.empCardMain}>
                        <Text style={styles.empName}>{emp.name ?? '—'}</Text>
                        <Text style={styles.empMeta}>{emp.employeeId ?? '—'}{emp.department?.name ? ` · ${emp.department.name}` : ''}</Text>
                        <Text style={styles.empDesignation}>{emp.designation ?? '—'}</Text>
                        <View style={styles.empStats}>
                          <Text style={styles.empStatsText}>{empEntries.length} day{empEntries.length !== 1 ? 's' : ''} · {totalTasks} task{totalTasks !== 1 ? 's' : ''}</Text>
                          <Text style={styles.empStatsDone}> · {completed} done</Text>
                          {inProgress > 0 && <Text style={styles.empStatsProgress}> · {inProgress} in progress</Text>}
                          {blocked > 0 && <Text style={styles.empStatsBlocked}> · {blocked} blocked</Text>}
                        </View>
                      </View>
                      <View style={styles.empActions}>
                        <TouchableOpacity style={styles.viewBtn} onPress={() => setViewEmployee(key)}>
                          <Text style={styles.viewBtnText}>View Tasks</Text>
                        </TouchableOpacity>
                        {filterMode === 'month' && (
                          <TouchableOpacity
                            style={[styles.pdfBtn, downloading === (emp.employeeId ?? '') && styles.pdfBtnDisabled]}
                            onPress={() => downloadTaskReportPDF(emp.employeeId ?? '', monthFilter, yearFilter, setDownloading, (err) => Alert.alert('Error', err))}
                            disabled={!!downloading}
                          >
                            {downloading === (emp.employeeId ?? '') ? (
                              <ActivityIndicator size="small" color="#fff" />
                            ) : (
                              <Text style={styles.pdfBtnText}>PDF Report</Text>
                            )}
                          </TouchableOpacity>
                        )}
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
  content: { padding: Spacing.md, paddingBottom: Spacing.section },
  bottomPad: { height: Spacing.section },
  pageSubtitle: { fontSize: 15, color: AppColors.textSecondary, marginBottom: Spacing.lg },
  filtersCard: { backgroundColor: AppColors.card, borderRadius: BorderRadius.xl, padding: Spacing.lg, marginBottom: Spacing.lg, ...CardShadow },
  inputLabel: { fontSize: 13, fontWeight: '600', color: AppColors.textSecondary, marginBottom: 6, marginTop: 8 },
  input: { borderWidth: 1, borderColor: 'rgba(60,60,67,0.2)', borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, fontSize: 16, color: AppColors.text, marginBottom: 4 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
  chip: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: BorderRadius.md, backgroundColor: 'rgba(118,118,128,0.12)' },
  chipActive: { backgroundColor: AppColors.tint },
  chipText: { fontSize: 13, fontWeight: '600', color: AppColors.text },
  chipTextActive: { color: '#fff' },
  loadingWrap: { alignItems: 'center', paddingVertical: Spacing.xxl },
  muted: { fontSize: 14, color: AppColors.textSecondary, marginTop: Spacing.sm },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
    backgroundColor: AppColors.card,
    borderRadius: BorderRadius.xl,
    ...CardShadow,
  },
  emptyText: { fontSize: 17, fontWeight: '600', color: AppColors.text, marginTop: Spacing.md },
  emptySub: { fontSize: 14, color: AppColors.textSecondary, marginTop: Spacing.sm },
  list: { gap: Spacing.md },
  empCard: {
    backgroundColor: AppColors.card,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    ...CardShadow,
  },
  empCardMain: { marginBottom: Spacing.sm },
  empName: { fontSize: 16, fontWeight: '700', color: AppColors.text },
  empMeta: { fontSize: 13, color: AppColors.textSecondary },
  empDesignation: { fontSize: 14, color: AppColors.textSecondary, marginTop: 2 },
  empStats: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 6, alignItems: 'center' },
  empStatsText: { fontSize: 13, color: AppColors.tint, fontWeight: '600' },
  empStatsDone: { fontSize: 13, color: '#15803d', fontWeight: '600' },
  empStatsProgress: { fontSize: 13, color: '#b45309', fontWeight: '600' },
  empStatsBlocked: { fontSize: 13, color: '#b91c1c', fontWeight: '600' },
  empActions: { flexDirection: 'row', gap: 8, marginTop: Spacing.sm, flexWrap: 'wrap' },
  viewBtn: { backgroundColor: AppColors.tint, paddingHorizontal: 14, paddingVertical: 8, borderRadius: BorderRadius.md },
  viewBtnText: { fontSize: 14, fontWeight: '600', color: '#fff' },
  pdfBtn: { backgroundColor: 'rgba(118,118,128,0.2)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: BorderRadius.md, minWidth: 90, alignItems: 'center' },
  pdfBtnDisabled: { opacity: 0.7 },
  pdfBtnText: { fontSize: 14, fontWeight: '600', color: AppColors.text },
  detailCard: {
    backgroundColor: AppColors.card,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    ...CardShadow,
  },
  detailName: { fontSize: 18, fontWeight: '700', color: AppColors.text, marginBottom: 4 },
  detailMeta: { fontSize: 14, color: AppColors.textSecondary },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: Spacing.md },
  statChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: '#dbeafe' },
  statChipText: { fontSize: 13, fontWeight: '600', color: '#2563eb' },
  statChipGreen: { backgroundColor: '#dcfce7' },
  statChipTextGreen: { fontSize: 13, fontWeight: '600', color: '#15803d' },
  statChipAmber: { backgroundColor: '#fef3c7' },
  statChipTextAmber: { fontSize: 13, fontWeight: '600', color: '#b45309' },
  statChipRed: { backgroundColor: '#fee2e2' },
  statChipTextRed: { fontSize: 13, fontWeight: '600', color: '#b91c1c' },
  entryList: { gap: Spacing.md },
  entryCard: { backgroundColor: AppColors.card, borderRadius: BorderRadius.xl, padding: Spacing.lg, ...CardShadow },
  entryCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  entryCardDate: { fontSize: 15, fontWeight: '700', color: AppColors.tint },
  entryCardCount: { fontSize: 13, color: AppColors.textSecondary },
  taskItem: { paddingVertical: Spacing.sm },
  taskItemBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(60,60,67,0.12)' },
  taskItemRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  taskItemTitle: { fontSize: 15, fontWeight: '600', color: AppColors.text, flex: 1 },
  taskItemDesc: { fontSize: 14, color: AppColors.textSecondary, marginTop: 4 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  badgeText: { fontSize: 12, fontWeight: '600' },
});
