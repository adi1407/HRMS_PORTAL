import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { CardShadow, Spacing } from '@/constants/theme';
import { useAppColors } from '@/hooks/use-app-theme';
import { useAuthStore } from '@/store/authStore';
import api from '@/lib/api';
import { encodeFaceDescriptorFromUri } from '@/lib/faceEncode';

const MIN_SAMPLES = 3;
const MAX_SAMPLES = 5;

type EmployeeRow = {
  _id: string;
  name?: string;
  employeeId?: string;
  faceEnrolled?: boolean;
  faceEnrolledAt?: string;
};

export default function FaceEnrollEmployeeScreen() {
  const { empId } = useLocalSearchParams<{ empId: string }>();
  const router = useRouter();
  const colors = useAppColors();
  const getRole = useAuthStore((s) => s.getRole);
  const canManage = ['HR', 'DIRECTOR', 'SUPER_ADMIN'].includes(getRole());

  const cameraRef = useRef<CameraView>(null);

  const [employee, setEmployee] = useState<EmployeeRow | null>(null);
  const [loadingEmp, setLoadingEmp] = useState(true);
  const [descriptors, setDescriptors] = useState<number[][]>([]);
  const [capturing, setCapturing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState('');

  const [permission, requestPermission] = useCameraPermissions();
  const [cameraReady, setCameraReady] = useState(false);

  const loadEmployee = useCallback(async () => {
    if (!empId) return;
    setLoadingEmp(true);
    try {
      const { data } = await api.get<{ success?: boolean; data?: EmployeeRow }>(`/face/status/${empId}`);
      setEmployee(data.data ?? null);
    } catch {
      setEmployee(null);
    } finally {
      setLoadingEmp(false);
    }
  }, [empId]);

  useEffect(() => {
    loadEmployee();
  }, [loadEmployee]);

  const captureSample = async () => {
    if (!cameraRef.current || capturing || descriptors.length >= MAX_SAMPLES) return;
    setCapturing(true);
    setMsg('Taking photo…');
    try {
      const photo = await cameraRef.current.takePictureAsync?.({
        quality: 0.85,
        skipProcessing: Platform.OS === 'ios',
      });
      if (!photo?.uri) throw new Error('No photo');
      setMsg('Encoding face…');
      const d = await encodeFaceDescriptorFromUri(photo.uri);
      setDescriptors((prev) => {
        const next = [...prev, d];
        if (next.length < MIN_SAMPLES) {
          setMsg(`Sample ${next.length} captured. Need at least ${MIN_SAMPLES - next.length} more. Slightly turn your head.`);
        } else if (next.length < MAX_SAMPLES) {
          setMsg(`Sample ${next.length}. You can enroll or add up to ${MAX_SAMPLES} samples.`);
        } else {
          setMsg(`${MAX_SAMPLES} samples captured.`);
        }
        return next;
      });
    } catch (e: unknown) {
      const m =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        (e instanceof Error ? e.message : 'Capture failed.');
      setMsg(m);
      Alert.alert('Capture failed', m);
    } finally {
      setCapturing(false);
    }
  };

  const submitEnroll = async () => {
    if (!empId || descriptors.length < MIN_SAMPLES) return;
    setSubmitting(true);
    try {
      await api.post(`/face/enroll/${empId}`, { descriptors });
      setMsg('Face enrolled successfully.');
      Alert.alert('Success', 'Face enrolled successfully.', [{ text: 'OK', onPress: () => router.back() }]);
      await loadEmployee();
      setDescriptors([]);
    } catch (e: unknown) {
      const m = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Enrollment failed.';
      Alert.alert('Enrollment failed', m);
    } finally {
      setSubmitting(false);
    }
  };

  const removeEnrollment = () => {
    if (!empId || !employee?.name) return;
    Alert.alert(
      'Remove face enrollment?',
      `${employee.name} will not be able to use face check-in until re-enrolled.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/face/enroll/${empId}`);
              await loadEmployee();
              setDescriptors([]);
              setMsg('');
            } catch (e: unknown) {
              const m = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed.';
              Alert.alert('Error', m);
            }
          },
        },
      ]
    );
  };

  if (!canManage) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.text }}>Access denied</Text>
      </View>
    );
  }

  if (loadingEmp) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.tint} />
      </View>
    );
  }

  if (!employee) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background, padding: Spacing.xl }]}>
        <Text style={{ color: colors.text }}>Employee not found.</Text>
        <TouchableOpacity style={{ marginTop: Spacing.md }} onPress={() => router.back()}>
          <Text style={{ color: colors.tint, fontWeight: '600' }}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <SafeAreaView>
        <View style={[styles.header, { borderBottomColor: colors.textSecondary + '30' }]}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <MaterialIcons
              name={Platform.OS === 'ios' ? 'arrow-back-ios' : 'arrow-back'}
              size={Platform.OS === 'ios' ? 22 : 24}
              color={colors.text}
            />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
            {employee.name ?? 'Enroll'}
          </Text>
          <View style={styles.backBtn} />
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.card, { backgroundColor: colors.card }, CardShadow]}>
          <Text style={[styles.empLine, { color: colors.text }]}>
            {employee.employeeId ?? '—'} · {employee.faceEnrolled ? 'Face enrolled' : 'Not enrolled'}
          </Text>
          {employee.faceEnrolled && employee.faceEnrolledAt ? (
            <Text style={[styles.meta, { color: colors.textSecondary }]}>
              Since {new Date(employee.faceEnrolledAt).toLocaleDateString()}
            </Text>
          ) : null}
          {employee.faceEnrolled ? (
            <TouchableOpacity style={styles.dangerOutline} onPress={removeEnrollment}>
              <Text style={styles.dangerText}>Remove enrollment</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>Samples ({descriptors.length}/{MAX_SAMPLES})</Text>
        <View style={styles.dots}>
          {Array.from({ length: MAX_SAMPLES }, (_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                { backgroundColor: descriptors.length > i ? '#22c55e' : colors.textSecondary + '40' },
              ]}
            >
              <Text style={{ color: descriptors.length > i ? '#fff' : colors.textSecondary, fontWeight: '700' }}>
                {descriptors.length > i ? '✓' : i + 1}
              </Text>
            </View>
          ))}
        </View>

        {!permission?.granted ? (
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <Text style={[styles.meta, { color: colors.textSecondary, marginBottom: Spacing.md }]}>
              Camera access is required to capture face samples.
            </Text>
            <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.tint }]} onPress={requestPermission}>
              <Text style={styles.primaryBtnText}>Allow camera</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={[styles.cameraCard, { backgroundColor: '#000' }]}>
            <View style={styles.cameraInner}>
              <CameraView
                ref={cameraRef}
                style={styles.camera}
                facing="front"
                onCameraReady={() => setCameraReady(true)}
              />
              {!cameraReady ? (
                <View style={[styles.cameraOverlay, StyleSheet.absoluteFillObject]}>
                  <ActivityIndicator color="#fff" />
                </View>
              ) : null}
            </View>
            <View style={styles.captureBar} pointerEvents="box-none">
              <TouchableOpacity
                style={[styles.shutter, (capturing || descriptors.length >= MAX_SAMPLES) && { opacity: 0.4 }]}
                disabled={capturing || descriptors.length >= MAX_SAMPLES}
                onPress={captureSample}
                activeOpacity={0.85}
              >
                <View style={styles.shutterInner} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {msg ? <Text style={[styles.hint, { color: colors.textSecondary }]}>{msg}</Text> : null}

        <TouchableOpacity
          style={[
            styles.primaryBtn,
            { backgroundColor: colors.tint },
            (descriptors.length < MIN_SAMPLES || submitting) && { opacity: 0.55 },
          ]}
          disabled={descriptors.length < MIN_SAMPLES || submitting}
          onPress={submitEnroll}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryBtnText}>Save enrollment ({descriptors.length} samples)</Text>
          )}
        </TouchableOpacity>

        {descriptors.length > 0 ? (
          <TouchableOpacity onPress={() => { setDescriptors([]); setMsg('Samples cleared.'); }}>
            <Text style={{ color: colors.tint, textAlign: 'center', marginTop: Spacing.md, fontWeight: '600' }}>
              Clear samples
            </Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'flex-start' },
  headerTitle: { fontSize: 18, fontWeight: '700', flex: 1, textAlign: 'center' },
  content: { padding: Spacing.xl, paddingBottom: Spacing.section },
  card: { borderRadius: 16, padding: Spacing.lg, marginBottom: Spacing.lg },
  empLine: { fontSize: 15, fontWeight: '600' },
  meta: { fontSize: 13, marginTop: 4 },
  dangerOutline: { marginTop: Spacing.md, alignSelf: 'flex-start', paddingVertical: 6, paddingHorizontal: 10 },
  dangerText: { color: '#dc2626', fontWeight: '600', fontSize: 14 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: Spacing.sm },
  dots: { flexDirection: 'row', gap: 10, marginBottom: Spacing.lg, flexWrap: 'wrap' },
  dot: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraCard: { borderRadius: 16, overflow: 'hidden', marginBottom: Spacing.md },
  cameraInner: { position: 'relative', width: '100%', height: 240 },
  camera: { width: '100%', height: 240 },
  cameraOverlay: { alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.3)' },
  captureBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: 16,
    alignItems: 'center',
  },
  shutter: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 4,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#fff' },
  hint: { fontSize: 14, lineHeight: 20, marginBottom: Spacing.md },
  primaryBtn: {
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
