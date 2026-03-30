import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import api from '@/lib/api';
import { Spacing, BorderRadius } from '@/constants/theme';
import { useAppColors, useAppTheme } from '@/hooks/use-app-theme';
import { useAuthStore } from '@/store/authStore';

type Ratee = { _id: string; name: string; employeeId: string; role: string };
type RatingRow = {
  _id: string;
  score: number;
  review: string;
  weekLabel: string;
  ratee?: Ratee | null;
  rater?: Ratee | null;
};

const GRANS = [
  { v: 'week', l: 'Weekly' },
  { v: 'month', l: 'Monthly' },
  { v: 'quarter', l: 'Quarterly' },
  { v: 'half_year', l: 'Half-year' },
  { v: 'year', l: 'Yearly' },
];

function canSubmit(role: string) {
  return ['HR', 'DIRECTOR', 'SUPER_ADMIN', 'EMPLOYEE'].includes(role);
}

function isAdmin(role: string) {
  return role === 'SUPER_ADMIN' || role === 'DIRECTOR';
}

export default function FeedbackRatingsScreen() {
  const router = useRouter();
  const colors = useAppColors();
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const role = useAuthStore((s) => s.user?.role) || '';

  const [tab, setTab] = useState<'submit' | 'received' | 'given' | 'charts' | 'admin'>(
    canSubmit(role) ? 'submit' : 'received'
  );

  const [weekInfo, setWeekInfo] = useState<{ weekLabel: string; reviewMin: number; reviewMax: number } | null>(null);
  const [ratees, setRatees] = useState<Ratee[]>([]);
  const [rateeId, setRateeId] = useState('');
  const [score, setScore] = useState(5);
  const [review, setReview] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const [received, setReceived] = useState<RatingRow[]>([]);
  const [given, setGiven] = useState<RatingRow[]>([]);
  const [audit, setAudit] = useState<RatingRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [granularity, setGranularity] = useState('month');
  const [chartText, setChartText] = useState('');
  const [adminChartText, setAdminChartText] = useState('');

  const loadBase = useCallback(async () => {
    try {
      const { data } = await api.get('/feedback-ratings/week-info');
      setWeekInfo(data.data);
    } catch {
      setWeekInfo(null);
    }
    if (canSubmit(role)) {
      try {
        const { data } = await api.get('/feedback-ratings/eligible-ratees');
        setRatees(data.data?.ratees || []);
      } catch {
        setRatees([]);
      }
    }
  }, [role]);

  useEffect(() => {
    loadBase();
  }, [loadBase]);

  useEffect(() => {
    if (!canSubmit(role) && tab === 'submit') setTab('received');
  }, [role, tab]);

  const loadReceived = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/feedback-ratings/me/received');
      setReceived(data.data?.ratings || []);
    } catch {
      setReceived([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadGiven = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/feedback-ratings/me/given');
      setGiven(data.data?.ratings || []);
    } catch {
      setGiven([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAudit = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/feedback-ratings/admin/audit?limit=80');
      setAudit(data.data?.ratings || []);
    } catch {
      setAudit([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCharts = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/feedback-ratings/analytics/me?granularity=${granularity}`);
      const s = data.data;
      if (s?.labels?.length) {
        const lines = s.labels.map((lab: string, i: number) => `${lab}: avg ${s.averages[i]?.toFixed(2) ?? '—'} (n=${s.counts[i] ?? 0})`);
        setChartText(lines.join('\n'));
      } else setChartText('No data in range.');
      if (isAdmin(role)) {
        const { data: ad } = await api.get(`/feedback-ratings/admin/analytics?granularity=${granularity}`);
        const o = ad.data;
        if (o?.labels?.length) {
          const lines = o.labels.map((lab: string, i: number) => `${lab}: avg ${o.averages[i]?.toFixed(2) ?? '—'} (n=${o.counts[i] ?? 0})`);
          setAdminChartText(lines.join('\n'));
        } else setAdminChartText('No org data.');
      }
    } catch {
      setChartText('Failed to load.');
      setAdminChartText('');
    } finally {
      setLoading(false);
    }
  }, [granularity, role]);

  useEffect(() => {
    if (tab === 'received') loadReceived();
    if (tab === 'given') loadGiven();
    if (tab === 'admin') loadAudit();
    if (tab === 'charts') loadCharts();
  }, [tab, loadReceived, loadGiven, loadAudit, loadCharts]);

  const submit = async () => {
    setMsg('');
    const min = weekInfo?.reviewMin ?? 20;
    if (!rateeId) {
      setMsg('Select who you are rating.');
      return;
    }
    if (review.trim().length < min) {
      setMsg(`Review at least ${min} characters.`);
      return;
    }
    setBusy(true);
    try {
      await api.post('/feedback-ratings', {
        rateeId,
        score,
        review: review.trim(),
      });
      setMsg('Submitted.');
      setReview('');
      loadGiven();
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { message?: string } } };
      setMsg(ax?.response?.data?.message || 'Failed.');
    } finally {
      setBusy(false);
    }
  };

  const Tab = ({ id, label }: { id: typeof tab; label: string }) => (
    <TouchableOpacity
      style={[styles.tab, tab === id && { backgroundColor: colors.tint + '33', borderColor: colors.tint }]}
      onPress={() => setTab(id)}
    >
      <Text style={[styles.tabText, { color: tab === id ? colors.tint : colors.textSecondary }]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
      <View style={[styles.header, { borderBottomColor: colors.textSecondary + '30' }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <MaterialIcons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Weekly feedback</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsRow}>
        {canSubmit(role) && <Tab id="submit" label="Submit" />}
        <Tab id="received" label="About me" />
        {canSubmit(role) && <Tab id="given" label="I rated" />}
        <Tab id="charts" label="Charts" />
        {isAdmin(role) && <Tab id="admin" label="Audit" />}
      </ScrollView>

      <ScrollView style={styles.body} contentContainerStyle={{ padding: Spacing.lg, paddingBottom: insets.bottom + 24 }}>
        {tab === 'submit' && canSubmit(role) && (
          <View>
            {weekInfo && (
              <Text style={{ color: colors.textSecondary, marginBottom: Spacing.md }}>Week (IST): {weekInfo.weekLabel}</Text>
            )}
            <Text style={[styles.label, { color: colors.text }]}>Who to rate</Text>
            <ScrollView style={{ maxHeight: 160 }} nestedScrollEnabled>
              {ratees.map((u) => (
                <TouchableOpacity
                  key={u._id}
                  style={[
                    styles.pickRow,
                    { borderColor: rateeId === u._id ? colors.tint : colors.textSecondary + '30' },
                  ]}
                  onPress={() => setRateeId(u._id)}
                >
                  <Text style={{ color: colors.text }}>
                    {u.name} ({u.employeeId}) — {u.role}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Text style={[styles.label, { color: colors.text }]}>Score</Text>
            <View style={[styles.scoreRow, { flexWrap: 'wrap' }]}>
              {[1, 2, 3, 4, 5].map((n) => (
                <TouchableOpacity
                  key={n}
                  onPress={() => setScore(n)}
                  style={[
                    styles.scoreBtn,
                    { borderColor: score === n ? colors.tint : colors.textSecondary + '40', backgroundColor: score === n ? colors.tint + '22' : 'transparent' },
                  ]}
                >
                  <Text style={{ color: colors.text, fontWeight: '700' }}>{n}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={[styles.label, { color: colors.text }]}>Review ({weekInfo?.reviewMin ?? 20}+ chars)</Text>
            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.textSecondary + '40' }]}
              multiline
              value={review}
              onChangeText={setReview}
              placeholder="Written reason (required)"
              placeholderTextColor={colors.textSecondary}
            />
            {msg ? <Text style={{ color: msg.includes('Submit') ? '#15803d' : colors.destructive, marginBottom: 8 }}>{msg}</Text> : null}
            <TouchableOpacity style={[styles.btn, { backgroundColor: colors.tint }]} onPress={submit} disabled={busy}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Submit</Text>}
            </TouchableOpacity>
          </View>
        )}

        {tab === 'received' &&
          (loading ? (
            <ActivityIndicator color={colors.tint} />
          ) : received.length === 0 ? (
            <Text style={{ color: colors.textSecondary }}>No feedback yet.</Text>
          ) : (
            received.map((r) => (
              <View key={r._id} style={[styles.card, { backgroundColor: colors.card }]}>
                <Text style={{ fontWeight: '700', color: colors.text }}>
                  {r.score}/5 — {r.weekLabel}
                </Text>
                <Text style={{ color: colors.text, marginTop: 8 }}>{r.review}</Text>
                <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 6 }}>Anonymous rater</Text>
              </View>
            ))
          ))}

        {tab === 'given' &&
          (loading ? (
            <ActivityIndicator color={colors.tint} />
          ) : given.length === 0 ? (
            <Text style={{ color: colors.textSecondary }}>Nothing submitted yet.</Text>
          ) : (
            given.map((r) => (
              <View key={r._id} style={[styles.card, { backgroundColor: colors.card }]}>
                <Text style={{ fontWeight: '700', color: colors.text }}>
                  {r.ratee?.name} — {r.score}/5
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{r.weekLabel}</Text>
                <Text style={{ color: colors.text, marginTop: 8 }}>{r.review}</Text>
              </View>
            ))
          ))}

        {tab === 'charts' && (
          <View>
            <Text style={[styles.label, { color: colors.text }]}>Granularity</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              {GRANS.map((g) => (
                <TouchableOpacity
                  key={g.v}
                  onPress={() => setGranularity(g.v)}
                  style={[
                    styles.granChip,
                    { borderColor: granularity === g.v ? colors.tint : colors.textSecondary + '40' },
                  ]}
                >
                  <Text style={{ color: colors.text, fontSize: 13 }}>{g.l}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={[styles.btn, { backgroundColor: colors.tint, marginBottom: 16 }]} onPress={loadCharts}>
              <Text style={styles.btnText}>Refresh</Text>
            </TouchableOpacity>
            {loading ? (
              <ActivityIndicator color={colors.tint} />
            ) : (
              <>
                <Text style={{ fontWeight: '700', color: colors.text, marginBottom: 8 }}>My received (avg)</Text>
                <Text style={{ color: colors.text, lineHeight: 22 }}>{chartText || '—'}</Text>
                {isAdmin(role) && (
                  <>
                    <Text style={{ fontWeight: '700', color: colors.text, marginTop: 16, marginBottom: 8 }}>Organization</Text>
                    <Text style={{ color: colors.text, lineHeight: 22 }}>{adminChartText || '—'}</Text>
                  </>
                )}
              </>
            )}
          </View>
        )}

        {tab === 'admin' && isAdmin(role) &&
          (loading ? (
            <ActivityIndicator color={colors.tint} />
          ) : audit.length === 0 ? (
            <Text style={{ color: colors.textSecondary }}>No rows.</Text>
          ) : (
            audit.map((r) => (
              <View key={r._id} style={[styles.card, { backgroundColor: colors.card }]}>
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{r.weekLabel}</Text>
                <Text style={{ color: colors.text }}>
                  {r.rater?.name} → {r.ratee?.name} — {r.score}/5
                </Text>
                <Text style={{ color: colors.text, marginTop: 6 }}>{r.review}</Text>
              </View>
            ))
          ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: 18, fontWeight: '700', flex: 1, textAlign: 'center' },
  tabsRow: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, gap: 8 },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: 'transparent',
    marginRight: 8,
  },
  tabText: { fontSize: 13, fontWeight: '600' },
  body: { flex: 1 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 6, marginTop: 12 },
  input: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    minHeight: 100,
    padding: 12,
    textAlignVertical: 'top',
  },
  pickRow: { padding: 10, borderRadius: BorderRadius.md, borderWidth: 1, marginBottom: 6 },
  scoreRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  scoreBtn: { width: 44, height: 44, borderRadius: BorderRadius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  granChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: BorderRadius.full, borderWidth: 1, marginRight: 8 },
  btn: { padding: 14, borderRadius: BorderRadius.md, alignItems: 'center', marginTop: 16 },
  btnText: { color: '#fff', fontWeight: '700' },
  card: { padding: 14, borderRadius: BorderRadius.lg, marginBottom: 10 },
});
