import React, { useEffect, useState } from 'react';
import { ScrollView, View, Text, StyleSheet, RefreshControl, TouchableOpacity, Linking, Alert, SafeAreaView, Platform, Modal, TextInput, KeyboardAvoidingView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Spacing, BorderRadius, AppColors, CardShadow } from '@/constants/theme';
import api from '@/lib/api';

const DOC_TYPES = [
  { value: 'OFFER_LETTER', label: 'Offer Letter' },
  { value: 'ID_PROOF', label: 'ID Proof' },
  { value: 'CERTIFICATE', label: 'Certificate' },
  { value: 'CONTRACT', label: 'Contract' },
  { value: 'PAYSLIP', label: 'Payslip' },
  { value: 'OTHER', label: 'Other' },
];

const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  OFFER_LETTER: { bg: '#dbeafe', text: '#2563eb' },
  ID_PROOF: { bg: '#fef3c7', text: '#d97706' },
  CERTIFICATE: { bg: '#dcfce7', text: '#16a34a' },
  CONTRACT: { bg: '#f3e8ff', text: '#7c3aed' },
  PAYSLIP: { bg: '#ffedd5', text: '#ea580c' },
  OTHER: { bg: '#f3f4f6', text: '#374151' },
};

function formatSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type Doc = {
  _id: string;
  name: string;
  type?: string;
  createdAt: string;
  fileUrl?: string;
  fileSize?: number;
  mimeType?: string;
  uploadedBy?: { name?: string };
};

const DOC_MIME = ['application/pdf', 'image/jpeg', 'image/png', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

export default function DocumentsScreen() {
  const router = useRouter();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterType, setFilterType] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadName, setUploadName] = useState('');
  const [uploadType, setUploadType] = useState('OTHER');
  const [uploadFile, setUploadFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState('');

  const load = async () => {
    try {
      const { data } = await api.get<{ data: Doc[] }>('/documents/my');
      setDocs(data.data ?? []);
    } catch {
      setDocs([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = filterType
    ? docs.filter((d) => (d.type ?? 'OTHER') === filterType)
    : docs;

  const openDoc = (d: Doc) => {
    const url = d.fileUrl;
    if (!url) return;
    Linking.canOpenURL(url).then((ok) => {
      if (ok) {
        Linking.openURL(url).catch(() => Alert.alert('Open link', 'Could not open this document on this device.'));
      }
      else Alert.alert('Open link', 'Cannot open this document.');
    }).catch(() => Alert.alert('Error', 'Could not open document.'));
  };

  const getDocIcon = (d: Doc): 'image' | 'insert-drive-file' | 'description' => {
    const m = d.mimeType ?? '';
    if (m.startsWith('image/')) return 'image';
    if (m === 'application/pdf') return 'insert-drive-file';
    return 'description';
  };

  const getDocIconBg = (d: Doc) => {
    const m = d.mimeType ?? '';
    if (m.startsWith('image/')) return '#dbeafe';
    if (m === 'application/pdf') return '#fee2e2';
    return `${AppColors.tint}18`;
  };

  const typeColor = (type?: string) => TYPE_COLORS[type ?? 'OTHER'] ?? TYPE_COLORS.OTHER;
  const typeLabel = (type?: string) => DOC_TYPES.find((t) => t.value === type)?.label ?? type ?? 'Document';

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: DOC_MIME,
        copyToCacheDirectory: true,
      });
      if (!result.canceled) setUploadFile(result.assets[0]);
    } catch {
      Alert.alert('Error', 'Could not pick file.');
    }
  };

  const submitUpload = async () => {
    if (!uploadName.trim()) return setUploadMsg('Enter document name.');
    if (!uploadFile) return setUploadMsg('Select a file.');
    setUploading(true);
    setUploadMsg('');
    try {
      const formData = new FormData();
      const uri = uploadFile.uri;
      formData.append('file', {
        uri: Platform.OS === 'android' && !uri.startsWith('file://') ? `file://${uri}` : uri,
        name: uploadFile.name ?? 'document',
        type: uploadFile.mimeType ?? 'application/octet-stream',
      } as unknown as Blob);
      formData.append('name', uploadName.trim());
      formData.append('type', uploadType);
      await api.post('/documents', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setShowUpload(false);
      setUploadName('');
      setUploadType('OTHER');
      setUploadFile(null);
      load();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Upload failed.';
      setUploadMsg(msg);
    } finally {
      setUploading(false);
    }
  };

  const closeUpload = () => {
    if (!uploading) {
      setShowUpload(false);
      setUploadMsg('');
      setUploadName('');
      setUploadType('OTHER');
      setUploadFile(null);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: AppColors.background }]}>
      <SafeAreaView style={styles.safeTop}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <MaterialIcons name={Platform.OS === 'ios' ? 'arrow-back-ios' : 'arrow-back'} size={Platform.OS === 'ios' ? 22 : 24} color={AppColors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Documents</Text>
          <TouchableOpacity style={styles.headerAction} onPress={() => setShowUpload(true)}>
            <MaterialIcons name="upload-file" size={24} color={AppColors.tint} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <Modal visible={showUpload} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalContent}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Upload Document</Text>
              {uploadMsg ? <Text style={styles.uploadError}>{uploadMsg}</Text> : null}
              <Text style={styles.inputLabel}>Document name *</Text>
              <TextInput
                style={styles.input}
                value={uploadName}
                onChangeText={setUploadName}
                placeholder="e.g. Aadhaar Card, Offer Letter"
                placeholderTextColor={AppColors.textSecondary}
                editable={!uploading}
              />
              <Text style={styles.inputLabel}>Type</Text>
              <View style={styles.typeRow}>
                {DOC_TYPES.map((t) => (
                  <TouchableOpacity
                    key={t.value}
                    style={[styles.typeChip, uploadType === t.value && styles.typeChipActive]}
                    onPress={() => setUploadType(t.value)}
                    disabled={uploading}
                  >
                    <Text style={[styles.typeChipText, uploadType === t.value && styles.typeChipTextActive]}>{t.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.inputLabel}>File * (PDF, JPG, PNG, DOC, DOCX — max 10 MB)</Text>
              <TouchableOpacity style={styles.pickBtn} onPress={pickDocument} disabled={uploading}>
                <MaterialIcons name="attach-file" size={20} color={AppColors.tint} />
                <Text style={styles.pickBtnText}>{uploadFile ? uploadFile.name : 'Choose file'}</Text>
              </TouchableOpacity>
              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={closeUpload} disabled={uploading}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.uploadSubmitBtn, uploading && styles.uploadSubmitDisabled]}
                  onPress={submitUpload}
                  disabled={uploading || !uploadName.trim() || !uploadFile}
                >
                  {uploading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.uploadSubmitText}>Upload</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={AppColors.tint} />
        }
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.pageSubtitle}>Your documents. Tap to view or open in browser.</Text>

        {docs.length > 0 && !loading && (
          <Text style={styles.summary}>
            {filterType
              ? `Showing ${filtered.length} of ${docs.length}`
              : `${docs.length} document${docs.length === 1 ? '' : 's'}`}
          </Text>
        )}

        {docs.length > 0 && (
        <View style={styles.filterRow}>
          <TouchableOpacity
            style={[styles.filterChip, !filterType && styles.filterChipActive]}
            onPress={() => setFilterType(null)}
          >
            <Text style={[styles.filterText, !filterType && styles.filterTextActive]}>All ({docs.length})</Text>
          </TouchableOpacity>
          {DOC_TYPES.map((t) => {
            const count = docs.filter((d) => (d.type ?? 'OTHER') === t.value).length;
            if (count === 0) return null;
            return (
              <TouchableOpacity
                key={t.value}
                style={[styles.filterChip, filterType === t.value && styles.filterChipActive]}
                onPress={() => setFilterType(filterType === t.value ? null : t.value)}
              >
                <Text style={[styles.filterText, filterType === t.value && styles.filterTextActive]}>
                  {t.label} ({count})
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {loading ? (
        <Text style={styles.muted}>Loading…</Text>
      ) : filtered.length === 0 ? (
        <View style={styles.emptyCard}>
          <MaterialIcons name="folder-open" size={48} color={AppColors.textSecondary} />
          <Text style={styles.emptyText}>No documents yet</Text>
          <Text style={styles.emptySub}>
            {filterType ? `No ${typeLabel(filterType)} documents.` : 'Upload documents from the web portal or ask HR to add them.'}
          </Text>
        </View>
      ) : (
        <View style={styles.card}>
          {filtered.map((d, i) => {
            const tc = typeColor(d.type);
            const sizeStr = formatSize(d.fileSize);
            return (
              <TouchableOpacity
                key={d._id}
                style={[styles.row, i < filtered.length - 1 && styles.rowBorder]}
                onPress={() => openDoc(d)}
                activeOpacity={0.7}
              >
                <View style={[styles.docIcon, { backgroundColor: getDocIconBg(d) }]}>
                  <MaterialIcons name={getDocIcon(d)} size={24} color={AppColors.tint} />
                </View>
                <View style={styles.docBody}>
                  <View style={styles.nameRow}>
                    <Text style={styles.docName} numberOfLines={1}>{d.name}</Text>
                    <View style={[styles.typeBadge, { backgroundColor: tc.bg }]}>
                      <Text style={[styles.typeBadgeText, { color: tc.text }]}>{typeLabel(d.type)}</Text>
                    </View>
                  </View>
                  <Text style={styles.meta}>
                    {[sizeStr, new Date(d.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })].filter(Boolean).join(' · ')}
                    {d.uploadedBy?.name ? ` · ${d.uploadedBy.name}` : ''}
                  </Text>
                  <View style={styles.viewRow}>
                    <MaterialIcons name="open-in-new" size={16} color={AppColors.tint} />
                    <Text style={styles.viewText}>View / Open</Text>
                  </View>
                </View>
                <MaterialIcons name="chevron-right" size={22} color={AppColors.textSecondary} />
              </TouchableOpacity>
            );
          })}
        </View>
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
  modalCard: { backgroundColor: AppColors.card, borderTopLeftRadius: BorderRadius.xl, borderTopRightRadius: BorderRadius.xl, padding: Spacing.xl, paddingBottom: Spacing.xxl + 24 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: AppColors.text, marginBottom: Spacing.lg },
  uploadError: { fontSize: 14, color: '#dc2626', marginBottom: Spacing.sm },
  inputLabel: { fontSize: 14, fontWeight: '600', color: AppColors.text, marginBottom: 6, marginTop: Spacing.sm },
  input: { borderWidth: 1, borderColor: 'rgba(60,60,67,0.2)', borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, fontSize: 16, color: AppColors.text },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: 4 },
  typeChip: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: BorderRadius.full, backgroundColor: 'rgba(118,118,128,0.12)' },
  typeChipActive: { backgroundColor: AppColors.tint },
  typeChipText: { fontSize: 13, fontWeight: '600', color: AppColors.text },
  typeChipTextActive: { color: '#fff' },
  pickBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: 'rgba(60,60,67,0.2)', borderStyle: 'dashed' },
  pickBtnText: { fontSize: 15, color: AppColors.tint, fontWeight: '600' },
  modalActions: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.xl },
  cancelBtn: { flex: 1, paddingVertical: Spacing.md, alignItems: 'center', borderRadius: BorderRadius.md, backgroundColor: 'rgba(118,118,128,0.2)' },
  cancelBtnText: { fontSize: 16, fontWeight: '600', color: AppColors.text },
  uploadSubmitBtn: { flex: 1, paddingVertical: Spacing.md, alignItems: 'center', justifyContent: 'center', borderRadius: BorderRadius.md, backgroundColor: AppColors.tint, minHeight: 48 },
  uploadSubmitDisabled: { opacity: 0.7 },
  uploadSubmitText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  scroll: { flex: 1 },
  content: { padding: Spacing.xl, paddingBottom: Spacing.section },
  pageSubtitle: { fontSize: 15, color: AppColors.textSecondary, marginBottom: Spacing.sm },
  summary: { fontSize: 14, color: AppColors.textSecondary, marginBottom: Spacing.md, fontWeight: '500' },
  bottomPad: { height: Spacing.section },
  muted: { fontSize: 15, color: AppColors.textSecondary },
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
  emptyCard: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
    backgroundColor: AppColors.card,
    borderRadius: BorderRadius.xl,
    ...CardShadow,
  },
  emptyText: { fontSize: 17, fontWeight: '600', color: AppColors.text, marginTop: Spacing.md },
  emptySub: { fontSize: 14, color: AppColors.textSecondary, marginTop: Spacing.sm, textAlign: 'center', paddingHorizontal: Spacing.xl },
  card: { backgroundColor: AppColors.card, borderRadius: BorderRadius.xl, overflow: 'hidden', ...CardShadow },
  row: { flexDirection: 'row', alignItems: 'center', padding: Spacing.lg },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(60,60,67,0.12)' },
  docIcon: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  docBody: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap', marginBottom: 2 },
  docName: { fontSize: 16, fontWeight: '600', color: AppColors.text, flex: 1 },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  typeBadgeText: { fontSize: 11, fontWeight: '600' },
  meta: { fontSize: 13, color: AppColors.textSecondary, marginTop: 2 },
  viewRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: Spacing.sm },
  viewText: { fontSize: 14, fontWeight: '600', color: AppColors.tint },
});
