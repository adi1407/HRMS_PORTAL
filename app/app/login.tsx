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
import { AdiverseLogoHorizontal } from '@/components/adiverse-logo';
import { Spacing, BorderRadius, CardShadow, Brand } from '@/constants/theme';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { useAppColors, useAppTheme } from '@/hooks/use-app-theme';
import { API_BASE_URL } from '@/config/env';

const WAKE_MS = 120000;
const LOGIN_MS = 120000;
const LOGIN_ATTEMPTS = 3;
const RETRY_GAP_MS = 2500;

const DEMO_ACCOUNTS = [
  { role: 'Super Admin', email: 'admin@hrms.com', password: 'Admin@123' },
];

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export default function LoginScreen() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const colors = useAppColors();
  const theme = useAppTheme();
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
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
      <View style={[styles.heroBand, { backgroundColor: Brand.navy }]} />
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
            <AdiverseLogoHorizontal height={40} />
            <Text style={[styles.tagline, { color: colors.textSecondary }]}>
              Human Resource Management System
            </Text>
          </View>

          <View
            style={[
              styles.card,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
              CardShadow,
            ]}
          >
            <Text style={[styles.cardTitle, { color: colors.text }]}>Sign in</Text>
            <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>
              Use your work email and password
            </Text>

            <Text style={[styles.fieldLabel, { color: colors.textTertiary }]}>Email</Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.surfaceMuted,
                  color: colors.text,
                  borderColor: colors.border,
                },
              ]}
              placeholder="name@company.com"
              placeholderTextColor={colors.textTertiary}
              value={email}
              onChangeText={(t: string) => {
                setEmail(t);
                setError('');
              }}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              editable={!loading}
            />
            <Text style={[styles.fieldLabel, { color: colors.textTertiary }]}>Password</Text>
            <TextInput
              style={[
                styles.input,
                styles.inputLast,
                {
                  backgroundColor: colors.surfaceMuted,
                  color: colors.text,
                  borderColor: colors.border,
                },
              ]}
              placeholder="••••••••"
              placeholderTextColor={colors.textTertiary}
              value={password}
              onChangeText={(t: string) => {
                setPassword(t);
                setError('');
              }}
              secureTextEntry
              textContentType="password"
              editable={!loading}
            />
          </View>

          {error ? (
            <View style={[styles.errorBox, { backgroundColor: `${colors.destructive}14` }]}>
              <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.tint }, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
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

          <View style={[styles.demoBox, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <Text style={[styles.demoTitle, { color: colors.textTertiary }]}>Demo credentials</Text>
            {DEMO_ACCOUNTS.map((account) => (
              <TouchableOpacity
                key={account.email}
                style={[styles.demoCard, { borderColor: colors.border }]}
                onPress={() => {
                  setEmail(account.email);
                  setPassword(account.password);
                  setError('');
                }}
                disabled={loading}
                activeOpacity={0.8}
              >
                <Text style={[styles.demoRole, { color: colors.tint }]}>{account.role}</Text>
                <Text style={[styles.demoLine, { color: colors.text }]}>
                  Email: {account.email}
                </Text>
                <Text style={[styles.demoLine, { color: colors.text }]}>
                  Password: {account.password}
                </Text>
                <Text style={[styles.demoHint, { color: colors.textSecondary }]}>Tap to autofill</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.footer, { color: colors.textTertiary }]}>Secure sign-in to your HRMS account</Text>
          <Text style={[styles.devApiHint, { color: colors.textTertiary }]} selectable>
            Server: {API_BASE_URL}
            {__DEV__
              ? '\n(Local dev: change app/.env and restart Metro.)'
              : '\n(Baked into APK at build time from eas.json.)'}
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
  heroBand: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 160,
    opacity: 0.06,
  },
  keyboard: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.xxl,
    paddingTop: 48,
    paddingBottom: Spacing.section,
  },
  header: {
    alignItems: 'center',
    marginBottom: 36,
  },
  tagline: {
    fontSize: 14,
    marginTop: 14,
    textAlign: 'center',
    fontWeight: '500',
    letterSpacing: 0.1,
  },
  card: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    marginBottom: Spacing.xl,
    borderWidth: StyleSheet.hairlineWidth,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.4,
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 14,
    marginBottom: Spacing.xl,
    lineHeight: 20,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  input: {
    height: 50,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg,
    fontSize: 16,
    marginBottom: Spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
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
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
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
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  statusLine: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: Spacing.md,
    lineHeight: 18,
  },
  demoBox: {
    marginTop: Spacing.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
  },
  demoTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: Spacing.sm,
  },
  demoCard: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
  },
  demoRole: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  demoLine: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  demoHint: {
    fontSize: 11,
    marginTop: 6,
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
    opacity: 0.9,
  },
});
