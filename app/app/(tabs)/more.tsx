import React, { useMemo, useCallback } from 'react';
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Spacing, BorderRadius, CardShadow } from '@/constants/theme';
import { useAuthStore } from '@/store/authStore';
import { useAppColors } from '@/hooks/use-app-theme';
import { MoreMenuItem } from '@/components/more-menu-item';
import api from '@/lib/api';

type MenuItem = {
  route: string;
  label: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  section: 'Me' | 'Work' | 'Company' | 'HR' | 'Admin' | 'Other';
  roles: string[];
};

// Aligned with website Layout.jsx NAV_ITEMS roles
const MENU_ITEMS: MenuItem[] = [
  { route: '/assistant', label: 'HRMS Assistant', icon: 'smart-toy', section: 'Me', roles: ['SUPER_ADMIN', 'DIRECTOR', 'HR', 'ACCOUNTS', 'EMPLOYEE'] },
  { route: '/feedback-ratings', label: 'Weekly feedback', icon: 'forum', section: 'Me', roles: ['SUPER_ADMIN', 'DIRECTOR', 'HR', 'ACCOUNTS', 'EMPLOYEE'] },
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
  { route: '/employees', label: 'Employees', icon: 'people', section: 'HR', roles: ['SUPER_ADMIN', 'DIRECTOR', 'HR', 'ACCOUNTS'] },
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
  const { clearAuth, getRole } = useAuthStore();
  const colors = useAppColors();
  // Use effective role (user.role or decoded from JWT) so HR/Director always see correct menu
  const role = getRole();

  const bySection = useMemo(() => {
    const allowedItems = MENU_ITEMS.filter((item) => item.roles.includes(role));
    return SECTION_ORDER.map((section) => ({
      section,
      items: allowedItems.filter((i) => i.section === section),
    })).filter((g) => g.items.length > 0);
  }, [role]);

  const borderMuted = colors.separator ?? colors.textSecondary + '40';

  const handleLogout = useCallback(() => {
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
  }, [clearAuth, router]);

  return (
    <ScrollView
      style={[styles.scroll, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.pageTitle, { color: colors.text }]}>Menu</Text>
      <Text style={[styles.pageSubtitle, { color: colors.textTertiary }]}>Settings and shortcuts</Text>

      {/* App preferences — tap to open Light / System / Dark */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textTertiary }]}>App preferences</Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => {
              router.push('/app-preferences');
            }}
            activeOpacity={0.65}
          >
            <View style={[styles.menuIconWrap, { backgroundColor: colors.tint + '12' }]}>
              <MaterialIcons name="settings" size={20} color={colors.tint} />
            </View>
            <Text style={[styles.menuLabel, { color: colors.text }]}>App preferences</Text>
            <MaterialIcons name="chevron-right" size={20} color={colors.textTertiary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Menu sections */}
      {bySection.map(({ section, items }) => (
        <View key={section} style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textTertiary }]}>{section}</Text>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {items.map((item, index) => (
              <MoreMenuItem
                key={item.route}
                item={item}
                isLast={index === items.length - 1}
                colors={colors}
                borderBottomColor={borderMuted}
              />
            ))}
          </View>
        </View>
      ))}

      <TouchableOpacity
        style={[styles.logoutBtn, { borderColor: `${colors.destructive}55`, backgroundColor: `${colors.destructive}0A` }]}
        onPress={handleLogout}
        activeOpacity={0.8}
      >
        <MaterialIcons name="logout" size={20} color={colors.destructive} />
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
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.4,
    marginBottom: 4,
  },
  pageSubtitle: { fontSize: 14, marginBottom: Spacing.xl, fontWeight: '500' },
  section: { marginBottom: Spacing.xl },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: Spacing.sm,
    marginLeft: Spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  card: {
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    ...CardShadow,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md + 2,
    paddingHorizontal: Spacing.lg,
  },
  menuIconWrap: {
    width: 34,
    height: 34,
    borderRadius: BorderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  menuLabel: { flex: 1, fontSize: 16, fontWeight: '500', letterSpacing: -0.2 },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    height: 50,
    borderRadius: BorderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: Spacing.sm,
  },
  logoutLabel: { fontSize: 16, fontWeight: '600' },
});
