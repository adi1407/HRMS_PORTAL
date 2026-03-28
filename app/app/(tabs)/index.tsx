import React, { useEffect, useMemo, useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Pressable,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Spacing, BorderRadius, getAppColors, Colors } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useAuthStore } from '@/store/authStore';
import api from '@/lib/api';

type TodayAttendance = {
  displayStatus?: string;
  status?: string;
  checkIn?: string;
  checkOut?: string;
  checkInTime?: string;
  checkOutTime?: string;
  workingHours?: number;
  date?: string;
};

type MonthRecord = { date?: string; displayStatus?: string; status?: string };
type LeaveRecord = { _id: string; type: string; fromDate: string; toDate: string; status: string; totalDays: number };
type Announcement = { _id: string; title: string; content: string; priority?: string };
type Holiday = { _id: string; name: string; date: string; type?: string };

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const CELL_COLOR: Record<string, string> = {
  FULL_DAY: 'present',
  HALF_DAY: 'half',
  HALF_DAY_DISPLAY: 'half',
  ABSENT: 'absent',
  ON_LEAVE: 'leave',
  HOLIDAY: 'holiday',
  WEEKLY_OFF: 'weekoff',
};

// Calendar cell colors (match web: green present, yellow half, red absent, blue leave, teal holiday/weekoff)
const CAL_STYLES: Record<string, { bg: string; border: string; text: string }> = {
  present: { bg: '#16a34a', border: '#15803d', text: '#fff' },
  half: { bg: '#f59e0b', border: '#d97706', text: '#fff' },
  absent: { bg: '#dc2626', border: '#b91c1c', text: '#fff' },
  leave: { bg: '#2563eb', border: '#1d4ed8', text: '#fff' },
  holiday: { bg: '#059669', border: '#047857', text: '#fff' },
  weekoff: { bg: '#059669', border: '#047857', text: '#fff' },
  other: { bg: '#e5e7eb', border: '#d1d5db', text: '#374151' },
  'no-record': { bg: 'rgba(220,38,38,0.13)', border: 'rgba(220,38,38,0.22)', text: '#b91c1c' },
  'past-off': { bg: 'rgba(156,163,175,0.15)', border: 'rgba(156,163,175,0.22)', text: '#9ca3af' },
  future: { bg: 'rgba(37,99,235,0.05)', border: 'rgba(37,99,235,0.1)', text: '#93c5fd' },
};

function AttendanceCalendar({
  records,
  month,
  year,
  holidays,
}: {
  records: MonthRecord[];
  month: number;
  year: number;
  holidays: Holiday[];
}) {
  const theme = useAppTheme();
  const colors = useMemo(() => getAppColors(theme), [theme]);
  const calStyles = useMemo(() => createCalStyles(colors, theme), [theme]);

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const holidaySet = new Set(
    holidays.map((h) => {
      const d = new Date(h.date);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    })
  );

  const statusMap: Record<string, string> = {};
  records.forEach((r) => {
    if (!r.date) return;
    const d = new Date(r.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    statusMap[key] =
      r.status === 'WEEKLY_OFF' || r.status === 'HOLIDAY' ? r.status : (r.displayStatus || r.status || '');
  });

  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDay = new Date(year, month - 1, 1).getDay();
  const offset = (firstDay + 6) % 7;

  const cells: (number | null)[] = Array(offset).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const rows: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    const row = cells.slice(i, i + 7);
    while (row.length < 7) row.push(null);
    rows.push(row);
  }

  const renderCell = (day: number | null, idx: number) => {
    if (day === null) return <View key={`e-${idx}`} style={calStyles.cellEmpty} />;

    const key = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const status = statusMap[key];
    const isToday = key === todayStr;
    const isFuture = new Date(year, month - 1, day) > today;
    const dow = new Date(year, month - 1, day).getDay();
    const isSunday = dow === 0;
    const isHol = holidaySet.has(key);

    let colorKey = '';
    if (status) {
      colorKey = CELL_COLOR[status] || 'other';
    } else if (isSunday) {
      colorKey = 'weekoff';
    } else if (isHol) {
      colorKey = 'holiday';
    } else if (isFuture) {
      colorKey = 'future';
    } else {
      colorKey = 'no-record';
    }

    const style = CAL_STYLES[colorKey] || CAL_STYLES.other;
    return (
      <View
        key={key}
        style={[
          calStyles.cell,
          { backgroundColor: style.bg, borderColor: style.border },
          isToday && calStyles.cellToday,
        ]}
      >
        <Text style={[calStyles.cellNum, { color: style.text }]}>{day}</Text>
      </View>
    );
  };

  return (
    <View style={calStyles.calendar}>
      <View style={calStyles.weekdays}>
        {WEEKDAYS.map((w) => (
          <Text key={w} style={calStyles.wday}>
            {w}
          </Text>
        ))}
      </View>
      <View style={calStyles.grid}>
        {rows.map((row, ri) => (
          <View key={`r-${ri}`} style={calStyles.gridRow}>
            {row.map((day, di) => renderCell(day, ri * 7 + di))}
          </View>
        ))}
      </View>
      <View style={calStyles.legend}>
        {[
          { key: 'present', label: 'Full Day' },
          { key: 'half', label: 'Half Day' },
          { key: 'absent', label: 'Absent' },
          { key: 'leave', label: 'On Leave' },
          { key: 'holiday', label: 'Holiday / Sunday' },
          { key: 'no-record', label: 'No Record' },
          { key: 'future', label: 'Upcoming' },
        ].map(({ key: k, label }) => (
          <View key={k} style={calStyles.legendItem}>
            <View style={[calStyles.legendDot, { backgroundColor: (CAL_STYLES[k] || CAL_STYLES.other).bg }]} />
            <Text style={calStyles.legendLabel}>{label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function createCalStyles(colors: ReturnType<typeof getAppColors>, theme: 'light' | 'dark') {
  return StyleSheet.create({
    calendar: { width: '100%' },
    weekdays: { flexDirection: 'row', marginBottom: 6 },
    wday: {
      flex: 1,
      textAlign: 'center',
      fontSize: 10,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    grid: { gap: 4 },
    gridRow: { flexDirection: 'row', gap: 4, marginBottom: 4 },
    cell: {
      flex: 1,
      aspectRatio: 1,
      borderRadius: 8,
      borderWidth: 1.5,
      justifyContent: 'center',
      alignItems: 'center',
    },
    cellEmpty: { flex: 1, aspectRatio: 1 },
    cellToday: { borderWidth: 2, borderColor: colors.tint },
    cellNum: { fontSize: 12, fontWeight: '600' },
    legend: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 14,
      paddingTop: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: Colors[theme].separator,
    },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    legendDot: { width: 10, height: 10, borderRadius: 4 },
    legendLabel: { fontSize: 11, color: colors.textSecondary },
  });
}

const HR_ROLES = ['HR', 'DIRECTOR', 'SUPER_ADMIN'];

export default function HomeScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const colors = useMemo(() => getAppColors(theme), [theme]);
  const styles = useMemo(() => createHomeStyles(colors, theme), [theme]);

  const user = useAuthStore((s) => s.user);
  const getRole = useAuthStore((s) => s.getRole);
  const role = getRole();
  const quickActions = useMemo(() => {
    const blue = '#2563eb';
    const purple = '#7c3aed';
    const base = [
      { id: 'checkin', label: 'Check In', icon: 'login' as const, route: '/(tabs)/checkin', color: colors.success },
      { id: 'leave', label: 'Apply Leave', icon: 'event-note' as const, route: '/(tabs)/leave', color: blue },
      { id: 'salary', label: 'My Salary', icon: 'payments' as const, route: '/salary', color: purple },
      { id: 'attendance', label: 'Attendance', icon: 'today' as const, route: '/attendance', color: colors.warning },
    ];
    const hr = [
      { id: 'employees', label: 'Employees', icon: 'people' as const, route: '/employees', color: purple },
      { id: 'recruitment', label: 'Recruitment', icon: 'person-add' as const, route: '/recruitment', color: blue },
    ];
    return HR_ROLES.includes(role) ? [...base, ...hr] : base;
  }, [colors, role]);
  const [today, setToday] = useState<TodayAttendance | null>(null);
  const [monthRecords, setMonthRecords] = useState<MonthRecord[]>([]);
  const [leaves, setLeaves] = useState<LeaveRecord[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const [calendarMonth, setCalendarMonth] = useState(currentMonth);
  const [calendarYear, setCalendarYear] = useState(currentYear);
  const [calendarRecords, setCalendarRecords] = useState<MonthRecord[]>([]);
  const [calendarHolidays, setCalendarHolidays] = useState<Holiday[]>([]);

  const load = async () => {
    const month = currentMonth;
    const year = currentYear;
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    try {
      const [todayRes, monthRes, leavesRes, annRes, holRes] = await Promise.all([
        api.get<{ data: TodayAttendance }>('/attendance/today'),
        api.get<{ data: MonthRecord[] }>(`/attendance/my?month=${month}&year=${year}`),
        api.get<{ data: LeaveRecord[] }>('/leaves/my'),
        api.get<{ data: unknown[] }>('/announcements/active'),
        api.get<{ data: Holiday[] }>(`/holidays?year=${year}`),
      ]);
      setToday(todayRes.data.data ?? null);
      const monthData = monthRes.data.data ?? [];
      setMonthRecords(monthData);
      setLeaves(leavesRes.data.data ?? []);
      setAnnouncements((annRes.data.data ?? []) as Announcement[]);
      const allHol = (holRes.data.data ?? []) as Holiday[];
      const upcoming = allHol.filter((h) => new Date(h.date) >= todayStart).slice(0, 5);
      setHolidays(upcoming);
      setCalendarMonth(month);
      setCalendarYear(year);
      setCalendarRecords(monthData);
      setCalendarHolidays(allHol);
    } catch {
      setToday(null);
      setMonthRecords([]);
      setLeaves([]);
      setHolidays([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadCalendar = async (month: number, year: number) => {
    try {
      const [attRes, holRes] = await Promise.all([
        api.get<{ data: MonthRecord[] }>(`/attendance/my?month=${month}&year=${year}`),
        api.get<{ data: Holiday[] }>(`/holidays?year=${year}`),
      ]);
      setCalendarRecords(attRes.data.data ?? []);
      setCalendarHolidays((holRes.data.data ?? []) as Holiday[]);
    } catch {
      setCalendarRecords([]);
    }
  };

  const isCurrentMonth = calendarMonth === currentMonth && calendarYear === currentYear;
  const handlePrevMonth = () => {
    let m = calendarMonth;
    let y = calendarYear;
    if (m === 1) {
      m = 12;
      y -= 1;
    } else m -= 1;
    setCalendarMonth(m);
    setCalendarYear(y);
    loadCalendar(m, y);
  };
  const handleNextMonth = () => {
    if (isCurrentMonth) return;
    let m = calendarMonth;
    let y = calendarYear;
    if (m === 12) {
      m = 1;
      y += 1;
    } else m += 1;
    setCalendarMonth(m);
    setCalendarYear(y);
    loadCalendar(m, y);
  };

  useEffect(() => {
    load();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  const firstName = user?.name?.split(' ')[0] ?? user?.email ?? 'there';
  const dateStr = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const present = monthRecords.filter((r) => r.displayStatus === 'FULL_DAY').length;
  const halfDay = monthRecords.filter((r) => r.displayStatus === 'HALF_DAY').length;
  const absent = monthRecords.filter((r) => r.displayStatus === 'ABSENT').length;
  const onLeave = monthRecords.filter((r) => r.displayStatus === 'ON_LEAVE').length;
  const totalWorking = present + halfDay + absent + onLeave;
  const attendancePct = totalWorking > 0 ? Math.round(((present + halfDay * 0.5) / totalWorking) * 100) : 0;

  const displayStatus = today?.displayStatus ?? today?.status;
  const statusLabel = displayStatus ? displayStatus.replace(/_/g, ' ') : null;

  const separator = Colors[theme].separator;

  return (
    <ScrollView
      style={[styles.scroll, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.tint} />
      }
      showsVerticalScrollIndicator={false}
    >
      {/* Hero — matches login/splash typography */}
      <View style={styles.hero}>
        <Text style={styles.heroGreeting}>
          {greeting}, <Text style={styles.heroName}>{firstName}</Text>
        </Text>
        <Text style={styles.heroDate}>{dateStr}</Text>
      </View>

      {/* Quick actions — card style like login */}
      <View style={styles.quickSection}>
        <View style={styles.quickGrid}>
          {quickActions.map((qa) => (
            <Pressable
              key={qa.id}
              style={({ pressed }) => [
                styles.quickCard,
                pressed && styles.quickCardPressed,
              ]}
              onPress={() => router.push(qa.route as never)}
            >
              <View style={[styles.quickIconWrap, { backgroundColor: `${qa.color}18` }]}>
                <MaterialIcons name={qa.icon} size={22} color={qa.color} />
              </View>
              <Text style={styles.quickLabel}>{qa.label}</Text>
              <MaterialIcons name="chevron-right" size={18} color={colors.textSecondary} style={styles.quickArrow} />
            </Pressable>
          ))}
        </View>
      </View>

      {/* Today's status card */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Today&apos;s status</Text>
          {attendancePct > 0 && (
            <View style={styles.ringWrap}>
              <Text style={styles.ringText}>{attendancePct}%</Text>
            </View>
          )}
        </View>
        {loading ? (
          <Text style={styles.muted}>Loading…</Text>
        ) : displayStatus ? (
          <View style={styles.todayBody}>
            <View style={styles.statusBadge}>
              <Text style={styles.statusBadgeText}>{statusLabel}</Text>
            </View>
            <View style={styles.timeRows}>
              {today?.checkInTime && (
                <View style={styles.timeRow}>
                  <MaterialIcons name="login" size={16} color={colors.success} />
                  <Text style={styles.muted}>Check in</Text>
                  <Text style={styles.timeVal}>{today.checkInTime}</Text>
                </View>
              )}
              {today?.checkOutTime && (
                <View style={styles.timeRow}>
                  <MaterialIcons name="logout" size={16} color={colors.danger} />
                  <Text style={styles.muted}>Check out</Text>
                  <Text style={styles.timeVal}>{today.checkOutTime}</Text>
                </View>
              )}
              {today?.workingHours != null && today.workingHours > 0 && (
                <View style={styles.timeRow}>
                  <MaterialIcons name="schedule" size={16} color={colors.tint} />
                  <Text style={styles.muted}>Hours</Text>
                  <Text style={styles.timeValAccent}>{today.workingHours}h</Text>
                </View>
              )}
            </View>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.checkInCta}
            onPress={() => router.push('/(tabs)/checkin' as never)}
            activeOpacity={0.82}
          >
            <MaterialIcons name="login" size={22} color="#fff" />
            <Text style={styles.checkInCtaText}>Check in now</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Month stats */}
      {!loading && totalWorking > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>This month</Text>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <View style={[styles.statDot, { backgroundColor: colors.success }]} />
              <Text style={styles.statNum}>{present}</Text>
              <Text style={styles.statLabel}>Present</Text>
            </View>
            <View style={styles.statItem}>
              <View style={[styles.statDot, { backgroundColor: colors.warning }]} />
              <Text style={styles.statNum}>{halfDay}</Text>
              <Text style={styles.statLabel}>Half</Text>
            </View>
            <View style={styles.statItem}>
              <View style={[styles.statDot, { backgroundColor: colors.danger }]} />
              <Text style={styles.statNum}>{absent}</Text>
              <Text style={styles.statLabel}>Absent</Text>
            </View>
            <View style={styles.statItem}>
              <View style={[styles.statDot, { backgroundColor: '#2563eb' }]} />
              <Text style={styles.statNum}>{onLeave}</Text>
              <Text style={styles.statLabel}>Leave</Text>
            </View>
          </View>
        </View>
      )}

      {/* Attendance calendar — green present, yellow half, red absent, etc. */}
      <View style={styles.card}>
        <View style={styles.calHeader}>
          <Text style={styles.cardTitle}>
            Attendance — {MONTH_NAMES[calendarMonth - 1]} {calendarYear}
          </Text>
          <View style={styles.calNav}>
            <TouchableOpacity style={styles.calNavBtn} onPress={handlePrevMonth}>
              <MaterialIcons name="chevron-left" size={22} color={colors.text} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.calNavBtn, isCurrentMonth && styles.calNavBtnDisabled]}
              onPress={handleNextMonth}
              disabled={isCurrentMonth}
            >
              <MaterialIcons name="chevron-right" size={22} color={isCurrentMonth ? colors.textSecondary : colors.text} />
            </TouchableOpacity>
          </View>
        </View>
        <AttendanceCalendar
          records={calendarRecords}
          month={calendarMonth}
          year={calendarYear}
          holidays={calendarHolidays}
        />
      </View>

      {/* My details */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>My details</Text>
        <View style={styles.detailRows}>
          <View style={[styles.detailRow, styles.detailRowFirst]}>
            <Text style={styles.muted}>Department</Text>
            <Text style={styles.detailVal}>{user?.department?.name ?? '—'}</Text>
          </View>
          <View style={[styles.detailRow, { borderTopColor: separator }]}>
            <Text style={styles.muted}>Branch</Text>
            <Text style={styles.detailVal}>{user?.branch?.name ?? '—'}</Text>
          </View>
        </View>
      </View>

      {/* Announcements */}
      {announcements.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Announcements</Text>
          {announcements.slice(0, 2).map((a) => (
            <TouchableOpacity
              key={a._id}
              style={[styles.annRow, { borderTopColor: separator }]}
              onPress={() => router.push('/announcements' as never)}
              activeOpacity={0.7}
            >
              <Text style={styles.annTitle}>{a.title}</Text>
              <Text style={styles.muted} numberOfLines={2}>{a.content}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Upcoming holidays */}
      {holidays.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Upcoming holidays</Text>
          {holidays.map((h) => (
            <View key={h._id} style={[styles.holidayRow, { borderTopColor: separator }]}>
              <MaterialIcons name="event" size={18} color={colors.tint} />
              <View style={styles.holidayInfo}>
                <Text style={styles.holidayName}>{h.name}</Text>
                <Text style={styles.muted}>
                  {new Date(h.date).toLocaleDateString('en-IN', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'long',
                  })}
                </Text>
              </View>
              {h.type ? <Text style={styles.holidayType}>{h.type}</Text> : null}
            </View>
          ))}
        </View>
      )}

      {/* Recent leave */}
      {leaves.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Recent leave</Text>
          {leaves.slice(0, 3).map((l) => (
            <View key={l._id} style={[styles.leaveRow, { borderTopColor: separator }]}>
              <Text style={styles.leaveType}>{l.type}</Text>
              <Text style={styles.muted}>
                {new Date(l.fromDate).toLocaleDateString()} – {new Date(l.toDate).toLocaleDateString()} · {l.status}
              </Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.bottomPad} />
    </ScrollView>
  );
}

function createHomeStyles(colors: ReturnType<typeof getAppColors>, theme: 'light' | 'dark') {
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

  return StyleSheet.create({
    scroll: { flex: 1 },
    content: {
      paddingHorizontal: Spacing.xxl,
      paddingTop: Spacing.lg,
      paddingBottom: Spacing.section,
    },
    bottomPad: { height: Spacing.section },
    hero: { marginBottom: 28 },
    heroGreeting: {
      fontSize: 28,
      fontWeight: '700',
      letterSpacing: -0.5,
      color: colors.text,
      marginBottom: 4,
    },
    heroName: { fontWeight: '700', color: colors.text },
    heroDate: { fontSize: 15, color: colors.textSecondary },
    quickSection: { marginBottom: 24 },
    quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
    quickCard: {
      width: '47%',
      backgroundColor: colors.card,
      borderRadius: BorderRadius.xl,
      padding: Spacing.lg,
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 64,
      ...cardShadow,
    },
    quickCardPressed: { opacity: 0.88 },
    quickIconWrap: {
      width: 44,
      height: 44,
      borderRadius: BorderRadius.md,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: Spacing.md,
    },
    quickLabel: { flex: 1, fontSize: 16, fontWeight: '600', color: colors.text },
    quickArrow: { marginLeft: Spacing.xs },
    card: {
      backgroundColor: colors.card,
      borderRadius: BorderRadius.xl,
      padding: Spacing.xl,
      marginBottom: Spacing.xl,
      ...cardShadow,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: Spacing.md,
    },
    cardTitle: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.text,
      letterSpacing: -0.3,
    },
    ringWrap: { paddingHorizontal: Spacing.sm },
    ringText: { fontSize: 15, fontWeight: '700', color: colors.tint },
    calHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: Spacing.md,
    },
    calNav: { flexDirection: 'row', gap: 4 },
    calNavBtn: {
      width: 36,
      height: 36,
      borderRadius: BorderRadius.sm,
      backgroundColor: colors.background,
      justifyContent: 'center',
      alignItems: 'center',
    },
    calNavBtnDisabled: { opacity: 0.5 },
    todayBody: {},
    statusBadge: {
      alignSelf: 'flex-start',
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderRadius: BorderRadius.md,
      marginBottom: Spacing.md,
      backgroundColor: `${colors.tint}18`,
    },
    statusBadgeText: { fontSize: 15, fontWeight: '600', color: colors.tint },
    timeRows: { gap: Spacing.sm },
    timeRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    timeVal: { marginLeft: 'auto', fontSize: 15, fontWeight: '500', color: colors.text },
    timeValAccent: { marginLeft: 'auto', fontSize: 15, fontWeight: '600', color: colors.tint },
    checkInCta: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.sm,
      height: 52,
      borderRadius: BorderRadius.md,
      backgroundColor: colors.tint,
    },
    checkInCtaText: { fontSize: 17, fontWeight: '600', color: '#FFFFFF' },
    muted: { fontSize: 15, color: colors.textSecondary },
    statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.md },
    statItem: { alignItems: 'center', minWidth: 72 },
    statDot: { width: 8, height: 8, borderRadius: 4, marginBottom: Spacing.xs },
    statNum: { fontSize: 22, fontWeight: '700', color: colors.text },
    statLabel: { fontSize: 13, color: colors.textSecondary },
    detailRows: {},
    detailRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: Spacing.md,
      borderTopWidth: StyleSheet.hairlineWidth,
    },
    detailRowFirst: { borderTopWidth: 0 },
    detailVal: { fontSize: 15, fontWeight: '500', color: colors.text },
    annRow: { paddingVertical: Spacing.md, borderTopWidth: StyleSheet.hairlineWidth },
    annTitle: { fontWeight: '600', marginBottom: 2, fontSize: 15, color: colors.text },
    holidayRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: Spacing.md,
      borderTopWidth: StyleSheet.hairlineWidth,
      gap: Spacing.md,
    },
    holidayInfo: { flex: 1 },
    holidayName: { fontWeight: '600', fontSize: 15, color: colors.text },
    holidayType: { fontSize: 13, color: colors.textSecondary },
    leaveRow: { paddingVertical: Spacing.md, borderTopWidth: StyleSheet.hairlineWidth },
    leaveType: { fontWeight: '600', marginBottom: 2, fontSize: 15, color: colors.text },
  });
}
