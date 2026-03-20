import React, { useEffect, useState, useCallback } from 'react';
import {
  ScrollView,
  View,
  Text,
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
import { useAuthStore } from '@/store/authStore';
import { downloadAndShareFromApi } from '@/lib/download';

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  DRAFT: { bg: '#f3f4f6', color: '#6b7280' },
  SELF_REVIEW: { bg: '#fef3c7', color: '#b45309' },
  MANAGER_REVIEW: { bg: '#dbeafe', color: '#2563eb' },
  COMPLETED: { bg: '#dcfce7', color: '#15803d' },
};
const RATING_COLORS: Record<string, { bg: string; color: string }> = {
  OUTSTANDING: { bg: '#dcfce7', color: '#15803d' },
  EXCEEDS_EXPECTATIONS: { bg: '#dbeafe', color: '#2563eb' },
  MEETS_EXPECTATIONS: { bg: '#fef3c7', color: '#b45309' },
  NEEDS_IMPROVEMENT: { bg: '#fed7aa', color: '#c2410c' },
  UNSATISFACTORY: { bg: '#fee2e2', color: '#b91c1c' },
};
const RATING_LABELS: Record<string, string> = {
  OUTSTANDING: 'Outstanding',
  EXCEEDS_EXPECTATIONS: 'Exceeds Expectations',
  MEETS_EXPECTATIONS: 'Meets Expectations',
  NEEDS_IMPROVEMENT: 'Needs Improvement',
  UNSATISFACTORY: 'Unsatisfactory',
};

type Kpi = {
  _id: string;
  title?: string;
  description?: string;
  weight?: number;
  selfScore?: number;
  selfComment?: string;
  managerScore?: number;
  managerComment?: string;
};

type Appraisal = {
  _id: string;
  appraisalId?: string;
  cycleName?: string;
  cycleType?: string;
  period?: { startDate: string; endDate: string };
  status?: string;
  rating?: string;
  finalScore?: number;
  weightedSelfScore?: number;
  weightedManagerScore?: number;
  overallSelfComment?: string;
  overallManagerComment?: string;
  employee?: { _id: string; name?: string; employeeId?: string; designation?: string };
  reviewer?: { _id?: string; name?: string };
  kpis?: Kpi[];
  createdAt?: string;
};

function fmt(d: string | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function AppraisalsScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [myList, setMyList] = useState<Appraisal[]>([]);
  const [toReviewList, setToReviewList] = useState<Appraisal[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<'my' | 'review'>('my');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Appraisal | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const load = useCallback(async () => {
    try {
      const [myRes, reviewRes] = await Promise.all([
        api.get<{ data: Appraisal[] }>('/appraisals/my'),
        api.get<{ data: Appraisal[] }>('/appraisals/to-review'),
      ]);
      setMyList(myRes.data.data ?? []);
      setToReviewList(reviewRes.data.data ?? []);
    } catch {
      setMyList([]);
      setToReviewList([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const loadDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    setDetail(null);
    try {
      const { data } = await api.get<{ data: Appraisal }>(`/appraisals/${id}`);
      setDetail(data.data ?? null);
    } catch {
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedId) loadDetail(selectedId);
    else setDetail(null);
  }, [selectedId, loadDetail]);

  const downloadPdf = async () => {
    if (!detail?.appraisalId || !detail._id) return;
    setDownloadingPdf(true);
    try {
      await downloadAndShareFromApi({
        path: `/appraisals/${detail._id}/pdf`,
        fileName: `Appraisal_${detail.appraisalId}.pdf`,
        mimeType: 'application/pdf',
        dialogTitle: `Appraisal ${detail.appraisalId}`,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'PDF is only available for completed appraisals.';
      Alert.alert('Download failed', msg);
    } finally {
      setDownloadingPdf(false);
    }
  };

  const list = tab === 'my' ? myList : toReviewList;
  const st = (s?: string) => STATUS_COLORS[s ?? ''] ?? STATUS_COLORS.DRAFT;
  const rc = (r?: string) => RATING_COLORS[r ?? ''] ?? null;

  // Detail view
  if (selectedId) {
    const d = detail;
    const isOwner = d?.employee?._id === user?._id;
    const isReviewer = !!d?.reviewer?._id && d.reviewer._id === (user as { _id?: string })?._id;
    const isAdmin = ['HR', 'DIRECTOR', 'SUPER_ADMIN'].includes((user as { role?: string })?.role ?? '');
    const canSelfReview = isOwner && d?.status === 'SELF_REVIEW';
    const canManagerReview = (isReviewer || isAdmin) && d?.status === 'MANAGER_REVIEW';
    const canDownloadPdf = d?.status === 'COMPLETED' && (isAdmin || isOwner);

    if (detailLoading || !d) {
      return (
        <View style={[styles.screen, { backgroundColor: AppColors.background }]}>
          <SafeAreaView style={styles.safeTop}>
            <View style={styles.header}>
              <TouchableOpacity style={styles.backBtn} onPress={() => { setSelectedId(null); setDetail(null); }} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <MaterialIcons name={Platform.OS === 'ios' ? 'arrow-back-ios' : 'arrow-back'} size={Platform.OS === 'ios' ? 22 : 24} color={AppColors.text} />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Appraisal</Text>
              <View style={styles.backBtn} />
            </View>
          </SafeAreaView>
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={AppColors.tint} />
            <Text style={styles.muted}>Loading…</Text>
          </View>
        </View>
      );
    }

    const sc = st(d.status);
    const ratingStyle = rc(d.rating);

    return (
      <View style={[styles.screen, { backgroundColor: AppColors.background }]}>
        <SafeAreaView style={styles.safeTop}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backBtn} onPress={() => { setSelectedId(null); setDetail(null); }} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <MaterialIcons name={Platform.OS === 'ios' ? 'arrow-back-ios' : 'arrow-back'} size={Platform.OS === 'ios' ? 22 : 24} color={AppColors.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{d.appraisalId ?? 'Appraisal'}</Text>
            <View style={styles.backBtn} />
          </View>
        </SafeAreaView>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Header card */}
          <View style={[styles.detailCard, { borderLeftWidth: 4, borderLeftColor: sc.color }]}>
            <View style={styles.detailCardTop}>
              <View>
                <Text style={styles.detailName}>{d.employee?.name ?? '—'}</Text>
                <Text style={styles.detailMeta}>{d.employee?.employeeId} · {d.cycleName} · {d.employee?.designation ?? '—'}</Text>
                <Text style={styles.detailMetaSmall}>{fmt(d.period?.startDate)} to {fmt(d.period?.endDate)}</Text>
                <Text style={styles.detailMetaSmall}>Reviewer: {d.reviewer?.name ?? '—'}</Text>
              </View>
              <View style={styles.detailBadges}>
                <View style={[styles.badge, { backgroundColor: '#f3f4f6' }]}>
                  <Text style={[styles.badgeText, { color: '#374151' }]}>{d.appraisalId}</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: sc.bg }]}>
                  <Text style={[styles.badgeText, { color: sc.color }]}>{d.status?.replace(/_/g, ' ')}</Text>
                </View>
                {d.rating && ratingStyle && (
                  <View style={[styles.badge, { backgroundColor: ratingStyle.bg }]}>
                    <Text style={[styles.badgeText, { color: ratingStyle.color }]}>{RATING_LABELS[d.rating] ?? d.rating}</Text>
                  </View>
                )}
              </View>
            </View>
            {d.status === 'COMPLETED' && d.finalScore != null && ratingStyle && (
              <View style={[styles.scoreBlock, { backgroundColor: ratingStyle.bg }]}>
                <Text style={[styles.scoreValue, { color: ratingStyle.color }]}>{d.finalScore}/5</Text>
                <Text style={[styles.scoreLabel, { color: ratingStyle.color }]}>{RATING_LABELS[d.rating ?? '']}</Text>
              </View>
            )}
            {canDownloadPdf && (
              <TouchableOpacity style={styles.pdfBtn} onPress={downloadPdf} disabled={downloadingPdf}>
                {downloadingPdf ? <ActivityIndicator size="small" color={AppColors.tint} /> : <MaterialIcons name="picture-as-pdf" size={20} color={AppColors.tint} />}
                <Text style={styles.pdfBtnText}>{downloadingPdf ? 'Downloading…' : 'Download PDF'}</Text>
              </TouchableOpacity>
            )}
          </View>

          {canSelfReview && (
            <View style={[styles.banner, { backgroundColor: '#fef3c7' }]}>
              <MaterialIcons name="info" size={20} color={AppColors.tint} />
              <Text style={[styles.bannerText, { color: '#92400e' }]}>Complete your self-review on the web portal.</Text>
            </View>
          )}
          {canManagerReview && (
            <View style={[styles.banner, { backgroundColor: '#dbeafe' }]}>
              <MaterialIcons name="info" size={20} color={AppColors.tint} />
              <Text style={[styles.bannerText, { color: '#1e40af' }]}>Complete manager review on the web portal.</Text>
            </View>
          )}

          {/* KPI breakdown */}
          {d.kpis && d.kpis.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>KPI Breakdown</Text>
              {d.kpis.map((kpi) => (
                <View key={kpi._id} style={styles.kpiCard}>
                  <View style={styles.kpiRow}>
                    <Text style={styles.kpiTitle}>{kpi.title}</Text>
                    <View style={[styles.badge, { backgroundColor: '#f3f4f6' }]}>
                      <Text style={[styles.badgeText, { color: '#374151' }]}>{kpi.weight ?? 0}%</Text>
                    </View>
                  </View>
                  {kpi.description ? <Text style={styles.kpiDesc}>{kpi.description}</Text> : null}
                  <View style={styles.kpiScores}>
                    <Text style={styles.kpiScoreText}>Self: {kpi.selfScore != null ? `${kpi.selfScore}/5` : '—'}</Text>
                    <Text style={styles.kpiScoreText}>Manager: {kpi.managerScore != null ? `${kpi.managerScore}/5` : '—'}</Text>
                  </View>
                  {kpi.selfComment ? <Text style={styles.kpiComment}>Self: "{kpi.selfComment}"</Text> : null}
                  {kpi.managerComment ? <Text style={[styles.kpiComment, { color: '#1e40af' }]}>Manager: "{kpi.managerComment}"</Text> : null}
                </View>
              ))}
            </>
          )}

          {/* Overall comments */}
          {(d.overallSelfComment || d.overallManagerComment) && (
            <View style={styles.commentsCard}>
              {d.overallSelfComment ? (
                <View style={styles.commentBlock}>
                  <Text style={styles.commentLabel}>Employee's overall comment</Text>
                  <Text style={styles.commentValue}>{d.overallSelfComment}</Text>
                </View>
              ) : null}
              {d.overallManagerComment ? (
                <View style={styles.commentBlock}>
                  <Text style={styles.commentLabel}>Manager's overall comment</Text>
                  <Text style={[styles.commentValue, { color: '#1e3a8a' }]}>{d.overallManagerComment}</Text>
                </View>
              ) : null}
            </View>
          )}

          {/* Score summary when completed */}
          {d.status === 'COMPLETED' && (
            <View style={styles.summaryCard}>
              <Text style={styles.summaryRow}>Self score: <Text style={styles.summaryBold}>{d.weightedSelfScore?.toFixed(2) ?? '—'}/5</Text></Text>
              <Text style={styles.summaryRow}>Manager score: <Text style={styles.summaryBold}>{d.weightedManagerScore?.toFixed(2) ?? '—'}/5</Text></Text>
              <Text style={styles.summaryRow}>Final: <Text style={[styles.summaryBold, ratingStyle && { color: ratingStyle.color }]}>{d.finalScore?.toFixed(2) ?? '—'}/5 — {RATING_LABELS[d.rating ?? ''] ?? '—'}</Text></Text>
            </View>
          )}

          <View style={styles.bottomPad} />
        </ScrollView>
      </View>
    );
  }

  // List view
  return (
    <View style={[styles.screen, { backgroundColor: AppColors.background }]}>
      <SafeAreaView style={styles.safeTop}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <MaterialIcons name={Platform.OS === 'ios' ? 'arrow-back-ios' : 'arrow-back'} size={Platform.OS === 'ios' ? 22 : 24} color={AppColors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Appraisals</Text>
          <View style={styles.backBtn} />
        </View>
      </SafeAreaView>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={AppColors.tint} />}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.pageSubtitle}>View your appraisals and complete assessments</Text>

        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tab, tab === 'my' && styles.tabActive]}
            onPress={() => setTab('my')}
          >
            <Text style={[styles.tabText, tab === 'my' && styles.tabTextActive]}>My Appraisals ({myList.length})</Text>
          </TouchableOpacity>
          {toReviewList.length > 0 && (
            <TouchableOpacity
              style={[styles.tab, tab === 'review' && styles.tabActive]}
              onPress={() => setTab('review')}
            >
              <Text style={[styles.tabText, tab === 'review' && styles.tabTextActive]}>To Review ({toReviewList.length})</Text>
            </TouchableOpacity>
          )}
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={AppColors.tint} />
            <Text style={styles.muted}>Loading…</Text>
          </View>
        ) : list.length === 0 ? (
          <View style={styles.emptyCard}>
            <MaterialIcons name="star" size={48} color={AppColors.textSecondary} />
            <Text style={styles.emptyText}>{tab === 'my' ? 'No appraisals yet' : 'No reviews pending'}</Text>
            <Text style={styles.muted}>
              {tab === 'my' ? 'Your appraisals will appear here when assigned.' : 'No employees need your review right now.'}
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {list.map((a) => {
              const sc2 = st(a.status);
              const rc2 = rc(a.rating);
              return (
                <TouchableOpacity
                  key={a._id}
                  style={[styles.card, { borderLeftWidth: 4, borderLeftColor: sc2.color }]}
                  onPress={() => setSelectedId(a._id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.cardTop}>
                    <View style={styles.badgeRow}>
                      {tab === 'review' && a.employee?.name ? (
                        <Text style={styles.employeeName}>{a.employee.name}</Text>
                      ) : null}
                      <View style={[styles.badge, { backgroundColor: '#f3f4f6' }]}>
                        <Text style={[styles.badgeText, { color: '#374151' }]}>{a.appraisalId ?? '—'}</Text>
                      </View>
                      <View style={[styles.badge, { backgroundColor: '#ede9fe' }]}>
                        <Text style={[styles.badgeText, { color: '#6d28d9' }]}>{a.cycleName ?? '—'}</Text>
                      </View>
                      <View style={[styles.badge, { backgroundColor: sc2.bg }]}>
                        <Text style={[styles.badgeText, { color: sc2.color }]}>{a.status?.replace(/_/g, ' ') ?? '—'}</Text>
                      </View>
                      {rc2 && a.rating ? (
                        <View style={[styles.badge, { backgroundColor: rc2.bg }]}>
                          <Text style={[styles.badgeText, { color: rc2.color }]}>{RATING_LABELS[a.rating] ?? a.rating}</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={styles.cardDate}>{fmt(a.period?.startDate)} — {fmt(a.period?.endDate)}</Text>
                  </View>
                  <Text style={styles.cardMeta}>
                    {a.kpis?.length ?? 0} KPIs · Reviewer: {a.reviewer?.name ?? '—'}
                    {a.finalScore != null ? ` · Score: ${a.finalScore}/5` : ''}
                  </Text>
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
  headerTitle: { fontSize: 18, fontWeight: '700', color: AppColors.text },
  scroll: { flex: 1 },
  content: { padding: Spacing.xl, paddingBottom: Spacing.section },
  bottomPad: { height: Spacing.section },
  pageSubtitle: { fontSize: 15, color: AppColors.textSecondary, marginBottom: Spacing.lg },
  tabRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg, flexWrap: 'wrap' },
  tab: {
    paddingVertical: 10,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    borderColor: 'rgba(118,118,128,0.3)',
  },
  tabActive: { backgroundColor: AppColors.tint, borderColor: AppColors.tint },
  tabText: { fontSize: 14, fontWeight: '600', color: AppColors.textSecondary },
  tabTextActive: { color: '#fff' },
  muted: { fontSize: 14, color: AppColors.textSecondary, marginTop: Spacing.sm },
  loadingWrap: { alignItems: 'center', paddingVertical: Spacing.xxl },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
    backgroundColor: AppColors.card,
    borderRadius: BorderRadius.xl,
    ...CardShadow,
  },
  emptyText: { fontSize: 17, fontWeight: '600', color: AppColors.text, marginTop: Spacing.md },
  list: { gap: Spacing.md },
  card: {
    backgroundColor: AppColors.card,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    ...CardShadow,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: 6 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  employeeName: { fontSize: 15, fontWeight: '700', color: AppColors.text, marginRight: 4 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  cardDate: { fontSize: 12, color: AppColors.textSecondary },
  cardMeta: { fontSize: 13, color: AppColors.textSecondary },
  // Detail
  detailCard: {
    backgroundColor: AppColors.card,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    ...CardShadow,
  },
  detailCardTop: { marginBottom: Spacing.md },
  detailName: { fontSize: 17, fontWeight: '700', color: AppColors.text },
  detailMeta: { fontSize: 14, color: AppColors.textSecondary, marginTop: 2 },
  detailMetaSmall: { fontSize: 12, color: AppColors.textSecondary, marginTop: 2 },
  detailBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: Spacing.sm },
  scoreBlock: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingHorizontal: Spacing.md, borderRadius: BorderRadius.md, alignSelf: 'flex-start', marginBottom: Spacing.sm },
  scoreValue: { fontSize: 16, fontWeight: '700' },
  scoreLabel: { fontSize: 13, fontWeight: '600' },
  pdfBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    borderColor: AppColors.tint,
    alignSelf: 'flex-start',
  },
  pdfBtnText: { fontSize: 14, fontWeight: '600', color: AppColors.tint },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
  },
  bannerText: { fontSize: 14, fontWeight: '500', flex: 1 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: AppColors.text, marginBottom: Spacing.md },
  kpiCard: {
    backgroundColor: AppColors.card,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    ...CardShadow,
  },
  kpiRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 },
  kpiTitle: { fontSize: 15, fontWeight: '700', color: AppColors.text, flex: 1 },
  kpiDesc: { fontSize: 13, color: AppColors.textSecondary, marginTop: 4 },
  kpiScores: { flexDirection: 'row', gap: Spacing.lg, marginTop: 6 },
  kpiScoreText: { fontSize: 13, color: AppColors.text },
  kpiComment: { fontSize: 12, color: AppColors.textSecondary, marginTop: 4, fontStyle: 'italic' },
  commentsCard: { backgroundColor: AppColors.card, borderRadius: BorderRadius.xl, padding: Spacing.lg, marginBottom: Spacing.lg, ...CardShadow },
  commentBlock: { marginBottom: Spacing.md },
  commentLabel: { fontSize: 13, fontWeight: '600', color: AppColors.textSecondary },
  commentValue: { fontSize: 14, color: AppColors.text, marginTop: 4, lineHeight: 20 },
  summaryCard: { backgroundColor: AppColors.card, borderRadius: BorderRadius.xl, padding: Spacing.lg, ...CardShadow },
  summaryRow: { fontSize: 14, color: AppColors.text, marginBottom: 4 },
  summaryBold: { fontWeight: '700' },
});
