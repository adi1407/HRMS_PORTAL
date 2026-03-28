import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import axios from 'axios';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AdiverseLogo } from '@/components/adiverse-logo';
import { Spacing, BorderRadius } from '@/constants/theme';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { useAppColors } from '@/hooks/use-app-theme';
import { API_BASE_URL } from '@/config/env';

/** Wake Render / slow LAN before login; same timeout as a single slow cold start */
const WAKE_MS = 120000;
const LOGIN_MS = 120000;
const LOGIN_ATTEMPTS = 3;
const RETRY_GAP_MS = 2500;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export default function LoginScreen() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const colors = useAppColors();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [statusLine, setStatusLine] = useState('');

  const handleLogin = async () => {
    const e = email.trim().toLowerCase();
    const p = password;
    if (!e || !p) {
      setError('Please enter email and password.');
      return;
    }
    setError('');
    setStatusLine('');
    setLoading(true);
    try {
      // 1) Warm up cold Render / verify LAN path (ignore failure — some stacks block GET)
      setStatusLine('Connecting to server…');
      try {
        await api.get('/health', { timeout: WAKE_MS });
      } catch {
        /* still try login */
      }

      setStatusLine('Signing in…');

      let lastErr: unknown;
      for (let attempt = 1; attempt <= LOGIN_ATTEMPTS; attempt++) {
        try {
          const { data } = await api.post<{
            accessToken?: string;
            refreshToken?: string;
            user?: Parameters<typeof setAuth>[0];
            data?: { user?: Parameters<typeof setAuth>[0]; accessToken?: string; refreshToken?: string };
          }>('/auth/login', { email: e, password: p }, { timeout: LOGIN_MS });

          const user = data.user ?? data.data?.user;
          const accessToken = data.accessToken ?? data.data?.accessToken;
          const refreshToken = data.refreshToken ?? data.data?.refreshToken ?? null;
          if (!user || !accessToken) throw new Error('Invalid login response');
          await setAuth(user, accessToken, refreshToken);
          router.replace('/(tabs)');
          return;
        } catch (err: unknown) {
          lastErr = err;
          const ax = axios.isAxiosError(err) ? err : null;
          const hasResponse = !!(ax?.response);
          const timedOut =
            ax && (ax.code === 'ECONNABORTED' || /timeout/i.test(ax.message || ''));
          const networkNoResponse =
            ax && !hasResponse && (ax.message?.includes('Network Error') || ax.code === 'ERR_NETWORK');
          const canRetry =
            !hasResponse && (timedOut || networkNoResponse) && attempt < LOGIN_ATTEMPTS;
          if (canRetry) {
            setStatusLine(`Still connecting… try ${attempt + 1}/${LOGIN_ATTEMPTS}`);
            await sleep(RETRY_GAP_MS);
            continue;
          }
          throw err;
        }
      }
      throw lastErr;
    } catch (err: unknown) {
      const ax = axios.isAxiosError(err) ? err : null;
      const status = ax?.response?.status;
      const data = ax?.response?.data as { message?: string } | undefined;
      const serverMsg = typeof data?.message === 'string' ? data.message : '';
      const e = err as { response?: { data?: { message?: string } }; code?: string; message?: string };
      const baseFromServer = serverMsg || e?.response?.data?.message || '';
      const invalidCreds = status === 401 && /invalid email or password/i.test(baseFromServer);
      const credHint = invalidCreds
        ? '\n\nIf sign-in works on the web app but not here, your phone may be calling a different API than the site. Check the Server line below (local IP vs cloud) and match your backend.'
        : '';

      let msg: string;
      if (baseFromServer) {
        msg = `${baseFromServer}${credHint}`;
      } else if (e?.code === 'ECONNABORTED' || /timeout/i.test(e?.message || '')) {
        msg = `Still timed out after ${LOGIN_ATTEMPTS} tries. Check Server line below; local: PC IP + server running; Render: open ${API_BASE_URL}/api/health in browser first.`;
      } else if (e?.message?.includes('Network Error')) {
        msg = `Can't reach API at ${API_BASE_URL}. Open ${API_BASE_URL}/api/health in your phone browser — if it won't load, fix the URL or firewall.`;
      } else {
        msg = 'Login failed. Please try again.';
      }
      setError(msg);
    } finally {
      setLoading(false);
      setStatusLine('');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboard}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <AdiverseLogo size={72} />
            <View style={styles.brandText}>
              <Text style={[styles.brandName, { color: colors.text }]}>Adiverse</Text>
              <Text style={[styles.tagline, { color: colors.textSecondary }]}>Human Resource Management System</Text>
            </View>
          </View>

          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Sign in</Text>
            <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>Use your work email and password</Text>

            <TextInput
              style={[styles.input, { backgroundColor: `${colors.textSecondary}20`, color: colors.text }]}
              placeholder="Email"
              placeholderTextColor={colors.textSecondary}
              value={email}
              onChangeText={(t: string) => { setEmail(t); setError(''); }}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              editable={!loading}
            />
            <TextInput
              style={[styles.input, styles.inputLast, { backgroundColor: `${colors.textSecondary}20`, color: colors.text }]}
              placeholder="Password"
              placeholderTextColor={colors.textSecondary}
              value={password}
              onChangeText={(t: string) => { setPassword(t); setError(''); }}
              secureTextEntry
              textContentType="password"
              editable={!loading}
            />
          </View>

          {error ? (
            <View style={[styles.errorBox, { backgroundColor: `${colors.destructive}1F` }]}>
              <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.tint }, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.82}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonLabel}>Sign In</Text>
            )}
          </TouchableOpacity>

          {loading && statusLine ? (
            <Text style={[styles.statusLine, { color: colors.textSecondary }]}>{statusLine}</Text>
          ) : null}

          <Text style={[styles.footer, { color: colors.textSecondary }]}>Secure sign-in to your HRMS account</Text>
          <Text style={[styles.devApiHint, { color: colors.textSecondary }]} selectable>
            Server: {API_BASE_URL}
            {__DEV__ ? '\n(Local dev: change app/.env and restart Metro.)' : '\n(Baked into APK at build time from eas.json.)'}
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboard: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.xxl,
    paddingTop: 56,
    paddingBottom: Spacing.section,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  brandText: {
    alignItems: 'center',
    marginTop: 16,
  },
  brandName: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 15,
    marginTop: 4,
    textAlign: 'center',
  },
  card: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    marginBottom: Spacing.xl,
    ...(Platform.OS === 'android' ? { elevation: 2 } : {}),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 15,
    marginBottom: Spacing.xl,
  },
  input: {
    height: 52,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg,
    fontSize: 17,
    marginBottom: Spacing.md,
  },
  inputLast: {
    marginBottom: 0,
  },
  errorBox: {
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.lg,
  },
  errorText: {
    fontSize: 15,
    fontWeight: '500',
  },
  button: {
    height: 52,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonLabel: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
  statusLine: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: Spacing.md,
    lineHeight: 18,
  },
  footer: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: Spacing.xxl,
  },
  devApiHint: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: Spacing.md,
    lineHeight: 16,
    opacity: 0.85,
  },
});

