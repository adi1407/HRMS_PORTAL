import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

const REFRESH_KEY = 'hrms_refresh_token';

export type User = {
  _id: string;
  email: string;
  name: string;
  role: string;
  department?: { name: string };
  branch?: { name: string };
};

/** Decode role from JWT payload (access token includes userId + role). Use when user.role is missing. */
function getRoleFromToken(token: string | null): string {
  if (!token || typeof token !== 'string') return '';
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return '';
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const decoded =
      typeof atob !== 'undefined'
        ? atob(base64)
        : (globalThis as unknown as { Buffer?: { from: (s: string, enc: string) => { toString: () => string } } }).Buffer?.from?.(base64, 'base64')?.toString() ?? '';
    const payload = JSON.parse(decoded) as { role?: string };
    return (payload.role ?? '').toString().trim().toUpperCase();
  } catch {
    return '';
  }
}

export function getEffectiveRole(user: User | null, accessToken: string | null): string {
  const fromUser = (user?.role ?? (user as Record<string, unknown>)?.userRole ?? (user as Record<string, unknown>)?.roleName ?? '')
    .toString()
    .trim()
    .toUpperCase();
  if (fromUser) return fromUser;
  return getRoleFromToken(accessToken);
}

type AuthState = {
  user: User | null;
  accessToken: string | null;
  isHydrated: boolean;
  setAuth: (user: User | null, accessToken: string | null, refreshToken?: string | null) => Promise<void>;
  setHydrated: () => void;
  clearAuth: () => Promise<void>;
  getStoredRefreshToken: () => Promise<string | null>;
  getRole: () => string;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  isHydrated: false,

  setAuth: async (user, accessToken, refreshToken) => {
    if (refreshToken != null) {
      await SecureStore.setItemAsync(REFRESH_KEY, refreshToken);
    }
    const rawRole = user?.role ?? (user as Record<string, unknown>)?.userRole ?? (user as Record<string, unknown>)?.roleName ?? '';
    const normalizedRole = rawRole.toString().trim().toUpperCase()
      || (accessToken ? getRoleFromToken(accessToken) : '');
    const normalizedUser = user
      ? { ...user, role: normalizedRole || (user.role ?? '') }
      : null;
    set({ user: normalizedUser, accessToken });
  },

  getRole: () => getEffectiveRole(get().user, get().accessToken),

  setHydrated: () => set({ isHydrated: true }),


  clearAuth: async () => {
    try {
      await SecureStore.deleteItemAsync(REFRESH_KEY);
    } catch {}
    set({ user: null, accessToken: null });
  },

  getStoredRefreshToken: async () => {
    try {
      return await SecureStore.getItemAsync(REFRESH_KEY);
    } catch {
      return null;
    }
  },
}));
