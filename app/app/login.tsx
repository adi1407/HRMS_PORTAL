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
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AdiverseLogo } from '@/components/adiverse-logo';
import { Spacing, BorderRadius } from '@/constants/theme';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { useAppColors } from '@/hooks/use-app-theme';

export default function LoginScreen() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const colors = useAppColors();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    const e = email.trim();
    const p = password;
    if (!e || !p) {
      setError('Please enter email and password.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post<{
        accessToken?: string;
        refreshToken?: string;
        user?: Parameters<typeof setAuth>[0];
        data?: { user?: Parameters<typeof setAuth>[0]; accessToken?: string; refreshToken?: string };
      }>(
        '/auth/login',
        { email: e, password: p },
        { timeout: 120000 }
      );
      const user = data.user ?? data.data?.user;
      const accessToken = data.accessToken ?? data.data?.accessToken;
      const refreshToken = data.refreshToken ?? data.data?.refreshToken ?? null;
      if (!user || !accessToken) throw new Error('Invalid login response');
      await setAuth(user, accessToken, refreshToken);
      router.replace('/(tabs)');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } }; code?: string; message?: string };
      const msg =
        e?.response?.data?.message ||
        (e?.code === 'ECONNABORTED'
          ? 'Server took too long to respond (cold start or slow network). Try again, or check EXPO_PUBLIC_API_URL matches your LAN IP / Render URL.'
          : '') ||
        (e?.message?.includes('Network Error')
          ? 'Network error. Check WiFi, firewall, and EXPO_PUBLIC_API_URL in app .env (same network as your PC if using local API).'
          : '') ||
        'Login failed. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
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

          <Text style={[styles.footer, { color: colors.textSecondary }]}>Secure sign-in to your HRMS account</Text>
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
  footer: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: Spacing.xxl,
  },
});

