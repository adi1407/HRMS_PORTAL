import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import * as Location from 'expo-location';
import * as LocalAuthentication from 'expo-local-authentication';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Spacing, BorderRadius } from '@/constants/theme';
import api from '@/lib/api';
import {
  getAttendanceBiometricOptions,
  getBiometricAttendanceReadinessError,
} from '@/lib/attendanceBiometric';
import { useAuthStore } from '@/store/authStore';

// Match splash + login: light-only, premium Apple-style
const COLORS = {
  background: '#F2F2F7',
  card: '#FFFFFF',
  text: '#1C1C1E',
  textSecondary: '#8E8E93',
  tint: '#6366f1',
  success: '#059669',
  danger: '#dc2626',
  warning: '#d97706',
};
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

type TodayRecord = {
  checkIn?: string;
  checkOut?: string;
  checkInTime?: string;
  checkOutTime?: string;
  displayStatus?: string;
  workingHours?: number;
};
type Branch = { _id: string; name: string; wifiSSIDs?: string[] };

export default function CheckInScreen() {
  const user = useAuthStore((s) => s.user);
  const [todayRecord, setTodayRecord] = useState<TodayRecord | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  // Location
  const [geoCoords, setGeoCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [geoStatus, setGeoStatus] = useState<'getting' | 'success' | 'denied' | 'error'>('getting');
  const [geoMessage, setGeoMessage] = useState('Getting your location...');

  // WiFi (user must select when branch has wifiSSIDs)
  const [wifiSSID, setWifiSSID] = useState('');
  const [branchSSIDs, setBranchSSIDs] = useState<string[]>([]);

  // Report to HR
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [requestMsg, setRequestMsg] = useState('');
  const [requestSending, setRequestSending] = useState(false);
  const [requestSent, setRequestSent] = useState(false);

  /** HR enables in Employees; employee completes on this device. */
  const [biometricAttendanceEnabled, setBiometricAttendanceEnabled] = useState(false);
  const [biometricMobileEnrolled, setBiometricMobileEnrolled] = useState(false);
  const [enrollingBio, setEnrollingBio] = useState(false);

  const userBranchId = (user?.branch as { _id?: string })?._id ?? (user?.branch as string) ?? null;
  const userBranch = branches.find((b) => b._id === userBranchId) ?? branches.find((b) => b.name === (user?.branch as { name?: string })?.name) ?? branches[0];
  const branchId = userBranch?._id ?? userBranchId ?? branches[0]?._id;
  const wifiRequired = (userBranch?.wifiSSIDs?.length ?? 0) > 0;
  const wifiOk = !wifiRequired || (wifiSSID.trim().length > 0);
  /** Strong policy: real biometrics only; device PIN/passcode alone is not accepted */
  const biometricLabel = Platform.OS === 'android' ? 'fingerprint or Face unlock (strong)' : 'Touch ID or Face ID';

  const loadData = async () => {
    setLoadingData(true);
    setResult(null);
    try {
      const [todayRes, branchesRes, meRes] = await Promise.all([
        api.get<{ data: TodayRecord }>('/attendance/today'),
        api.get<{ data: Branch[] }>('/branches'),
        api
          .get<{
            data?: {
              biometricAttendanceEnabled?: boolean;
              biometricMobileEnrolledAt?: string | null;
            };
          }>('/auth/me')
          .catch(() => ({ data: { data: {} } })),
      ]);
      setTodayRecord(todayRes.data.data ?? null);
      const blist = branchesRes.data.data ?? [];
      setBranches(blist);
      const me = meRes.data.data ?? {};
      setBiometricAttendanceEnabled(!!me.biometricAttendanceEnabled);
      setBiometricMobileEnrolled(!!me.biometricMobileEnrolledAt);
      const b = blist.find((x) => x._id === userBranchId) ?? blist.find((x) => x.name === (user?.branch as { name?: string })?.name) ?? blist[0];
      if (b?.wifiSSIDs?.length) setBranchSSIDs(b.wifiSSIDs);
      else setBranchSSIDs([]);
    } catch {
      setBranches([]);
      setBiometricAttendanceEnabled(false);
      setBiometricMobileEnrolled(false);
    } finally {
      setLoadingData(false);
    }
  };

  const startGeoCheck = async () => {
    setGeoStatus('getting');
    setGeoMessage('Getting your location...');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setGeoStatus('denied');
        setGeoMessage('Location access denied. Enable location in device settings.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
        mayShowUserSettings: true,
      });
      setGeoCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
      setGeoStatus('success');
      const acc = pos.coords.accuracy != null ? Math.round(pos.coords.accuracy) : 0;
      setGeoMessage(`Location obtained (±${acc}m accuracy)`);
    } catch {
      setGeoStatus('error');
      setGeoMessage('Could not get location. Check GPS and retry.');
    }
  };

  useEffect(() => {
    startGeoCheck();
  }, []);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh attendance when logged-in user changes
  }, [user?._id]);

  useEffect(() => {
    if (!branchId || !branches.length) return;
    const b = branches.find((x) => x._id === branchId);
    if (b?.wifiSSIDs?.length) setBranchSSIDs(b.wifiSSIDs);
    else setBranchSSIDs([]);
  }, [branchId, branches]);

  const completeMobileBiometricEnrollment = async () => {
    if (!biometricAttendanceEnabled) return;
    setEnrollingBio(true);
    try {
      const readiness = await getBiometricAttendanceReadinessError();
      if (readiness) {
        Alert.alert('Biometric required', readiness);
        return;
      }
      const auth = await LocalAuthentication.authenticateAsync(
        getAttendanceBiometricOptions('Register fingerprint or Face ID for attendance')
      );
      if (!auth.success) {
        Alert.alert('Cancelled', 'Enrollment was not completed.');
        return;
      }
      await api.post('/auth/biometric-attendance/mobile-enroll', {});
      setBiometricMobileEnrolled(true);
      Alert.alert('Done', 'This device is registered for biometric attendance.');
      await loadData();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Enrollment failed.';
      Alert.alert('Error', msg);
    } finally {
      setEnrollingBio(false);
    }
  };

  const handleCheckInOut = async () => {
    const isCheckOut = !!todayRecord?.checkIn && !todayRecord?.checkOut;
    if (!branchId) {
      Alert.alert('Error', 'No branch available. Contact HR.');
      return;
    }
    if (wifiRequired && !wifiSSID.trim()) {
      Alert.alert('Select WiFi', 'Please select the office WiFi you are connected to.');
      return;
    }
    if (geoStatus !== 'success' || !geoCoords) {
      Alert.alert('Location required', 'Please allow location and wait for it to be obtained, then retry.');
      return;
    }
    if (biometricAttendanceEnabled && !biometricMobileEnrolled) {
      Alert.alert('Enrollment required', 'Complete fingerprint enrollment on this phone first (see step below).');
      return;
    }

    setSubmitting(true);
    setResult(null);
    try {
      if (biometricAttendanceEnabled) {
        const readiness = await getBiometricAttendanceReadinessError();
        if (readiness) {
          Alert.alert('Biometric required', readiness);
          setSubmitting(false);
          return;
        }
        const auth = await LocalAuthentication.authenticateAsync(
          getAttendanceBiometricOptions(
            canCheckOut ? 'Confirm check-out with fingerprint or Face ID' : 'Confirm check-in with fingerprint or Face ID'
          )
        );
        if (!auth.success) {
          Alert.alert('Authentication failed', 'Biometric verification was cancelled or failed.');
          setSubmitting(false);
          return;
        }
      }

      const endpoint = isCheckOut ? '/attendance/checkout' : '/attendance/checkin';
      const { data } = await api.post(endpoint, {
        branchId,
        lat: geoCoords.lat,
        lon: geoCoords.lon,
        wifiSSID: wifiSSID.trim() || undefined,
      });
      const payload = data.data as { message?: string };
      setResult({
        success: true,
        message: payload?.message ?? (isCheckOut ? 'Checked out successfully.' : 'Checked in successfully.'),
      });
      await loadData();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? (isCheckOut ? 'Check-out failed.' : 'Check-in failed.');
      setResult({ success: false, message: msg });
    } finally {
      setSubmitting(false);
    }
  };

  const submitRequestToHR = async () => {
    if (!requestMsg.trim()) return;
    setRequestSending(true);
    try {
      await api.post('/attendance/request', { message: requestMsg.trim() });
      setRequestSent(true);
      setShowRequestForm(false);
    } catch {
      setResult({ success: false, message: 'Failed to send request to HR.' });
    } finally {
      setRequestSending(false);
    }
  };

  const alreadyCheckedIn = !!todayRecord?.checkInTime;
  const alreadyCheckedOut = !!todayRecord?.checkOutTime;
  const canCheckIn = !alreadyCheckedIn;
  const canCheckOut = alreadyCheckedIn && !alreadyCheckedOut;
  const doneForToday = alreadyCheckedIn && alreadyCheckedOut;
  const bioGateOk = !biometricAttendanceEnabled || biometricMobileEnrolled;
  const canSubmit =
    (canCheckIn || canCheckOut) && geoStatus === 'success' && wifiOk && !submitting && bioGateOk;

  if (loadingData) {
    return (
      <View style={[styles.centered, { backgroundColor: COLORS.background }]}>
        <ActivityIndicator size="large" color={COLORS.tint} />
        <Text style={[styles.muted, { marginTop: Spacing.md }]}>Loading…</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.scroll, { backgroundColor: COLORS.background }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.pageTitle}>Attendance Check In / Out</Text>
      <Text style={styles.pageSubtitle}>
        {doneForToday
          ? 'Attendance complete for today'
          : canCheckOut
            ? 'Tap below to check out'
            : 'Complete the steps below to check in'}
      </Text>

      {result && (
        <View style={[styles.alert, result.success ? styles.alertSuccess : styles.alertError]}>
          <MaterialIcons
            name={result.success ? 'check-circle' : 'warning'}
            size={20}
            color={result.success ? COLORS.success : COLORS.danger}
          />
          <Text style={[styles.alertText, { color: result.success ? COLORS.success : COLORS.danger }]}>
            {result.message}
          </Text>
        </View>
      )}

      {todayRecord && (
        <View style={styles.summaryBar}>
          <Text style={styles.summaryText}>
            Today: <Text style={styles.summaryBold}>{todayRecord.displayStatus?.replace(/_/g, ' ') ?? '—'}</Text>
          </Text>
          {todayRecord.checkInTime && (
            <View style={styles.summaryRow}>
              <MaterialIcons name="login" size={14} color={COLORS.success} />
              <Text style={styles.summaryText}>In: <Text style={styles.summaryBold}>{todayRecord.checkInTime}</Text></Text>
            </View>
          )}
          {todayRecord.checkOutTime && (
            <View style={styles.summaryRow}>
              <MaterialIcons name="logout" size={14} color={COLORS.danger} />
              <Text style={styles.summaryText}>Out: <Text style={styles.summaryBold}>{todayRecord.checkOutTime}</Text></Text>
            </View>
          )}
          {todayRecord.workingHours != null && todayRecord.workingHours > 0 && (
            <Text style={styles.summaryText}>{todayRecord.workingHours}h worked</Text>
          )}
        </View>
      )}

      {!doneForToday && (
        <>
          {/* Step 1: GPS Location */}
          <View style={styles.card}>
            <View style={styles.stepHeader}>
              <View style={styles.stepNum}>
                <Text style={styles.stepNumText}>1</Text>
              </View>
              <Text style={styles.stepTitle}>GPS Location</Text>
            </View>
            <Text style={styles.stepDesc}>Your location is verified to confirm you are at the office.</Text>
            <View style={[styles.statusChip, geoStatus === 'success' ? styles.statusSuccess : geoStatus === 'getting' ? styles.statusChecking : styles.statusError]}>
              {geoStatus === 'getting' && <ActivityIndicator size="small" color={COLORS.tint} />}
              {geoStatus === 'success' && <MaterialIcons name="location-on" size={16} color={COLORS.success} />}
              {(geoStatus === 'denied' || geoStatus === 'error') && <MaterialIcons name="error-outline" size={16} color={COLORS.danger} />}
              <Text style={[styles.statusChipText, geoStatus === 'success' ? { color: COLORS.success } : geoStatus === 'getting' ? { color: COLORS.tint } : { color: COLORS.danger }]}>
                {geoMessage}
              </Text>
            </View>
            {(geoStatus === 'denied' || geoStatus === 'error') && (
              <TouchableOpacity style={styles.retryBtn} onPress={startGeoCheck}>
                <MaterialIcons name="refresh" size={18} color={COLORS.tint} />
                <Text style={styles.retryBtnText}>Retry Location</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Step 2: Office WiFi */}
          <View style={styles.card}>
            <View style={styles.stepHeader}>
              <View style={styles.stepNum}>
                <Text style={styles.stepNumText}>2</Text>
              </View>
              <Text style={styles.stepTitle}>Office WiFi</Text>
            </View>
            <Text style={styles.stepDesc}>Connect to the office WiFi and select the network below.</Text>

            {branchSSIDs.length === 0 && (
              <View style={[styles.statusChip, styles.statusSuccess]}>
                <MaterialIcons name="wifi" size={16} color={COLORS.success} />
                <Text style={[styles.statusChipText, { color: COLORS.success }]}>
                  No WiFi restriction — you can check in from any network.
                </Text>
              </View>
            )}

            {branchSSIDs.length > 0 && (
              <View style={styles.wifiList}>
                {branchSSIDs.map((ssid) => (
                  <TouchableOpacity
                    key={ssid}
                    style={[styles.wifiItem, wifiSSID === ssid && styles.wifiItemSelected]}
                    onPress={() => setWifiSSID(ssid)}
                    activeOpacity={0.8}
                  >
                    <MaterialIcons
                      name="wifi"
                      size={20}
                      color={wifiSSID === ssid ? COLORS.success : COLORS.textSecondary}
                    />
                    <Text style={[styles.wifiItemLabel, wifiSSID === ssid && { color: COLORS.text, fontWeight: '600' }]}>
                      {ssid}
                    </Text>
                    {wifiSSID === ssid && (
                      <View style={styles.wifiBadge}>
                        <Text style={styles.wifiBadgeText}>Selected</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Step 3: HR-enabled biometric — enroll this phone once */}
          {biometricAttendanceEnabled && !biometricMobileEnrolled && (
            <View style={styles.card}>
              <View style={styles.stepHeader}>
                <View style={styles.stepNum}>
                  <Text style={styles.stepNumText}>3</Text>
                </View>
                <Text style={styles.stepTitle}>Register fingerprint</Text>
              </View>
              <Text style={styles.stepDesc}>
                HR has enabled biometric attendance. Register once using fingerprint or Face ID — screen PIN alone is not accepted.
              </Text>
              <TouchableOpacity
                style={[
                  styles.secondaryBtn,
                  { borderColor: COLORS.tint, flexDirection: 'row', gap: 8 },
                  enrollingBio && { opacity: 0.6 },
                ]}
                onPress={completeMobileBiometricEnrollment}
                disabled={enrollingBio}
              >
                {enrollingBio ? (
                  <ActivityIndicator color={COLORS.tint} />
                ) : (
                  <>
                    <MaterialIcons name="fingerprint" size={20} color={COLORS.tint} />
                    <Text style={[styles.secondaryBtnText, { color: COLORS.tint }]}>Enroll this device</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Check In / Out */}
          <View style={styles.card}>
            <View style={styles.stepHeader}>
              <View style={styles.stepNum}>
                <Text style={styles.stepNumText}>
                  {biometricAttendanceEnabled && !biometricMobileEnrolled ? '4' : '3'}
                </Text>
              </View>
              <Text style={styles.stepTitle}>{canCheckOut ? 'Check Out' : 'Check In'}</Text>
            </View>
            <Text style={styles.stepDesc}>
              {biometricAttendanceEnabled
                ? canCheckOut
                  ? 'Confirm with fingerprint or Face ID (not screen PIN alone), then tap below to check out.'
                  : 'After WiFi, GPS, and enrollment, confirm with fingerprint or Face ID to check in.'
                : canCheckOut
                  ? 'Tap below when you leave the office.'
                  : 'Ensure location and WiFi are set, then tap to check in.'}
            </Text>
            {wifiRequired && !wifiSSID.trim() && (
              <View style={[styles.statusChip, styles.statusError]}>
                <MaterialIcons name="info" size={16} color={COLORS.danger} />
                <Text style={[styles.statusChipText, { color: COLORS.danger }]}>
                  Select your office WiFi above before checking in.
                </Text>
              </View>
            )}
            <TouchableOpacity
              style={[styles.primaryBtn, !canSubmit && styles.primaryBtnDisabled]}
              onPress={handleCheckInOut}
              disabled={!canSubmit}
              activeOpacity={0.82}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <MaterialIcons name={canCheckOut ? 'logout' : 'login'} size={22} color="#fff" />
                  <Text style={styles.primaryBtnText}>{canCheckOut ? 'Check Out' : 'Check In'}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </>
      )}

      {doneForToday && (
        <View style={styles.doneCard}>
          <MaterialIcons name="check-circle" size={48} color={COLORS.success} />
          <Text style={styles.doneTitle}>Attendance complete for today</Text>
          <Text style={styles.doneSub}>
            In: {todayRecord?.checkInTime} · Out: {todayRecord?.checkOutTime}
          </Text>
        </View>
      )}

      {/* Report to HR */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Having trouble checking in?</Text>
        <Text style={styles.muted}>Send a message to HR — they can mark your attendance manually.</Text>
        {!requestSent ? (
          <>
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => setShowRequestForm((f) => !f)}
            >
              <Text style={styles.secondaryBtnText}>{showRequestForm ? 'Cancel' : 'Report to HR'}</Text>
            </TouchableOpacity>
            {showRequestForm && (
              <View style={styles.requestForm}>
                <Text style={[styles.muted, { marginBottom: Spacing.sm }]}>Describe the issue (e.g. location not updating, WiFi not in list):</Text>
                <Text style={styles.inputHint}>Message</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Describe the issue…"
                  placeholderTextColor={COLORS.textSecondary}
                  multiline
                  numberOfLines={3}
                  value={requestMsg}
                  onChangeText={setRequestMsg}
                />
                <TouchableOpacity
                  style={[styles.primaryBtn, styles.primaryBtnSmall, (!requestMsg.trim() || requestSending) && styles.primaryBtnDisabled]}
                  onPress={submitRequestToHR}
                  disabled={!requestMsg.trim() || requestSending}
                >
                  {requestSending ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Send to HR</Text>}
                </TouchableOpacity>
              </View>
            )}
          </>
        ) : (
          <View style={[styles.statusChip, styles.statusSuccess, { marginTop: Spacing.sm }]}>
            <MaterialIcons name="check-circle" size={16} color={COLORS.success} />
            <Text style={[styles.statusChipText, { color: COLORS.success }]}>Your message was sent to HR.</Text>
          </View>
        )}
      </View>

      <View style={styles.bottomPad} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: Spacing.xxl, paddingBottom: Spacing.section },
  bottomPad: { height: Spacing.section },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  pageTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.text,
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  pageSubtitle: { fontSize: 15, color: COLORS.textSecondary, marginBottom: Spacing.xl },
  alert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
  },
  alertSuccess: { backgroundColor: `${COLORS.success}18` },
  alertError: { backgroundColor: `${COLORS.danger}12` },
  alertText: { fontSize: 15, fontWeight: '500', flex: 1 },
  summaryBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    backgroundColor: COLORS.card,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.xl,
    ...CARD_SHADOW,
  },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  summaryText: { fontSize: 14, color: COLORS.textSecondary },
  summaryBold: { fontWeight: '600', color: COLORS.text },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    marginBottom: Spacing.xl,
    ...CARD_SHADOW,
  },
  stepHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.sm },
  stepNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.tint,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  stepNumText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  stepTitle: { fontSize: 17, fontWeight: '600', color: COLORS.text },
  stepDesc: { fontSize: 14, color: COLORS.textSecondary, lineHeight: 20, marginBottom: Spacing.md },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  statusChecking: { backgroundColor: `${COLORS.tint}18` },
  statusSuccess: { backgroundColor: `${COLORS.success}18` },
  statusError: { backgroundColor: `${COLORS.danger}12` },
  statusChipText: { fontSize: 14, flex: 1 },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  retryBtnText: { fontSize: 15, fontWeight: '600', color: COLORS.tint },
  wifiList: { gap: Spacing.sm },
  wifiItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    backgroundColor: '#fff',
  },
  wifiItemSelected: {
    borderColor: COLORS.success,
    backgroundColor: `${COLORS.success}08`,
  },
  wifiItemLabel: { flex: 1, fontSize: 15, color: COLORS.textSecondary },
  wifiBadge: { backgroundColor: `${COLORS.success}20`, paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: 6 },
  wifiBadgeText: { fontSize: 12, fontWeight: '600', color: COLORS.success },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    height: 52,
    borderRadius: BorderRadius.md,
    backgroundColor: COLORS.tint,
    marginTop: Spacing.sm,
  },
  primaryBtnDisabled: { opacity: 0.6 },
  primaryBtnSmall: { height: 44, marginTop: Spacing.md },
  primaryBtnText: { fontSize: 17, fontWeight: '600', color: '#fff' },
  secondaryBtn: {
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: COLORS.tint,
  },
  secondaryBtnText: { fontSize: 15, fontWeight: '600', color: COLORS.tint },
  doneCard: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
    backgroundColor: COLORS.card,
    borderRadius: BorderRadius.xl,
    marginBottom: Spacing.xl,
    ...CARD_SHADOW,
  },
  doneTitle: { fontSize: 17, fontWeight: '600', color: COLORS.text, marginTop: Spacing.md },
  doneSub: { fontSize: 14, color: COLORS.textSecondary, marginTop: 4 },
  cardTitle: { fontSize: 17, fontWeight: '600', color: COLORS.text, marginBottom: 4 },
  muted: { fontSize: 14, color: COLORS.textSecondary, lineHeight: 20 },
  requestForm: { marginTop: Spacing.md },
  inputHint: { fontSize: 13, color: COLORS.textSecondary, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: 15,
    color: COLORS.text,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  faceCameraBox: { marginTop: Spacing.sm, borderRadius: BorderRadius.lg, overflow: 'hidden', backgroundColor: '#000' },
  faceCameraInner: { position: 'relative', width: '100%', height: 200 },
  faceCamera: { width: '100%', height: 200 },
  faceCameraLoading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  faceCaptureBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    height: 48,
    margin: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  faceOkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
});
