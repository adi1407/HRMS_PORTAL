import React from 'react';
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Spacing, BorderRadius } from '@/constants/theme';
import { useAuthStore } from '@/store/authStore';
import { useAppColors } from '@/hooks/use-app-theme';
import api from '@/lib/api';

const CARD_SHADOW = Platform.select({
  ios: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  android: { elevation: 2 },
  default: {},
});

const ROLE_DISPLAY: Record<string, string> = {
  SUPER_ADMIN: 'Administrator',
  DIRECTOR: 'Director',
  HR: 'HR',
  ACCOUNTS: 'Accounts',
  EMPLOYEE: 'Employee',
};

type MenuItem = {
  route: string;
  label: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  section: 'Me' | 'Work' | 'Company' | 'HR' | 'Admin' | 'Other';
  roles: string[];
};

// Aligned with website Layout.jsx NAV_ITEMS roles
const MENU_ITEMS: MenuItem[] = [
  { route: '/profile', label: 'My Profile', icon: 'person', section: 'Me', roles: ['SUPER_ADMIN', 'DIRECTOR', 'HR', 'ACCOUNTS', 'EMPLOYEE'] },
  { route: '/salary', label: 'Salary & Payslips', icon: 'payments', section: 'Me', roles: ['SUPER_ADMIN', 'DIRECTOR', 'HR', 'ACCOUNTS', 'EMPLOYEE'] },
  { route: '/attendance', label: 'Attendance', icon: 'today', section: 'Me', roles: ['SUPER_ADMIN', 'DIRECTOR', 'HR', 'ACCOUNTS', 'EMPLOYEE'] },
  { route: '/documents', label: 'Documents', icon: 'folder-open', section: 'Work', roles: ['SUPER_ADMIN', 'DIRECTOR', 'HR', 'ACCOUNTS', 'EMPLOYEE'] },
  { route: '/expense-claims', label: 'Expense Claims', icon: 'receipt-long', section: 'Work', roles: ['SUPER_ADMIN', 'DIRECTOR', 'HR', 'ACCOUNTS', 'EMPLOYEE'] },
  { route: '/daily-tasks', label: 'Daily Tasks', icon: 'assignment', section: 'Work', roles: ['SUPER_ADMIN', 'DIRECTOR', 'HR', 'ACCOUNTS', 'EMPLOYEE'] },
  { route: '/tickets', label: 'Help Desk', icon: 'support-agent', section: 'Work', roles: ['SUPER_ADMIN', 'DIRECTOR', 'HR', 'ACCOUNTS', 'EMPLOYEE'] },
  { route: '/assets', label: 'Assets', icon: 'inventory-2', section: 'Work', roles: ['SUPER_ADMIN', 'DIRECTOR', 'HR', 'ACCOUNTS', 'EMPLOYEE'] },
  { route: '/onboarding', label: 'Onboarding', icon: 'launch', section: 'Work', roles: ['SUPER_ADMIN', 'DIRECTOR', 'HR', 'ACCOUNTS', 'EMPLOYEE'] },
  { route: '/holidays', label: 'Holidays', icon: 'celebration', section: 'Company', roles: ['SUPER_ADMIN', 'DIRECTOR', 'HR', 'ACCOUNTS', 'EMPLOYEE'] },
  { route: '/announcements', label: 'Announcements', icon: 'campaign', section: 'Company', roles: ['SUPER_ADMIN', 'DIRECTOR', 'HR'] },
  { route: '/policies', label: 'Policies', icon: 'menu-book', section: 'Company', roles: ['SUPER_ADMIN', 'DIRECTOR', 'HR', 'ACCOUNTS', 'EMPLOYEE'] },
  { route: '/directory', label: 'Directory', icon: 'contacts', section: 'Company', roles: ['SUPER_ADMIN', 'DIRECTOR', 'HR', 'ACCOUNTS', 'EMPLOYEE'] },
  { route: '/resignation', label: 'Resignation', icon: 'person-remove', section: 'Company', roles: ['SUPER_ADMIN', 'DIRECTOR', 'HR', 'ACCOUNTS', 'EMPLOYEE'] },
  { route: '/warnings', label: 'Warnings', icon: 'warning', section: 'Company', roles: ['SUPER_ADMIN', 'DIRECTOR', 'HR', 'ACCOUNTS', 'EMPLOYEE'] },
  { route: '/appraisals', label: 'Appraisals', icon: 'star', section: 'Company', roles: ['SUPER_ADMIN', 'DIRECTOR', 'HR', 'ACCOUNTS', 'EMPLOYEE'] },
  { route: '/employees', label: 'Employees', icon: 'people', section: 'HR', roles: ['SUPER_ADMIN', 'DIRECTOR', 'HR', 'ACCOUNTS'] },
  { route: '/face-enroll', label: 'Face Enroll', icon: 'face', section: 'HR', roles: ['SUPER_ADMIN', 'DIRECTOR', 'HR'] },
  { route: '/recruitment', label: 'Recruitment', icon: 'person-add', section: 'HR', roles: ['SUPER_ADMIN', 'DIRECTOR', 'HR'] },
  { route: '/task-reports', label: 'Task Reports', icon: 'assessment', section: 'HR', roles: ['SUPER_ADMIN', 'DIRECTOR', 'HR'] },
  { route: '/email-alerts', label: 'Email Alerts', icon: 'email', section: 'HR', roles: ['SUPER_ADMIN', 'DIRECTOR', 'HR'] },
  { route: '/audit-log', label: 'Audit Log', icon: 'history', section: 'Admin', roles: ['SUPER_ADMIN', 'DIRECTOR'] },
  { route: '/branch-settings', label: 'Office Settings', icon: 'business', section: 'Admin', roles: ['SUPER_ADMIN', 'DIRECTOR', 'HR'] },
  { route: '/notifications', label: 'Notifications', icon: 'notifications', section: 'Other', roles: ['SUPER_ADMIN', 'DIRECTOR', 'HR', 'ACCOUNTS', 'EMPLOYEE'] },
];

const SECTION_ORDER: MenuItem['section'][] = ['Me', 'Work', 'Company', 'HR', 'Admin', 'Other'];

export default function MoreScreen() {
  const router = useRouter();
  const { user, clearAuth, getRole } = useAuthStore();
  const colors = useAppColors();
  // Use effective role (user.role or decoded from JWT) so HR/Director always see correct menu
  const role = getRole();

  const allowedItems = MENU_ITEMS.filter((item) => item.roles.includes(role));
  const bySection = SECTION_ORDER.map((section) => ({
    section,
    items: allowedItems.filter((i) => i.section === section),
  })).filter((g) => g.items.length > 0);

  const handleLogout = () => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          try {
            const refreshToken = await useAuthStore.getState().getStoredRefreshToken();
            await api.post('/auth/logout', refreshToken ? { refreshToken } : {});
          } catch {}
          await clearAuth();
          router.replace('/login');
        },
      },
    ]);
  };

  return (
    <ScrollView
      style={[styles.scroll, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.pageTitle, { color: colors.text }]}>More</Text>
      <Text style={[styles.pageSubtitle, { color: colors.textSecondary }]}>Profile and settings</Text>

      {/* App preferences — tap to open Light / System / Dark */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>App preferences</Text>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => router.push('/app-preferences')}
            activeOpacity={0.7}
          >
            <View style={[styles.menuIconWrap, { backgroundColor: colors.tint + '20' }]}>
              <MaterialIcons name="settings" size={22} color={colors.tint} />
            </View>
            <Text style={[styles.menuLabel, { color: colors.text }]}>App preferences</Text>
            <MaterialIcons name="chevron-right" size={22} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Profile card */}
      <View style={[styles.profileCard, { backgroundColor: colors.card }]}>
        <View style={[styles.avatarWrap, { backgroundColor: colors.tint }]}>
          <Text style={styles.avatarText}>
            {(user?.name ?? user?.email ?? '?').charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.profileInfo}>
          <Text style={[styles.profileName, { color: colors.text }]}>{user?.name ?? '—'}</Text>
          <Text style={[styles.profileEmail, { color: colors.textSecondary }]}>{user?.email}</Text>
          <Text style={[styles.profileRole, { color: colors.textSecondary }]}>
            {ROLE_DISPLAY[role] ?? role.replace(/_/g, ' ')}
          </Text>
        </View>
      </View>

      {/* Menu sections */}
      {bySection.map(({ section, items }) => (
        <View key={section} style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{section}</Text>
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            {items.map((item, index) => (
              <TouchableOpacity
                key={item.route}
                style={[
                  styles.menuRow,
                  index < items.length - 1 && styles.menuRowBorder,
                  index < items.length - 1 && { borderBottomColor: colors.textSecondary + '40' },
                ]}
                onPress={() => router.push(item.route as never)}
                activeOpacity={0.7}
              >
                <View style={[styles.menuIconWrap, { backgroundColor: colors.tint + '20' }]}>
                  <MaterialIcons
                    name={item.icon as keyof typeof MaterialIcons.glyphMap}
                    size={22}
                    color={colors.tint}
                  />
                </View>
                <Text style={[styles.menuLabel, { color: colors.text }]}>{item.label}</Text>
                <MaterialIcons name="chevron-right" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ))}

      <TouchableOpacity
        style={[styles.logoutBtn, { borderColor: colors.destructive }]}
        onPress={handleLogout}
        activeOpacity={0.8}
      >
        <MaterialIcons name="logout" size={22} color={colors.destructive} />
        <Text style={[styles.logoutLabel, { color: colors.destructive }]}>Sign out</Text>
      </TouchableOpacity>

      <View style={styles.bottomPad} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: Spacing.xxl, paddingBottom: Spacing.section },
  bottomPad: { height: Spacing.section },
  pageTitle: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  pageSubtitle: { fontSize: 15, marginBottom: Spacing.xl },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    marginBottom: Spacing.xl,
    ...CARD_SHADOW,
  },
  avatarWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.lg,
  },
  avatarText: { color: '#fff', fontSize: 24, fontWeight: '600' },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 18, fontWeight: '600', marginBottom: 2 },
  profileEmail: { fontSize: 14 },
  profileRole: { fontSize: 13, marginTop: 2 },
  section: { marginBottom: Spacing.xl },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: Spacing.sm,
    marginLeft: Spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  card: {
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    ...CARD_SHADOW,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  menuRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  menuIconWrap: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  menuLabel: { flex: 1, fontSize: 17, fontWeight: '500' },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    height: 52,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    marginTop: Spacing.sm,
  },
  logoutLabel: { fontSize: 17, fontWeight: '600' },
});
