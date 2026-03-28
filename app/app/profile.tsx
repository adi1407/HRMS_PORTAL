import React, { useEffect, useMemo, useState, useCallback } from 'react';
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
  Linking,
  Alert,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Spacing, BorderRadius, getAppColors, Colors } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useAuthStore } from '@/store/authStore';
import api from '@/lib/api';

type UserShape = {
  _id?: string;
  name?: string;
  email?: string;
  role?: string;
  department?: { name: string };
  branch?: { name: string };
  employeeId?: string;
  designation?: string;
};

type ProfileData = {
  completionPercent?: number;
  personalPhone?: string;
  personalEmail?: string;
  dateOfBirth?: string;
  gender?: string;
  bloodGroup?: string;
  currentAddress?: string;
  permanentAddress?: string;
  emergencyContactName?: string;
  emergencyContactRelation?: string;
  emergencyContactPhone?: string;
  fatherName?: string;
  motherName?: string;
  maritalStatus?: string;
  nationality?: string;
  employee?: UserShape;
};

const HR_PROFILE_ROLES = ['HR', 'DIRECTOR', 'SUPER_ADMIN'];

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Administrator',
  DIRECTOR: 'Director',
  HR: 'HR',
  ACCOUNTS: 'Accounts',
  EMPLOYEE: 'Employee',
};

function Section({
  styles,
  tint,
  title,
  icon,
  children,
}: {
  styles: ReturnType<typeof createProfileStyles>;
  tint: string;
  title: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <MaterialIcons name={icon} size={18} color={tint} />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );
}

function InfoRow({
  styles,
  label,
  value,
}: {
  styles: ReturnType<typeof createProfileStyles>;
  label: string;
  value?: string | null;
}) {
  if (value == null || value === '') return null;
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

export default function ProfileScreen() {
  const theme = useAppTheme();
  const colors = useMemo(() => getAppColors(theme), [theme]);
  const styles = useMemo(() => createProfileStyles(colors, theme), [theme]);

  const router = useRouter();
  const params = useLocalSearchParams<{ empId?: string }>();
  const targetEmpId = params.empId;
  const currentUser = useAuthStore((s) => s.user) as UserShape | null;
  const getRole = useAuthStore((s) => s.getRole);
  const role = getRole();
  const canViewEditOthers = HR_PROFILE_ROLES.includes(role);
  const isViewingOwn = !targetEmpId || targetEmpId === currentUser?._id;

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editForm, setEditForm] = useState<Partial<ProfileData>>({});

  const load = useCallback(async () => {
    try {
      if (targetEmpId && canViewEditOthers) {
        const { data } = await api.get<{ data: ProfileData & { completionPercent?: number; employee?: UserShape } }>(`/employee-profile/${targetEmpId}`);
        setProfile(data.data ?? null);
        setEditForm({
          personalPhone: data.data?.personalPhone ?? '',
          personalEmail: data.data?.personalEmail ?? '',
          dateOfBirth: data.data?.dateOfBirth ? new Date(data.data.dateOfBirth).toISOString().slice(0, 10) : '',
          gender: data.data?.gender ?? '',
          bloodGroup: data.data?.bloodGroup ?? '',
          currentAddress: data.data?.currentAddress ?? '',
          permanentAddress: data.data?.permanentAddress ?? '',
          emergencyContactName: data.data?.emergencyContactName ?? '',
          emergencyContactRelation: data.data?.emergencyContactRelation ?? '',
          emergencyContactPhone: data.data?.emergencyContactPhone ?? '',
          fatherName: data.data?.fatherName ?? '',
          motherName: data.data?.motherName ?? '',
          maritalStatus: data.data?.maritalStatus ?? '',
          nationality: data.data?.nationality ?? '',
        });
      } else {
        const { data } = await api.get<{ data: ProfileData & { completionPercent?: number } }>('/employee-profile/my');
        setProfile(data.data ?? null);
      }
    } catch {
      setProfile(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [targetEmpId, canViewEditOthers]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSaveEdit = async () => {
    if (!targetEmpId) return;
    setEditSaving(true);
    try {
      const payload: Record<string, unknown> = { ...editForm };
      if (payload.dateOfBirth === '') delete payload.dateOfBirth;
      else if (payload.dateOfBirth) payload.dateOfBirth = new Date(payload.dateOfBirth as string).toISOString();
      await api.patch(`/employee-profile/${targetEmpId}`, payload);
      setEditModalVisible(false);
      load();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to save.';
      Alert.alert('Error', msg);
    } finally {
      setEditSaving(false);
    }
  };

  const displayUser = (profile?.employee && !isViewingOwn) ? profile.employee : currentUser;
  const initials = (displayUser?.name ?? displayUser?.email ?? '?').slice(0, 2).toUpperCase();
  const completion = profile?.completionPercent ?? 0;
  const completionColor = completion >= 80 ? colors.success : completion >= 40 ? '#d97706' : colors.danger;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <SafeAreaView style={styles.safeTop}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <MaterialIcons name={Platform.OS === 'ios' ? 'arrow-back-ios' : 'arrow-back'} size={Platform.OS === 'ios' ? 22 : 24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {isViewingOwn ? 'My Profile' : (displayUser?.name ?? 'Profile')}
          </Text>
          <View style={styles.backBtn} />
        </View>
      </SafeAreaView>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.tint} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero card */}
        <View style={styles.heroCard}>
          <View style={styles.avatarWrap}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <Text style={styles.heroName}>{displayUser?.name ?? '—'}</Text>
          <Text style={styles.heroRole}>{ROLE_LABELS[displayUser?.role ?? ''] ?? (displayUser?.role ?? '').replace(/_/g, ' ')}</Text>
          {(displayUser?.employeeId ?? displayUser?.designation) && (
            <Text style={styles.heroMeta}>
              {[displayUser?.employeeId, displayUser?.designation].filter(Boolean).join(' · ')}
            </Text>
          )}
          {typeof completion === 'number' && (
            <View style={styles.completionWrap}>
              <View style={styles.completionTrack}>
                <View style={[styles.completionFill, { width: `${Math.min(100, completion)}%`, backgroundColor: completionColor }]} />
              </View>
              <Text style={styles.completionText}>{completion}% complete</Text>
            </View>
          )}
        </View>

        {loading ? (
          <Text style={styles.muted}>Loading…</Text>
        ) : (
          <>
            <Section styles={styles} tint={colors.tint} title="Work" icon="work">
              <InfoRow styles={styles} label="Employee ID" value={displayUser?.employeeId} />
              <InfoRow styles={styles} label="Email" value={displayUser?.email} />
              <InfoRow styles={styles} label="Designation" value={displayUser?.designation} />
              <InfoRow styles={styles} label="Department" value={displayUser?.department?.name} />
              <InfoRow styles={styles} label="Branch" value={displayUser?.branch?.name} />
            </Section>

            <Section styles={styles} tint={colors.tint} title="Personal" icon="person">
              <InfoRow styles={styles} label="Phone" value={profile?.personalPhone} />
              <InfoRow styles={styles} label="Personal email" value={profile?.personalEmail} />
              <InfoRow styles={styles} label="Date of birth" value={profile?.dateOfBirth ? new Date(profile.dateOfBirth).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : undefined} />
              <InfoRow styles={styles} label="Gender" value={profile?.gender?.replace(/_/g, ' ')} />
              <InfoRow styles={styles} label="Blood group" value={profile?.bloodGroup} />
              <InfoRow styles={styles} label="Current address" value={profile?.currentAddress} />
              <InfoRow styles={styles} label="Permanent address" value={profile?.permanentAddress} />
            </Section>

            <Section styles={styles} tint={colors.tint} title="Emergency contact" icon="contact-emergency">
              <InfoRow styles={styles} label="Name" value={profile?.emergencyContactName} />
              <InfoRow styles={styles} label="Relation" value={profile?.emergencyContactRelation} />
              <InfoRow styles={styles} label="Phone" value={profile?.emergencyContactPhone} />
            </Section>

            {!isViewingOwn && canViewEditOthers && (
              <TouchableOpacity style={styles.editDetailsBtn} onPress={() => setEditModalVisible(true)}>
                <MaterialIcons name="edit" size={20} color="#fff" />
                <Text style={styles.editDetailsBtnText}>Edit this employee&apos;s details</Text>
              </TouchableOpacity>
            )}

            {isViewingOwn && canViewEditOthers && (
              <TouchableOpacity style={styles.teamProfilesLink} onPress={() => router.push('/employees')}>
                <MaterialIcons name="people" size={20} color={colors.tint} />
                <Text style={styles.teamProfilesLinkText}>View & edit team profiles</Text>
                <MaterialIcons name="chevron-right" size={22} color={colors.tint} />
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.webLinkCard}
              onPress={() => {
                const url = typeof process !== 'undefined' && (process as unknown as { env?: { EXPO_PUBLIC_CLIENT_URL?: string } }).env?.EXPO_PUBLIC_CLIENT_URL;
                if (url) Linking.openURL(url).catch(() => Alert.alert('Link', 'Could not open web portal.'));
                else Alert.alert('Edit profile', 'Open the company web portal in a browser to edit your full profile, education, experience, and documents.');
              }}
            >
              <MaterialIcons name="edit" size={20} color={colors.tint} />
              <Text style={styles.webLinkText}>Edit full profile on web portal</Text>
              <MaterialIcons name="open-in-new" size={18} color={colors.tint} />
            </TouchableOpacity>
          </>
        )}
        <View style={styles.bottomPad} />
      </ScrollView>

      {/* Edit details modal (HR editing another employee) */}
      <Modal visible={editModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalScrollContent} keyboardShouldPersistTaps="handled">
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Edit details</Text>
              <Text style={styles.inputLabel}>Personal phone</Text>
              <TextInput style={styles.input} value={editForm.personalPhone ?? ''} onChangeText={(v) => setEditForm((f) => ({ ...f, personalPhone: v }))} placeholder="Phone" placeholderTextColor={colors.textSecondary} />
              <Text style={styles.inputLabel}>Personal email</Text>
              <TextInput style={styles.input} value={editForm.personalEmail ?? ''} onChangeText={(v) => setEditForm((f) => ({ ...f, personalEmail: v }))} placeholder="Email" placeholderTextColor={colors.textSecondary} keyboardType="email-address" />
              <Text style={styles.inputLabel}>Date of birth (YYYY-MM-DD)</Text>
              <TextInput style={styles.input} value={editForm.dateOfBirth ?? ''} onChangeText={(v) => setEditForm((f) => ({ ...f, dateOfBirth: v }))} placeholder="1990-01-15" placeholderTextColor={colors.textSecondary} />
              <Text style={styles.inputLabel}>Gender</Text>
              <TextInput style={styles.input} value={editForm.gender ?? ''} onChangeText={(v) => setEditForm((f) => ({ ...f, gender: v }))} placeholder="MALE / FEMALE / OTHER" placeholderTextColor={colors.textSecondary} />
              <Text style={styles.inputLabel}>Blood group</Text>
              <TextInput style={styles.input} value={editForm.bloodGroup ?? ''} onChangeText={(v) => setEditForm((f) => ({ ...f, bloodGroup: v }))} placeholder="e.g. O+" placeholderTextColor={colors.textSecondary} />
              <Text style={styles.inputLabel}>Father / Mother name</Text>
              <TextInput style={styles.input} value={editForm.fatherName ?? ''} onChangeText={(v) => setEditForm((f) => ({ ...f, fatherName: v }))} placeholder="Father" placeholderTextColor={colors.textSecondary} />
              <TextInput style={[styles.input, { marginTop: 8 }]} value={editForm.motherName ?? ''} onChangeText={(v) => setEditForm((f) => ({ ...f, motherName: v }))} placeholder="Mother" placeholderTextColor={colors.textSecondary} />
              <Text style={styles.inputLabel}>Marital status</Text>
              <TextInput style={styles.input} value={editForm.maritalStatus ?? ''} onChangeText={(v) => setEditForm((f) => ({ ...f, maritalStatus: v }))} placeholder="SINGLE / MARRIED / etc." placeholderTextColor={colors.textSecondary} />
              <Text style={styles.inputLabel}>Nationality</Text>
              <TextInput style={styles.input} value={editForm.nationality ?? ''} onChangeText={(v) => setEditForm((f) => ({ ...f, nationality: v }))} placeholder="Indian" placeholderTextColor={colors.textSecondary} />
              <Text style={styles.inputLabel}>Current address</Text>
              <TextInput style={[styles.input, styles.inputArea]} value={editForm.currentAddress ?? ''} onChangeText={(v) => setEditForm((f) => ({ ...f, currentAddress: v }))} placeholder="Address" placeholderTextColor={colors.textSecondary} multiline />
              <Text style={styles.inputLabel}>Permanent address</Text>
              <TextInput style={[styles.input, styles.inputArea]} value={editForm.permanentAddress ?? ''} onChangeText={(v) => setEditForm((f) => ({ ...f, permanentAddress: v }))} placeholder="Address" placeholderTextColor={colors.textSecondary} multiline />
              <Text style={styles.inputLabel}>Emergency contact</Text>
              <TextInput style={styles.input} value={editForm.emergencyContactName ?? ''} onChangeText={(v) => setEditForm((f) => ({ ...f, emergencyContactName: v }))} placeholder="Name" placeholderTextColor={colors.textSecondary} />
              <TextInput style={[styles.input, { marginTop: 8 }]} value={editForm.emergencyContactRelation ?? ''} onChangeText={(v) => setEditForm((f) => ({ ...f, emergencyContactRelation: v }))} placeholder="Relation" placeholderTextColor={colors.textSecondary} />
              <TextInput style={[styles.input, { marginTop: 8 }]} value={editForm.emergencyContactPhone ?? ''} onChangeText={(v) => setEditForm((f) => ({ ...f, emergencyContactPhone: v }))} placeholder="Phone" placeholderTextColor={colors.textSecondary} keyboardType="phone-pad" />
              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditModalVisible(false)}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.saveBtn, editSaving && styles.btnDisabled]} onPress={handleSaveEdit} disabled={editSaving}>
                  {editSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

function createProfileStyles(colors: ReturnType<typeof getAppColors>, theme: 'light' | 'dark') {
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
  const sep = Colors[theme].separator;
  const borderInput = theme === 'dark' ? 'rgba(255,255,255,0.18)' : 'rgba(118,118,128,0.2)';

  return StyleSheet.create({
  screen: { flex: 1 },
  safeTop: { backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: sep,
  },
  backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'flex-start' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  scroll: { flex: 1 },
  content: { padding: Spacing.xl, paddingBottom: Spacing.section },
  heroCard: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
    marginBottom: Spacing.xl,
    backgroundColor: colors.card,
    borderRadius: BorderRadius.xl,
    ...cardShadow,
  },
  avatarWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: `${colors.tint}20`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  avatarText: { fontSize: 28, fontWeight: '700', color: colors.tint },
  heroName: { fontSize: 22, fontWeight: '700', color: colors.text, marginBottom: 2 },
  heroRole: { fontSize: 15, color: colors.textSecondary, marginBottom: 2 },
  heroMeta: { fontSize: 14, color: colors.tint, fontWeight: '600', marginBottom: Spacing.lg },
  completionWrap: { width: '100%', paddingHorizontal: Spacing.xl, alignItems: 'center' },
  completionTrack: {
    height: 6,
    width: '100%',
    maxWidth: 200,
    borderRadius: 3,
    backgroundColor: 'rgba(118,118,128,0.2)',
    overflow: 'hidden',
  },
  completionFill: { height: '100%', borderRadius: 3 },
  completionText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginTop: 6 },
  muted: { fontSize: 15, color: colors.textSecondary },
  section: { marginBottom: Spacing.lg },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  sectionCard: {
    backgroundColor: colors.card,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    ...cardShadow,
  },
  infoRow: { paddingVertical: Spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: sep },
  infoLabel: { fontSize: 13, color: colors.textSecondary, marginBottom: 2 },
  infoValue: { fontSize: 16, fontWeight: '500', color: colors.text },
  webLinkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    padding: Spacing.lg,
    backgroundColor: `${colors.tint}12`,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: `${colors.tint}30`,
  },
  webLinkText: { fontSize: 15, fontWeight: '600', color: colors.tint },
  editDetailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    height: 52,
    borderRadius: BorderRadius.md,
    backgroundColor: colors.tint,
    marginBottom: Spacing.lg,
  },
  editDetailsBtnText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  teamProfilesLink: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    backgroundColor: colors.card,
    borderRadius: BorderRadius.xl,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: `${colors.tint}30`,
    ...cardShadow,
  },
  teamProfilesLinkText: { flex: 1, fontSize: 16, fontWeight: '600', color: colors.tint },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalScroll: { maxHeight: '90%' },
  modalScrollContent: { paddingBottom: Spacing.section },
  modalContent: { backgroundColor: colors.card, borderTopLeftRadius: BorderRadius.xl, borderTopRightRadius: BorderRadius.xl, padding: Spacing.xl },
  modalTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: Spacing.lg },
  inputLabel: { fontSize: 13, color: colors.textSecondary, marginBottom: 6, fontWeight: '500' },
  input: { borderWidth: 1, borderColor: borderInput, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, fontSize: 16, color: colors.text, marginBottom: Spacing.lg },
  inputArea: { minHeight: 72, textAlignVertical: 'top' },
  modalActions: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.md },
  cancelBtn: { flex: 1, height: 48, borderRadius: BorderRadius.md, backgroundColor: 'rgba(118,118,128,0.12)', justifyContent: 'center', alignItems: 'center' },
  cancelBtnText: { fontSize: 16, fontWeight: '600', color: colors.tint },
  saveBtn: { flex: 1, height: 48, borderRadius: BorderRadius.md, backgroundColor: colors.tint, justifyContent: 'center', alignItems: 'center' },
  saveBtnText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  btnDisabled: { opacity: 0.6 },
  bottomPad: { height: Spacing.section },
  });
}
