import React, { useMemo, useCallback } from 'react';
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
import { MoreMenuItem } from '@/components/more-menu-item';
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
  { route: '/appraisals', label: 'Appraisals', icon: 'star', section: 'Company', roles: ['SUPER_ADMIN', 'DIRECTOR', 'HR', 'ACCOUNTS', 'EMPLOYEE'] },
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

  const borderMuted = colors.textSecondary + '40';

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
      <Text style={[styles.pageTitle, { color: colors.text }]}>More</Text>
      <Text style={[styles.pageSubtitle, { color: colors.textSecondary }]}>Settings and shortcuts</Text>

      {/* App preferences — tap to open Light / System / Dark */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>App preferences</Text>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => {
              router.push('/app-preferences');
            }}
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

      {/* Menu sections */}
      {bySection.map(({ section, items }) => (
        <View key={section} style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{section}</Text>
          <View style={[styles.card, { backgroundColor: colors.card }]}>
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
