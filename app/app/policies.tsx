import React, { useEffect, useState, useCallback } from 'react';
import {
  ScrollView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  RefreshControl,
  Linking,
  Platform,
  SafeAreaView,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Switch,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Spacing, BorderRadius, AppColors, CardShadow } from '@/constants/theme';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

const CATEGORIES = ['LEAVE_POLICY', 'WFH_POLICY', 'CODE_OF_CONDUCT', 'IT_POLICY', 'SAFETY_POLICY', 'HR_POLICY', 'FINANCE_POLICY', 'OTHER'];
const CATEGORY_LABELS: Record<string, string> = {
  LEAVE_POLICY: 'Leave Policy',
  WFH_POLICY: 'WFH Policy',
  CODE_OF_CONDUCT: 'Code of Conduct',
  IT_POLICY: 'IT Policy',
  SAFETY_POLICY: 'Safety Policy',
  HR_POLICY: 'HR Policy',
  FINANCE_POLICY: 'Finance Policy',
  OTHER: 'Other',
};
const POLICY_FILE_TYPES = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/jpeg', 'image/png'];

const CATEGORY_COLORS: Record<string, { bg: string; color: string }> = {
  LEAVE_POLICY: { bg: '#dbeafe', color: '#2563eb' },
  WFH_POLICY: { bg: '#e0e7ff', color: '#4338ca' },
  CODE_OF_CONDUCT: { bg: '#fef3c7', color: '#b45309' },
  IT_POLICY: { bg: '#d1fae5', color: '#047857' },
  SAFETY_POLICY: { bg: '#fed7aa', color: '#c2410c' },
  HR_POLICY: { bg: '#ede9fe', color: '#6d28d9' },
  FINANCE_POLICY: { bg: '#cffafe', color: '#0e7490' },
  OTHER: { bg: '#f3f4f6', color: '#4b5563' },
};

type Policy = {
  _id: string;
  title: string;
  summary?: string;
  description?: string;
  category?: string;
  isMandatory?: boolean;
  isActive?: boolean;
  fileUrl?: string;
  version?: string | number;
  effectiveDate?: string;
  expiryDate?: string;
  fileSize?: number;
  uploadedBy?: { name: string };
  acknowledgments?: Array<{ employee: string | { _id?: string; name?: string }; acknowledgedAt?: string }>;
  acknowledgmentCount?: number;
};

function fmt(d: string | undefined): string {
  return d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
}

function formatBytes(b: number | undefined): string {
  if (b == null) return '—';
  if (b < 1024) return b + ' B';
  if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB';
  return (b / (1024 * 1024)).toFixed(1) + ' MB';
}

function EmployeePoliciesView() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [acknowledging, setAcknowledging] = useState<string | null>(null);
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'ACKNOWLEDGED'>('ALL');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const load = async () => {
    try {
      const { data } = await api.get<{ data: Policy[] }>('/policies/active');
      setPolicies(data.data ?? []);
    } catch {
      setPolicies([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);

  const isAcknowledged = (p: Policy) =>
    p.acknowledgments?.some((a) => {
      const id = a.employee && typeof a.employee === 'object' ? (a.employee as { _id?: string })._id : a.employee;
      return id?.toString() === user?._id;
    });

  const acknowledged = policies.filter(isAcknowledged);
  const pending = policies.filter((p) => p.isMandatory && !isAcknowledged(p));
  const filtered =
    filter === 'PENDING' ? pending : filter === 'ACKNOWLEDGED' ? acknowledged : policies;

  const acknowledge = async (id: string) => {
    setAcknowledging(id);
    setMsg(null);
    try {
      await api.post(`/policies/${id}/acknowledge`);
      setMsg({ type: 'success', text: 'Policy acknowledged successfully!' });
      load();
    } catch (e: unknown) {
      const text = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to acknowledge.';
      setMsg({ type: 'error', text });
    } finally {
      setAcknowledging(null);
    }
  };

  const viewPolicy = (p: Policy) => {
    const url = p.fileUrl;
    if (!url) return;
    Linking.canOpenURL(url).then((ok) => {
      if (ok) {
        Linking.openURL(url).catch(() => Alert.alert('Open', 'Could not open this document on this device.'));
      }
      else Alert.alert('Open', 'Cannot open this document.');
    }).catch(() => Alert.alert('Error', 'Could not open document.'));
  };

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => (prev === id ? null : id));
  };

  return (
    <View style={[styles.screen, { backgroundColor: AppColors.background }]}>
      <SafeAreaView style={styles.safeTop}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <MaterialIcons name={Platform.OS === 'ios' ? 'arrow-back-ios' : 'arrow-back'} size={Platform.OS === 'ios' ? 22 : 24} color={AppColors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Policies</Text>
          <View style={styles.backBtn} />
        </View>
      </SafeAreaView>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={AppColors.tint} />}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.pageSubtitle}>Read and acknowledge company policy documents</Text>

        {pending.length > 0 && (
          <View style={styles.pendingBanner}>
            <MaterialIcons name="warning" size={18} color={AppColors.danger} />
            <Text style={styles.pendingText}>{pending.length} pending acknowledgment{pending.length !== 1 ? 's' : ''}</Text>
          </View>
        )}

        {msg && (
          <View style={[styles.msgBanner, msg.type === 'success' ? styles.msgSuccess : styles.msgError]}>
            <Text style={[styles.msgText, { color: msg.type === 'success' ? AppColors.success : AppColors.danger }]}>{msg.text}</Text>
          </View>
        )}

        <View style={styles.filterRow}>
          {(['ALL', 'PENDING', 'ACKNOWLEDGED'] as const).map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.filterChip, filter === f && styles.filterChipActive]}
              onPress={() => setFilter(f)}
            >
              <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
                {f === 'ALL' ? `All (${policies.length})` : f === 'PENDING' ? `Pending (${pending.length})` : `Acknowledged (${acknowledged.length})`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={AppColors.tint} />
            <Text style={styles.muted}>Loading policies…</Text>
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.emptyCard}>
            <MaterialIcons name="menu-book" size={48} color={AppColors.textSecondary} />
            <Text style={styles.emptyText}>No policies found</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {filtered.map((p) => {
              const acked = isAcknowledged(p);
              const isOpen = expanded === p._id;
              const catColor = (p.category && CATEGORY_COLORS[p.category]) ? CATEGORY_COLORS[p.category] : CATEGORY_COLORS.OTHER;
              return (
                <View
                  key={p._id}
                  style={[
                    styles.card,
                    acked && styles.cardAcked,
                    p.isMandatory && !acked && styles.cardMandatory,
                  ]}
                >
                  <TouchableOpacity
                    style={styles.cardRow}
                    onPress={() => toggleExpanded(p._id)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.cardRowLeft}>
                      <View style={[styles.iconWrap, { backgroundColor: catColor.bg }]}>
                        <MaterialIcons name="description" size={22} color={catColor.color} />
                      </View>
                      <View style={styles.cardRowText}>
                        <Text style={styles.title}>{p.title}</Text>
                        <View style={styles.badges}>
                          {p.category && (
                            <View style={[styles.categoryBadge, { backgroundColor: catColor.bg }]}>
                              <Text style={[styles.categoryText, { color: catColor.color }]}>{CATEGORY_LABELS[p.category] ?? p.category}</Text>
                            </View>
                          )}
                          {p.isMandatory && (
                            <View style={styles.mandatoryBadge}>
                              <Text style={styles.mandatoryText}>Mandatory</Text>
                            </View>
                          )}
                          {p.version != null && (
                            <Text style={styles.versionText}>v{p.version}</Text>
                          )}
                        </View>
                      </View>
                    </View>
                    <View style={styles.cardRowRight}>
                      {acked ? (
                        <View style={styles.statusAcked}>
                          <MaterialIcons name="check" size={16} color={AppColors.success} />
                          <Text style={styles.statusAckedText}>Acknowledged</Text>
                        </View>
                      ) : p.isMandatory ? (
                        <View style={styles.statusPending}>
                          <MaterialIcons name="schedule" size={16} color={AppColors.warning} />
                          <Text style={styles.statusPendingText}>Pending</Text>
                        </View>
                      ) : null}
                      <MaterialIcons name={isOpen ? 'expand-less' : 'expand-more'} size={24} color={AppColors.textSecondary} />
                    </View>
                  </TouchableOpacity>

                  {isOpen && (
                    <View style={styles.expanded}>
                      {(p.description ?? p.summary) ? (
                        <Text style={styles.description}>{p.description ?? p.summary}</Text>
                      ) : null}
                      <View style={styles.metaRow}>
                        <Text style={styles.metaText}>Effective: {fmt(p.effectiveDate)}</Text>
                        {p.expiryDate ? <Text style={styles.metaText}>Expires: {fmt(p.expiryDate)}</Text> : null}
                        <Text style={styles.metaText}>Size: {formatBytes(p.fileSize)}</Text>
                        <Text style={styles.metaText}>Uploaded by: {p.uploadedBy?.name ?? '—'}</Text>
                      </View>
                      <View style={styles.actions}>
                        {p.fileUrl && (
                          <TouchableOpacity style={styles.viewBtn} onPress={() => viewPolicy(p)}>
                            <MaterialIcons name="open-in-new" size={16} color="#fff" />
                            <Text style={styles.viewBtnText}>View Document</Text>
                          </TouchableOpacity>
                        )}
                        {!acked ? (
                          <TouchableOpacity
                            style={[styles.ackBtn, acknowledging === p._id && styles.ackBtnDisabled]}
                            onPress={() => acknowledge(p._id)}
                            disabled={acknowledging === p._id}
                          >
                            {acknowledging === p._id ? (
                              <ActivityIndicator size="small" color="#fff" />
                            ) : (
                              <>
                                <MaterialIcons name="check" size={16} color="#fff" />
                                <Text style={styles.ackBtnText}>I have read & acknowledge this policy</Text>
                              </>
                            )}
                          </TouchableOpacity>
                        ) : (
                          <View style={styles.doneBadge}>
                            <MaterialIcons name="check-circle" size={18} color={AppColors.success} />
                            <Text style={styles.doneText}>Acknowledged</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  )}
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

type PolicyStats = { totalPolicies?: number; activePolicies?: number; mandatoryPolicies?: number; activeEmployees?: number; overallComplianceRate?: number };
type PendingEmployee = { _id: string; name?: string; employeeId?: string; designation?: string };

function AdminPoliciesView() {
  const router = useRouter();
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [stats, setStats] = useState<PolicyStats>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [filterActive, setFilterActive] = useState<string>('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showPendingId, setShowPendingId] = useState<string | null>(null);
  const [pendingList, setPendingList] = useState<PendingEmployee[]>([]);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    category: 'OTHER',
    version: '1.0',
    targetAudience: 'ALL',
    effectiveDate: new Date().toISOString().slice(0, 10),
    expiryDate: '',
    isMandatory: true,
  });
  const [uploadFile, setUploadFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (searchTerm.trim()) params.set('search', searchTerm.trim());
      if (filterCategory) params.set('category', filterCategory);
      if (filterActive === 'true') params.set('isActive', 'true');
      if (filterActive === 'false') params.set('isActive', 'false');
      const [pRes, sRes] = await Promise.all([
        api.get<{ data: Policy[] }>(`/policies?${params.toString()}`),
        api.get<{ data: PolicyStats }>('/policies/stats'),
      ]);
      setPolicies(pRes.data.data ?? []);
      setStats(sRes.data.data ?? {});
    } catch {
      setPolicies([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [searchTerm, filterCategory, filterActive]);

  useEffect(() => { load(); }, [load]);

  const pickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: POLICY_FILE_TYPES,
        copyToCacheDirectory: true,
      });
      if (!result.canceled) setUploadFile(result.assets[0]);
    } catch {
      Alert.alert('Error', 'Could not pick file.');
    }
  };

  const submitUpload = async () => {
    if (!form.title.trim()) return setMsg({ type: 'error', text: 'Title is required.' });
    if (!uploadFile) return setMsg({ type: 'error', text: 'Please select a file.' });
    setUploading(true);
    setMsg(null);
    try {
      const formData = new FormData();
      const uri = uploadFile.uri;
      formData.append('file', {
        uri: Platform.OS === 'android' && !uri.startsWith('file://') ? `file://${uri}` : uri,
        name: uploadFile.name ?? 'document',
        type: uploadFile.mimeType ?? 'application/octet-stream',
      } as unknown as Blob);
      formData.append('title', form.title.trim());
      formData.append('description', form.description.trim());
      formData.append('category', form.category);
      formData.append('version', form.version.trim());
      formData.append('targetAudience', form.targetAudience);
      formData.append('isMandatory', String(form.isMandatory));
      formData.append('effectiveDate', form.effectiveDate || new Date().toISOString().slice(0, 10));
      if (form.expiryDate) formData.append('expiryDate', form.expiryDate);
      await api.post('/policies', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setMsg({ type: 'success', text: 'Policy uploaded successfully.' });
      setShowUpload(false);
      setForm({ title: '', description: '', category: 'OTHER', version: '1.0', targetAudience: 'ALL', effectiveDate: new Date().toISOString().slice(0, 10), expiryDate: '', isMandatory: true });
      setUploadFile(null);
      load();
    } catch (e: unknown) {
      const text = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Upload failed.';
      setMsg({ type: 'error', text });
    } finally {
      setUploading(false);
    }
  };

  const viewPolicy = (p: Policy) => {
    const url = p.fileUrl;
    if (!url) return;
    Linking.canOpenURL(url).then((ok) => {
      if (ok) {
        Linking.openURL(url).catch(() => Alert.alert('Open', 'Could not open this document on this device.'));
      } else {
        Alert.alert('Open', 'Cannot open this document.');
      }
    }).catch(() => Alert.alert('Error', 'Could not open document.'));
  };

  const loadPending = async (id: string) => {
    if (showPendingId === id) { setShowPendingId(null); setPendingList([]); return; }
    setShowPendingId(id);
    setPendingLoading(true);
    try {
      const { data } = await api.get<{ data: PendingEmployee[] }>(`/policies/${id}/pending`);
      setPendingList(data.data ?? []);
    } catch {
      setPendingList([]);
    } finally {
      setPendingLoading(false);
    }
  };

  const toggleActive = async (p: Policy) => {
    const next = !p.isActive;
    try {
      await api.patch(`/policies/${p._id}`, { isActive: next });
      setMsg({ type: 'success', text: next ? 'Policy activated.' : 'Policy deactivated.' });
      load();
    } catch (e: unknown) {
      const text = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to update.';
      setMsg({ type: 'error', text });
    }
  };

  const deletePolicy = (p: Policy) => {
    Alert.alert('Delete Policy', `Delete "${p.title}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/policies/${p._id}`);
            setMsg({ type: 'success', text: 'Policy deleted.' });
            load();
          } catch (e: unknown) {
            const text = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Delete failed.';
            setMsg({ type: 'error', text });
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
          <Text style={styles.headerTitle}>Policies (Admin)</Text>
          <TouchableOpacity style={styles.headerBtn} onPress={() => setShowUpload(true)}>
            <MaterialIcons name="upload-file" size={24} color={AppColors.tint} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={AppColors.tint} />}
        showsVerticalScrollIndicator={false}
      >
        {msg && (
          <View style={[styles.msgBanner, msg.type === 'success' ? styles.msgSuccess : styles.msgError]}>
            <Text style={[styles.msgText, { color: msg.type === 'success' ? AppColors.success : AppColors.danger }]}>{msg.text}</Text>
          </View>
        )}

        <View style={styles.statsRow}>
          <View style={styles.statCard}><Text style={styles.statValue}>{stats.totalPolicies ?? 0}</Text><Text style={styles.statLabel}>Total</Text></View>
          <View style={styles.statCard}><Text style={styles.statValue}>{stats.activePolicies ?? 0}</Text><Text style={styles.statLabel}>Active</Text></View>
          <View style={styles.statCard}><Text style={styles.statValue}>{stats.mandatoryPolicies ?? 0}</Text><Text style={styles.statLabel}>Mandatory</Text></View>
          <View style={styles.statCard}><Text style={styles.statValue}>{stats.overallComplianceRate ?? 0}%</Text><Text style={styles.statLabel}>Compliance</Text></View>
        </View>

        <TextInput
          style={styles.searchInput}
          placeholder="Search policies..."
          placeholderTextColor={AppColors.textSecondary}
          value={searchTerm}
          onChangeText={setSearchTerm}
        />
        <View style={styles.filterRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
            <TouchableOpacity style={[styles.filterChip, !filterCategory && styles.filterChipActive]} onPress={() => setFilterCategory('')}>
              <Text style={[styles.filterText, !filterCategory && styles.filterTextActive]}>All categories</Text>
            </TouchableOpacity>
            {CATEGORIES.map((c) => (
              <TouchableOpacity key={c} style={[styles.filterChip, filterCategory === c && styles.filterChipActive]} onPress={() => setFilterCategory(c)}>
                <Text style={[styles.filterText, filterCategory === c && styles.filterTextActive]}>{CATEGORY_LABELS[c]}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
        <View style={styles.filterRow}>
          {(['', 'true', 'false'] as const).map((v) => (
            <TouchableOpacity key={v || 'all'} style={[styles.filterChip, filterActive === v && styles.filterChipActive]} onPress={() => setFilterActive(v)}>
              <Text style={[styles.filterText, filterActive === v && styles.filterTextActive]}>{v === '' ? 'All' : v === 'true' ? 'Active' : 'Inactive'}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={AppColors.tint} />
            <Text style={styles.muted}>Loading…</Text>
          </View>
        ) : policies.length === 0 ? (
          <View style={styles.emptyCard}>
            <MaterialIcons name="menu-book" size={48} color={AppColors.textSecondary} />
            <Text style={styles.emptyText}>No policies found</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {policies.map((p) => {
              const isOpen = expanded === p._id;
              const catColor = (p.category && CATEGORY_COLORS[p.category]) ? CATEGORY_COLORS[p.category] : CATEGORY_COLORS.OTHER;
              const ackCount = p.acknowledgmentCount ?? p.acknowledgments?.length ?? 0;
              const showPending = showPendingId === p._id;
              return (
                <View key={p._id} style={styles.card}>
                  <TouchableOpacity style={styles.cardRow} onPress={() => setExpanded((prev) => (prev === p._id ? null : p._id))} activeOpacity={0.8}>
                    <View style={styles.cardRowLeft}>
                      <View style={[styles.iconWrap, { backgroundColor: catColor.bg }]}>
                        <MaterialIcons name="description" size={22} color={catColor.color} />
                      </View>
                      <View style={styles.cardRowText}>
                        <Text style={styles.title}>{p.title}</Text>
                        <View style={styles.badges}>
                          {p.category && (
                            <View style={[styles.categoryBadge, { backgroundColor: catColor.bg }]}>
                              <Text style={[styles.categoryText, { color: catColor.color }]}>{CATEGORY_LABELS[p.category] ?? p.category}</Text>
                            </View>
                          )}
                          {p.isMandatory && <View style={styles.mandatoryBadge}><Text style={styles.mandatoryText}>Mandatory</Text></View>}
                          {p.isActive === false && <View style={[styles.categoryBadge, { backgroundColor: '#fee2e2' }]}><Text style={[styles.categoryText, { color: '#b91c1c' }]}>Inactive</Text></View>}
                          {p.version != null && <Text style={styles.versionText}>v{p.version}</Text>}
                        </View>
                      </View>
                    </View>
                    <MaterialIcons name={isOpen ? 'expand-less' : 'expand-more'} size={24} color={AppColors.textSecondary} />
                  </TouchableOpacity>
                  {isOpen && (
                    <View style={styles.expanded}>
                      {(p.description ?? p.summary) ? <Text style={styles.description}>{p.description ?? p.summary}</Text> : null}
                      <View style={styles.metaRow}>
                        <Text style={styles.metaText}>Effective: {fmt(p.effectiveDate)}</Text>
                        {p.expiryDate ? <Text style={styles.metaText}>Expires: {fmt(p.expiryDate)}</Text> : null}
                        <Text style={styles.metaText}>Size: {formatBytes(p.fileSize)}</Text>
                        <Text style={styles.metaText}>Uploaded by: {p.uploadedBy?.name ?? '—'}</Text>
                      </View>
                      {p.isMandatory && (
                        <View style={styles.progressWrap}>
                          <Text style={styles.metaText}>Acknowledged: {ackCount} employees</Text>
                        </View>
                      )}
                      <View style={styles.actions}>
                        {p.fileUrl && (
                          <TouchableOpacity style={styles.viewBtn} onPress={() => viewPolicy(p)}>
                            <MaterialIcons name="open-in-new" size={16} color="#fff" />
                            <Text style={styles.viewBtnText}>View</Text>
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity style={styles.viewBtnSecondary} onPress={() => loadPending(p._id)}>
                          {pendingLoading && showPending ? <ActivityIndicator size="small" color={AppColors.tint} /> : <MaterialIcons name="people-outline" size={16} color={AppColors.tint} />}
                          <Text style={styles.viewBtnSecondaryText}>View Pending</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.viewBtnSecondary, { borderColor: AppColors.success }]} onPress={() => toggleActive(p)}>
                          <MaterialIcons name={p.isActive ? 'visibility-off' : 'visibility'} size={16} color={AppColors.success} />
                          <Text style={[styles.viewBtnSecondaryText, { color: AppColors.success }]}>{p.isActive ? 'Deactivate' : 'Activate'}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.viewBtnSecondary, { borderColor: AppColors.danger }]} onPress={() => deletePolicy(p)}>
                          <MaterialIcons name="delete-outline" size={16} color={AppColors.danger} />
                          <Text style={[styles.viewBtnSecondaryText, { color: AppColors.danger }]}>Delete</Text>
                        </TouchableOpacity>
                      </View>
                      {showPending && (
                        <View style={styles.pendingList}>
                          <Text style={styles.pendingListTitle}>Employees who haven&apos;t acknowledged</Text>
                          {pendingList.length === 0 ? <Text style={styles.metaText}>None</Text> : pendingList.slice(0, 20).map((e) => <Text key={e._id} style={styles.pendingItem}>{e.name ?? '—'} ({e.employeeId ?? e._id})</Text>)}
                          {pendingList.length > 20 && <Text style={styles.metaText}>… and {pendingList.length - 20} more</Text>}
                        </View>
                      )}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}
        <View style={styles.bottomPad} />
      </ScrollView>

      <Modal visible={showUpload} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Upload Policy</Text>
              <TouchableOpacity onPress={() => !uploading && setShowUpload(false)}><MaterialIcons name="close" size={24} color={AppColors.text} /></TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>Title *</Text>
              <TextInput style={styles.input} placeholder="Policy title" placeholderTextColor={AppColors.textSecondary} value={form.title} onChangeText={(t) => setForm((f) => ({ ...f, title: t }))} />
              <Text style={styles.inputLabel}>Category</Text>
              <View style={styles.chipRow}>
                {CATEGORIES.map((c) => (
                  <TouchableOpacity key={c} style={[styles.formChip, form.category === c && styles.formChipActive]} onPress={() => setForm((f) => ({ ...f, category: c }))}>
                    <Text style={[styles.formChipText, form.category === c && styles.formChipTextActive]}>{CATEGORY_LABELS[c]}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.inputLabel}>Version</Text>
              <TextInput style={styles.input} placeholder="1.0" value={form.version} onChangeText={(t) => setForm((f) => ({ ...f, version: t }))} />
              <Text style={styles.inputLabel}>Target audience</Text>
              <View style={styles.chipRow}>
                {(['ALL', 'DEPARTMENT', 'BRANCH'] as const).map((a) => (
                  <TouchableOpacity key={a} style={[styles.formChip, form.targetAudience === a && styles.formChipActive]} onPress={() => setForm((f) => ({ ...f, targetAudience: a }))}>
                    <Text style={[styles.formChipText, form.targetAudience === a && styles.formChipTextActive]}>{a}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.inputLabel}>Effective date</Text>
              <TextInput style={styles.input} value={form.effectiveDate} onChangeText={(t) => setForm((f) => ({ ...f, effectiveDate: t }))} placeholder="YYYY-MM-DD" placeholderTextColor={AppColors.textSecondary} />
              <Text style={styles.inputLabel}>Expiry date (optional)</Text>
              <TextInput style={styles.input} value={form.expiryDate} onChangeText={(t) => setForm((f) => ({ ...f, expiryDate: t }))} placeholder="YYYY-MM-DD" placeholderTextColor={AppColors.textSecondary} />
              <Text style={styles.inputLabel}>File *</Text>
              <TouchableOpacity style={styles.fileBtn} onPress={pickFile}>
                <MaterialIcons name="attach-file" size={20} color={AppColors.tint} />
                <Text style={styles.fileBtnText}>{uploadFile ? uploadFile.name : 'Choose PDF, DOC, DOCX, JPG or PNG'}</Text>
              </TouchableOpacity>
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Mandatory</Text>
                <Switch value={form.isMandatory} onValueChange={(v) => setForm((f) => ({ ...f, isMandatory: v }))} trackColor={{ false: '#ccc', true: AppColors.tint }} thumbColor="#fff" />
              </View>
              <Text style={styles.inputLabel}>Description (optional)</Text>
              <TextInput style={[styles.input, styles.inputArea]} placeholder="Description" placeholderTextColor={AppColors.textSecondary} value={form.description} onChangeText={(t) => setForm((f) => ({ ...f, description: t }))} multiline numberOfLines={3} />
              <TouchableOpacity style={[styles.submitBtn, uploading && styles.submitBtnDisabled]} onPress={submitUpload} disabled={uploading}>
                {uploading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.submitBtnText}>Upload Policy</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

export default function PoliciesScreen() {
  const getRole = useAuthStore((s) => s.getRole);
  const role = getRole();
  const isAdmin = ['HR', 'DIRECTOR', 'SUPER_ADMIN'].includes(role ?? '');
  if (isAdmin) return <AdminPoliciesView />;
  return <EmployeePoliciesView />;
}

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
  headerBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'flex-end' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: AppColors.text },
  scroll: { flex: 1 },
  statsRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg, flexWrap: 'wrap' },
  statCard: { flex: 1, minWidth: 72, backgroundColor: AppColors.card, borderRadius: BorderRadius.md, padding: Spacing.md, alignItems: 'center', ...CardShadow },
  statValue: { fontSize: 20, fontWeight: '700', color: AppColors.text },
  statLabel: { fontSize: 12, color: AppColors.textSecondary, marginTop: 4 },
  searchInput: { backgroundColor: AppColors.card, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, fontSize: 16, color: AppColors.text, marginBottom: Spacing.md },
  filterScroll: { gap: Spacing.sm, paddingBottom: 4 },
  content: { padding: Spacing.xl, paddingBottom: Spacing.section },
  bottomPad: { height: Spacing.section },
  pageSubtitle: { fontSize: 15, color: AppColors.textSecondary, marginBottom: Spacing.lg },
  muted: { fontSize: 15, color: AppColors.textSecondary, marginTop: Spacing.sm },
  loadingWrap: { alignItems: 'center', paddingVertical: Spacing.xxl },
  pendingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    backgroundColor: `${AppColors.danger}12`,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
  },
  pendingText: { fontSize: 14, fontWeight: '600', color: AppColors.danger },
  msgBanner: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
  },
  msgSuccess: { backgroundColor: `${AppColors.success}18` },
  msgError: { backgroundColor: `${AppColors.danger}12` },
  msgText: { fontSize: 14, fontWeight: '500' },
  filterRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.xl, flexWrap: 'wrap' },
  filterChip: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.md, backgroundColor: 'rgba(118,118,128,0.12)' },
  filterChipActive: { backgroundColor: AppColors.tint },
  filterText: { fontSize: 14, fontWeight: '600', color: AppColors.text },
  filterTextActive: { color: '#fff' },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
    backgroundColor: AppColors.card,
    borderRadius: BorderRadius.xl,
    ...CardShadow,
  },
  emptyText: { fontSize: 17, fontWeight: '600', color: AppColors.text, marginTop: Spacing.md },
  list: { gap: Spacing.lg },
  card: {
    backgroundColor: AppColors.card,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
    ...CardShadow,
  },
  cardAcked: { borderColor: AppColors.success },
  cardMandatory: { borderColor: AppColors.warning },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  cardRowLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.md, minWidth: 0 },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardRowText: { flex: 1, minWidth: 0 },
  title: { fontSize: 17, fontWeight: '600', color: AppColors.text, marginBottom: 4 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Spacing.sm },
  categoryBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  categoryText: { fontSize: 12, fontWeight: '600' },
  mandatoryBadge: { backgroundColor: `${AppColors.danger}15`, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  mandatoryText: { fontSize: 12, fontWeight: '600', color: AppColors.danger },
  versionText: { fontSize: 12, color: AppColors.textSecondary },
  cardRowRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  statusAcked: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statusAckedText: { fontSize: 13, fontWeight: '600', color: AppColors.success },
  statusPending: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statusPendingText: { fontSize: 13, fontWeight: '600', color: AppColors.warning },
  expanded: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(60,60,67,0.12)',
    padding: Spacing.lg,
  },
  description: { fontSize: 14, color: AppColors.textSecondary, lineHeight: 22, marginBottom: Spacing.md },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.lg, marginBottom: Spacing.md },
  metaText: { fontSize: 13, color: AppColors.textSecondary },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, alignItems: 'center' },
  viewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    backgroundColor: AppColors.tint,
  },
  viewBtnText: { fontSize: 15, fontWeight: '600', color: '#fff' },
  viewBtnSecondary: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: AppColors.tint },
  viewBtnSecondaryText: { fontSize: 14, fontWeight: '600', color: AppColors.tint },
  progressWrap: { marginBottom: Spacing.md },
  pendingList: { marginTop: Spacing.md, paddingTop: Spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(60,60,67,0.12)' },
  pendingListTitle: { fontSize: 14, fontWeight: '600', color: AppColors.text, marginBottom: Spacing.sm },
  pendingItem: { fontSize: 13, color: AppColors.textSecondary, marginBottom: 2 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: AppColors.background, borderTopLeftRadius: BorderRadius.xl, borderTopRightRadius: BorderRadius.xl, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.lg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(60,60,67,0.12)' },
  modalTitle: { fontSize: 18, fontWeight: '700', color: AppColors.text },
  modalScroll: { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  inputLabel: { fontSize: 14, fontWeight: '600', color: AppColors.text, marginBottom: 6, marginTop: Spacing.sm },
  input: { backgroundColor: AppColors.card, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, fontSize: 16, color: AppColors.text },
  inputArea: { minHeight: 80, textAlignVertical: 'top' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.sm },
  formChip: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.md, backgroundColor: 'rgba(118,118,128,0.12)' },
  formChipActive: { backgroundColor: AppColors.tint },
  formChipText: { fontSize: 14, fontWeight: '600', color: AppColors.text },
  formChipTextActive: { color: '#fff' },
  fileBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md, backgroundColor: AppColors.card, borderRadius: BorderRadius.md, marginBottom: Spacing.sm },
  fileBtnText: { fontSize: 15, color: AppColors.textSecondary, flex: 1 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md },
  switchLabel: { fontSize: 16, color: AppColors.text },
  submitBtn: { backgroundColor: AppColors.tint, borderRadius: BorderRadius.md, paddingVertical: Spacing.md, alignItems: 'center', marginTop: Spacing.lg },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  ackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    backgroundColor: AppColors.success,
  },
  ackBtnDisabled: { opacity: 0.6 },
  ackBtnText: { fontSize: 15, fontWeight: '600', color: '#fff' },
  doneBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  doneText: { fontSize: 14, fontWeight: '600', color: AppColors.success },
});
