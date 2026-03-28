import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import api from '@/lib/api';
import { Spacing, BorderRadius } from '@/constants/theme';
import { useAppColors, useAppTheme } from '@/hooks/use-app-theme';
import type { AssistantChatMessage } from '@/types/assistant';

export default function AssistantScreen() {
  const router = useRouter();
  const colors = useAppColors();
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const { height: winH } = useWindowDimensions();

  const [messages, setMessages] = useState<AssistantChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [suggested, setSuggested] = useState<string[]>([]);
  const [aiConfigured, setAiConfigured] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get<{ data?: { suggestedPrompts?: string[]; aiConfigured?: boolean } }>(
          '/assistant/meta'
        );
        if (cancelled) return;
        setSuggested(data?.data?.suggestedPrompts ?? []);
        setAiConfigured(!!data?.data?.aiConfigured);
      } catch {
        if (!cancelled) setSuggested([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || loading) return;

      setError('');
      const nextUser: AssistantChatMessage = { role: 'user', content: trimmed };
      const historyForApi = [...messages, nextUser].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      setMessages((prev) => [...prev, nextUser]);
      setInput('');
      setLoading(true);

      try {
        const { data } = await api.post<{ data?: { message?: string } }>('/assistant/chat', {
          messages: historyForApi,
        });
        const reply = data?.data?.message ?? '';
        setMessages((prev) => [...prev, { role: 'assistant', content: reply || 'No response.' }]);
      } catch (e: unknown) {
        const ax = e as { response?: { data?: { message?: string } }; message?: string };
        const msg =
          ax?.response?.data?.message ||
          ax?.message ||
          'Could not reach the assistant. Ensure OPENAI_API_KEY is set on the server.';
        setError(msg);
      } finally {
        setLoading(false);
      }
    },
    [loading, messages]
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
      <View style={[styles.header, { borderBottomColor: colors.textSecondary + '30' }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <MaterialIcons name="smart-toy" size={22} color={colors.tint} />
          <Text style={[styles.headerTitle, { color: colors.text }]}>HRMS Assistant</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {!aiConfigured && (
        <View style={[styles.banner, { backgroundColor: colors.textSecondary + '25' }]}>
          <Text style={[styles.bannerText, { color: colors.textSecondary }]}>
            Server missing OPENAI_API_KEY — configure it for AI answers.
          </Text>
        </View>
      )}

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { minHeight: Math.min(winH * 0.4, 320) }]}
          keyboardShouldPersistTaps="handled"
        >
          {suggested.length > 0 && messages.length === 0 && (
            <View style={styles.chips}>
              {suggested.map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[styles.chip, { borderColor: colors.textSecondary + '50', backgroundColor: colors.card }]}
                  onPress={() => send(s)}
                >
                  <Text style={[styles.chipText, { color: colors.text }]} numberOfLines={2}>
                    {s}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {messages.length === 0 && (
            <Text style={[styles.hint, { color: colors.textSecondary }]}>
              Ask about your leave, attendance, daily tasks, or profile. HR can ask for team attendance and leave
              overviews.
            </Text>
          )}

          {messages.map((m, i) => (
            <View
              key={i}
              style={[
                styles.bubble,
                m.role === 'user' ? { alignSelf: 'flex-end', backgroundColor: colors.tint + '22' } : { alignSelf: 'flex-start', backgroundColor: colors.card },
              ]}
            >
              <Text style={[styles.bubbleText, { color: colors.text }]}>{m.content}</Text>
            </View>
          ))}

          {loading && (
            <View style={[styles.bubble, { alignSelf: 'flex-start', backgroundColor: colors.card }]}>
              <ActivityIndicator color={colors.tint} />
            </View>
          )}

          {error ? (
            <Text style={[styles.err, { color: colors.destructive }]}>{error}</Text>
          ) : null}
        </ScrollView>

        <View style={[styles.inputRow, { borderTopColor: colors.textSecondary + '30', paddingBottom: Math.max(insets.bottom, Spacing.md) }]}>
          <TextInput
            style={[styles.input, { color: colors.text, borderColor: colors.textSecondary + '40', backgroundColor: colors.card }]}
            placeholder="Ask the assistant…"
            placeholderTextColor={colors.textSecondary}
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={4000}
            editable={!loading}
          />
          <TouchableOpacity
            style={[styles.sendBtn, { backgroundColor: colors.tint }, (!input.trim() || loading) && styles.sendBtnDisabled]}
            onPress={() => send(input)}
            disabled={!input.trim() || loading}
          >
            <MaterialIcons name="send" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { padding: Spacing.xs },
  headerTitleWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  banner: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm },
  bannerText: { fontSize: 12 },
  scroll: { flex: 1 },
  scrollContent: { padding: Spacing.lg, paddingBottom: Spacing.xl, gap: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: Spacing.md },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    maxWidth: '100%',
  },
  chipText: { fontSize: 13 },
  hint: { fontSize: 14, lineHeight: 20, marginBottom: Spacing.sm },
  bubble: {
    maxWidth: '92%',
    padding: 12,
    borderRadius: BorderRadius.lg,
  },
  bubbleText: { fontSize: 15, lineHeight: 22 },
  err: { fontSize: 13, marginTop: 4 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  sendBtn: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.45 },
});
