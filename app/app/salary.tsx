import React, { useState, useEffect, useCallback } from 'react';
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
  SafeAreaView,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Spacing, BorderRadius, AppColors, CardShadow } from '@/constants/theme';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { downloadAndShareFromApi } from '@/lib/download';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

type SalarySlip = {
  _id: string;
  month: number;
  year: number;
  employee?: { _id?: string; name: string; employeeId?: string; designation?: string };
  grossSalary?: number;
  netSalary?: number;
  perDaySalary?: number;
  daysInMonth?: number;
  fullDays?: number;
  realHalfDays?: number;
  displayHalfDays?: number; // may be stripped by API
  paidLeaves?: number;
  absentDays?: number;
  unpaidLeaves?: number;
  holidays?: number;
  weeklyOffs?: number;
  deductionDays?: number;
  deductionAmount?: number;
  hasDeduction?: boolean;
  reimbursementTotal?: number;
  manualAdjustment?: number;
  adjustmentNote?: string;
  status?: string;
};

export default function SalaryScreen() {
  const user = useAuthStore((s) => s.user);
  const getRole = useAuthStore((s) => s.getRole);
  const role = getRole();
  const canManageSalary = ['ACCOUNTS', 'DIRECTOR', 'SUPER_ADMIN'].includes(role);
  const canExportExcel = ['ACCOUNTS', 'DIRECTOR', 'SUPER_ADMIN'].includes(role);
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [salary, setSalary] = useState<SalarySlip | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [pinForSession, setPinForSession] = useState('');
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [records, setRecords] = useState<SalarySlip[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [finalizingId, setFinalizingId] = useState<string | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<SalarySlip | null>(null);
  const [statusMsg, setStatusMsg] = useState('');
  const [adjustRecord, setAdjustRecord] = useState<SalarySlip | null>(null);
  const [adjAmount, setAdjAmount] = useState('');
  const [adjNote, setAdjNote] = useState('');
  const [adjusting, setAdjusting] = useState(false);

  const years = [now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2];

  const getPinHeaders = useCallback(() => {
    if (pinForSession) return { 'X-Payslip-Pin': pinForSession };
    return {};
  }, [pinForSession]);

  const fetchSalary = useCallback(async (pinOverride?: string) => {
    setLoading(true);
    setError('');
    const headers = pinOverride != null ? { 'X-Payslip-Pin': pinOverride } : getPinHeaders();
    try {
      const { data } = await api.get<{ data: SalarySlip }>(`/salary/my?month=${month}&year=${year}`, { headers });
      setSalary(data.data ?? null);
      if (pinOverride) setPinForSession(pinOverride);
      setShowPinModal(false);
      setPinInput('');
      setPinError('');
    } catch (err: unknown) {
      setSalary(null);
      const res = err as { response?: { status?: number; data?: { message?: string } } };
      const msg = res.response?.data?.message ?? '';
      if (res.response?.status === 403 && /payslip pin/i.test(msg)) {
        setShowPinModal(true);
        setError('');
      } else if (res.response?.status !== 404) {
        setError(msg || 'Failed to load salary.');
      } else {
        setError('');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [month, year, getPinHeaders]);

  const fetchAllRecords = useCallback(async () => {
    if (!canManageSalary) return;
    setLoadingRecords(true);
    setStatusMsg('');
    try {
      const { data } = await api.get<{ data: SalarySlip[] }>(`/salary?month=${month}&year=${year}`);
      setRecords(data.data ?? []);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to load salary records.';
      setStatusMsg(`error:${msg}`);
      setRecords([]);
    } finally {
      setLoadingRecords(false);
    }
  }, [canManageSalary, month, year]);

  useEffect(() => {
    if (canManageSalary) fetchAllRecords();
    else fetchSalary();
  }, [month, year, canManageSalary, fetchAllRecords, fetchSalary]);

  const onRefresh = () => {
    setRefreshing(true);
    if (canManageSalary) {
      fetchAllRecords().finally(() => setRefreshing(false));
      return;
    }
    fetchSalary();
  };

  const submitPin = () => {
    const p = String(pinInput || '').trim();
    if (p.length < 4) {
      setPinError('Enter 4–8 digit PIN');
      return;
    }
    setPinError('');
    fetchSalary(p);
  };

  const downloadPdf = async () => {
    if (!salary || !user?._id) return;
    setDownloadingPdf(true);
    try {
      await downloadAndShareFromApi({
        path: `/salary/${user._id}/${salary.month}/${salary.year}/pdf`,
        fileName: `Salary_${MONTHS[salary.month - 1]}_${salary.year}.pdf`,
        mimeType: 'application/pdf',
        dialogTitle: `Salary ${MONTHS[salary.month - 1]} ${salary.year}`,
        extraHeaders: getPinHeaders(),
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Payslip PIN may be required or slip not available.';
      Alert.alert('Download failed', msg);
    } finally {
      setDownloadingPdf(false);
    }
  };

  const downloadPdfForRecord = async (record: SalarySlip) => {
    const empId = record.employee?._id;
    if (!empId) return;
    setDownloadingPdf(true);
    try {
      await downloadAndShareFromApi({
        path: `/salary/${empId}/${record.month}/${record.year}/pdf`,
        fileName: `Salary_${record.employee?.employeeId || empId}_${MONTHS[record.month - 1]}_${record.year}.pdf`,
        mimeType: 'application/pdf',
        dialogTitle: `Salary ${record.employee?.name || ''} ${MONTHS[record.month - 1]} ${record.year}`,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to download PDF.';
      Alert.alert('Download failed', msg);
    } finally {
      setDownloadingPdf(false);
    }
  };

  const exportExcel = async () => {
    if (!canExportExcel) return;
    setExportingExcel(true);
    try {
      await downloadAndShareFromApi({
        path: `/salary/export?month=${month}&year=${year}`,
        fileName: `Salary_Report_${MONTHS[month - 1]}_${year}.xlsx`,
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        dialogTitle: `Salary Report ${MONTHS[month - 1]} ${year}`,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to export salary report.';
      Alert.alert('Export failed', msg);
    } finally {
      setExportingExcel(false);
    }
  };

  const generateAll = async () => {
    if (!canManageSalary) return;
    setGenerating(true);
    setStatusMsg('');
    try {
      const { data } = await api.post<{ message?: string }>('/salary/generate', { month, year });
      setStatusMsg(`success:${data.message || 'Salary generated successfully.'}`);
      await fetchAllRecords();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to generate salaries.';
      setStatusMsg(`error:${msg}`);
    } finally {
      setGenerating(false);
    }
  };

  const finalizeSlip = async (id: string) => {
    setFinalizingId(id);
    setStatusMsg('');
    try {
      await api.patch(`/salary/${id}/finalize`);
      setStatusMsg('success:Salary slip finalized.');
      await fetchAllRecords();
      if (selectedRecord?._id === id) setSelectedRecord((prev) => (prev ? { ...prev, status: 'FINAL' } : prev));
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to finalize salary.';
      setStatusMsg(`error:${msg}`);
    } finally {
      setFinalizingId(null);
    }
  };

  const openAdjust = (record: SalarySlip) => {
    setAdjustRecord(record);
    setAdjAmount('');
    setAdjNote('');
  };

  const applyAdjustment = async () => {
    if (!adjustRecord) return;
    const amt = Number(adjAmount);
    if (!Number.isFinite(amt) || amt === 0) {
      Alert.alert('Invalid amount', 'Enter a valid amount. Positive for bonus, negative for deduction.');
      return;
    }
    setAdjusting(true);
    try {
      const { data } = await api.patch<{ message?: string }>(`/salary/${adjustRecord._id}/adjust`, { amount: amt, note: adjNote.trim() || undefined });
      setStatusMsg(`success:${data.message || 'Salary adjusted successfully.'}`);
      setAdjustRecord(null);
      await fetchAllRecords();
      if (selectedRecord?._id === adjustRecord._id) {
        const { data: one } = await api.get<{ data: SalarySlip }>(`/salary/${adjustRecord.employee?._id}/${adjustRecord.month}/${adjustRecord.year}`);
        setSelectedRecord(one.data ?? null);
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to adjust salary.';
      setStatusMsg(`error:${msg}`);
    } finally {
      setAdjusting(false);
    }
  };

  if (canManageSalary) {
    const selected = selectedRecord;
    const showMsg = !!statusMsg;
    const isSuccess = statusMsg.startsWith('success:');
    const msgText = statusMsg.replace(/^(success|error):/, '');
    return (
      <View style={[styles.screen, { backgroundColor: AppColors.background }]}>
        <SafeAreaView style={styles.safeTop} />
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={AppColors.tint} />}
          showsVerticalScrollIndicator={false}
        >
          {selected ? (
            <>
              <View style={styles.adminHeaderRow}>
                <TouchableOpacity style={styles.backBtn} onPress={() => setSelectedRecord(null)}>
                  <MaterialIcons name="arrow-back" size={18} color={AppColors.tint} />
                  <Text style={styles.backBtnText}>Back</Text>
                </TouchableOpacity>
                {selected.status === 'DRAFT' && (
                  <TouchableOpacity style={styles.primaryActionBtn} onPress={() => finalizeSlip(selected._id)} disabled={finalizingId === selected._id}>
                    <Text style={styles.primaryActionBtnText}>{finalizingId === selected._id ? 'Finalizing…' : 'Finalize Slip'}</Text>
                  </TouchableOpacity>
                )}
              </View>
              <Text style={styles.pageSubtitle}>{selected.employee?.name} - {MONTHS[selected.month - 1]} {selected.year}</Text>
              {showMsg ? (
                <View style={[styles.banner, isSuccess ? styles.bannerSuccess : styles.bannerError]}>
                  <Text style={[styles.bannerText, isSuccess ? styles.bannerTextSuccess : styles.bannerTextError]}>{msgText}</Text>
                </View>
              ) : null}
              <View style={styles.slip}>
                <View style={[styles.slipHeader, { backgroundColor: AppColors.card }]}>
                  <View>
                    <Text style={styles.slipTitle}>Salary Slip</Text>
                    <Text style={styles.slipSubtitle}>{MONTHS[selected.month - 1]} {selected.year}</Text>
                  </View>
                  <View style={styles.slipHeaderRight}>
                    <TouchableOpacity style={styles.pdfBtn} onPress={() => downloadPdfForRecord(selected)} disabled={downloadingPdf}>
                      {downloadingPdf ? <ActivityIndicator size="small" color={AppColors.tint} /> : <MaterialIcons name="picture-as-pdf" size={20} color={AppColors.tint} />}
                      <Text style={styles.pdfBtnText}>PDF</Text>
                    </TouchableOpacity>
                    {selected.status === 'DRAFT' && (
                      <TouchableOpacity style={styles.adjustBtn} onPress={() => openAdjust(selected)}>
                        <Text style={styles.adjustBtnText}>Adjust</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
                <View style={[styles.card, { marginTop: Spacing.lg }]}>
                  <Text style={styles.sectionTitle}>Employee Info</Text>
                  <Row label="Employee ID" value={selected.employee?.employeeId || '—'} />
                  <Row label="Name" value={selected.employee?.name || '—'} />
                  <Row label="Designation" value={selected.employee?.designation || '—'} />
                  <Row label="Working Days" value={String(selected.daysInMonth ?? '—')} />
                </View>
                <View style={[styles.card]}>
                  <Text style={styles.sectionTitle}>Salary Calculation</Text>
                  <Row label="Gross Salary" value={selected.grossSalary != null ? `₹${Number(selected.grossSalary).toLocaleString('en-IN')}` : '—'} />
                  <Row label="Deduction Amount" value={selected.hasDeduction ? `— ₹${Number(selected.deductionAmount ?? 0).toLocaleString('en-IN')}` : '—'} danger={selected.hasDeduction} />
                  <Row label="Reimbursement" value={(selected.reimbursementTotal ?? 0) > 0 ? `+ ₹${Number(selected.reimbursementTotal).toLocaleString('en-IN')}` : '—'} success={(selected.reimbursementTotal ?? 0) > 0} />
                  {selected.manualAdjustment != null && selected.manualAdjustment !== 0 && (
                    <Row
                      label={`Manual Adjustment${selected.adjustmentNote ? ` (${selected.adjustmentNote})` : ''}`}
                      value={`${selected.manualAdjustment > 0 ? '+' : ''} ₹${Number(selected.manualAdjustment).toLocaleString('en-IN')}`}
                      success={selected.manualAdjustment > 0}
                      danger={selected.manualAdjustment < 0}
                    />
                  )}
                  <View style={styles.netRow}>
                    <Text style={styles.netLabel}>Net Salary</Text>
                    <Text style={styles.netValue}>₹{selected.netSalary != null ? Number(selected.netSalary).toLocaleString('en-IN') : '—'}</Text>
                  </View>
                </View>
              </View>
            </>
          ) : (
            <>
              <Text style={styles.pageSubtitle}>Generate and manage employee salary slips</Text>
              <View style={styles.controls}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.controlsContent}>
                  <Text style={styles.controlLabel}>Month</Text>
                  {MONTHS.map((_, i) => {
                    const m = i + 1;
                    const selectedMonth = month === m;
                    return (
                      <TouchableOpacity key={m} style={[styles.chip, selectedMonth && styles.chipActive]} onPress={() => setMonth(m)}>
                        <Text style={[styles.chipText, selectedMonth && styles.chipTextActive]}>{MONTHS[i]?.slice(0, 3)}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
                <View style={styles.yearRow}>
                  <Text style={styles.controlLabel}>Year</Text>
                  {years.map((y) => {
                    const selectedYear = year === y;
                    return (
                      <TouchableOpacity key={y} style={[styles.chip, selectedYear && styles.chipActive]} onPress={() => setYear(y)}>
                        <Text style={[styles.chipText, selectedYear && styles.chipTextActive]}>{y}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <View style={styles.adminActionsRow}>
                  <TouchableOpacity style={[styles.exportBtn, exportingExcel && styles.exportBtnDisabled]} onPress={exportExcel} disabled={exportingExcel}>
                    <Text style={styles.exportBtnText}>{exportingExcel ? 'Exporting…' : 'Export Excel'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.primaryActionBtn, generating && styles.exportBtnDisabled]} onPress={generateAll} disabled={generating}>
                    <Text style={styles.primaryActionBtnText}>{generating ? 'Generating…' : 'Generate All Salaries'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
              {showMsg ? (
                <View style={[styles.banner, isSuccess ? styles.bannerSuccess : styles.bannerError]}>
                  <Text style={[styles.bannerText, isSuccess ? styles.bannerTextSuccess : styles.bannerTextError]}>{msgText}</Text>
                </View>
              ) : null}
              {loadingRecords ? (
                <View style={styles.loadingWrap}>
                  <ActivityIndicator size="large" color={AppColors.tint} />
                  <Text style={styles.muted}>Loading salary records…</Text>
                </View>
              ) : records.length === 0 ? (
                <View style={styles.emptyCard}>
                  <MaterialIcons name="wallet" size={48} color={AppColors.textSecondary} />
                  <Text style={styles.emptyTitle}>No salary records</Text>
                  <Text style={styles.muted}>No salaries generated for {MONTHS[month - 1]} {year}.</Text>
                </View>
              ) : (
                records.map((r) => (
                  <View key={r._id} style={styles.adminCard}>
                    <View style={styles.adminCardTop}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.adminName}>{r.employee?.name || 'Unknown Employee'}</Text>
                        <Text style={styles.adminSub}>{r.employee?.employeeId || '—'} · {r.employee?.designation || '—'}</Text>
                      </View>
                      <View style={[styles.statusBadge, r.status === 'FINAL' ? styles.statusFinal : styles.statusDraft]}>
                        <Text style={[styles.statusText, r.status === 'FINAL' ? { color: AppColors.success } : { color: AppColors.warning }]}>{r.status || 'DRAFT'}</Text>
                      </View>
                    </View>
                    <View style={styles.adminAmounts}>
                      <Text style={styles.adminAmountText}>Gross: ₹{Number(r.grossSalary || 0).toLocaleString('en-IN')}</Text>
                      <Text style={styles.adminAmountText}>Net: ₹{Number(r.netSalary || 0).toLocaleString('en-IN')}</Text>
                    </View>
                    <View style={styles.adminActionBtns}>
                      <TouchableOpacity style={styles.smallBtn} onPress={() => setSelectedRecord(r)}>
                        <Text style={styles.smallBtnText}>View</Text>
                      </TouchableOpacity>
                      {r.status === 'DRAFT' && (
                        <>
                          <TouchableOpacity style={styles.smallBtn} onPress={() => finalizeSlip(r._id)} disabled={finalizingId === r._id}>
                            <Text style={styles.smallBtnText}>{finalizingId === r._id ? '…' : 'Finalize'}</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={styles.smallBtn} onPress={() => openAdjust(r)}>
                            <Text style={styles.smallBtnText}>Adjust</Text>
                          </TouchableOpacity>
                        </>
                      )}
                    </View>
                  </View>
                ))
              )}
            </>
          )}
          <View style={styles.bottomPad} />
        </ScrollView>
        <Modal visible={!!adjustRecord} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Adjust Salary</Text>
              <Text style={styles.modalDesc}>
                {adjustRecord?.employee?.name || 'Employee'} · {adjustRecord ? `${MONTHS[adjustRecord.month - 1]} ${adjustRecord.year}` : ''}
              </Text>
              <Text style={styles.inputLabel}>Amount (positive bonus / negative deduction)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 500 or -500"
                placeholderTextColor={AppColors.textSecondary}
                value={adjAmount}
                onChangeText={setAdjAmount}
                keyboardType="numeric"
              />
              <Text style={styles.inputLabel}>Note (optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="Adjustment note"
                placeholderTextColor={AppColors.textSecondary}
                value={adjNote}
                onChangeText={setAdjNote}
              />
              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.primaryBtn} onPress={applyAdjustment} disabled={adjusting}>
                  <Text style={styles.primaryBtnText}>{adjusting ? 'Applying…' : 'Apply'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.secondaryBtn} onPress={() => setAdjustRecord(null)}>
                  <Text style={styles.secondaryBtnText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: AppColors.background }]}>
      <SafeAreaView style={styles.safeTop} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={AppColors.tint} />}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.pageSubtitle}>Monthly salary slip and deduction breakdown</Text>

        <View style={styles.controls}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.controlsContent}>
            <Text style={styles.controlLabel}>Month</Text>
            {MONTHS.map((_, i) => {
              const m = i + 1;
              const selected = month === m;
              return (
                <TouchableOpacity
                  key={m}
                  style={[styles.chip, selected && styles.chipActive]}
                  onPress={() => setMonth(m)}
                >
                  <Text style={[styles.chipText, selected && styles.chipTextActive]}>{MONTHS[i]?.slice(0, 3)}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <View style={styles.yearRow}>
            <Text style={styles.controlLabel}>Year</Text>
            {years.map((y) => {
              const selected = year === y;
              return (
                <TouchableOpacity
                  key={y}
                  style={[styles.chip, selected && styles.chipActive]}
                  onPress={() => setYear(y)}
                >
                  <Text style={[styles.chipText, selected && styles.chipTextActive]}>{y}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {canExportExcel && (
            <TouchableOpacity
              style={[styles.exportBtn, exportingExcel && styles.exportBtnDisabled]}
              onPress={exportExcel}
              disabled={exportingExcel}
            >
              {exportingExcel ? (
                <ActivityIndicator size="small" color={AppColors.tint} />
              ) : (
                <MaterialIcons name="download" size={18} color={AppColors.tint} />
              )}
              <Text style={styles.exportBtnText}>{exportingExcel ? 'Exporting…' : 'Export Excel'}</Text>
            </TouchableOpacity>
          )}
        </View>

        {error ? (
          <View style={styles.errorBanner}>
            <MaterialIcons name="error-outline" size={20} color={AppColors.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {loading && !salary ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={AppColors.tint} />
            <Text style={styles.muted}>Loading salary slip…</Text>
          </View>
        ) : !salary && !showPinModal ? (
          <View style={styles.emptyCard}>
            <MaterialIcons name="payments" size={48} color={AppColors.textSecondary} />
            <Text style={styles.emptyTitle}>No salary slip found</Text>
            <Text style={styles.muted}>Salary for {MONTHS[month - 1]} {year} has not been generated yet.</Text>
          </View>
        ) : salary ? (
          <View style={styles.slip}>
            <View style={[styles.slipHeader, { backgroundColor: AppColors.card }]}>
              <View>
                <Text style={styles.slipTitle}>Salary Slip</Text>
                <Text style={styles.slipSubtitle}>{MONTHS[salary.month - 1]} {salary.year}</Text>
              </View>
              <View style={styles.slipHeaderRight}>
                <TouchableOpacity
                  style={styles.pdfBtn}
                  onPress={downloadPdf}
                  disabled={downloadingPdf}
                >
                  {downloadingPdf ? <ActivityIndicator size="small" color={AppColors.tint} /> : <MaterialIcons name="picture-as-pdf" size={20} color={AppColors.tint} />}
                  <Text style={styles.pdfBtnText}>PDF</Text>
                </TouchableOpacity>
                <View style={[styles.statusBadge, salary.status === 'FINAL' ? styles.statusFinal : styles.statusDraft]}>
                  <Text style={[styles.statusText, salary.status === 'FINAL' ? { color: AppColors.success } : { color: AppColors.warning }]}>{salary.status}</Text>
                </View>
              </View>
            </View>

            <View style={[styles.card, { marginTop: Spacing.lg }]}>
              <Text style={styles.sectionTitle}>Employee Info</Text>
              <Row label="Employee ID" value={salary.employee?.employeeId} />
              <Row label="Name" value={salary.employee?.name} />
              <Row label="Designation" value={salary.employee?.designation} />
              <Row label="Working Days" value={String(salary.daysInMonth ?? '—')} />
            </View>

            <View style={[styles.card]}>
              <Text style={styles.sectionTitle}>Attendance Summary</Text>
              <Row label="Full Days Present" value={String(salary.fullDays ?? 0)} />
              <Row label="Half Days" value={String((salary.displayHalfDays ?? 0) + (salary.realHalfDays ?? 0))} />
              <Row label="Paid Leaves" value={String(salary.paidLeaves ?? 0)} />
              <Row label="Absent Days" value={String(salary.absentDays ?? 0)} danger />
              <Row label="Unpaid Leaves" value={String(salary.unpaidLeaves ?? 0)} danger />
              <Row label="Holidays" value={String(salary.holidays ?? 0)} />
              <Row label="Weekly Offs" value={String(salary.weeklyOffs ?? 0)} />
            </View>

            <View style={[styles.card]}>
              <Text style={styles.sectionTitle}>Salary Calculation</Text>
              <Row label="Gross Salary" value={salary.grossSalary != null ? `₹${Number(salary.grossSalary).toLocaleString('en-IN')}` : '—'} />
              <Row label="Per Day Salary" value={salary.perDaySalary != null ? `₹${Number(salary.perDaySalary).toFixed(2)}` : '—'} />
              {salary.hasDeduction && (
                <>
                  <Row label="Total Deduction Days" value={`— ${salary.deductionDays ?? 0}`} danger />
                  <Row label="Deduction Amount" value={salary.deductionAmount != null ? `— ₹${Number(salary.deductionAmount).toLocaleString('en-IN')}` : '—'} danger />
                </>
              )}
              {(salary.reimbursementTotal ?? 0) > 0 && (
                <Row label="Expense Reimbursement" value={`+ ₹${Number(salary.reimbursementTotal).toLocaleString('en-IN')}`} success />
              )}
              {salary.manualAdjustment != null && salary.manualAdjustment !== 0 && (
                <Row
                  label={`Manual Adjustment${salary.adjustmentNote ? ` (${salary.adjustmentNote})` : ''}`}
                  value={`${salary.manualAdjustment > 0 ? '+' : ''} ₹${Number(salary.manualAdjustment).toLocaleString('en-IN')}`}
                  success={salary.manualAdjustment > 0}
                  danger={salary.manualAdjustment < 0}
                />
              )}
              <View style={styles.netRow}>
                <Text style={styles.netLabel}>Net Salary</Text>
                <Text style={styles.netValue}>₹{salary.netSalary != null ? Number(salary.netSalary).toLocaleString('en-IN') : '—'}</Text>
              </View>
            </View>
          </View>
        ) : null}

        <View style={styles.bottomPad} />
      </ScrollView>

      {/* PIN Modal */}
      <Modal visible={showPinModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Payslip PIN required</Text>
            <Text style={styles.modalDesc}>Enter your payslip PIN to view or download your salary slip.</Text>
            <Text style={styles.inputLabel}>PIN (4–8 digits)</Text>
            <TextInput
              style={styles.input}
              placeholder="••••"
              placeholderTextColor={AppColors.textSecondary}
              value={pinInput}
              onChangeText={(v) => { setPinInput(v.replace(/\D/g, '').slice(0, 8)); setPinError(''); }}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={8}
            />
            {pinError ? <Text style={styles.pinError}>{pinError}</Text> : null}
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.primaryBtn} onPress={submitPin}>
                <Text style={styles.primaryBtnText}>Submit</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={() => { setShowPinModal(false); setPinInput(''); setPinError(''); }}
              >
                <Text style={styles.secondaryBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Row({ label, value, danger, success }: { label: string; value: string; danger?: boolean; success?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, danger && styles.rowValueDanger, success && styles.rowValueSuccess]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  safeTop: {},
  scroll: { flex: 1 },
  content: { padding: Spacing.xl, paddingBottom: Spacing.section },
  bottomPad: { height: Spacing.section },
  pageSubtitle: { fontSize: 15, color: AppColors.textSecondary, marginBottom: Spacing.lg },
  controls: { marginBottom: Spacing.xl },
  controlsContent: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  controlLabel: { fontSize: 13, fontWeight: '600', color: AppColors.textSecondary, marginRight: Spacing.sm, width: 44 },
  yearRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  exportBtn: {
    marginTop: Spacing.md,
    alignSelf: 'flex-start',
    height: 42,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: AppColors.tint,
    backgroundColor: AppColors.card,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  exportBtnDisabled: { opacity: 0.6 },
  exportBtnText: { fontSize: 14, fontWeight: '600', color: AppColors.tint },
  primaryActionBtn: {
    height: 42,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: AppColors.tint,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryActionBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  adminActionsRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md, flexWrap: 'wrap' },
  banner: {
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  bannerSuccess: { backgroundColor: `${AppColors.success}15` },
  bannerError: { backgroundColor: `${AppColors.danger}12` },
  bannerText: { fontSize: 14, fontWeight: '500' },
  bannerTextSuccess: { color: AppColors.success },
  bannerTextError: { color: AppColors.danger },
  chip: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.md, backgroundColor: 'rgba(118,118,128,0.12)' },
  chipActive: { backgroundColor: AppColors.tint },
  chipText: { fontSize: 14, fontWeight: '600', color: AppColors.text },
  chipTextActive: { color: '#fff' },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    backgroundColor: `${AppColors.danger}12`,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
  },
  errorText: { fontSize: 14, color: AppColors.danger, flex: 1 },
  muted: { fontSize: 14, color: AppColors.textSecondary },
  loadingWrap: { alignItems: 'center', paddingVertical: Spacing.xxl },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
    backgroundColor: AppColors.card,
    borderRadius: BorderRadius.xl,
    ...CardShadow,
  },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: AppColors.text, marginTop: Spacing.md },
  slip: {},
  adminHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm, gap: Spacing.sm },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: 10, borderWidth: 1, borderColor: AppColors.tint, borderRadius: BorderRadius.md, backgroundColor: AppColors.card },
  backBtnText: { fontSize: 14, fontWeight: '600', color: AppColors.tint },
  slipHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    ...CardShadow,
  },
  slipTitle: { fontSize: 18, fontWeight: '700', color: AppColors.text },
  slipSubtitle: { fontSize: 14, color: AppColors.textSecondary, marginTop: 2 },
  slipHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  pdfBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: 12 },
  pdfBtnText: { fontSize: 14, fontWeight: '600', color: AppColors.tint },
  adjustBtn: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: BorderRadius.sm, borderWidth: 1, borderColor: AppColors.tint },
  adjustBtnText: { fontSize: 13, fontWeight: '700', color: AppColors.tint },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusFinal: { backgroundColor: `${AppColors.success}20` },
  statusDraft: { backgroundColor: `${AppColors.warning}20` },
  statusText: { fontSize: 12, fontWeight: '600' },
  card: {
    backgroundColor: AppColors.card,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    ...CardShadow,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: AppColors.text, marginBottom: Spacing.md },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  rowLabel: { fontSize: 14, color: AppColors.textSecondary },
  rowValue: { fontSize: 14, fontWeight: '600', color: AppColors.text },
  rowValueDanger: { color: AppColors.danger },
  rowValueSuccess: { color: AppColors.success },
  netRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Spacing.md, paddingTop: Spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(60,60,67,0.12)' },
  netLabel: { fontSize: 16, fontWeight: '700', color: AppColors.text },
  netValue: { fontSize: 18, fontWeight: '700', color: AppColors.text },
  adminCard: {
    backgroundColor: AppColors.card,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    ...CardShadow,
  },
  adminCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.sm },
  adminName: { fontSize: 16, fontWeight: '700', color: AppColors.text },
  adminSub: { marginTop: 2, fontSize: 13, color: AppColors.textSecondary },
  adminAmounts: { marginTop: Spacing.sm, flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.sm, flexWrap: 'wrap' },
  adminAmountText: { fontSize: 13, color: AppColors.textSecondary },
  adminActionBtns: { marginTop: Spacing.md, flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
  smallBtn: { borderWidth: 1, borderColor: AppColors.tint, borderRadius: BorderRadius.sm, paddingHorizontal: 10, paddingVertical: 6 },
  smallBtnText: { color: AppColors.tint, fontSize: 13, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: Spacing.xl },
  modalContent: { backgroundColor: AppColors.card, borderRadius: BorderRadius.xl, padding: Spacing.xl },
  modalTitle: { fontSize: 18, fontWeight: '700', color: AppColors.text, marginBottom: 8 },
  modalDesc: { fontSize: 14, color: AppColors.textSecondary, marginBottom: Spacing.lg },
  inputLabel: { fontSize: 13, fontWeight: '600', color: AppColors.textSecondary, marginBottom: 6 },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: 'rgba(118,118,128,0.2)',
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    fontSize: 16,
    color: AppColors.text,
  },
  pinError: { fontSize: 13, color: AppColors.danger, marginBottom: Spacing.sm },
  modalActions: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.lg },
  primaryBtn: { flex: 1, height: 48, borderRadius: BorderRadius.md, backgroundColor: AppColors.tint, justifyContent: 'center', alignItems: 'center' },
  primaryBtnText: { fontSize: 17, fontWeight: '600', color: '#fff' },
  secondaryBtn: { flex: 1, height: 48, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: AppColors.tint, justifyContent: 'center', alignItems: 'center' },
  secondaryBtnText: { fontSize: 17, fontWeight: '600', color: AppColors.tint },
});
