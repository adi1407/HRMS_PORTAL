import React, { useEffect, useState, useCallback } from 'react';
import {
  ScrollView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  RefreshControl,
  Platform,
  SafeAreaView,
  ActivityIndicator,
  KeyboardAvoidingView,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Spacing, BorderRadius, CardShadow } from '@/constants/theme';
import { useAppColors } from '@/hooks/use-app-theme';
import { useAuthStore } from '@/store/authStore';
import api from '@/lib/api';

const DEFAULT_DEPARTMENTS = [
  { name: 'IT Department', note: 'Software & technical staff' },
  { name: 'HR Department', note: 'Human resources team' },
  { name: 'Manager Head', note: 'Directors & management (always full-day present)' },
  { name: 'Accounts Department', note: 'Accounts & finance team' },
  { name: 'Pharmacy', note: 'Pharmacy staff' },
];

type Branch = {
  _id: string;
  name: string;
  address?: string;
  wifiSSIDs?: string[];
  allowedIPs?: string[];
  latitude?: number;
  longitude?: number;
  radiusMeters?: number;
};

type Department = { _id: string; name: string };

export default function BranchSettingsScreen() {
  const router = useRouter();
  const colors = useAppColors();
  const getRole = useAuthStore((s) => s.getRole);
  const role = getRole();
  const canEdit = ['SUPER_ADMIN', 'DIRECTOR', 'HR'].includes(role ?? '');
  const [tab, setTab] = useState<'network' | 'departments'>('network');

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <SafeAreaView style={styles.safeTop}>
        <View style={[styles.header, { borderBottomColor: colors.textSecondary + '30' }]}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <MaterialIcons name={Platform.OS === 'ios' ? 'arrow-back-ios' : 'arrow-back'} size={Platform.OS === 'ios' ? 22 : 24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Office Settings</Text>
          <View style={styles.backBtn} />
        </View>
      </SafeAreaView>

      <View style={[styles.tabRow, { borderBottomColor: colors.textSecondary + '20' }]}>
        <TouchableOpacity
          style={[styles.tab, tab === 'network' && { borderBottomColor: colors.tint, borderBottomWidth: 2 }]}
          onPress={() => setTab('network')}
        >
          <MaterialIcons name="wifi" size={20} color={tab === 'network' ? colors.tint : colors.textSecondary} />
          <Text style={[styles.tabLabel, { color: tab === 'network' ? colors.tint : colors.textSecondary }]}>WiFi & Location</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'departments' && { borderBottomColor: colors.tint, borderBottomWidth: 2 }]}
          onPress={() => setTab('departments')}
        >
          <MaterialIcons name="business" size={20} color={tab === 'departments' ? colors.tint : colors.textSecondary} />
          <Text style={[styles.tabLabel, { color: tab === 'departments' ? colors.tint : colors.textSecondary }]}>Departments</Text>
        </TouchableOpacity>
      </View>

      {tab === 'network' && <NetworkTab canEdit={canEdit} colors={colors} />}
      {tab === 'departments' && <DepartmentsTab canEdit={canEdit} colors={colors} />}
    </View>
  );
}

function NetworkTab({ canEdit, colors }: { canEdit: boolean; colors: ReturnType<typeof useAppColors> }) {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [working, setWorking] = useState<string | null>(null);

  const fetchBranches = useCallback(async () => {
    try {
      const { data } = await api.get<{ data: Branch[] }>('/branches');
      setBranches(data.data ?? []);
    } catch {
      setMsg({ type: 'error', text: 'Failed to load settings.' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchBranches(); }, [fetchBranches]);

  const addSSID = async (branchId: string, ssid: string) => {
    setWorking(branchId); setMsg(null);
    try {
      const { data } = await api.post<{ data: Branch }>(`/branches/${branchId}/wifi-ssid`, { ssid });
      setBranches((prev) => prev.map((b) => (b._id === branchId ? data.data : b)));
      setMsg({ type: 'success', text: `WiFi "${ssid}" added.` });
    } catch (e: unknown) {
      const text = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to add WiFi.';
      setMsg({ type: 'error', text });
    } finally {
      setWorking(null);
    }
  };

  const removeSSID = async (branchId: string, ssid: string) => {
    setWorking(branchId + ssid); setMsg(null);
    try {
      const { data } = await api.delete<{ data: Branch }>(`/branches/${branchId}/wifi-ssid`, { data: { ssid } });
      setBranches((prev) => prev.map((b) => (b._id === branchId ? data.data : b)));
      setMsg({ type: 'success', text: `WiFi "${ssid}" removed.` });
    } catch (e: unknown) {
      const text = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to remove WiFi.';
      setMsg({ type: 'error', text });
    } finally {
      setWorking(null);
    }
  };

  const saveGeoFence = async (branchId: string, geo: { latitude: number; longitude: number; radiusMeters: number }) => {
    setWorking('geo-' + branchId); setMsg(null);
    try {
      const { data } = await api.patch<{ data: Branch }>(`/branches/${branchId}`, geo);
      setBranches((prev) => prev.map((b) => (b._id === branchId ? data.data : b)));
      setMsg({ type: 'success', text: 'Geo-fence saved. GPS check is now active.' });
    } catch (e: unknown) {
      const text = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to save geo-fence.';
      setMsg({ type: 'error', text });
    } finally {
      setWorking(null);
    }
  };

  const clearGeoFence = async (branchId: string) => {
    setWorking('geo-' + branchId); setMsg(null);
    try {
      const { data } = await api.patch<{ data: Branch }>(`/branches/${branchId}`, { latitude: 0, longitude: 0, radiusMeters: 30 });
      setBranches((prev) => prev.map((b) => (b._id === branchId ? data.data : b)));
      setMsg({ type: 'success', text: 'Geo-fence cleared. GPS check disabled.' });
    } catch {
      setMsg({ type: 'error', text: 'Failed to clear geo-fence.' });
    } finally {
      setWorking(null);
    }
  };

  const addIP = async (branchId: string, ip: string) => {
    setWorking('ip-' + branchId); setMsg(null);
    try {
      const { data } = await api.post<{ data: Branch }>(`/branches/${branchId}/allowip`, { ip: ip.trim() });
      setBranches((prev) => prev.map((b) => (b._id === branchId ? data.data : b)));
      setMsg({ type: 'success', text: `IP "${ip.trim()}" added.` });
    } catch (e: unknown) {
      const text = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to add IP.';
      setMsg({ type: 'error', text });
    } finally {
      setWorking(null);
    }
  };

  const removeIP = async (branchId: string, ip: string) => {
    setWorking('ip-' + branchId + ip); setMsg(null);
    try {
      const { data } = await api.delete<{ data: Branch }>(`/branches/${branchId}/allowip`, { data: { ip } });
      setBranches((prev) => prev.map((b) => (b._id === branchId ? data.data : b)));
      setMsg({ type: 'success', text: `IP "${ip}" removed.` });
    } catch (e: unknown) {
      const text = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to remove IP.';
      setMsg({ type: 'error', text });
    } finally {
      setWorking(null);
    }
  };

  const fetchMyIP = async (): Promise<string | null> => {
    try {
      const { data } = await api.get<{ ip?: string }>('/branches/myip');
      return data?.ip ?? null;
    } catch {
      return null;
    }
  };

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchBranches(); }} tintColor={colors.tint} />}
      showsVerticalScrollIndicator={false}
    >
      {msg && (
        <View style={[styles.msgBanner, msg.type === 'success' ? { backgroundColor: colors.success + '20' } : { backgroundColor: colors.destructive + '20' }]}>
          <Text style={[styles.msgText, { color: msg.type === 'success' ? colors.success : colors.destructive }]}>{msg.text}</Text>
        </View>
      )}

      <View style={[styles.infoCard, { backgroundColor: colors.tint + '15', borderColor: colors.tint + '40' }]}>
        <Text style={[styles.infoTitle, { color: colors.tint }]}>Network verification for check-in</Text>
        <Text style={[styles.infoBody, { color: colors.textSecondary }]}>
          Allowed IPs (recommended): add office public IP. WiFi names: add office SSIDs. Use “Add My Current IP” when on office network. Leave both empty to allow check-in from any network.
        </Text>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.tint} />
          <Text style={[styles.muted, { color: colors.textSecondary }]}>Loading settings…</Text>
        </View>
      ) : (
        branches.map((branch) => (
          <View key={branch._id} style={[styles.branchCard, { backgroundColor: colors.card }, CardShadow]}>
            <View style={styles.branchHeader}>
              <MaterialIcons name="business" size={20} color={colors.tint} />
              <Text style={[styles.branchName, { color: colors.text }]}>{branch.name}</Text>
            </View>
            <Text style={[styles.branchAddress, { color: colors.textSecondary }]}>{branch.address || 'No address set'}</Text>

            {/* WiFi SSIDs */}
            <Text style={[styles.sectionLabel, { color: colors.text }]}>Allowed WiFi ({(branch.wifiSSIDs || []).length})</Text>
            {(branch.wifiSSIDs || []).length > 0 && (
              <View style={styles.chipList}>
                {(branch.wifiSSIDs || []).map((ssid) => (
                  <View key={ssid} style={[styles.chipRow, { backgroundColor: colors.success + '15' }]}>
                    <MaterialIcons name="wifi" size={16} color={colors.success} />
                    <Text style={[styles.chipText, { color: colors.text }]}>{ssid}</Text>
                    {canEdit && (
                      <TouchableOpacity onPress={() => removeSSID(branch._id, ssid)} disabled={working === branch._id + ssid}>
                        <Text style={[styles.removeBtn, { color: colors.destructive }]}>Remove</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
              </View>
            )}
            {canEdit && <AddSSIDForm branchId={branch._id} onAdd={addSSID} working={working === branch._id} existing={branch.wifiSSIDs || []} colors={colors} />}

            {/* Allowed IPs */}
            <Text style={[styles.sectionLabel, { color: colors.text }]}>Allowed IPs ({(branch.allowedIPs || []).length})</Text>
            {(branch.allowedIPs || []).length > 0 && (
              <View style={styles.chipList}>
                {(branch.allowedIPs || []).map((ip) => (
                  <View key={ip} style={[styles.chipRow, { backgroundColor: colors.success + '12' }]}>
                    <MaterialIcons name="dns" size={16} color={colors.success} />
                    <Text style={[styles.chipText, { color: colors.text, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }]}>{ip}</Text>
                    {canEdit && (
                      <TouchableOpacity onPress={() => removeIP(branch._id, ip)} disabled={working === 'ip-' + branch._id + ip}>
                        <Text style={[styles.removeBtn, { color: colors.destructive }]}>Remove</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
              </View>
            )}
            {canEdit && <AddIPForm branchId={branch._id} onAdd={addIP} onFetchMyIP={fetchMyIP} working={working} existing={branch.allowedIPs || []} colors={colors} />}

            {/* Geo-fence */}
            <GeoFenceForm
              branch={branch}
              canEdit={canEdit}
              onSave={(geo) => saveGeoFence(branch._id, geo)}
              onClear={() => clearGeoFence(branch._id)}
              saving={working === 'geo-' + branch._id}
              colors={colors}
            />
          </View>
        ))
      )}
      <View style={styles.bottomPad} />
    </ScrollView>
  );
}

function GeoFenceForm({
  branch,
  canEdit,
  onSave,
  onClear,
  saving,
  colors,
}: {
  branch: Branch;
  canEdit: boolean;
  onSave: (geo: { latitude: number; longitude: number; radiusMeters: number }) => void;
  onClear: () => void;
  saving: boolean;
  colors: ReturnType<typeof useAppColors>;
}) {
  const hasGeo = !!(branch.latitude && branch.longitude);
  const [lat, setLat] = useState(hasGeo ? String(branch.latitude) : '');
  const [lon, setLon] = useState(hasGeo ? String(branch.longitude) : '');
  const [radius, setRadius] = useState(String(branch.radiusMeters ?? 25));
  const [gpsMsg, setGpsMsg] = useState('');

  const useMyLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setGpsMsg('Location permission denied.');
        return;
      }
      setGpsMsg('Getting location…');
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setLat(pos.coords.latitude.toFixed(8));
      setLon(pos.coords.longitude.toFixed(8));
      setGpsMsg(`Got location (±${Math.round(pos.coords.accuracy ?? 0)}m accuracy)`);
    } catch {
      setGpsMsg('Could not get location.');
    }
  };

  const handleSave = () => {
    const la = parseFloat(lat);
    const lo = parseFloat(lon);
    const r = parseInt(radius, 10);
    if (isNaN(la) || isNaN(lo) || isNaN(r)) return;
    onSave({ latitude: la, longitude: lo, radiusMeters: r });
  };

  return (
    <View style={styles.geoSection}>
      <Text style={[styles.sectionLabel, { color: colors.text }]}>
        GPS Geo-fence {hasGeo ? `· Active ${branch.radiusMeters}m radius` : '· Not configured'}
      </Text>
      {canEdit && (
        <>
          <View style={styles.geoRow}>
            <TextInput style={[styles.input, { backgroundColor: colors.background, color: colors.text }]} placeholder="Latitude" placeholderTextColor={colors.textSecondary} value={lat} onChangeText={setLat} />
            <TextInput style={[styles.input, { backgroundColor: colors.background, color: colors.text }]} placeholder="Longitude" placeholderTextColor={colors.textSecondary} value={lon} onChangeText={setLon} />
          </View>
          <View style={styles.geoRow}>
            <TextInput style={[styles.input, styles.inputShort, { backgroundColor: colors.background, color: colors.text }]} placeholder="Radius m" placeholderTextColor={colors.textSecondary} value={radius} onChangeText={setRadius} keyboardType="number-pad" />
            <TouchableOpacity style={[styles.secondaryBtn, { borderColor: colors.tint }]} onPress={useMyLocation}>
              <MaterialIcons name="my-location" size={18} color={colors.tint} />
              <Text style={[styles.secondaryBtnText, { color: colors.tint }]}>Use GPS</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.tint }]} onPress={handleSave} disabled={!lat || !lon || saving}>
              {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.primaryBtnText}>Save</Text>}
            </TouchableOpacity>
          </View>
          {hasGeo && (
            <TouchableOpacity style={[styles.dangerBtn, { borderColor: colors.destructive }]} onPress={onClear} disabled={saving}>
              <Text style={[styles.dangerBtnText, { color: colors.destructive }]}>Disable Geo-fence</Text>
            </TouchableOpacity>
          )}
          {gpsMsg ? <Text style={[styles.muted, { color: colors.textSecondary, marginTop: 4 }]}>{gpsMsg}</Text> : null}
        </>
      )}
    </View>
  );
}

function AddSSIDForm({
  branchId,
  onAdd,
  working,
  existing,
  colors,
}: {
  branchId: string;
  onAdd: (id: string, ssid: string) => void;
  working: boolean;
  existing: string[];
  colors: ReturnType<typeof useAppColors>;
}) {
  const [show, setShow] = useState(false);
  const [value, setValue] = useState('');

  const handleAdd = () => {
    const t = value.trim();
    if (!t || existing.some((s) => s.toLowerCase() === t.toLowerCase())) return;
    onAdd(branchId, t);
    setValue('');
    setShow(false);
  };

  if (!show) {
    return (
      <TouchableOpacity style={[styles.addChipBtn, { borderColor: colors.tint }]} onPress={() => setShow(true)}>
        <MaterialIcons name="add" size={18} color={colors.tint} />
        <Text style={[styles.addChipBtnText, { color: colors.tint }]}>Add WiFi Network</Text>
      </TouchableOpacity>
    );
  }
  return (
    <View style={styles.addFormRow}>
      <TextInput style={[styles.input, { flex: 1, backgroundColor: colors.background, color: colors.text }]} placeholder="WiFi name (SSID)" placeholderTextColor={colors.textSecondary} value={value} onChangeText={setValue} />
      <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.tint }]} onPress={handleAdd} disabled={!value.trim() || working}>
        <Text style={styles.primaryBtnText}>Add</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => { setShow(false); setValue(''); }}>
        <Text style={[styles.cancelBtn, { color: colors.textSecondary }]}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );
}

function AddIPForm({
  branchId,
  onAdd,
  onFetchMyIP,
  working,
  existing,
  colors,
}: {
  branchId: string;
  onAdd: (id: string, ip: string) => void;
  onFetchMyIP: () => Promise<string | null>;
  working: string | null;
  existing: string[];
  colors: ReturnType<typeof useAppColors>;
}) {
  const [show, setShow] = useState(false);
  const [value, setValue] = useState('');
  const [fetching, setFetching] = useState(false);

  const handleAddMyIP = async () => {
    setFetching(true);
    try {
      const ip = await onFetchMyIP();
      if (ip && !existing.includes(ip)) {
        onAdd(branchId, ip);
        setShow(false);
      } else if (ip && existing.includes(ip)) {
        Alert.alert('Info', 'This IP is already in the list.');
      } else {
        Alert.alert('Error', 'Could not fetch your IP.');
      }
    } finally {
      setFetching(false);
    }
  };

  const handleAdd = () => {
    const t = value.trim();
    if (!t || existing.includes(t)) return;
    onAdd(branchId, t);
    setValue('');
    setShow(false);
  };

  if (!show) {
    return (
      <View style={styles.addFormRow}>
        <TouchableOpacity style={[styles.addChipBtn, { borderColor: colors.tint }]} onPress={handleAddMyIP} disabled={fetching}>
          {fetching ? <ActivityIndicator size="small" color={colors.tint} /> : (
            <>
              <MaterialIcons name="dns" size={18} color={colors.tint} />
              <Text style={[styles.addChipBtnText, { color: colors.tint }]}>Add My Current IP</Text>
            </>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={[styles.addChipBtn, { borderColor: colors.textSecondary }]} onPress={() => setShow(true)}>
          <Text style={[styles.addChipBtnText, { color: colors.textSecondary }]}>Add IP manually</Text>
        </TouchableOpacity>
      </View>
    );
  }
  return (
    <View style={styles.addFormRow}>
      <TextInput style={[styles.input, { flex: 1, backgroundColor: colors.background, color: colors.text, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }]} placeholder="e.g. 203.0.113.45" placeholderTextColor={colors.textSecondary} value={value} onChangeText={setValue} />
      <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.tint }]} onPress={handleAdd} disabled={!value.trim() || working === 'ip-' + branchId}>
        <Text style={styles.primaryBtnText}>Add</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => { setShow(false); setValue(''); }}>
        <Text style={[styles.cancelBtn, { color: colors.textSecondary }]}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );
}

function DepartmentsTab({ canEdit, colors }: { canEdit: boolean; colors: ReturnType<typeof useAppColors> }) {
  const [depts, setDepts] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchDepts = useCallback(async () => {
    try {
      const { data } = await api.get<{ data: Department[] }>('/departments');
      setDepts(data.data ?? []);
    } catch {
      setMsg({ type: 'error', text: 'Failed to load departments.' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchDepts(); }, [fetchDepts]);

  const seedDefaults = async () => {
    setSaving(true); setMsg(null);
    let created = 0;
    for (const dept of DEFAULT_DEPARTMENTS) {
      const exists = depts.find((d) => d.name.toLowerCase() === dept.name.toLowerCase());
      if (!exists) {
        try {
          await api.post('/departments', { name: dept.name });
          created++;
        } catch {}
      }
    }
    setMsg({ type: 'success', text: created > 0 ? `${created} default department(s) created.` : 'All default departments already exist.' });
    setSaving(false);
    fetchDepts();
  };

  const createDept = async () => {
    if (!newName.trim()) return;
    setSaving(true); setMsg(null);
    try {
      await api.post('/departments', { name: newName.trim() });
      setMsg({ type: 'success', text: `Department "${newName.trim()}" created.` });
      setNewName('');
      setShowForm(false);
      fetchDepts();
    } catch (e: unknown) {
      const text = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to create department.';
      setMsg({ type: 'error', text });
    } finally {
      setSaving(false);
    }
  };

  const deleteDept = (dept: Department) => {
    Alert.alert('Deactivate', `Deactivate department "${dept.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Deactivate',
        style: 'destructive',
        onPress: async () => {
          setDeleting(dept._id);
          try {
            await api.delete(`/departments/${dept._id}`);
            setMsg({ type: 'success', text: `"${dept.name}" deactivated.` });
            fetchDepts();
          } catch (e: unknown) {
            const text = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed.';
            setMsg({ type: 'error', text });
          } finally {
            setDeleting(null);
          }
        },
      },
    ]);
  };

  const missingDefaults = DEFAULT_DEPARTMENTS.filter((d) => !depts.find((x) => x.name.toLowerCase() === d.name.toLowerCase()));

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchDepts(); }} tintColor={colors.tint} />}
      showsVerticalScrollIndicator={false}
    >
      {msg && (
        <View style={[styles.msgBanner, msg.type === 'success' ? { backgroundColor: colors.success + '20' } : { backgroundColor: colors.destructive + '20' }]}>
          <Text style={[styles.msgText, { color: msg.type === 'success' ? colors.success : colors.destructive }]}>{msg.text}</Text>
        </View>
      )}

      <View style={[styles.infoCard, { backgroundColor: colors.success + '12', borderColor: colors.success + '40' }]}>
        <Text style={[styles.infoTitle, { color: colors.success }]}>Department → Role mapping</Text>
        {DEFAULT_DEPARTMENTS.map((d) => (
          <Text key={d.name} style={[styles.infoBody, { color: colors.textSecondary }]}>{d.name}: {d.note}</Text>
        ))}
      </View>

      {canEdit && (
        <View style={styles.deptActions}>
          <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.tint }]} onPress={() => { setShowForm(!showForm); setMsg(null); }}>
            <Text style={styles.primaryBtnText}>{showForm ? 'Cancel' : '+ Add Department'}</Text>
          </TouchableOpacity>
          {missingDefaults.length > 0 && (
            <TouchableOpacity style={[styles.secondaryBtn, { borderColor: colors.tint }]} onPress={seedDefaults} disabled={saving}>
              <Text style={[styles.secondaryBtnText, { color: colors.tint }]}>{saving ? 'Creating…' : `Add ${missingDefaults.length} default(s)`}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {showForm && canEdit && (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.formCard, { backgroundColor: colors.card }, CardShadow]}>
            <Text style={[styles.formLabel, { color: colors.text }]}>New Department</Text>
            <TextInput style={[styles.input, { backgroundColor: colors.background, color: colors.text }]} placeholder="Department name" placeholderTextColor={colors.textSecondary} value={newName} onChangeText={setNewName} />
            <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.tint }]} onPress={createDept} disabled={saving || !newName.trim()}>
              {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.primaryBtnText}>Create</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.tint} />
          <Text style={[styles.muted, { color: colors.textSecondary }]}>Loading departments…</Text>
        </View>
      ) : depts.length === 0 ? (
        <View style={[styles.emptyCard, { backgroundColor: colors.card }, CardShadow]}>
          <MaterialIcons name="business" size={48} color={colors.textSecondary} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No departments yet</Text>
          {canEdit && (
            <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.tint }]} onPress={seedDefaults} disabled={saving}>
              <Text style={styles.primaryBtnText}>{saving ? 'Creating…' : 'Create default departments'}</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <View style={styles.deptList}>
          {depts.map((dept) => {
            const meta = DEFAULT_DEPARTMENTS.find((d) => d.name.toLowerCase() === dept.name.toLowerCase());
            return (
              <View key={dept._id} style={[styles.deptCard, { backgroundColor: colors.card }, CardShadow]}>
                <View style={styles.deptCardRow}>
                  <View>
                    <Text style={[styles.deptName, { color: colors.text }]}>{dept.name}</Text>
                    <Text style={[styles.deptNote, { color: colors.textSecondary }]}>{meta?.note || 'Custom department'}</Text>
                  </View>
                  {meta ? (
                    <View style={[styles.defaultBadge, { backgroundColor: colors.tint + '20' }]}>
                      <Text style={[styles.defaultBadgeText, { color: colors.tint }]}>Default</Text>
                    </View>
                  ) : canEdit ? (
                    <TouchableOpacity onPress={() => deleteDept(dept)} disabled={deleting === dept._id}>
                      <Text style={[styles.removeBtn, { color: colors.destructive }]}>{deleting === dept._id ? '…' : 'Remove'}</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>
      )}
      <View style={styles.bottomPad} />
    </ScrollView>
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
  },
  backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'flex-start' },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  tabRow: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: Spacing.md },
  tabLabel: { fontSize: 14, fontWeight: '600' },
  scroll: { flex: 1 },
  scrollContent: { padding: Spacing.lg, paddingBottom: Spacing.section },
  bottomPad: { height: Spacing.section },
  msgBanner: { padding: Spacing.md, borderRadius: BorderRadius.md, marginBottom: Spacing.lg },
  msgText: { fontSize: 14, fontWeight: '500' },
  infoCard: { padding: Spacing.md, borderRadius: BorderRadius.md, marginBottom: Spacing.lg, borderWidth: 1 },
  infoTitle: { fontSize: 14, fontWeight: '600', marginBottom: 6 },
  infoBody: { fontSize: 13, marginBottom: 4 },
  loadingWrap: { alignItems: 'center', paddingVertical: Spacing.xxl },
  muted: { fontSize: 14 },
  branchCard: { borderRadius: BorderRadius.xl, padding: Spacing.lg, marginBottom: Spacing.lg },
  branchHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: 4 },
  branchName: { fontSize: 17, fontWeight: '600' },
  branchAddress: { fontSize: 13, marginBottom: Spacing.md },
  sectionLabel: { fontSize: 14, fontWeight: '600', marginBottom: Spacing.sm },
  chipList: { marginBottom: Spacing.sm },
  chipRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.sm, borderRadius: BorderRadius.md, marginBottom: Spacing.xs },
  chipText: { fontSize: 14, flex: 1 },
  removeBtn: { fontSize: 13, fontWeight: '600' },
  addChipBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1, marginTop: Spacing.sm, alignSelf: 'flex-start' },
  addChipBtnText: { fontSize: 14, fontWeight: '600' },
  addFormRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.sm, flexWrap: 'wrap' },
  input: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.md, fontSize: 16, minWidth: 120 },
  inputShort: { minWidth: 70 },
  geoSection: { marginTop: Spacing.lg, paddingTop: Spacing.lg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(60,60,67,0.2)' },
  geoRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm, flexWrap: 'wrap' },
  secondaryBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1 },
  secondaryBtnText: { fontSize: 14, fontWeight: '600' },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg, borderRadius: BorderRadius.md },
  primaryBtnText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  dangerBtn: { paddingVertical: Spacing.sm, marginTop: Spacing.sm, borderRadius: BorderRadius.md, borderWidth: 1 },
  dangerBtnText: { fontSize: 14, fontWeight: '600' },
  cancelBtn: { fontSize: 14, fontWeight: '600', padding: Spacing.sm },
  deptActions: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg, flexWrap: 'wrap' },
  formCard: { padding: Spacing.lg, borderRadius: BorderRadius.xl, marginBottom: Spacing.lg },
  formLabel: { fontSize: 16, fontWeight: '600', marginBottom: Spacing.sm },
  emptyCard: { alignItems: 'center', padding: Spacing.xxl, borderRadius: BorderRadius.xl },
  emptyTitle: { fontSize: 18, fontWeight: '600', marginTop: Spacing.md, marginBottom: Spacing.lg },
  deptList: { gap: Spacing.md },
  deptCard: { padding: Spacing.lg, borderRadius: BorderRadius.xl },
  deptCardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: Spacing.md },
  deptName: { fontSize: 16, fontWeight: '600' },
  deptNote: { fontSize: 13, marginTop: 2 },
  defaultBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: 8 },
  defaultBadgeText: { fontSize: 12, fontWeight: '600' },
});
